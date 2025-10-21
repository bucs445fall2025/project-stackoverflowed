# main.py — Title/Brand matching (no UPCs)
# 1) Scrape Walmart via SerpAPI and store items
# 2) Look up Amazon offers via SerpAPI by *title/brand* and cache them
# 3) Join Walmart+Amazon to return deals where Walmart is cheaper by %/$ thresholds

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from typing import List, Dict, Any, Optional
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import httpx
import asyncio
import os
import re
import difflib
import random

app = FastAPI(title="Walmart vs Amazon Deals (Title Match)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # or restrict to your frontend domain
    allow_credentials=True,
    allow_methods=["*"],   # includes OPTIONS, GET, POST, etc
    allow_headers=["*"],
)

# ──────────────────────────────────────────────────────────────────────────────
# Config
# ──────────────────────────────────────────────────────────────────────────────
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
# Utils
# ──────────────────────────────────────────────────────────────────────────────
PRICE_RE = re.compile(r"(\d+(?:\.\d{1,2})?)")

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def now_iso() -> str:
    return now_utc().isoformat()

def parse_price(v) -> Optional[float]:
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, dict):
        for k in ("value", "raw", "price", "extracted"):
            if k in v:
                return parse_price(v[k])
    s = str(v).replace(",", "")
    m = PRICE_RE.search(s)
    return float(m.group(1)) if m else None

async def serp_get(url: str, q: dict):
    if not SERPAPI_KEY:
        raise HTTPException(status_code=500, detail="SERPAPI_KEY not set")
    q["api_key"] = SERPAPI_KEY

    timeout = httpx.Timeout(30.0, connect=15.0)
    async with httpx.AsyncClient(timeout=timeout) as c:
        for attempt in range(3):
            try:
                r = await c.get(url, params=q)
                if r.status_code >= 400:
                    # show SerpAPI’s error content instead of a generic 500
                    try:
                        err = r.json()
                    except Exception:
                        err = {"text": r.text}
                    raise HTTPException(status_code=r.status_code, detail=err)
                return r.json()
            except httpx.ReadTimeout:
                if attempt < 2:
                    await asyncio.sleep((2 ** attempt) + random.random())
                    continue
                raise HTTPException(status_code=504, detail="SerpAPI request timed out")

async def serp_amazon_by_upc(upc: str) -> Optional[Dict[str, Any]]:
    data = await serp_get(
        "https://serpapi.com/search.json",
        {"engine": "amazon", "amazon_domain": "amazon.com", "k": upc, "gl": "us", "hl": "en"}
    )
    for it in data.get("organic_results", []):
        p = parse_price(it.get("price"))
        if p is None:
            continue
        # When searching by UPC, first organic with a price is usually correct.
        it["price_num"] = p
        it["match_score"] = 1.0  # exact-id basis
        return it
    return None


async def walmart_product_details(product_id: str) -> Optional[Dict[str, Any]]:
    data = await serp_get(
        "https://serpapi.com/search.json",
        {"engine": "walmart_product", "product_id": product_id}
    )
    return data.get("product_result")

# Type-safe Mongo “to number”
def to_num(expr: Any) -> Dict[str, Any]:
    """
    Mongo 4.2-friendly numeric coercion:
    - If it's already a number -> toDouble
    - Else regexFind the first number (digits + optional .decimals) from the string.
    - If nothing matches, return 0.
    """
    return {
        "$let": {
            "vars": {
                "valStr": {"$toString": {"$ifNull": [expr, ""]}},
                "m": {
                    "$regexFind": {
                        "input": {"$toString": {"$ifNull": [expr, ""]}},
                        "regex": r"(\d+(?:\.\d{1,2})?)"
                    }
                }
            },
            "in": {
                "$cond": [
                    {"$gt": [{"$size": {"$ifNull": ["$$m.captures", []]}}, 0]},
                    {"$toDouble": {"$arrayElemAt": ["$$m.captures", 0]}},
                    0.0
                ]
            }
        }
    }

SIZE_RE = re.compile(
    r"(?:(\d+(?:\.\d+)?)\s*(lb|lbs|pound|pounds|oz|ounce|ounces|kg|g|gram|grams|ml|l|liter|liters))"
    r"|(?:pack\s*of\s*(\d+)|(\d+)\s*ct|\b(\d+)-?pack\b)",
    re.I,
)

def _to_grams(val: float, unit: str) -> Optional[float]:
    u = unit.lower()
    if u in {"lb", "lbs", "pound", "pounds"}: return val * 453.59237
    if u in {"oz", "ounce", "ounces"}:        return val * 28.349523125
    if u in {"kg"}:                            return val * 1000.0
    if u in {"g", "gram", "grams"}:            return val
    # liquid units are tricky; treat ml like g, L as 1000g approx (density ~1)
    if u in {"ml"}:                             return val
    if u in {"l", "liter", "liters"}:          return val * 1000.0
    return None

def extract_size_and_count(title: str) -> Dict[str, Optional[float]]:
    """
    Heuristic: extract primary size in grams (approx) and pack count, e.g.
    'Optimum Nutrition Whey Protein 5 lb (2 pack)' -> grams=2267.96, count=2
    """
    grams = None
    count = 1
    if not title:
        return {"grams": None, "count": 1}

    for m in SIZE_RE.finditer(title):
        qty, unit, pack_of, ct_alt, pack_alt = m.groups()
        if qty and unit:
            g = _to_grams(float(qty), unit)
            if g:
                # keep the largest size we find (ignores tiny “sample 1 oz” if 5 lb also present)
                grams = max(grams or 0, g)
        if pack_of and pack_of.isdigit():
            count = max(count, int(pack_of))
        if ct_alt and ct_alt.isdigit():
            count = max(count, int(ct_alt))
        if pack_alt and pack_alt.isdigit():
            count = max(count, int(pack_alt))

    return {"grams": grams, "count": count}

def unit_price(price: Optional[float], grams: Optional[float], count: int) -> Optional[float]:
    if price is None or grams is None or grams <= 0:
        return None
    total_grams = grams * max(1, count)
    return price / total_grams if total_grams > 0 else None

# ──────────────────────────────────────────────────────────────────────────────
# Indexes
# ──────────────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def _startup_indexes():
    # Walmart items (no UPC index needed now)
    await db[WM_COLL].create_index("product_id", unique=True, sparse=True)
    await db[WM_COLL].create_index("upc", sparse=True)
    await db[WM_COLL].create_index("category", sparse=True)
    await db[WM_COLL].create_index([("updatedAt", -1)])
    # Amazon offers cache
    await db[AMZ_COLL].create_index([("key_type", 1), ("key_val", 1)], unique=True)
    await db[AMZ_COLL].create_index([("checked_at", -1)])

# ──────────────────────────────────────────────────────────────────────────────
# Health / Debug
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {"message": "Deals API (title match) running", "time": now_iso()}

@app.get("/walmart/stats")
async def wm_stats():
    total = await db[WM_COLL].count_documents({})
    cats = await db[WM_COLL].distinct("category")
    return {"walmart_total": total, "categories": cats}
@app.get("/walmart/items")
async def walmart_items(limit: int = 30):
    cur = db[WM_COLL].find({}, {"_id": 0}).sort([("updatedAt", -1)]).limit(limit)
    items = await cur.to_list(length=limit)
    return {"items": items}
@app.get("/amazon/cache/stats")
async def amz_stats():
    total = await db[AMZ_COLL].count_documents({})
    title_keys = await db[AMZ_COLL].count_documents({"key_type": "wm_pid"})
    sample = await db[AMZ_COLL].find_one(
        {"key_type": "wm_pid"}, {"_id": 0, "key_type": 1, "key_val": 1, "price": 1, "checked_at": 1}
    )
    return {"amazon_offers_total": total, "amazon_wm_pid_keys": title_keys, "sample": sample}

# ──────────────────────────────────────────────────────────────────────────────
# Walmart via SerpAPI (search)
# ──────────────────────────────────────────────────────────────────────────────
async def walmart_search_page(query: str, page: int = 1, store_id: Optional[str] = None) -> Dict[str, Any]:
    # https://serpapi.com/walmart-search-api
    params = {"engine": "walmart", "query": query, "page": page, "hl": "en", "gl": "us"}
    if store_id:
        params["store_id"] = store_id
    return await serp_get("https://serpapi.com/search.json", params)

class WalmartScrapeRequest(BaseModel):
    query: str = Field(..., description="Walmart search query")
    pages: int = Field(1, ge=1, le=20, description="SerpAPI pages to fetch")
    max_products: int = Field(50, ge=1, le=500)
    store_id: Optional[str] = Field(None, description="Walmart store_id for local results (optional)")
    delay_ms: int = Field(400, ge=0, le=3000, description="Delay between SerpAPI calls (ms)")

@app.post("/walmart/scrape")
async def walmart_scrape(req: WalmartScrapeRequest):
    inserted = 0
    updated = 0
    total_processed = 0
    skipped_no_pid = 0
    skipped_no_price = 0


    for pg in range(1, req.pages + 1):
        if total_processed >= req.max_products:
            break
        data = await walmart_search_page(req.query, page=pg, store_id=req.store_id)
        items = data.get("organic_results") or []
        for it in items:
            # product id
            pid = it.get("product_id") or it.get("product_id_full") or it.get("us_item_id") or it.get("item_id")
            if not pid:
                skipped_no_pid += 1
                continue

            # ✅ Walmart price usually lives here:
            po = it.get("primary_offer") or {}
            price_val = parse_price(
                po.get("offer_price") or  # <-- most common
                po.get("price") or        # fallback
                it.get("price")           # last resort
            )
            if price_val is None:
                skipped_no_price += 1
                continue

            doc = {
                "product_id": str(pid),
                "us_item_id": it.get("us_item_id"),
                "title": it.get("title"),
                "brand": it.get("brand") or it.get("seller"),
                "price": price_val,
                "link": it.get("link") or it.get("product_page_url"),
                "thumbnail": it.get("thumbnail"),
                "rating": it.get("rating"),
                "reviews": it.get("reviews"),
                "category": it.get("category"),
                "updatedAt": now_utc(),
            }

            res = await db[WM_COLL].update_one(
                {"product_id": str(pid)},
                {"$setOnInsert": {"createdAt": now_utc()}, "$set": doc},
                upsert=True,
            )
            if res.upserted_id:
                inserted += 1
            else:
                updated += res.modified_count
            total_processed += 1

        # return payload
        return {
            "query": req.query,
            "pages_fetched": req.pages,
            "inserted": inserted,
            "updated": updated,
            "total_processed": total_processed,
            "skipped_no_pid": skipped_no_pid,
            "skipped_no_price": skipped_no_price,
        }
    
@app.post("/walmart/enrich-upc")
async def walmart_enrich_upc(limit: int = 200):
    coll = db[WM_COLL]
    cur = coll.find(
        {"product_id": {"$exists": True, "$ne": None}, "upc": {"$exists": False}},
        {"_id": 1, "product_id": 1, "us_item_id": 1}
    ).sort([("updatedAt", -1)]).limit(limit)
    docs = await cur.to_list(length=limit)

    updated = 0
    for d in docs:
        pid = str(d.get("product_id"))
        try:
            pr = await walmart_product_details(pid)
            if not pr:
                continue
            raw_upc = pr.get("upc") or pr.get("gtin") or pr.get("gtin13") or pr.get("gtin12")
            upc = normalize_upc(raw_upc)
            update = {}
            if upc:
                update["upc"] = upc
            # store raw too (debug/edge-cases)
            if raw_upc:
                update["gtin_raw"] = raw_upc
            if update:
                await coll.update_one({"_id": d["_id"]}, {"$set": update})
                updated += 1
        except Exception:
            pass
        finally:
            await asyncio.sleep(0.35)  # be kind to SerpAPI
    return {"considered": len(docs), "updated": updated}


# ──────────────────────────────────────────────────────────────────────────────
# Amazon via SerpAPI — match by Title/Brand
# ──────────────────────────────────────────────────────────────────────────────
STOPWORDS = {"with","and","the","for","in","of","to","by","on","oz","fl","ct","pack","count","lb","lbs","ounce","ounces"}

def norm(s: str) -> str:
    if not s: return ""
    s = re.sub(r"[^a-z0-9 ]+", " ", s.lower())
    toks = [t for t in s.split() if t and t not in STOPWORDS]
    return " ".join(toks)

def title_score(wm_title: str, amz_title: str, brand: Optional[str]=None) -> float:
    a = norm(wm_title); b = norm(amz_title)
    base = difflib.SequenceMatcher(None, a, b).ratio()
    if brand and brand.lower() in (amz_title or "").lower():
        base += 0.05

    # size affinity bonus (if sizes within ~±25%)
    wm_sz = extract_size_and_count(wm_title)
    amz_sz = extract_size_and_count(amz_title)
    wg, wc = wm_sz["grams"], wm_sz["count"]
    ag, ac = amz_sz["grams"], amz_sz["count"]
    if wg and ag:
        ratio = min(wg*wc, ag*ac) / max(wg*wc, ag*ac)
        if ratio >= 0.75:
            base += 0.05  # modest bump
        else:
            base -= 0.05  # small penalty for very different sizes
    return max(0.0, min(base, 1.0))

async def serp_amazon_by_title(title: str, brand: Optional[str]=None) -> Optional[Dict[str, Any]]:
    q = f"{brand} {title}" if brand else title
    data = await serp_get(
    "https://serpapi.com/search.json",
    {
        "engine": "amazon",
        "amazon_domain": "amazon.com",
        "k": q,             # ← use `k`, not `q`
        "gl": "us",
        "hl": "en",
    },
)
    best, best_s, best_p = None, -1.0, None
    for it in data.get("organic_results", []):
        p = parse_price(it.get("price"))
        if p is None: 
            continue
        s = title_score(title, it.get("title") or "", brand)
        if "amazon's choice" in str(it.get("badge","")).lower(): s += 0.03
        if len((it.get("title") or "")) < 140: s += 0.02
        if s > best_s:
            best, best_s, best_p = it, s, p
    if best:
        best["price_num"] = best_p
        best["match_score"] = round(best_s, 3)
    return best

class IndexAmazonByTitleReq(BaseModel):
    category: Optional[str] = None
    kw: Optional[str] = None         
    limit_items: int = 400           
    recache_hours: int = 48
    max_serp_calls: int = 200        
    min_score: float = 0.62
@app.post("/amazon/index-by-title")
async def index_amazon_by_title(req: IndexAmazonByTitleReq):
    """
    Build/refresh the Amazon cache by fuzzy title/brand for Walmart items.
    - Skips docs without a product_id (and won't crash).
    - Respects recache_hours so we don't hammer SerpAPI.
    - Writes either a hit (amz + price) or a miss stub for each pid.
    """
    if not SERPAPI_KEY:
        raise HTTPException(500, "SERPAPI_KEY not set")

    # Only work on items that have both a title and a product_id
    match: Dict[str, Any] = {
        "title": {"$exists": True, "$ne": None},
        "product_id": {"$exists": True, "$ne": None},
    }
    if req.category:
        match["category"] = req.category
    if req.kw:
        match["title"] = {"$regex": req.kw, "$options": "i"}

    cutoff = datetime.utcnow() - timedelta(hours=req.recache_hours)

    # Candidate Walmart items
    items = await db[WM_COLL].find(
        match, {"_id":1,"product_id":1,"title":1,"brand":1,"price":1}
    ).sort([("updatedAt",-1)]).limit(req.limit_items).to_list(req.limit_items)

    # Filter to those not recently cached
    to_fetch: List[Dict[str, Any]] = []
    skipped_no_pid = 0
    for it in items:
        pid = str(it.get("product_id") or "")
        if not pid:
            skipped_no_pid += 1
            continue

        cached = await db[AMZ_COLL].find_one(
            {"key_type": "wm_pid", "key_val": pid, "checked_at": {"$gte": cutoff}}
        )
        if not cached:
            to_fetch.append(it)

    # Respect max_serp_calls
    to_fetch = to_fetch[: max(0, req.max_serp_calls)]

    fetched = 0
    misses = 0

    for it in to_fetch:
        pid = str(it.get("product_id") or "")
        if not pid:
            skipped_no_pid += 1
            continue

        try:
            wm_doc = await db[WM_COLL].find_one({"product_id": pid}, {"upc": 1, "title": 1, "brand": 1})
            upc = wm_doc.get("upc") if wm_doc else None

            amz = None
            if upc:
                amz = await serp_amazon_by_upc(upc)

            if not amz:
                amz = await serp_amazon_by_title(it.get("title", ""), it.get("brand"))

            ok = bool(amz) and float(amz.get("match_score") or 0.0) >= float(req.min_score)

            if not ok:
                # record a miss so we don't keep retrying immediately
                await db[AMZ_COLL].update_one(
                    {"key_type": "wm_pid", "key_val": pid},
                    {"$set": {
                        "key_type": "wm_pid",
                        "key_val": pid,
                        "checked_at": datetime.utcnow(),
                        "miss": True,
                        "last_title": it.get("title"),
                        "last_brand": it.get("brand"),
                    }},
                    upsert=True,
                )
                misses += 1
            else:
                # normalize price field (SerpAPI sometimes puts it in price or price_num)
                amz_price = amz.get("price")
                if amz_price is None:
                    amz_price = amz.get("price_num")

                doc = {
                    "key_type": "wm_pid",
                    "key_val": pid,
                    "amz": {
                        "asin": amz.get("asin"),
                        "title": amz.get("title"),
                        "link": amz.get("link"),
                        "brand": amz.get("brand"),
                        "match_score": amz.get("match_score"),
                    },
                    "price": amz_price,
                    "checked_at": datetime.utcnow(),
                    "last_title": it.get("title"),
                    "last_brand": it.get("brand"),
                }

                await db[AMZ_COLL].update_one(
                    {"key_type": "wm_pid", "key_val": pid},
                    {"$set": doc},
                    upsert=True,
                )
                fetched += 1

        except Exception:
            # treat any error as a miss and move on
            misses += 1
        finally:
            # be nice to SerpAPI
            await asyncio.sleep(0.4)

    return {
        "considered": len(items),
        "queued": len(to_fetch),
        "fetched_now": fetched,
        "misses": misses,
        "skipped_no_pid": skipped_no_pid,
    }

# ──────────────────────────────────────────────────────────────────────────────
# Deals (Title/Brand join)
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/deals/by-title")
async def deals_by_title(
    category: Optional[str] = Query(None, description="Exact category match if present in Walmart docs"),
    kw: Optional[str] = Query(None, description="Case-insensitive keyword in Walmart title (fallback if category is sparse)"),
    min_abs: float = Query(5.0),
    min_pct: float = Query(0.20),
    min_score: float = Query(0.62),
    limit: int = Query(200, ge=1, le=2000),
    size_ratio_min: float = Query(0.70, description="Min smaller/larger total-size ratio to accept as the same item"),
):
    # Pull candidate Walmart items (Python for size parsing; we need titles anyway)
    q: Dict[str, Any] = {"title": {"$exists": True, "$ne": None}}
    if category:
        q["category"] = category
    if kw:
        q["title"] = {"$regex": kw, "$options": "i"}

    # fetch more rows to allow later filtering
    wm_rows = await db[WM_COLL].find(q, {"_id":0}).sort([("updatedAt",-1)]).limit(limit*5).to_list(length=limit*5)

    # Join to the most recent Amazon cache per product_id
    deals: List[Dict[str, Any]] = []
    for wm in wm_rows:
        wm_price = parse_price(wm.get("price"))
        if not wm_price or wm_price <= 0:
            continue
        pid = str(wm.get("product_id") or "")
        if not pid:
            continue

        amz_cache = await db[AMZ_COLL].find_one(
            {"key_type":"wm_pid","key_val":pid,"miss":{"$ne":True}},
            sort=[("checked_at",-1)]
        )
        if not amz_cache:
            continue
        amz = (amz_cache.get("amz") or {})
        amz_price = parse_price(amz_cache.get("price") or amz.get("price"))
        score = float(amz.get("match_score") or 0.0)
        if score < min_score:
            continue
        if not amz_price or amz_price <= 0:
            continue

        # size-aware comparison
        wm_sz = extract_size_and_count(wm.get("title") or "")
        amz_sz = extract_size_and_count(amz.get("title") or "")
        wg, wc = wm_sz["grams"], wm_sz["count"]
        ag, ac = amz_sz["grams"], amz_sz["count"]

        size_ok = True
        use_unit = False
        if wg and ag:
            wm_total = wg * max(1, wc)
            amz_total = ag * max(1, ac)
            ratio = min(wm_total, amz_total) / max(wm_total, amz_total)
            size_ok = ratio >= size_ratio_min
            use_unit = True

        if not size_ok:
            continue

        if use_unit:
            wm_unit = unit_price(wm_price, wg, wc)
            amz_unit = unit_price(amz_price, ag, ac)
            if wm_unit is None or amz_unit is None or amz_unit <= 0:
                continue
            diff = amz_unit - wm_unit
            pct  = diff / amz_unit
        else:
            # fallback to absolute product price when sizes not parseable
            diff = amz_price - wm_price
            pct  = diff / amz_price

        if diff >= min_abs and pct >= min_pct:
            deals.append({
                "wm": {
                    "title": wm.get("title"),
                    "price": round(wm_price, 2),
                    "brand": wm.get("brand"),
                    "link": wm.get("link"),
                    "thumbnail": wm.get("thumbnail"),
                    "category": wm.get("category"),
                    "product_id": wm.get("product_id"),
                    "size_grams": wg,
                    "count": wc,
                },
                "amz": {
                    "asin": amz.get("asin"),
                    "title": amz.get("title"),
                    "price": round(amz_price, 2),
                    "link": amz.get("link"),
                    "brand": amz.get("brand"),
                    "match_score": score,
                    "checked_at": amz_cache.get("checked_at"),
                    "size_grams": ag,
                    "count": ac,
                },
                "savings_abs": round(diff if not use_unit else diff * (ag or 1) * (ac or 1), 2) if use_unit else round(diff, 2),
                "savings_pct": round(pct*100, 1),
                "basis": "unit" if use_unit else "product"
            })

        if len(deals) >= limit:
            break

    # Sort best savings first
    deals.sort(key=lambda d: (d["savings_abs"], d["savings_pct"]), reverse=True)
    return {"count": len(deals), "deals": deals[:limit]}


@app.get("/deals/by-category")
async def deals_by_category(
    category: str = Query("", description="Optional category filter"),
    min_pct: float = Query(0.20, description="Minimum percent savings, 0.20 = 20%"),
    min_abs: float = Query(5.0, description="Minimum absolute savings in dollars"),
    limit: int = Query(24, description="Max deals to return")
):
    """Compare Walmart vs Amazon items by fuzzy title matching and return deals."""

    wm_query = {}
    if category:
        wm_query["category"] = {"$regex": category, "$options": "i"}

    wm_items = await db["walmart_items"].find(wm_query).to_list(length=500)
    amz_items = await db["amazon_items"].find({}).to_list(length=1000)

    deals = []

    for wm in wm_items:
        wm_price = wm.get("price") or wm.get("raw", {}).get("primary_offer", {}).get("offer_price")
        if wm_price is None:
            continue

        wm_title = wm.get("title") or wm.get("raw", {}).get("title", "")
        if not wm_title:
            continue

        # find best Amazon match by title
        best_match = None
        best_score = 0
        for amz in amz_items:
            amz_title = amz.get("title") or amz.get("raw", {}).get("title", "")
            if not amz_title:
                continue
            score = fuzz.token_set_ratio(wm_title, amz_title)
            if score > best_score:
                best_score = score
                best_match = amz

        if best_match and best_score >= 70:  # threshold
            amz_price = best_match.get("price") or best_match.get("raw", {}).get("price")
            if not amz_price:
                continue

            savings_abs = amz_price - wm_price
            savings_pct = savings_abs / amz_price if amz_price > 0 else 0

            if savings_abs >= min_abs and savings_pct >= min_pct:
                deals.append({
                    "wm": {
                        "title": wm_title,
                        "price": wm_price,
                        "thumbnail": wm.get("thumbnail"),
                        "link": wm.get("link"),
                        "upc": wm.get("upc"),
                        "category": wm.get("category"),
                    },
                    "amz": {
                        "title": best_match.get("title"),
                        "price": amz_price,
                        "asin": best_match.get("asin"),
                        "link": best_match.get("link"),
                        "checked_at": best_match.get("checked_at"),
                    },
                    "savings_abs": savings_abs,
                    "savings_pct": savings_pct,
                    "match_score": best_score
                })

    # sort best savings first
    deals.sort(key=lambda d: d["savings_abs"], reverse=True)

    return {"deals": deals[:limit]}
# ──────────────────────────────────────────────────────────────────────────────
# One-time normalizer for older docs (optional)
# ──────────────────────────────────────────────────────────────────────────────
@app.post("/admin/normalize-walmart")
async def normalize_walmart(limit: int = 500):
    coll = db[WM_COLL]
    cur = coll.find({"product_id": {"$exists": False}}, {"_id": 1, "raw": 1}).limit(limit)
    docs = await cur.to_list(limit)
    touched = 0
    for d in docs:
        r = d.get("raw") or {}
        pid = r.get("product_id") or r.get("us_item_id") or r.get("item_id") or r.get("id")
        link = r.get("product_page_url") or r.get("link")
        price = None
        po = r.get("primary_offer") or {}
        if po.get("offer_price") is not None:
            price = float(po["offer_price"])
        update = {}
        if pid: update["product_id"] = str(pid)
        if link: update["link"] = link
        if price is not None: update["price"] = price
        if r.get("seller_name"): update["seller"] = r["seller_name"]
        if r.get("title"): update["title"] = r["title"]
        if r.get("thumbnail"): update["thumbnail"] = r["thumbnail"]
        if update:
            update["updatedAt"] = datetime.utcnow()
            await coll.update_one({"_id": d["_id"]}, {"$set": update})
            touched += 1
    return {"normalized": touched}

def normalize_upc(gtin: Optional[str]) -> Optional[str]:
    """
    Return a 12-digit UPC-A if possible:
    - If 13 digits and starts with '0', drop the leading 0 (common EAN-13 → UPC-A).
    - Else if 12 digits, return as-is.
    - Otherwise return None.
    """
    if not gtin: 
        return None
    s = re.sub(r"\D", "", str(gtin))
    if len(s) == 13 and s.startswith("0"):
        return s[1:]
    if len(s) == 12:
        return s
    return None



#TESTING ROUTE
@app.get("/debug/amazon-search")
async def debug_amazon_search(
    q: str,
    n: int = 5,
    domain: str = "amazon.com"
):
    """
    Minimal Amazon search via SerpAPI.
    Returns top N simple results: title, price_num, price_raw, link, asin, badge.
    """
    if not SERPAPI_KEY:
        raise HTTPException(500, "SERPAPI_KEY not set")

    data = await serp_get(
        "https://serpapi.com/search.json",
        {
            "engine": "amazon",
            "amazon_domain": domain,
            "k": q,              # ← use `k`, not `q`
            "gl": "us",
            "hl": "en",
        },
    )

    out: List[Dict[str, Any]] = []
    for it in (data.get("organic_results") or [])[: max(0, n)]:
        out.append({
            "title": it.get("title"),
            "price_num": parse_price(it.get("price")),
            "price_raw": it.get("price"),
            "link": it.get("link"),
            "asin": it.get("asin"),
            "badge": it.get("badge"),
            "rating": it.get("rating"),
            "reviews": it.get("reviews"),
        })

    return {"q": q, "count": len(out), "results": out}