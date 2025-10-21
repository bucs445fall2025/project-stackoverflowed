// routes/walmartRoutes.js
const express = require("express");
const { fetch } = require("undici");

const router = express.Router();

async function forwardJsonOrText(upstreamRes) {
  const ct = upstreamRes.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      return await upstreamRes.json();
    }
    // HTML / text fallback
    const text = await upstreamRes.text();
    return { error: text }; // wrap so the client still gets JSON
  } catch (e) {
    // last-resort: try to read text body for debugging
    try {
      const text = await upstreamRes.text();
      return { error: "Non-JSON response", body: text };
    } catch {
      return { error: "Failed to parse upstream response" };
    }
  }
}


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

//UPC enrichment proxy
router.post('/walmart/enrich-upc', async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || req.body?.limit || 100);
    const r = await fetch(`${process.env.PYAPI_URL}/walmart/enrich-upc?limit=${limit}`, {
      method: 'POST',
    });
    const data = await r.json().catch(() => ({}));
    res.status(r.status).json(data);
  } catch (e) { next(e); }
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

router.post("/walmart/scrape-category", async (req, res) => {
  try {
    const r = await fetch(`${process.env.PYAPI_URL}/walmart/scrape-category`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await r.json();
    res.status(r.status).json(data);
  } catch (err) {
    res.status(500).json({ error: "Proxy failed", detail: err.message });
  }
});

//Should probably put these routes below in a separate amazon cache file , this is calling amazon serp routes

// POST /api/amazon/index-by-title  -> proxy to PyAPI /amazon/index-by-title
router.post("/index-by-title", async (req, res) => {
  try {
    const r = await fetch(`${process.env.PYAPI_URL}/amazon/index-by-title`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const payload = await forwardJsonOrText(r);
    res.status(r.status).json(payload);
  } catch (err) {
    console.error("Proxy error (index-by-title):", err);
    res.status(502).json({ error: "Proxy to pyapi failed" });
  }
});

// GET /api/amazon/deals/by-title  -> proxy to PyAPI /deals/by-title
router.get("/deals/by-title", async (req, res) => {
  try {
    const url = `${process.env.PYAPI_URL}/deals/by-title?${new URLSearchParams(req.query)}`;
    const r = await fetch(url);
    const payload = await forwardJsonOrText(r);
    res.status(r.status).json(payload);
  } catch (err) {
    console.error("Proxy error (deals/by-title):", err);
    res.status(502).json({ error: "Proxy to pyapi failed" });
  }
});
