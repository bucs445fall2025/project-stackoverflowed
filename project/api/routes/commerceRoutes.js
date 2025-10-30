// routes/commerceRoutes.js
const express = require("express");
const { fetch } = require("undici");
const OpenAI = require("openai");
const router = express.Router();

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

// ───────────────────────────────────────────────────────────────
// Category → Collection mapping
// ───────────────────────────────────────────────────────────────
const slugify = (label) =>
  label
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const mapLabelToCollections = (label) => {
  const slug = slugify(label || "");
  return {
    wm_coll: `wm_${slug}`,
    amz_coll: `amz_${slug}`,
  };
};

// ───────────────────────────────────────────────────────────────
// Helper: Parse JSON OR fallback to readable error text
// ───────────────────────────────────────────────────────────────
async function forwardJsonOrText(upstreamRes) {
  const ct = upstreamRes.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) return await upstreamRes.json();
    const text = await upstreamRes.text();
    return { error: text };
  } catch (e) {
    return { error: "Failed to parse upstream response" };
  }
}

// ───────────────────────────────────────────────────────────────
// Walmart Scrape Proxy
// ───────────────────────────────────────────────────────────────
router.post("/walmart/scrape", async (req, res) => {
  try {
    const { category = "", ...rest } = req.body || {};
    if (!category) return res.status(400).json({ error: "category is required" });

    const { wm_coll } = mapLabelToCollections(category);

    const url = `${process.env.PYAPI_URL}/walmart/scrape?${new URLSearchParams({ wm_coll })}`;

    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rest),
    });

    const payload = await forwardJsonOrText(r);
    return res.status(r.status).json(payload);
  } catch (err) {
    console.error("Proxy error (walmart/scrape):", err);
    res.status(500).json({ error: "Proxy failed" });
  }
});

// ───────────────────────────────────────────────────────────────
// Walmart Items View
// ───────────────────────────────────────────────────────────────
router.get("/walmart/items", async (req, res) => {
  try {
    const url = `${process.env.PYAPI_URL}/walmart/items?${new URLSearchParams(req.query)}`;
    const r = await fetch(url);
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    console.error("Proxy error (walmart/items):", err);
    return res.status(500).json({ error: "Failed to fetch Walmart items" });
  }
});

// ───────────────────────────────────────────────────────────────
// UPC Enrichment
// ───────────────────────────────────────────────────────────────
router.post("/walmart/enrich-upc", async (req, res) => {
  try {
    const { category = "" } = req.body || {};
    const limit = Number(req.query.limit || req.body?.limit || 100);

    if (!category) return res.status(400).json({ error: "category is required" });

    const { wm_coll } = mapLabelToCollections(category);
    const qs = new URLSearchParams({ limit: String(limit), wm_coll });

    const r = await fetch(`${process.env.PYAPI_URL}/walmart/enrich-upc?${qs.toString()}`, {
      method: "POST",
    });

    const payload = await forwardJsonOrText(r);
    return res.status(r.status).json(payload);
  } catch (err) {
    console.error("Proxy error (enrich-upc):", err);
    return res.status(500).json({ error: "Failed" });
  }
});

// ───────────────────────────────────────────────────────────────
// Amazon Cache: Title + UPC Indexing
// ───────────────────────────────────────────────────────────────
router.post("/amazon/index-upc", async (req, res) => {
  try {
    const { category = "" } = req.body || {};
    if (!category) return res.status(400).json({ error: "category is required" });

    const { amz_coll, wm_coll } = mapLabelToCollections(category);
    const qs = new URLSearchParams({ amz_coll, wm_coll });

    const r = await fetch(`${process.env.PYAPI_URL}/amazon/index-upc?${qs.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const payload = await forwardJsonOrText(r);
    return res.status(r.status).json(payload);
  } catch (err) {
    console.error("Proxy error (index-upc):", err);
    res.status(500).json({ error: "Failed" });
  }
});

router.post("/amazon/index-by-title", async (req, res) => {
  try {
    const { category = "" } = req.body || {};
    if (!category) return res.status(400).json({ error: "category is required" });

    const { amz_coll, wm_coll } = mapLabelToCollections(category);
    const qs = new URLSearchParams({ amz_coll, wm_coll });

    const r = await fetch(`${process.env.PYAPI_URL}/amazon/index-by-title?${qs.toString()}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const payload = await forwardJsonOrText(r);
    return res.status(r.status).json(payload);
  } catch (err) {
    console.error("Proxy error (index-by-title):", err);
    res.status(500).json({ error: "Failed" });
  }
});

// ───────────────────────────────────────────────────────────────
// Combined Deals Route ✅
// (Category only REQUIRED now — other params optional)
// ───────────────────────────────────────────────────────────────
router.post("/deals", async (req, res) => {
  try {
    const { category = "", min_abs, min_pct, min_sim, limit } = req.body || {};
    if (!category) return res.status(400).json({ error: "category is required" });

    const { amz_coll, wm_coll } = mapLabelToCollections(category);
    const qs = new URLSearchParams({ amz_coll, wm_coll });

    if (min_abs) qs.set("min_abs", String(min_abs));
    if (min_pct) qs.set("min_pct", String(min_pct));
    if (min_sim) qs.set("min_sim", String(min_sim));
    if (limit) qs.set("limit", String(limit));

    const upcRes = await fetch(`${process.env.PYAPI_URL}/deals/by-upc?${qs.toString()}`);
    const upcData = await upcRes.json();
    const upcDeals = upcData.deals || [];

    const titleRes = await fetch(`${process.env.PYAPI_URL}/deals/by-title?${qs.toString()}`);
    const titleData = await titleRes.json();
    const titleDeals = titleData.deals || [];

    let combined = [...upcDeals, ...titleDeals];

    // ✅ GPT Deal Filtering (optional smart cleanup)
    if (combined.length > 0) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Filter out irrelevant, mismatched or bad deals. Return a JSON array of valid Walmart-vs-Amazon comparisons only.",
            },
            {
              role: "user",
              content: JSON.stringify(combined),
            },
          ],
        });

        const result = completion.choices[0]?.message?.content || "";
        const filtered = JSON.parse(result);
        if (Array.isArray(filtered)) combined = filtered;
      } catch (e) {
        console.warn("GPT returned non-JSON — fallback to unfiltered");
      }
    }

    return res.status(200).json({ deals: combined });
  } catch (err) {
    console.error("Proxy error (deals):", err);
    res.status(500).json({ error: "Failed to fetch deals" });
  }
});

module.exports = router;
