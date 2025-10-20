# main.py
# FastAPI service to:
# 1) Scrape Walmart via SerpAPI and store items (with optional UPC enrichment)
# 2) Look up Amazon offers via SerpAPI by UPC and cache them
# 3) Join Walmart+Amazon to return deals where Walmart is cheaper by %/absolute thresholds

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import httpx
import asyncio
import os
import re

# ──────────────────────────────────────────────────────────────────────────────
# App & Config (single source of truth)
# ──────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="Walmart vs Amazon Deals API")



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
# Utilities
# ──────────────────────────────────────────────────────────────────────────────

PRICE_RE = re.compile(r"(\d+(?:\.\d{1,2})?)")

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

def now_iso() -> str:
    return now_utc().isoformat()

def parse_price(v) -> Optional[float]:
    """Accepts float/int/str/dict from SerpAPI and returns a float or None."""
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, dict):
        # SerpAPI may return {"value": 12.34} or {"raw":"$12.34"} etc.
        for k in ("value", "raw", "price", "extracted"):
            if k in v:
                return parse_price(v[k])
    s = str(v).replace(",", "")
    m = PRICE_RE.search(s)
    return float(m.group(1)) if m else None

async def serp_get(url: str, params: Dict[str, Any]) -> Dict[str, Any]:
    """HTTP GET with SerpAPI key injection."""
    if not SERPAPI_KEY:
        raise HTTPException(500, "SERPAPI_KEY not set")
    q = {**params, "api_key": SERPAPI_KEY}
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(url, params=q)
        r.raise_for_status()
        return r.json()

# MongoDB expression helpers (for $project/$addFields)
def to_num(expr: Any) -> Dict[str, Any]:
    """Mongo expression to coerce a value (string like '$12.99') into number."""
    return {
        "$toDouble": {
            "$replaceAll": {
                "input": {
                    "$replaceAll": {
                        "input": {"$ifNull": [expr, "0"]},
                        "find": ",", "replacement": ""
                    }
                },
                "find": "$", "replacement": ""
            }
        }
    }

# ──────────────────────────────────────────────────────────────────────────────
# Indexes
# ──────────────────────────────────────────────────────────────────────────────

@app.on_event("startup")
async def _startup_indexes():
    # Walmart items
    await db[WM_COLL].create_index("product_id", unique=True, sparse=True)
    await db[WM_COLL].create_index("upc", sparse=True)
    await db[WM_COLL].create_index([("updatedAt", -1)])
    await db[WM_COLL].create_index("category", sparse=True)
    # Amazon offers
    await db[AMZ_COLL].create_index([("key_type", 1), ("key_val", 1)], unique=True)
    await db[AMZ_COLL].create_index([("checked_at", -1)])

# ──────────────────────────────────────────────────────────────────────────────
# Health / Debug
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"message": "Deals API running", "time": now_iso()}

@app.get("/walmart/stats")
async def wm_stats():
    total = await db[WM_COLL].count_documents({})
    with_upc = await db[WM_COLL].count_documents({"upc": {"$exists": True, "$ne": None, "$ne": ""}})
    cats = await db[WM_COLL].distinct("category")
    return {"walmart_total": total, "walmart_with_upc": with_upc, "categories": cats}

@app.get("/amazon/cache/stats")
async def amz_stats():
    total = await db[AMZ_COLL].count_documents({})
    upc_keys = await db[AMZ_COLL].count_documents({"key_type": "upc"})
    sample = await db[AMZ_COLL].find_one({}, {"_id": 0, "key_type": 1, "key_val": 1, "price": 1, "checked_at": 1})
    return {"amazon_offers_total": total, "amazon_upc_keys": upc_keys, "sample": sample}

# ──────────────────────────────────────────────────────────────────────────────
# Walmart via SerpAPI
# ──────────────────────────────────────────────────────────────────────────────

async def walmart_search_page(query: str, page: int = 1, store_id: Optional[str] = None) -> Dict[str, Any]:
    # https://serpapi.com/walmart-search-api
    params = {"engine": "walmart", "query": query, "page": page, "hl": "en", "gl": "us"}
    if store_id:
        params["store_id"] = store_id
    return await serp_get("https://serpapi.com/search.json", params)

async def walmart_product_detail(product_id: str) -> Dict[str, Any]:
    # https://serpapi.com/walmart-product-api
    return await serp_get(
        "https://serpapi.com/search.json",
        {"engine": "walmart_product", "product_id": product_id, "hl": "en", "gl": "us"},
    )

def extract_upc_block(detail_payload: Dict[str, Any]) -> Dict[str, Any]:
    """Pull upc/gtin/category from walmart_product response."""
    out: Dict[str, Any] = {}
    prod = (detail_payload or {}).get("product") or {}
    for k in ("upc", "gtin", "gtin13", "gtin14", "ean"):
        if prod.get(k):
            out[k] = str(prod[k])
    if prod.get("category"):
        out["category"] = prod["category"]
    elif prod.get("categories"):
        cats = [str(x) for x in prod["categories"] if x]
        if cats:
            out["category"] = " / ".join(cats)
    return out

class WalmartScrapeRequest(BaseModel):
    query: str = Field(..., description="Walmart search query")
    pages: int = Field(1, ge=1, le=20, description="SerpAPI pages to fetch")
    max_products: int = Field(50, ge=1, le=500)
    store_id: Optional[str] = Field(None, description="Walmart store_id for local results (optional)")
    enrich_upc: bool = True
    max_detail_calls: int = Field(15, ge=0, le=100, description="Max product detail lookups for UPC enrichment")
    delay_ms: int = Field(400, ge=0, le=3000, description="Delay between SerpAPI calls (ms)")

@app.post("/walmart/scrape")
async def walmart_scrape(req: WalmartScrapeRequest):
    inserted = 0
    updated = 0
    total_processed = 0
    saved_ids: List[str] = []

    for pg in range(1, req.pages + 1):
        if total_processed >= req.max_products:
            break
        data = await walmart_search_page(req.query, page=pg, store_id=req.store_id)
        items = data.get("organic_results") or []
        for it in items:
            if total_processed >= req.max_products:
                break
            pid = it.get("product_id") or it.get("product_id_full") or it.get("us_item_id") or it.get("item_id")
            if not pid:
                continue

            price_val = parse_price(it.get("primary_offer", {}).get("price") or it.get("price"))
            doc = {
                "product_id": str(pid),
                "title": it.get("title"),
                "price": price_val,  # store as number when possible
                "link": it.get("link"),
                "thumbnail": it.get("thumbnail"),
                "rating": it.get("rating"),
                "reviews": it.get("reviews"),
                "brand": it.get("brand") or it.get("seller"),
                "seller": it.get("seller"),
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
            saved_ids.append(str(pid))

        if req.delay_ms:
            await asyncio.sleep(req.delay_ms / 1000.0)

    # Optional UPC enrichment via walmart_product
    enriched = 0
    checked = 0
    if req.enrich_upc and req.max_detail_calls > 0 and saved_ids:
        need_upc = await db[WM_COLL].find(
            {
                "product_id": {"$in": saved_ids},
                "$or": [{"upc": {"$exists": False}}, {"upc": None}, {"upc": ""}],
            },
            {"_id": 1, "product_id": 1},
        ).limit(req.max_detail_calls).to_list(req.max_detail_calls)

        for it in need_upc:
            if checked >= req.max_detail_calls:
                break
            pid = it["product_id"]
            try:
                detail = await walmart_product_detail(pid)
                blk = extract_upc_block(detail)
                if blk:
                    blk["enriched_at"] = now_utc()
                    await db[WM_COLL].update_one({"_id": it["_id"]}, {"$set": blk})
                    enriched += 1
                else:
                    await db[WM_COLL].update_one({"_id": it["_id"]}, {"$set": {"enriched_at": now_utc()}})
            except Exception:
                # still mark so we don't hot-loop on failures
                await db[WM_COLL].update_one({"_id": it["_id"]}, {"$set": {"enriched_at": now_utc()}})
            finally:
                checked += 1
                await asyncio.sleep(0.4)

    return {
        "query": req.query,
        "pages_fetched": req.pages,
        "inserted": inserted,
        "updated": updated,
        "total_processed": total_processed,
        "detail_checked": checked,
        "upc_enriched": enriched,
    }

# ──────────────────────────────────────────────────────────────────────────────
# Amazon via SerpAPI (by UPC)
# ──────────────────────────────────────────────────────────────────────────────

async def serp_amazon_by_upc(upc: str) -> Optional[Dict[str, Any]]:
    """
    Search Amazon via SerpAPI by UPC and return a 'best' organic result
    with a usable price and link.
    """
    params = {
        "engine": "amazon",
        "amazon_domain": "amazon.com",
        "q": upc,
        "gl": "us",
        "hl": "en",
    }
    data = await serp_get("https://serpapi.com/search.json", params)

    best = None
    best_score = -1.0
    for item in data.get("organic_results", []):
        p = parse_price(item.get("price"))
        if p is None:
            continue
        # heuristic scoring: prefer tight titles containing the UPC or exact-looking matches
        score = 1.0
        t = (item.get("title") or "").lower()
        if upc in t:
            score += 0.6
        if item.get("badge") and "amazon's choice" in str(item.get("badge")).lower():
            score += 0.2
        if len(t) < 150:
            score += 0.1
        # slightly prefer Prime/sold by Amazon (if present in SerpAPI fields)
        if "prime" in str(item).lower():
            score += 0.05
        if score > best_score:
            best = item
            best_score = score

    if best:
        # normalize price field (store both raw and numeric for convenience)
        price_num = parse_price(best.get("price"))
        best["price_num"] = price_num
    return best

class IndexAmazonRequest(BaseModel):
    category: Optional[str] = None
    limit_upcs: int = 50
    recache_hours: int = 72
    max_serp_calls: int = 25

@app.post("/amazon/index-by-upc")
async def index_amazon_by_upc(req: IndexAmazonRequest):
    """
    Find distinct UPCs from Walmart items (optionally filtered by category),
    fetch Amazon offers via SerpAPI, and cache them in AMZ_COLL.
    """
    if not SERPAPI_KEY:
        raise HTTPException(500, "SERPAPI_KEY not set")

    match: Dict[str, Any] = {"upc": {"$exists": True, "$ne": None, "$ne": ""}}
    if req.category:
        match["category"] = req.category

    upcs: List[str] = await db[WM_COLL].distinct("upc", match)
    upcs = upcs[: req.limit_upcs]

    cutoff = datetime.utcnow() - timedelta(hours=req.recache_hours)

    to_fetch: List[str] = []
    for u in upcs:
        cached = await db[AMZ_COLL].find_one(
            {"key_type": "upc", "key_val": str(u), "checked_at": {"$gte": cutoff}}
        )
        if not cached:
            to_fetch.append(str(u))

    to_fetch = to_fetch[: req.max_serp_calls]

    fetched = 0
    cached_count = len(upcs) - len(to_fetch)
    failures = 0

    for upc in to_fetch:
        try:
            amz = await serp_amazon_by_upc(upc)
            if not amz:
                failures += 1
                continue
            doc = {
                "key_type": "upc",
                "key_val": upc,
                "amz": {
                    "asin": amz.get("asin"),
                    "title": amz.get("title"),
                    "link": amz.get("link"),
                    "brand": amz.get("brand"),
                },
                # keep both, aggregation will coerce if needed
                "price": amz.get("price") if amz.get("price") is not None else amz.get("price_num"),
                "checked_at": datetime.utcnow(),
            }
            await db[AMZ_COLL].update_one(
                {"key_type": "upc", "key_val": upc},
                {"$set": doc},
                upsert=True,
            )
            fetched += 1
        except Exception:
            failures += 1
        finally:
            await asyncio.sleep(0.5)  # be gentle

    return {
        "distinct_upcs": len(upcs),
        "cached": cached_count,
        "fetched_now": fetched,
        "failures": failures,
    }

# ──────────────────────────────────────────────────────────────────────────────
# Deals join: Walmart vs Amazon
# ──────────────────────────────────────────────────────────────────────────────

@app.get("/deals/by-category")
async def deals_by_category(
    category: Optional[str] = Query(None),
    min_abs: float = Query(5.0, description="Minimum absolute savings (Amazon - Walmart)"),
    min_pct: float = Query(0.20, description="Minimum percentage savings (Walmart at least this much cheaper)"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Returns deals where Walmart price is cheaper than Amazon by both:
      - at least `min_abs` dollars
      - at least `min_pct` fraction (e.g., 0.20 = 20%)
    """
    match: Dict[str, Any] = {"upc": {"$exists": True, "$ne": None, "$ne": ""}}
    if category:
        match["category"] = category

    pipeline: List[Dict[str, Any]] = [
        {"$match": match},
        {"$lookup": {
            "from": AMZ_COLL,
            "let": {"u": "$upc"},
            "pipeline": [
                {"$match": {"$expr": {"$and": [
                    {"$eq": ["$key_type", "upc"]},
                    {"$eq": ["$key_val", "$$u"]}
                ]}}},
                {"$sort": {"checked_at": -1}},
                {"$limit": 1}
            ],
            "as": "amz"
        }},
        {"$unwind": "$amz"},
        # Coerce prices to numbers
        {"$addFields": {
            "wm_price_num": to_num("$price"),  # Walmart price stored as number or string
            "amz_price_num": to_num({
                "$ifNull": [
                    "$amz.price.value",
                    {"$ifNull": ["$amz.price", "0"]}
                ]
            })
        }},
        {"$addFields": {
            "diff": {"$subtract": ["$amz_price_num", "$wm_price_num"]},
            "pct": {
                "$cond": [
                    {"$gt": ["$amz_price_num", 0]},
                    {"$divide": [{"$subtract": ["$amz_price_num", "$wm_price_num"]}, "$amz_price_num"]},
                    0
                ]
            }
        }},
        {"$match": {"diff": {"$gte": min_abs}, "pct": {"$gte": min_pct}}},
        {"$project": {
            "_id": 0,
            "wm": {
                "title": "$title",
                "price": {"$round": ["$wm_price_num", 2]},
                "brand": "$brand",
                "link": "$link",
                "thumbnail": "$thumbnail",
                "upc": "$upc",
                "category": "$category"
            },
            "amz": {
                "asin": "$amz.amz.asin",
                "title": "$amz.amz.title",
                "price": {"$round": ["$amz_price_num", 2]},
                "link": "$amz.amz.link",
                "brand": "$amz.amz.brand",
                "checked_at": "$amz.checked_at"
            },
            "savings_abs": {"$round": ["$diff", 2]},
            "savings_pct": {"$round": [{"$multiply": ["$pct", 100]}, 1]}
        }},
        {"$sort": {"savings_abs": -1, "savings_pct": -1}},
        {"$limit": limit}
    ]

    docs = await db[WM_COLL].aggregate(pipeline).to_list(limit)
    return {"count": len(docs), "deals": docs}

# ──────────────────────────────────────────────────────────────────────────────
# UPC Enrichment (standalone recrawler)
# ──────────────────────────────────────────────────────────────────────────────

@app.post("/walmart/enrich-upc")
async def walmart_enrich_upc(limit: int = 25, recrawl_hours: int = 168):
    """
    For Walmart items missing 'upc', call SerpAPI walmart_product by product_id
    to extract upc/gtin/category. Marks 'enriched_at' to avoid hot-looping.
    """
    cutoff = now_utc() - timedelta(hours=recrawl_hours)

    # Use $and to combine missing-upc ORs with "stale/not-enriched" ORs
    q = {
        "$and": [
            {"$or": [
                {"upc": {"$exists": False}},
                {"upc": None},
                {"upc": ""}
            ]},
            {"$or": [
                {"enriched_at": {"$exists": False}},
                {"enriched_at": {"$lt": cutoff}},
            ]},
            {"product_id": {"$exists": True, "$ne": None}}
        ]
    }

    items = await db[WM_COLL].find(
        q, {"_id": 1, "product_id": 1, "title": 1}
    ).limit(limit).to_list(limit)

    checked = 0
    updated = 0

    for it in items:
        if checked >= limit:
            break
        pid = str(it["product_id"])
        try:
            detail = await walmart_product_detail(pid)
            blk = extract_upc_block(detail)
            changes = {"enriched_at": now_utc(), "upc_source": "walmart_product"}
            if blk:
                changes.update(blk)
                updated += 1
            await db[WM_COLL].update_one({"_id": it["_id"]}, {"$set": changes})
        except Exception:
            await db[WM_COLL].update_one({"_id": it["_id"]}, {"$set": {"enriched_at": now_utc()}})
        finally:
            checked += 1
            await asyncio.sleep(0.4)

    return {"checked": checked, "updated": updated}


@app.post("/admin/fix-indexes")
async def fix_indexes():
    coll = db[WM_COLL]
    out = {"before": await coll.index_information()}
    try: await coll.drop_index("key_1")
    except: pass
    await coll.create_index("product_id", unique=True, sparse=True)
    await coll.create_index("upc", sparse=True)
    await coll.create_index([("updatedAt", -1)])
    out["after"] = await coll.index_information()
    return out

@app.post("/admin/drop-legacy-key-index")
async def drop_legacy_key_index():
    coll = db[WM_COLL]
    out = {"before": await coll.index_information()}
    try:
        await coll.drop_index("key_1")
        out["dropped"] = "key_1"
    except Exception as e:
        out["drop_error"] = str(e)
    out["after"] = await coll.index_information()
    return out

