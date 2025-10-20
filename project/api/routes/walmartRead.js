// routes/walmartRead.js
const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Use the EXACT same collection name pyapi writes to
const WalmartItemSchema = new mongoose.Schema({}, { strict: false });
const WalmartItem = mongoose.models.WalmartItem
  || mongoose.model("WalmartItem", WalmartItemSchema, "walmart_items");

// Quick count + sample
router.get("/walmart/debug", async (_req, res) => {
  const count = await WalmartItem.countDocuments();
  const sample = await WalmartItem.findOne({}, { _id: 0 }).lean();
  res.json({ node_mongo_url: process.env.MONGO_URL, count, sample });
});

// Normal list
router.get("/walmart/items", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "30", 10), 100);
  const q = req.query.q;
  const filter = q ? { title: new RegExp(q, "i") } : {};
  const items = await WalmartItem.find(filter).sort({ updatedAt: -1 }).limit(limit).lean();
  res.json({ items });
});

module.exports = router;
