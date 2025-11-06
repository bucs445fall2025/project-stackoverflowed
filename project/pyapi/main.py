from http.client import HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import httpx, asyncio, os, re, random, difflib
from rapidfuzz import fuzz
from urllib.parse import quote_plus #used for building walmart links

# ──────────────────────────────────────────────────────────────────────────────
# Setup
# ──────────────────────────────────────────────────────────────────────────────
app = FastAPI(title="Walmart vs Amazon Deals (UPC-first)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
SERPAPI_KEY = os.getenv("SERPAPI_KEY")
MONGO_URL   = os.getenv("MONGO_URL")
MONGO_DB    = os.getenv("MONGO_DB", "MongoDB")

if not MONGO_URL:
    raise RuntimeError("MONGO_URL env var is required")

client = AsyncIOMotorClient(MONGO_URL)
db = client[MONGO_DB]

class WalmartScrapeReq(BaseModel):
    query: str
    pages: int = Field(1, ge=1, le=10)
    max_products: int = 100

class IndexAmazonByTitleReq(BaseModel):
    category: Optional[str] = None          # optional Walmart category filter
    kw: Optional[str] = None                # optional title keyword filter
    limit_items: int = 400                  # how many Walmart items to consider
    recache_hours: int = 48                 # skip re-fetching recent cache
    max_serp_calls: int = 200               # hard cap on SerpAPI calls this run
    min_similarity: int = 86                # RapidFuzz token_set_ratio threshold (0..100)
    require_brand: bool = True              # if Walmart brand is known, require the brand to appear in Amazon title
    per_call_delay_ms: int = 350            # throttle to avoid SerpAPI 429s

PRICE_RE = re.compile(r"(\d+(?:\.\d{1,2})?)")
STOPWORDS = {"with","and","the","for","in","of","to","by","on","oz","fl","ct","pack","count","lb","lbs","ounce","ounces"}
SIZE_RE = re.compile(
    r"(?:(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds|oz|ounce|ounces|kg|g|gram|grams|ml|l|liter|liters))"
    r"|(?:pack\s*of\s*(\d+)|(\d+)\s*ct|\b(\d+)-?pack\b)",
    re.I,
)

# ──────────────────────────────────────────────────────────────────────────────
# Utils
# ──────────────────────────────────────────────────────────────────────────────
def now_utc() -> datetime: return datetime.now(timezone.utc)

def parse_price(v) -> Optional[float]:
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    if isinstance(v, dict):
        for k in ("value","raw","price","extracted"):
            if k in v: return parse_price(v[k])
    s = str(v).replace(",","")
    m = PRICE_RE.search(s)
    return float(m.group(1)) if m else None

async def serp_get(url: str, q: dict):
    if not SERPAPI_KEY:
        raise HTTPException(500, "SERPAPI_KEY not set")

    # help avoid stale cache (optional)
    q = {**q, "api_key": SERPAPI_KEY, "no_cache": "true"}

    # generous timeouts + retries with jitter
    timeout = httpx.Timeout(connect=20.0, read=45.0, write=20.0, pool=20.0)

    async with httpx.AsyncClient(timeout=timeout) as c:
        last_err = None
        for attempt in range(5):  # up to 5 tries
            try:
                r = await c.get(url, params=q)
                # propagate 4xx/5xx but keep the body for debugging
                if r.status_code >= 400:
                    detail = None
                    try:
                        detail = r.json()
                    except Exception:
                        detail = {"text": r.text}
                    # 429 from SerpAPI => backoff and retry (unless last try)
                    if r.status_code == 429 and attempt < 4:
                        await asyncio.sleep(1.5 * (2 ** attempt) + random.random())
                        continue
                    raise HTTPException(status_code=r.status_code, detail=detail)
                return r.json()

            except httpx.ReadTimeout as e:
                last_err = e
                if attempt < 4:
                    # exponential backoff with jitter
                    await asyncio.sleep(0.8 * (2 ** attempt) + random.random())
                    continue
                # final attempt failed → surface as 504
                raise HTTPException(status_code=504, detail="SerpAPI request timed out") from e
            except (httpx.ConnectError, httpx.RemoteProtocolError) as e:
                last_err = e
                if attempt < 4:
                    await asyncio.sleep(0.6 * (2 ** attempt) + random.random())
                    continue
                raise HTTPException(status_code=502, detail="Network error calling SerpAPI") from e

        # should not reach here, but just in case:
        raise HTTPException(status_code=502, detail=str(last_err) if last_err else "Unknown SerpAPI error")


# ---- Amazon result hygiene ----
def norm(s: str) -> str:
    if not s: return ""
    s = re.sub(r"[^a-z0-9 ]+", " ", s.lower())
    toks = [t for t in s.split() if t and t not in STOPWORDS]
    return " ".join(toks)

def _to_grams(val: float, unit: str) -> Optional[float]:
    u = unit.lower()
    if u in {"lb","lbs","pound","pounds"}: return val * 453.59237
    if u in {"oz","ounce","ounces"}:       return val * 28.349523125
    if u in {"kg"}:                         return val * 1000.0
    if u in {"g","gram","grams"}:           return val
    if u in {"ml"}:                         return val
    if u in {"l","liter","liters"}:        return val * 1000.0
    return None

def extract_size_and_count(title: str) -> Dict[str, Optional[float]]:
    grams = None
    count = 1
    if not title: return {"grams": None, "count": 1}
    for m in SIZE_RE.finditer(title):
        qty, unit, pack_of, ct_alt, pack_alt = m.groups()
        if qty and unit:
            g = _to_grams(float(qty), unit)
            if g: grams = max(grams or 0, g)
        for v in (pack_of, ct_alt, pack_alt):
            if v and v.isdigit():
                count = max(count, int(v))
    return {"grams": grams, "count": count}

def sizes_compatible(wm_title: str, amz_title: str, threshold: float = 0.85) -> bool:
    wm = extract_size_and_count(wm_title); am = extract_size_and_count(amz_title)
    if not wm["grams"] or not am["grams"]:
        return True  # if we can't parse, don't block—use score/brand
    wm_total = wm["grams"] * max(1, wm["count"])
    am_total = am["grams"] * max(1, am["count"])
    ratio = min(wm_total, am_total) / max(wm_total, am_total)
    return ratio >= threshold

# ──────────────────────────────────────────────────────────────────────────────
# Walmart ingest
# ──────────────────────────────────────────────────────────────────────────────
async def walmart_search_page(query: str, page: int = 1):
    return await serp_get(
        "https://serpapi.com/search.json",
        {
            "engine": "walmart",
            "query": query,
            "page": page,
            "hl": "en",
            "gl": "us",
            # "store_id": "optional-store-id",  # if you want local results later
            "no_cache": "true",
        },
    )

def _norm_brand(b: Optional[str]) -> Optional[str]:
    if not b:
        return None
    b = re.sub(r"[^a-z0-9]+", " ", b.lower()).strip()
    return b or None

def _brand_in_title(brand: Optional[str], title: Optional[str]) -> bool:
    if not brand or not title:
        return False
    b = _norm_brand(brand)
    t = re.sub(r"[^a-z0-9]+", " ", title.lower())
    if not b:
        return False
    # loose contains and token match
    return b in t or any(tok and tok in t for tok in b.split())

def _pick_best_amz_by_title(
    wm_title: str,
    amz_candidates: List[Dict[str, Any]],
    *,
    wm_brand: Optional[str],
    min_similarity: int,
    require_brand: bool
) -> Optional[Dict[str, Any]]:
    """
    Choose the best Amazon result using RapidFuzz token_set_ratio.
    Optionally require that the Walmart brand appears in the Amazon title.
    """
    best: Optional[Dict[str, Any]] = None
    best_score = -1

    for it in amz_candidates or []:
        # normalize + price
        title = it.get("title") or ""
        price_num = parse_price(it.get("price"))
        if not title or price_num is None:
            continue

        sim = fuzz.token_set_ratio(wm_title, title)
        if sim < min_similarity:
            continue

        if require_brand and wm_brand:
            if not _brand_in_title(wm_brand, title):
                continue

        # favor non-sponsored a bit, and slightly favor shorter titles
        sponsored = str(it.get("badge") or it.get("sponsored") or "").lower().find("sponsor") >= 0
        adj = sim - (3 if sponsored else 0) + (2 if len(title) < 140 else 0)

        if adj > best_score:
            best_score = adj
            best = {
                "asin": it.get("asin"),
                "title": title,
                "link": it.get("link") or it.get("product_link"),
                "price_num": price_num,
                "raw_badge": it.get("badge"),
                "sim": sim,
            }

    return best


@app.post("/walmart/scrape")
async def walmart_scrape(req: WalmartScrapeReq, wm_coll: Optional[str] = Query(None)):
    WM = db[wm_coll]
    inserted = updated = total = 0
    pages_fetched = 0
    page_errors = 0

    for pg in range(1, req.pages + 1):
        if total >= req.max_products:
            break

        try:
            data = await walmart_search_page(req.query, page=pg)
            items = data.get("organic_results", []) or []
            pages_fetched += 1
        except HTTPException as e:
            # record and continue to next page instead of 500-ing
            page_errors += 1
            # brief pause in case of rate limiting
            await asyncio.sleep(1.0 + random.random())
            continue

        for it in items:
            if total >= req.max_products:
                break

            pid = it.get("product_id")
            if not pid:
                continue

            po = it.get("primary_offer") or {}
            price = parse_price(po.get("offer_price") or po.get("price") or it.get("price"))
            if price is None:
                continue

            # 🔹 Build a robust link with fallbacks
            raw_link = it.get("link")  # what we were relying on before
            title = it.get("title") or ""

            if not raw_link:
                # If we know the product_id, construct the canonical Walmart PDP URL
                raw_link = f"https://www.walmart.com/ip/{pid}"

            # Last-resort safety net: search URL by title (only if pid somehow missing)
            if not raw_link and title:
                raw_link = f"https://www.walmart.com/search?q={quote_plus(title)}"

            doc = {
                "product_id": str(pid),
                "title": title,
                "brand": it.get("brand"),
                "price": price,
                "link": raw_link,
                "thumbnail": it.get("thumbnail"),
                "category": it.get("category"),
                "updatedAt": now_utc(),
            }

            res = await WM.update_one(
                {"product_id": str(pid)},
                {"$set": doc, "$setOnInsert": {"createdAt": now_utc()}},
                upsert=True,
            )

        # small delay between pages to avoid bursts/429s
        await asyncio.sleep(0.4 + random.random() * 0.3)

    return {
        "query": req.query,
        "pages_requested": req.pages,
        "pages_fetched": pages_fetched,
        "page_errors": page_errors,
        "inserted": inserted,
        "updated": updated,
        "total": total,
    }


@app.post("/amazon/index-by-title")
async def index_amazon_by_title(
    req: IndexAmazonByTitleReq,
    wm_coll: Optional[str] = Query(None),
    amz_coll: Optional[str] = Query(None),
):
    if not SERPAPI_KEY:
        raise HTTPException(500, "SERPAPI_KEY not set")

    wm_db = db[wm_coll]
    amz_db = db[amz_coll]

    match: Dict[str, Any] = {"title": {"$exists": True, "$ne": None}}
    if req.kw:
        match["title"] = {"$regex": req.kw, "$options": "i"}

    cutoff = datetime.utcnow() - timedelta(hours=req.recache_hours)

    wm_candidates = await wm_db.find(
        match,
        {"_id": 0, "product_id": 1, "title": 1, "brand": 1, "price": 1, "updatedAt": 1},
    ).sort([("updatedAt", -1)]).limit(req.limit_items).to_list(req.limit_items)


    # Filter out those with fresh cache
    to_fetch: List[Dict[str, Any]] = []
    for it in wm_candidates:
        pid = str(it.get("product_id") or "")
        if not pid:
            continue
        cached = await amz_db.find_one(
            {"key_type": "wm_pid", "key_val": pid, "checked_at": {"$gte": cutoff}},
            {"_id": 1}
        )
        if not cached:
            to_fetch.append(it)

    # Respect SERP cap
    to_fetch = to_fetch[: max(0, req.max_serp_calls)]

    fetched_now = 0
    misses = 0
    below_threshold = 0
    skipped_no_pid = 0

    for it in to_fetch:
        pid = str(it.get("product_id") or "")
        if not pid:
            skipped_no_pid += 1
            continue

        wm_title = it.get("title") or ""
        wm_brand  = it.get("brand")

        # Amazon search via SerpAPI (use `k`, not `q`)
        try:
            data = await serp_get(
                "https://serpapi.com/search.json",
                {
                    "engine": "amazon",
                    "amazon_domain": "amazon.com",
                    "k": wm_title if not wm_brand else f"{wm_brand} {wm_title}",
                    "gl": "us",
                    "hl": "en",
                },
            )
        except HTTPException as e:
            # Record a miss so we don’t hammer the same pid repeatedly
            await amz_db.update_one(
                {"key_type": "wm_pid", "key_val": pid},
                {"$set": {
                    "key_type": "wm_pid",
                    "key_val": pid,
                    "checked_at": datetime.utcnow(),
                    "miss": True,
                    "err": f"serpapi:{e.status_code}"
                }},
                upsert=True,
            )
            misses += 1
            await asyncio.sleep(req.per_call_delay_ms / 1000.0)
            continue

        candidates = data.get("organic_results") or []
        best = _pick_best_amz_by_title(
            wm_title,
            candidates,
            wm_brand=wm_brand,
            min_similarity=req.min_similarity,
            require_brand=req.require_brand,
        )

        if not best:
            # Either truly no result, or all below threshold/brand mismatch
            await amz_db.update_one(
                {"key_type": "wm_pid", "key_val": pid},
                {"$set": {
                    "key_type": "wm_pid",
                    "key_val": pid,
                    "checked_at": datetime.utcnow(),
                    "miss": True,
                    "last_title": wm_title,
                    "last_brand": wm_brand,
                }},
                upsert=True,
            )
            misses += 1
        else:
            # Write a normalized cache document
            doc = {
                "key_type": "wm_pid",
                "key_val": pid,
                "amz": {
                    "asin": best.get("asin"),
                    "title": best.get("title"),
                    "link": best.get("link"),
                    "match_score_sim": best.get("sim"),  # 0..100 RapidFuzz token_set_ratio
                    "brand_required": bool(req.require_brand and wm_brand),
                },
                "price": best.get("price_num"),
                "checked_at": datetime.utcnow(),
                "last_title": wm_title,
                "last_brand": wm_brand,
            }
            await amz_db.update_one(
                {"key_type": "wm_pid", "key_val": pid},
                {"$set": doc},
                upsert=True,
            )
            fetched_now += 1

        # throttle to avoid 429
        await asyncio.sleep(req.per_call_delay_ms / 1000.0)

    return {
        "considered": len(wm_candidates),
        "queued": len(to_fetch),
        "fetched_now": fetched_now,
        "misses": misses,
        "skipped_no_pid": skipped_no_pid,
        "threshold": req.min_similarity,
        "brand_required": req.require_brand,
        "recache_hours": req.recache_hours,
    }

@app.get("/deals/by-title")
async def deals_by_title(
    min_abs: float = 5.0,
    min_pct: float = 0.20,
    min_sim: int = 86,
    limit: int = 100,
    wm_coll: Optional[str] = Query(None),
    amz_coll: Optional[str] = Query(None),
):
    wm_db = db[wm_coll]
    amz_db = db[amz_coll]

    wm_items = await wm_db.find({}).to_list(length=limit * 5)
    deals = []
    for wm in wm_items:
        wm_price = parse_price(wm.get("price"))
        if not wm_price:
            continue
        pid = str(wm.get("product_id") or "")
        if not pid:
            continue
        amz_cache = await amz_db.find_one({"key_type": "wm_pid", "key_val": pid})
        if not amz_cache:
            continue
        amz_price = parse_price(amz_cache.get("price"))
        amz_meta = amz_cache.get("amz") or {}
        sim_score = amz_meta.get("match_score_sim") or 0
        if not amz_price or sim_score < min_sim:
            continue
        diff = amz_price - wm_price
        pct = diff / amz_price if amz_price > 0 else 0
        if diff >= min_abs and pct >= min_pct:
            deals.append({
                "wm": {"title": wm.get("title"), "price": wm_price, "link": wm.get("link"), "thumbnail": wm.get("thumbnail")},
                "amz": {"title": amz_meta.get("title"), "price": amz_price, "link": amz_meta.get("link"), "sim": sim_score},
                "savings_abs": diff, "savings_pct": round(pct * 100, 2),
            })
        if len(deals) >= limit:
            break
    deals.sort(key=lambda d: d["savings_abs"], reverse=True)
    return {"count": len(deals), "deals": deals[:limit]}