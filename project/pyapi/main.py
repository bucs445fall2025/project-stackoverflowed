# main.py — Title/Brand matching (no UPCs)
# 1) Scrape Walmart via SerpAPI and store items
# 2) Look up Amazon offers via SerpAPI by *title/brand* and cache them
# 3) Join Walmart+Amazon to return deals where Walmart is cheaper by %/$ thresholds

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone, timedelta
import httpx
import asyncio
import os
import re
import difflib

app = FastAPI(title="Walmart vs Amazon Deals (Title Match)")

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
    q["api_key"] = os.environ["SERPAPI_KEY"]

    timeout = httpx.Timeout(30.0, connect=15.0)  # 30s total, 15s to connect
    async with httpx.AsyncClient(timeout=timeout) as c:
        for attempt in range(3):
            try:
                r = await c.get(url, params=q)
                r.raise_for_status()
                return r.json()
            except httpx.ReadTimeout:
                if attempt < 2:
                    await asyncio.sleep(2 ** attempt + random.random())  # exponential backoff
                    continue
                raise HTTPException(status_code=504, detail="SerpAPI request timed out")
            except httpx.HTTPStatusError as e:
                raise HTTPException(status_code=e.response.status_code, detail=str(e))


# Type-safe Mongo “to number”
def to_num(expr: Any) -> Dict[str, Any]:
    return {
        "$cond": [
            {"$isNumber": expr},
            {"$toDouble": expr},
            {
                "$toDouble": {
                    "$replaceAll": {
                        "input": {
                            "$replaceAll": {
                                "input": {"$toString": {"$ifNull": [expr, "0"]}},
                                "find": ",", "replacement": ""
                            }
                        },
                        "find": "$", "replacement": ""
                    }
                }
            }
        ]
    }

# ──────────────────────────────────────────────────────────────────────────────
# Indexes
# ──────────────────────────────────────────────────────────────────────────────
@app.on_event("startup")
async def _startup_indexes():
    # Walmart items (no UPC index needed now)
    await db[WM_COLL].create_index("product_id", unique=True, sparse=True)
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

    for pg in range(1, req.pages + 1):
        if total_processed >= req.max_products:
            break
        data = await walmart_search_page(req.query, page=pg, store_id=req.store_id)
        items = data.get("organic_results") or []
        for it in items:
            if total_processed >= req.max_products:
                break

            # Walmart “product_id” here is the internal one, also keep us_item_id if present
            pid = it.get("product_id") or it.get("product_id_full") or it.get("us_item_id") or it.get("item_id")
            if not pid:
                continue

            price_val = parse_price(it.get("primary_offer", {}).get("price") or it.get("price"))
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

        if req.delay_ms:
            await asyncio.sleep(req.delay_ms / 1000.0)

    return {
        "query": req.query,
        "pages_fetched": req.pages,
        "inserted": inserted,
        "updated": updated,
        "total_processed": total_processed,
    }

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
    base = difflib.SequenceMatcher(None, a, b).ratio()  # 0..1
    if brand and brand.lower() in (amz_title or "").lower():
        base += 0.05
    return min(base, 1.0)

async def serp_amazon_by_title(title: str, brand: Optional[str]=None) -> Optional[Dict[str, Any]]:
    q = f"{brand} {title}" if brand else title
    data = await serp_get("https://serpapi.com/search.json", {
        "engine":"amazon","amazon_domain":"amazon.com","q":q,"gl":"us","hl":"en"
    })
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
    limit_items: int = 50
    recache_hours: int = 72
    max_serp_calls: int = 25
    min_score: float = 0.62

@app.post("/amazon/index-by-title")
async def index_amazon_by_title(req: IndexAmazonByTitleReq):
    if not SERPAPI_KEY:
        raise HTTPException(500, "SERPAPI_KEY not set")

    match: Dict[str, Any] = {"title": {"$exists": True, "$ne": None}}
    if req.category:
        match["category"] = req.category

    cutoff = datetime.utcnow() - timedelta(hours=req.recache_hours)

    # candidates
    items = await db[WM_COLL].find(
        match, {"_id":1,"product_id":1,"title":1,"brand":1,"price":1}
    ).limit(req.limit_items).to_list(req.limit_items)

    # pick those not recently cached
    to_fetch: List[Dict[str, Any]] = []
    for it in items:
        pid = str(it["product_id"])
        cached = await db[AMZ_COLL].find_one(
            {"key_type":"wm_pid","key_val":pid,"checked_at":{"$gte":cutoff}}
        )
        if not cached:
            to_fetch.append(it)
    to_fetch = to_fetch[:req.max_serp_calls]

    fetched = 0; misses = 0
    for it in to_fetch:
        pid = str(it["product_id"])
        try:
            amz = await serp_amazon_by_title(it.get("title",""), it.get("brand"))
            if not amz or (amz.get("match_score") or 0) < req.min_score:
                await db[AMZ_COLL].update_one(
                    {"key_type":"wm_pid","key_val":pid},
                    {"$set":{
                        "key_type":"wm_pid","key_val":pid,"checked_at":datetime.utcnow(),
                        "miss":True,"last_title":it.get("title"),"last_brand":it.get("brand")
                    }},
                    upsert=True
                )
                misses += 1
            else:
                doc = {
                    "key_type":"wm_pid", "key_val": pid,
                    "amz": {
                        "asin": amz.get("asin"),
                        "title": amz.get("title"),
                        "link": amz.get("link"),
                        "brand": amz.get("brand"),
                        "match_score": amz.get("match_score"),
                    },
                    "price": amz.get("price") if amz.get("price") is not None else amz.get("price_num"),
                    "checked_at": datetime.utcnow(),
                    "last_title": it.get("title"),
                    "last_brand": it.get("brand"),
                }
                await db[AMZ_COLL].update_one(
                    {"key_type":"wm_pid","key_val":pid},
                    {"$set":doc},
                    upsert=True
                )
                fetched += 1
        except Exception:
            misses += 1
        finally:
            await asyncio.sleep(0.4)

    return {"considered": len(items), "fetched_now": fetched, "misses": misses}

# ──────────────────────────────────────────────────────────────────────────────
# Deals (Title/Brand join)
# ──────────────────────────────────────────────────────────────────────────────
@app.get("/deals/by-title")
async def deals_by_title(
    category: Optional[str] = Query(None),
    min_abs: float = Query(5.0, description="Minimum absolute savings (Amazon - Walmart)"),
    min_pct: float = Query(0.20, description="Minimum percentage savings (Walmart at least this much cheaper)"),
    min_score: float = Query(0.62, description="Minimum title match score 0..1"),
    limit: int = Query(50, ge=1, le=200),
):
    match: Dict[str, Any] = {"title": {"$exists": True, "$ne": None}}
    if category:
        match["category"] = category

    pipeline: List[Dict[str, Any]] = [
        {"$match": match},
        {"$lookup": {
            "from": AMZ_COLL,
            "let": {"pid": "$product_id"},
            "pipeline": [
                {"$match": {"$expr": {"$and":[
                    {"$eq": ["$key_type","wm_pid"]},
                    {"$eq": ["$key_val","$$pid"]}
                ]}}},
                {"$sort": {"checked_at": -1}},
                {"$limit": 1}
            ],
            "as": "amz"
        }},
        {"$unwind": "$amz"},
        {"$match": {"amz.miss": {"$ne": True}}},
        {"$match": {"amz.amz.match_score": {"$gte": min_score}}},
        {"$addFields": {
            "wm_price_num": to_num("$price"),
            "amz_price_num": to_num({"$ifNull": ["$amz.price", "0"]})
        }},
        {"$addFields": {
            "diff": {"$subtract": ["$amz_price_num", "$wm_price_num"]},
            "pct": {
                "$cond": [{"$gt": ["$amz_price_num", 0]},
                          {"$divide": [{"$subtract": ["$amz_price_num","$wm_price_num"]}, "$amz_price_num"]},
                          0]
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
                "category": "$category",
                "product_id": "$product_id",
            },
            "amz": {
                "asin": "$amz.amz.asin",
                "title": "$amz.amz.title",
                "price": {"$round": ["$amz_price_num", 2]},
                "link": "$amz.amz.link",
                "brand": "$amz.amz.brand",
                "match_score": "$amz.amz.match_score",
                "checked_at": "$amz.checked_at",
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
