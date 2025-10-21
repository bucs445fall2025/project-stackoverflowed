# main.py — Hybrid: UPC-first Amazon lookups, category scrape for Walmart
# Flow:
#   1. Scrape Walmart (category/keyword)
#   2. Enrich with UPCs
#   3. For each unique UPC, fetch Amazon PDP once and cache it
#   4. Match Walmart vs Amazon by UPC first, fuzzy-title fallback

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone, timedelta
import httpx, asyncio, os, re, random, difflib
from rapidfuzz import fuzz

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
WM_COLL     = os.getenv("MONGO_WALMART_COLLECTION", "walmart_items")
AMZ_COLL    = os.getenv("MONGO_AMAZON_COLLECTION", "amazon_offers")

if not MONGO_URL:
    raise RuntimeError("MONGO_URL env var is required")

client = AsyncIOMotorClient(MONGO_URL)
db = client[MONGO_DB]

# ──────────────────────────────────────────────────────────────────────────────
# Startup
# ──────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def _startup_indexes():
    await db[WM_COLL].create_index("product_id", unique=True, sparse=True)
    await db[WM_COLL].create_index("upc", sparse=True)
    await db[WM_COLL].create_index([("updatedAt",-1)])
    await db[AMZ_COLL].create_index([("key_type",1),("key_val",1)], unique=True)
    await db[AMZ_COLL].create_index([("checked_at",-1)])

# ──────────────────────────────────────────────────────────────────────────────
# Utils
# ──────────────────────────────────────────────────────────────────────────────
def now_utc() -> datetime: return datetime.now(timezone.utc)
def now_iso() -> str: return now_utc().isoformat()
PRICE_RE = re.compile(r"(\d+(?:\.\d{1,2})?)")

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
    q["api_key"] = SERPAPI_KEY
    timeout = httpx.Timeout(30.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.get(url, params=q)
        if r.status_code >= 400:
            raise HTTPException(r.status_code, detail=r.text)
        return r.json()

def normalize_upc(gtin: Optional[str]) -> Optional[str]:
    if not gtin: return None
    s = re.sub(r"\D","", str(gtin))
    if len(s)==13 and s.startswith("0"): return s[1:]
    if len(s)==12: return s
    return None

# ---- Amazon result hygiene ----
def is_valid_amz_result(it: dict) -> bool:
    link = (it.get("link") or "")
    asin = it.get("asin")
    title = (it.get("title") or "")
    # Drop sponsored/redirect/ad and non-PDP
    if "sspa/click" in link:    # sponsored
        return False
    if "/dp/" not in link:      # prefer canonical PDP
        return False
    if not asin:
        return False
    return len(title.strip()) >= 5

STOPWORDS = {"with","and","the","for","in","of","to","by","on","oz","fl","ct","pack","count","lb","lbs","ounce","ounces"}

def norm(s: str) -> str:
    if not s: return ""
    s = re.sub(r"[^a-z0-9 ]+", " ", s.lower())
    toks = [t for t in s.split() if t and t not in STOPWORDS]
    return " ".join(toks)

SIZE_RE = re.compile(
    r"(?:(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds|oz|ounce|ounces|kg|g|gram|grams|ml|l|liter|liters))"
    r"|(?:pack\s*of\s*(\d+)|(\d+)\s*ct|\b(\d+)-?pack\b)",
    re.I,
)

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

def brand_ok(wm_brand: Optional[str], amz_title: str) -> bool:
    if not wm_brand: return True
    wb = re.sub(r"[^a-z0-9]+","", wm_brand.lower())
    at = re.sub(r"[^a-z0-9]+","", (amz_title or "").lower())
    return len(wb) >= 3 and wb in at

def title_score(wm_title: str, amz_title: str, brand: Optional[str]=None) -> float:
    base = difflib.SequenceMatcher(None, norm(wm_title), norm(amz_title)).ratio()
    if brand and brand.lower() in (amz_title or "").lower():
        base += 0.05
    return max(0.0, min(base, 1.0))

AMZ_SSP_PAT = "sspa/click"

def clean_amz_link(asin: Optional[str], link: Optional[str]) -> Optional[str]:
    """
    Prefer a canonical dp link if we have an ASIN. Also reject sponsored redirect links.
    """
    if asin:
        return f"https://www.amazon.com/dp/{asin}"
    if link and AMZ_SSP_PAT not in link:
        return link
    return None

def brand_norm(s: Optional[str]) -> str:
    return re.sub(r"[^a-z0-9]+", "", (s or "").lower())

def title_sim(a: str, b: str) -> float:
    """
    RapidFuzz token_set_ratio gives robust order/dup handling (0–100).
    """
    return float(fuzz.token_set_ratio(a or "", b or ""))


# ──────────────────────────────────────────────────────────────────────────────
# Walmart ingest
# ──────────────────────────────────────────────────────────────────────────────
async def walmart_search_page(query: str, page: int=1):
    return await serp_get("https://serpapi.com/search.json", {
        "engine":"walmart", "query":query, "page":page, "hl":"en", "gl":"us"
    })

class WalmartScrapeReq(BaseModel):
    query: str
    pages: int = Field(1, ge=1, le=10)
    max_products: int = 100

@app.post("/walmart/scrape")
async def walmart_scrape(req: WalmartScrapeReq):
    inserted, updated, total = 0,0,0
    for pg in range(1, req.pages+1):
        if total >= req.max_products: break
        data = await walmart_search_page(req.query, page=pg)
        items = data.get("organic_results", [])
        for it in items:
            pid = it.get("product_id")
            if not pid: continue
            po = it.get("primary_offer") or {}
            price = parse_price(po.get("offer_price") or po.get("price") or it.get("price"))
            if price is None: continue
            doc = {
                "product_id": str(pid),
                "title": it.get("title"),
                "brand": it.get("brand"),
                "price": price,
                "link": it.get("link"),
                "thumbnail": it.get("thumbnail"),
                "category": it.get("category"),
                "updatedAt": now_utc(),
            }
            res = await db[WM_COLL].update_one(
                {"product_id": str(pid)},
                {"$set": doc, "$setOnInsert": {"createdAt": now_utc()}},
                upsert=True
            )
            if res.upserted_id: inserted+=1
            else: updated+=res.modified_count
            total+=1
    return {"inserted":inserted,"updated":updated,"total":total}

# ──────────────────────────────────────────────────────────────────────────────
# Walmart UPC enrichment
# ──────────────────────────────────────────────────────────────────────────────
async def walmart_product_details(product_id: str):
    data = await serp_get("https://serpapi.com/search.json", {
        "engine":"walmart_product","product_id":product_id
    })
    return data.get("product_result")

@app.post("/walmart/enrich-upc")
async def walmart_enrich_upc(limit: int = 100):
    """
    Enrich recent Walmart items by calling walmart_product:
      - Try to set: upc (or gtin), brand, category, link
      - Works even if UPC is absent; we still fill brand/category/link
    """
    # Prefer items that are missing ANY of these fields
    filt = {
        "$or": [
            {"upc": {"$exists": False}},
            {"brand": {"$in": [None, ""]}},
            {"category": {"$in": [None, ""]}},
            {"link": {"$in": [None, ""]}},
        ]
    }

    projection = {"_id": 1, "product_id": 1, "upc": 1, "brand": 1, "category": 1, "link": 1}
    cur = db[WM_COLL].find(filt, projection).sort([("updatedAt", -1)]).limit(limit)
    docs = await cur.to_list(length=limit)

    upc_set = brand_set = cat_set = link_set = 0
    touched = 0

    for d in docs:
        pid = d.get("product_id")
        if not pid:
            continue
        try:
            pr = await walmart_product_details(str(pid))  # SerpAPI walmart_product
            if not pr:
                continue

            update = {}

            # UPC/GTIN
            raw_upc = pr.get("upc") or pr.get("gtin") or pr.get("gtin13") or pr.get("gtin12")
            upc = normalize_upc(raw_upc)
            if upc and not d.get("upc"):
                update["upc"] = upc
                update["gtin_raw"] = raw_upc
                upc_set += 1

            # Brand
            pr_brand = pr.get("brand") or pr.get("brand_name")
            if pr_brand and not d.get("brand"):
                update["brand"] = pr_brand
                brand_set += 1

            # Category (best-effort)
            pr_cat = pr.get("category_path") or pr.get("category")
            if pr_cat and not d.get("category"):
                update["category"] = pr_cat
                cat_set += 1

            # Canonical link
            pr_link = pr.get("product_page_url") or pr.get("link")
            if pr_link and not d.get("link"):
                update["link"] = pr_link
                link_set += 1

            if update:
                update["updatedAt"] = datetime.utcnow()
                await db[WM_COLL].update_one({"_id": d["_id"]}, {"$set": update})
                touched += 1

        except Exception:
            # ignore per-item errors but keep going
            pass
        finally:
            await asyncio.sleep(0.35)  # avoid SerpAPI 429s

    return {
        "considered": len(docs),
        "updated": touched,
        "set_fields": {"upc": upc_set, "brand": brand_set, "category": cat_set, "link": link_set},
    }


# ──────────────────────────────────────────────────────────────────────────────
# Walmart: list items (debug/FE consumption)
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/walmart/items")
async def walmart_items(
    limit: int = Query(30, ge=1, le=500),
    have_upc: Optional[bool] = Query(None, description="Filter: only items with UPC (true) or without (false)"),
    q: Optional[str] = Query(None, description="Case-insensitive substring in title"),
):
    filt: Dict[str, Any] = {}
    if have_upc is True:
        filt["upc"] = {"$exists": True}
    elif have_upc is False:
        filt["$or"] = [{"upc": {"$exists": False}}, {"upc": None}, {"upc": ""}]

    if q:
        filt["title"] = {"$regex": q, "$options": "i"}

    # projection keeps payload light and matches your frontend usage
    projection = {
        "_id": 0,
        "product_id": 1,
        "title": 1,
        "brand": 1,
        "price": 1,
        "link": 1,
        "thumbnail": 1,
        "rating": 1,
        "reviews": 1,
        "category": 1,
        "upc": 1,
        "updatedAt": 1,
    }

    cur = db[WM_COLL].find(filt, projection).sort([("updatedAt", -1)]).limit(limit)
    items = await cur.to_list(length=limit)
    return {"items": items}

# TO CLEAR THE DATABASE 
@app.delete("/debug/clear-db")
async def clear_db():
    wm_res = await db[WM_COLL].delete_many({})
    amz_res = await db[AMZ_COLL].delete_many({})
    return {
        "walmart_deleted": wm_res.deleted_count,
        "amazon_deleted": amz_res.deleted_count,
    }


# ──────────────────────────────────────────────────────────────────────────────
# Amazon cache by UPC
# ──────────────────────────────────────────────────────────────────────────────
async def serp_amazon_by_upc(upc: str) -> Optional[Dict[str,Any]]:
    data = await serp_get("https://serpapi.com/search.json", {
        "engine":"amazon", "amazon_domain":"amazon.com", "k":upc, "gl":"us", "hl":"en"
    })

    best = None
    best_price = None
    # Prefer organic (non-sponsored) and items that actually have price + asin
    for it in data.get("organic_results", []):
        if not it: 
            continue
        price = parse_price(it.get("price"))
        asin  = it.get("asin")
        link  = it.get("link")
        if price is None or not asin:
            continue
        # kill sspa redirects; construct clean dp link
        link = clean_amz_link(asin, link)
        if not link:
            continue

        # first good one wins for UPC (usually exact)
        best = {
            "asin": asin,
            "title": it.get("title") or "",
            "brand": it.get("brand"),
            "link": link,
            "price_num": price,
        }
        best_price = price
        break

    return best


async def serp_amazon_by_title(title: str, brand: Optional[str], min_accept_score: float = 0.80) -> Optional[Dict[str, Any]]:
    q = f"{brand} {title}" if brand else title
    data = await serp_get("https://serpapi.com/search.json", {
        "engine": "amazon", "amazon_domain":"amazon.com", "k": q, "gl":"us", "hl":"en"
    })
    best, best_s, best_p = None, -1.0, None
    for it in data.get("organic_results", []):
        if not is_valid_amz_result(it):
            continue
        p = parse_price(it.get("price"))
        if p is None:
            continue
        s = title_score(title, it.get("title") or "", brand)
        if s > best_s:
            best, best_s, best_p = it, s, p
    if not best:
        return None
    # Strict acceptance
    if best_s < min_accept_score:
        return None
    if not brand_ok(brand, best.get("title") or ""):
        return None
    if not sizes_compatible(title, best.get("title") or ""):
        return None
    best["price_num"] = best_p
    best["match_score"] = round(best_s, 3)
    return best


@app.post("/amazon/index-upc")
async def index_amazon_by_upc(limit:int=200, recache_hours:int=48):
    cutoff = datetime.utcnow()-timedelta(hours=recache_hours)
    cur = db[WM_COLL].find({"upc":{"$exists":True}})
    docs = await cur.to_list(length=limit)
    fetched,misses=0,0
    for d in docs:
        upc = d.get("upc"); pid=d.get("product_id")
        if not upc: continue
        cached = await db[AMZ_COLL].find_one(
            {"key_type":"upc","key_val":upc,"checked_at":{"$gte":cutoff}}
        )
        if cached: continue
        try:
            amz = await serp_amazon_by_upc(upc)
            if not amz:
                misses+=1; continue
            doc = {
                "key_type":"upc","key_val":upc,
                "wm_pid": pid,
                "amz": {
                    "asin": amz.get("asin"),
                    "title": amz.get("title"),
                    "link": amz.get("link"),
                },
                "price": amz.get("price_num"),
                "checked_at": datetime.utcnow()
            }
            await db[AMZ_COLL].update_one({"key_type":"upc","key_val":upc},{"$set":doc},upsert=True)
            fetched+=1
        except: misses+=1
        await asyncio.sleep(0.4)
    return {"considered":len(docs),"fetched":fetched,"misses":misses}


class IndexAmazonByTitleReq(BaseModel):
    category: Optional[str] = None          # optional Walmart category filter
    kw: Optional[str] = None                # optional title keyword filter
    limit_items: int = 400                  # how many Walmart items to consider
    recache_hours: int = 48                 # skip re-fetching recent cache
    max_serp_calls: int = 200               # hard cap on SerpAPI calls this run
    min_similarity: int = 86                # RapidFuzz token_set_ratio threshold (0..100)
    require_brand: bool = True              # if Walmart brand is known, require the brand to appear in Amazon title
    per_call_delay_ms: int = 350            # throttle to avoid SerpAPI 429s

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

@app.post("/amazon/index-by-title")
async def index_amazon_by_title(req: IndexAmazonByTitleReq):
    """
    Build/refresh the Amazon cache by fuzzy title/brand for Walmart items using SerpAPI.
    Caches one Amazon offer per Walmart product_id under key_type="wm_pid".
    """
    if not SERPAPI_KEY:
        raise HTTPException(500, "SERPAPI_KEY not set")

    # Walmart candidate filter
    match: Dict[str, Any] = {"title": {"$exists": True, "$ne": None}}
    if req.category:
        match["category"] = req.category
    if req.kw:
        match["title"] = {"$regex": req.kw, "$options": "i"}

    cutoff = datetime.utcnow() - timedelta(hours=req.recache_hours)

    # Pull recent Walmart items
    wm_candidates = await db[WM_COLL].find(
        match,
        {"_id": 0, "product_id": 1, "title": 1, "brand": 1, "price": 1, "updatedAt": 1},
    ).sort([("updatedAt", -1)]).limit(req.limit_items).to_list(req.limit_items)

    # Filter out those with fresh cache
    to_fetch: List[Dict[str, Any]] = []
    for it in wm_candidates:
        pid = str(it.get("product_id") or "")
        if not pid:
            continue
        cached = await db[AMZ_COLL].find_one(
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
            await db[AMZ_COLL].update_one(
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
            await db[AMZ_COLL].update_one(
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
            await db[AMZ_COLL].update_one(
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


# ──────────────────────────────────────────────────────────────────────────────
# Deals (UPC-first join)
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/deals/by-upc")
async def deals_by_upc(min_abs:float=5.0,min_pct:float=0.2,limit:int=100):
    wm_items = await db[WM_COLL].find({"upc":{"$exists":True}}).to_list(length=limit*5)
    deals=[]
    for wm in wm_items:
        wm_price=parse_price(wm.get("price"))
        if not wm_price: continue
        upc=wm.get("upc")
        amz_cache=await db[AMZ_COLL].find_one({"key_type":"upc","key_val":upc})
        if not amz_cache: continue
        amz_price=parse_price(amz_cache.get("price"))
        if not amz_price: continue
        diff=amz_price-wm_price
        pct=diff/amz_price if amz_price>0 else 0
        if diff>=min_abs and pct>=min_pct:
            deals.append({
                "wm":{"title":wm.get("title"),"price":wm_price,"link":wm.get("link")},
                "amz":{"title":amz_cache["amz"].get("title"),"price":amz_price,"link":amz_cache["amz"].get("link")},
                "savings_abs":diff,"savings_pct":pct*100
            })
        if len(deals)>=limit: break
    deals.sort(key=lambda d:d["savings_abs"],reverse=True)
    return {"count":len(deals),"deals":deals[:limit]}

@app.get("/deals/by-title")
async def deals_by_title(
    min_abs: float = 5.0,
    min_pct: float = 0.20,
    min_sim: int = 86,
    limit: int = 100,
):
    """
    Join Walmart items with cached Amazon offers (by fuzzy title).
    Only count as a deal if:
      - Amazon match_score_sim >= min_sim
      - Amazon price > Walmart price
      - Savings exceed thresholds
    """
    wm_items = await db[WM_COLL].find({}).to_list(length=limit * 5)
    deals = []

    for wm in wm_items:
        wm_price = parse_price(wm.get("price"))
        if not wm_price:
            continue

        pid = str(wm.get("product_id") or "")
        if not pid:
            continue

        amz_cache = await db[AMZ_COLL].find_one({"key_type": "wm_pid", "key_val": pid})
        if not amz_cache:
            continue

        amz_price = parse_price(amz_cache.get("price"))
        amz_meta  = amz_cache.get("amz") or {}
        sim_score = amz_meta.get("match_score_sim") or 0

        if not amz_price or sim_score < min_sim:
            continue

        diff = amz_price - wm_price
        pct = diff / amz_price if amz_price > 0 else 0

        if diff >= min_abs and pct >= min_pct:
            deals.append({
                "wm": {
                    "title": wm.get("title"),
                    "price": wm_price,
                    "link": wm.get("link"),
                },
                "amz": {
                    "title": amz_meta.get("title"),
                    "price": amz_price,
                    "link": amz_meta.get("link"),
                    "sim": sim_score,
                },
                "savings_abs": diff,
                "savings_pct": round(pct * 100, 2),
            })

        if len(deals) >= limit:
            break

    deals.sort(key=lambda d: d["savings_abs"], reverse=True)
    return {"count": len(deals), "deals": deals[:limit]}
