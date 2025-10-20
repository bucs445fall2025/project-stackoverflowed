const express = require("express");
// Polyfill fetch for Node < 18
const { fetch } = require("undici");   // fetch present here

const router = express.Router();
const PYAPI_URL = process.env.PYAPI_URL || "http://localhost:8001";

router.post("/walmart/scrape", async (req, res) => {
  try {
    const { query, max_pages = 1, store_id = null, delay_ms = 600 } = req.body || {};
    if (!query) return res.status(400).json({ error: "query is required" });

    const r = await fetch(`${PYAPI_URL}/walmart/scrape`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, max_pages, store_id, delay_ms }),
    });

    const text = await r.text();
    let payload; try { payload = JSON.parse(text); } catch { payload = { error: text }; }
    return res.status(r.status).json(payload);
  } catch (err) {
    console.error("pyapi scrape error:", err);
    return res.status(502).json({ error: "pyapi unavailable" });
  }
});

module.exports = router;
