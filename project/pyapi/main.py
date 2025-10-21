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
async def walmart_enrich_upc(limit:int=100):
    cur = db[WM_COLL].find({"upc":{"$exists":False}}).limit(limit)
    docs = await cur.to_list(length=limit)
    updated=0
    for d in docs:
        try:
            pr = await walmart_product_details(d["product_id"])
            if not pr: continue
            raw_upc = pr.get("upc") or pr.get("gtin")
            upc = normalize_upc(raw_upc)
            if upc:
                await db[WM_COLL].update_one({"_id":d["_id"]},{"$set":{"upc":upc,"gtin_raw":raw_upc}})
                updated+=1
        except: pass
        await asyncio.sleep(0.3)
    return {"considered":len(docs),"updated":updated}

# ──────────────────────────────────────────────────────────────────────────────
# Amazon cache by UPC
# ──────────────────────────────────────────────────────────────────────────────
async def serp_amazon_by_upc(upc: str) -> Optional[Dict[str,Any]]:
    data = await serp_get("https://serpapi.com/search.json",{
        "engine":"amazon","amazon_domain":"amazon.com","k":upc,"gl":"us","hl":"en"
    })
    for it in data.get("organic_results", []):
        p = parse_price(it.get("price"))
        if p is None: continue
        it["price_num"] = p
        return it
    return None

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
