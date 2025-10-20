from fastapi import FastAPI, HTTPException
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
