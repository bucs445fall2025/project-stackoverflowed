from fastapi import FastAPI, HTTPException, Query
from motor.motor_asyncio import AsyncIOMotorClient
from typing import Optional, Dict, Any, Tuple, List
from pydantic import BaseModel, Field
import httpx
from datetime import datetime, timezone
import asyncio
import os

app = FastAPI()

# Mongo connection
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client["MongoDB"]  

@app.get("/")
async def root():
    return {"message": "Python calculation service is running."}

@app.post("/store")
async def store_data():
    result = await db.results.insert_one({"value": 42})
    return {"inserted_id": str(result.inserted_id)}

@app.get("/fetch")
async def fetch_data():
    docs = await db.results.find().to_list(10)
    return {"results": docs}

# ──────────────────────────────────────────────────────────────────────────────
# Walmart via SerpAPI
# ──────────────────────────────────────────────────────────────────────────────

SERPAPI_KEY = os.getenv("SERPAPI_KEY", "")
WALMART_COLLECTION_NAME = os.getenv("MONGO_WALMART_COLLECTION", "walmart_items")
walmart_col = db[WALMART_COLLECTION_NAME]

# Make sure we can upsert idempotently
async def _ensure_indexes():
    # unique key to prevent duplicates
    await walmart_col.create_index("key", unique=True)
    await walmart_col.create_index([("last_seen_at", -1)])

@app.on_event("startup")
async def _walmart_startup():
    # Keep your existing startup behavior intact; this only adds indexes for Walmart collection
    try:
        await _ensure_indexes()
    except Exception as e:
        print(f"[pyapi] index creation warning: {e}")

class WalmartScrapeRequest(BaseModel):
    query: str = Field(..., description="Walmart search query")
    max_pages: int = Field(1, ge=1, le=20, description="How many SerpAPI pages to fetch")
    store_id: Optional[str] = Field(None, description="Optional Walmart store_id for local results")
    delay_ms: int = Field(500, ge=0, le=3000, description="Delay between page requests (to respect rate limits)")

class WalmartScrapeResult(BaseModel):
    query: str
    pages_fetched: int
    inserted: int
    updated: int
    total_processed: int
    sample_keys: List[str]

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _build_params(query: str, page: int, store_id: Optional[str]) -> Dict[str, Any]:
    return {
        "engine": "walmart",
        "api_key": SERPAPI_KEY,
        "query": query,
        "page": page,
        **({"store_id": store_id} if store_id else {}),
    }

def _extract_key_and_doc(item: Dict[str, Any], query: str) -> Tuple[str, Dict[str, Any]]:
    """
    SerpAPI Walmart items can include various identifiers. Try the most stable first.
    """
    # Try several identifiers SerpAPI commonly returns
    candidates = [
        item.get("us_item_id"),
        item.get("product_id"),
        item.get("item_id"),
        item.get("upc"),
        item.get("id"),
    ]
    key = next((c for c in candidates if c), None)
    if not key:
        # Fall back to title+link as a derived key (not perfect, but prevents total loss)
        key = f"{(item.get('title') or '').strip()}|{(item.get('link') or '').strip()}"
    key = str(key)

    # Normalize a subset while keeping the raw payload
    doc = {
        "key": key,
        "source": "walmart/serpapi",
        "query": query,
        "title": item.get("title"),
        "price": item.get("price"),
        "currency": item.get("currency"),
        "rating": item.get("rating"),
        "reviews": item.get("reviews"),
        "seller": (item.get("seller") or item.get("sold_by")),
        "link": item.get("link"),
        "thumbnail": item.get("thumbnail"),
        "availability": item.get("availability"),
        "brand": item.get("brand"),
        "category": item.get("category"),
        "last_seen_at": _now_iso(),
        "raw": item,  # store full raw record for future fields
    }
    return key, doc

async def _fetch_serpapi_page(client: httpx.AsyncClient, query: str, page: int, store_id: Optional[str]) -> Dict[str, Any]:
    if not SERPAPI_KEY:
        raise RuntimeError("SERPAPI_KEY not configured")
    params = _build_params(query, page, store_id)
    r = await client.get("https://serpapi.com/search.json", params=params)
    r.raise_for_status()
    return r.json()

@app.post("/walmart/scrape", response_model=WalmartScrapeResult)
async def walmart_scrape(req: WalmartScrapeRequest):
    """
    Pull Walmart search results from SerpAPI and upsert into Mongo.
    Idempotent via unique 'key' index.
    """
    if not SERPAPI_KEY:
        raise HTTPException(status_code=500, detail="SERPAPI_KEY not set on server")

    inserted = updated = processed = 0
    sample_keys: List[str] = []

    # One client per request; could also reuse a global client if you prefer
    async with httpx.AsyncClient(timeout=httpx.Timeout(30.0)) as client:
        pages_fetched = 0
        for page in range(1, req.max_pages + 1):
            try:
                data = await _fetch_serpapi_page(client, req.query, page, req.store_id)
            except httpx.HTTPStatusError as e:
                # SerpAPI may return 429 or 4xx when quota is hit or params invalid
                raise HTTPException(status_code=e.response.status_code, detail=str(e))
            except Exception as e:
                raise HTTPException(status_code=502, detail=f"SerpAPI error: {e}")

            pages_fetched += 1

            # SerpAPI Walmart results are typically in 'organic_results'
            items = data.get("organic_results") or data.get("items") or []
            for item in items:
                processed += 1
                key, doc = _extract_key_and_doc(item, req.query)

                # Upsert by key; track whether we inserted or updated
                res = await walmart_col.update_one(
                    {"key": key},
                    {
                        "$set": doc,
                        "$setOnInsert": {"created_at": _now_iso()},
                    },
                    upsert=True,
                )
                if res.upserted_id:
                    inserted += 1
                    if len(sample_keys) < 8:
                        sample_keys.append(key)
                elif res.matched_count:
                    updated += 1

            # If SerpAPI says no more pages, break early
            if not items:
                break

            # polite delay between pages
            if req.delay_ms > 0 and page < req.max_pages:
                await asyncio.sleep(req.delay_ms / 1000.0)

    return WalmartScrapeResult(
        query=req.query,
        pages_fetched=pages_fetched,
        inserted=inserted,
        updated=updated,
        total_processed=processed,
        sample_keys=sample_keys,
    )


# main.py (additions)
import os, re, time
from datetime import datetime, timedelta

SERPAPI_KEY = os.getenv("SERPAPI_KEY")
MONGO_URL = os.getenv("MONGO_URL")
MONGO_DB  = os.getenv("MONGO_DB", "MongoDB")
client = AsyncIOMotorClient(MONGO_URL); db = client[MONGO_DB]
WM_COLL  = os.getenv("MONGO_WALMART_COLLECTION","walmart_items")
AMZ_COLL = os.getenv("MONGO_AMAZON_COLLECTION","amazon_offers")

def parse_price(v):
    if v is None: return None
    if isinstance(v, (int,float)): return float(v)
    s = str(v).replace(",","")
    m = re.search(r"(\d+(?:\.\d{1,2})?)", s)
    return float(m.group(1)) if m else None

async def serp_amazon_by_upc(upc: str):
    if not SERPAPI_KEY:
        raise HTTPException(500, "SERPAPI_KEY not set")
    # Option 1: use SerpAPI amazon engine with q=upc
    params = {
        "engine": "amazon", "amazon_domain": "amazon.com",
        "q": upc, "gl": "us", "hl": "en", "api_key": SERPAPI_KEY
    }
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get("https://serpapi.com/search.json", params=params)
        r.raise_for_status(); data = r.json()
    # pick best priced organic result
    best = None; best_score = -1
    for item in data.get("organic_results", []):
        p = parse_price(item.get("price"))
        if p is None: continue
        # prefer results that mention the upc or look like exact product (simple heuristic)
        score = 1.0
        t = (item.get("title") or "").lower()
        if upc in (item.get("asin") or "").lower(): score += 0.3
        if "amazon's choice" in (item.get("badge") or "").lower(): score += 0.1
        if len(t) < 200: score += 0.05  # avoid mega-bundle titles
        if score > best_score: best, best_score = item, score
    return best

class IndexAmazonRequest(BaseModel):
    category: str | None = None
    limit_upcs: int = 50
    recache_hours: int = 72
    max_serp_calls: int = 25

@app.post("/amazon/index-by-upc")
async def index_amazon_by_upc(req: IndexAmazonRequest):
    """Find distinct UPCs from walmart_items (optionally by category), and cache Amazon offers for those UPCs."""
    if not SERPAPI_KEY: raise HTTPException(500, "SERPAPI_KEY not set")
    match = {"upc": {"$exists": True, "$ne": None}}
    if req.category:
        match["category"] = req.category
    # distinct UPCs, cheapest-first to prioritize likely wins
    upcs = await db[WM_COLL].distinct("upc", match)
    # Cap to limit_upcs
    upcs = upcs[:req.limit_upcs]

    cutoff = datetime.utcnow() - timedelta(hours=req.recache_hours)
    to_fetch = []
    for u in upcs:
        cached = await db[AMZ_COLL].find_one({"key_type":"upc","key_val":u,"checked_at":{"$gte":cutoff}})
        if not cached:
            to_fetch.append(u)
    to_fetch = to_fetch[:req.max_serp_calls]

    fetched = 0; cached_count = len(upcs) - len(to_fetch); failures = 0
    for upc in to_fetch:
        amz = await serp_amazon_by_upc(str(upc))
        if not amz:
            failures += 1; continue
        doc = {
            "key_type":"upc", "key_val": str(upc),
            "amz": {"asin": amz.get("asin"), "title": amz.get("title"), "link": amz.get("link"), "brand": amz.get("brand")},
            "price": amz.get("price"),
            "checked_at": datetime.utcnow()
        }
        await db[AMZ_COLL].update_one({"key_type":"upc","key_val": str(upc)}, {"$set": doc}, upsert=True)
        fetched += 1
        time.sleep(0.5)  # be gentle

    return {"distinct_upcs": len(upcs), "cached": cached_count, "fetched_now": fetched, "failures": failures}


@app.get("/deals/by-category")
async def deals_by_category(
    category: str = Query(...),
    min_abs: float = 5.0,
    min_pct: float = 0.20,
    limit: int = 50
):
    """
    Join walmart_items with amazon_offers on UPC and return items where Walmart is cheaper by thresholds.
    """
    pipeline = [
        {"$match": {"category": category, "upc": {"$exists": True, "$ne": None}}},
        {"$lookup": {
            "from": AMZ_COLL,
            "let": {"u": "$upc"},
            "pipeline": [
                {"$match": {"$expr": {"$and":[{"$eq":["$key_type","upc"]},{"$eq":["$key_val","$$u"]}]}}},
                {"$sort": {"checked_at": -1}},
                {"$limit": 1}
            ],
            "as": "amz"
        }},
        {"$unwind": "$amz"},
        {"$addFields": {
            "wm_price_num": {"$toDouble": {"$ifNull": ["$price", 0]}},
            "amz_price_num": {
                "$toDouble": {
                    "$ifNull": [
                        {"$arrayElemAt": [
                            {"$filter": {
                                "input": [
                                    {"$toDouble": {"$ifNull": ["$amz.price", None]}},
                                    {"$toDouble": {"$ifNull": ["$amz.price.value", None]}},
                                ],
                                "as": "p", "cond": {"$gt": ["$$p", 0]}
                            }}, 0
                        ]},
                        0
                    ]
                }
            }
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
                "price": "$wm_price_num",
                "brand": "$brand",
                "link": "$link",
                "thumbnail": "$thumbnail",
                "upc": "$upc"
            },
            "amz": {
                "asin": "$amz.amz.asin",
                "title": "$amz.amz.title",
                "price": "$amz_price_num",
                "link": "$amz.amz.link",
                "brand": "$amz.amz.brand",
                "checked_at": "$amz.checked_at"
            },
            "savings_abs": "$diff",
            "savings_pct": {"$multiply": ["$pct", 100]}
        }},
        {"$sort": {"savings_abs": -1, "savings_pct": -1}},
        {"$limit": limit}
    ]
    docs = await db[WM_COLL].aggregate(pipeline).to_list(limit)
    return {"count": len(docs), "deals": docs}


#DEBUGGING ROUTES
@app.get("/walmart/stats")
async def wm_stats():
    wm = db[os.getenv("MONGO_WALMART_COLLECTION","walmart_items")]
    total = await wm.count_documents({})
    with_upc = await wm.count_documents({"upc": {"$exists": True, "$ne": None}})
    cats = await wm.distinct("category")
    return {"walmart_total": total, "walmart_with_upc": with_upc, "categories": cats}

@app.get("/amazon/cache/stats")
async def amz_stats():
    amz = db[os.getenv("MONGO_AMAZON_COLLECTION","amazon_offers")]
    total = await amz.count_documents({})
    upc_keys = await amz.count_documents({"key_type":"upc"})
    sample = await amz.find_one({}, {"_id":0, "key_type":1, "key_val":1, "price":1, "checked_at":1})
    return {"amazon_offers_total": total, "amazon_upc_keys": upc_keys, "sample": sample}




#HELPERS TO PARSE UPC
GTIN_RE = re.compile(r'"gtin\d*"\s*:\s*"(\d+)"', re.I)
UPC_RE  = re.compile(r'"upc"\s*:\s*"(\d+)"', re.I)
CAT_RE  = re.compile(r'"category"\s*:\s*"(.*?)"', re.I)  # from JSON-LD sometimes

async def fetch_walmart_pdp_fields(url: str):
    """
    Fetches a Walmart PDP and tries to extract gtin/upc and category from JSON-LD.
    Returns dict like {"upc": "...", "gtin": "...", "category": "..."} where available.
    """
    out = {}
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get(url, headers={"user-agent": "Mozilla/5.0"})
            r.raise_for_status()
            html = r.text
    except Exception:
        return out

    m = GTIN_RE.search(html)
    if m:
        out["gtin"] = m.group(1)
        # plenty of Walmart pages only provide gtin; treat it as upc when length is 12
        if len(out["gtin"]) in (12, 13, 14):
            out.setdefault("upc", out["gtin"])

    m2 = UPC_RE.search(html)
    if m2:
        out["upc"] = m2.group(1)

    mc = CAT_RE.search(html)
    if mc:
        out["category"] = mc.group(1)

    return out

class EnrichUPCRequest(BaseException):
    pass

@app.post("/walmart/enrich-upc")
async def walmart_enrich_upc(limit: int = 25, recrawl_hours: int = 168):
    """
    For items missing 'upc', fetch their PDP and extract upc/gtin/category.
    Does NOT use SerpAPI → free.
    """
    cutoff = datetime.utcnow() - timedelta(hours=recrawl_hours)
    q = {
        "upc": {"$in": [None, ""]},
        "link": {"$exists": True, "$ne": None},
        "$or": [{"enriched_at": {"$exists": False}}, {"enriched_at": {"$lt": cutoff}}],
    }

    items = await db[WM_COLL].find(q, {"_id": 1, "link": 1, "title": 1}).limit(limit).to_list(limit)
    updated = 0
    for it in items:
        url = it.get("link")
        if not url:
            continue
        fields = await fetch_walmart_pdp_fields(url)
        if not fields:
            # still mark as attempted to avoid hammering
            await db[WM_COLL].update_one({"_id": it["_id"]}, {"$set": {"enriched_at": datetime.utcnow()}})
            continue
        fields["enriched_at"] = datetime.utcnow()
        fields["upc_source"] = "pdp"
        await db[WM_COLL].update_one({"_id": it["_id"]}, {"$set": fields})
        updated += 1
        time.sleep(0.3)  # gentle
    return {"checked": len(items), "updated": updated}