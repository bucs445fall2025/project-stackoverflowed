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
    const r = await fetch(`${process.env.PYAPI_URL}/walmart/stats`);
    const data = await r.json();

    // Shape into items array if needed
    res.json({ items: data.items || data });
  } catch (err) {
    console.error("Proxy error (walmart/items):", err);
    res.status(500).json({ error: "Failed to fetch Walmart items" });
  }
});

module.exports = router;
