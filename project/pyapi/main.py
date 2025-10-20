from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
import os

app = FastAPI()

# Mongo connection
MONGO_URL = os.getenv("MONGO_URL")
client = AsyncIOMotorClient(MONGO_URL)
db = client["your_db_name"]  # replace with actual DB name in Railway

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
