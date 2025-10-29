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
const COLLECTION_MAP = {
  "Electronics": "amz_electronics",
  "Health & Wellness": "amz_health_wellness",
  "Home & Kitchen": "amz_home_kitchen",
  "Toys & Games": "amz_toys_games",
  "Beauty": "amz_beauty",
  "Grocery": "amz_grocery",
  "Sports & Outdoors": "amz_sports_outdoors",
  "Pet Supplies": "amz_pet_supplies",
};
const slugify = (label) =>
  label
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');

const mapLabelToCollections = (label) => {
  const slug = slugify(label || '');
  const defaults = { wm_coll: `wm_${slug}`, amz_coll: `amz_${slug}` };

  // Optional hard overrides if any label uses a special collection name:
  const OVERRIDES = {
    // 'Electronics': { wm_coll: 'wm_electronics', amz_coll: 'amz_electronics' },
  };
  return OVERRIDES[label] || defaults;
};


router.post("/walmart/scrape", async (req, res) => {
  try {
    const { category = '', ...rest } = req.body || {};
    if (!category) {
      return res.status(400).json({ error: "category is required" });
    }

    const { wm_coll } = mapLabelToCollections(category);
    const url = `${process.env.PYAPI_URL}/walmart/scrape?${new URLSearchParams({ wm_coll })}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rest), // keep existing fields: query, pages, max_products, etc.
    });

    const ct = r.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await r.json() : { error: await r.text() };
    res.status(r.status).json(data);
  } catch (err) {
    console.error("Proxy error (walmart/scrape):", err);
    res.status(500).json({ error: "Proxy to pyapi failed" });
  }
});


//UPC enrichment proxy
router.post("/walmart/enrich-upc", async (req, res, next) => {
  try {
    const { category = '' } = req.body || {};
    const limit = Number(req.query.limit || req.body?.limit || 100);

    if (!category) {
      return res.status(400).json({ error: "category is required" });
    }

    const { wm_coll } = mapLabelToCollections(category);
    const qs = new URLSearchParams({ limit: String(limit), wm_coll });

    const r = await fetch(`${process.env.PYAPI_URL}/walmart/enrich-upc?${qs.toString()}`, {
      method: "POST",
    });

    const ct = r.headers.get("content-type") || "";
    const data = ct.includes("application/json") ? await r.json() : { error: await r.text() };
    res.status(r.status).json(data);
  } catch (e) {
    next(e);
  }
});


// GET /api/walmart/items -> proxies to FastAPI /walmart/stats
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

// POST /api/walmart/index-by-title  -> proxy to PyAPI /amazon/index-by-title
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

// GET /api/walmart/deals/by-title  -> proxy to PyAPI /deals/by-title
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
