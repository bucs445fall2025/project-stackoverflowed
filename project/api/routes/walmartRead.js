const express = require("express");
const WalmartItem = require("../models/WalmartItem");
const router = express.Router();

router.get("/walmart/items", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || "30", 10), 100);
  const q = req.query.q;
  const filter = q ? { title: new RegExp(q, "i") } : {};
  const items = await WalmartItem.find(filter).sort({ updatedAt: -1 }).limit(limit).lean();
  res.json({ items });
});

module.exports = router;