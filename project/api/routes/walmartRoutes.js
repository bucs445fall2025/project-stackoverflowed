// routes/walmartRoutes.js
const express = require("express");
const { fetch } = require("undici");

const router = express.Router();

// POST /api/amazon/walmart/scrape -> proxies to FastAPI /walmart/scrape
router.post("/walmart/scrape", async (req, res) => {
  try {
    const r = await fetch(`${process.env.PYAPI_URL}/walmart/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    // Parse JSON
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    console.error("Proxy error (walmart/scrape):", err);
    res.status(500).json({ error: "Proxy to pyapi failed" });
  }
});

// GET /api/amazon/walmart/items -> proxies to FastAPI /walmart/stats
router.get("/walmart/items", async (req, res) => {
  try {
    const url = `${process.env.PYAPI_URL}/walmart/items?${new URLSearchParams(req.query)}`;
    const r = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
    const data = await r.json();
    res.set("Cache-Control", "no-store");
    return res.status(r.status).json({ items: Array.isArray(data.items) ? data.items : [] });
  } catch (err) {
    console.error("Proxy error (walmart/items):", err);
    return res.status(500).json({ error: "Failed to fetch Walmart items" });
  }
});

module.exports = router;
