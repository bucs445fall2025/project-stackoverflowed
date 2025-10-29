const express = require('express'); // Import express to so we can create a router object 

// Create a new express router instance to attach HTTP methods and paths to
const router = express.Router();

// Imports all exported functions from amazonController. They handle the logic at a certain route
const amazonController = require('../controllers/amazonController');

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

/* 
    Defines the POST routes that listen for GET reqs.
    When a client sends a POST request to /api/users/register or /login, express will call the 
    corresponding controller function

    e.g.: Someone hits /api/amazon/auth/login and it runs amazonController.login (because of the mount in app.js),
*/
router.get('/auth/login', amazonController.login);
router.get('/auth/callback', amazonController.callback);
router.get('/spapi/sandbox-check', amazonController.sandboxCheck);
router.get('/spapi/products', amazonController.sandboxCheck);



// Exports the router so it can be imported into app.js
module.exports = router;

router.post("/amazon/scrape-category", async (req, res) => {
    try {
      const r = await fetch(`${process.env.PYAPI_URL}/amazon/scrape-category`, {
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

  router.post("/index-upc", async (req, res) => {
    try {
      const { category = '' } = req.body || {};
      if (!category) return res.status(400).json({ error: 'category is required' });
  
      const { wm_coll, amz_coll } = mapLabelToCollections(category);
  
      const qs = new URLSearchParams({ wm_coll, amz_coll });
  
      const r = await fetch(`${process.env.PYAPI_URL}/amazon/index-upc?${qs.toString()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await r.json();
      res.status(r.status).json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/index-by-title", async (req, res) => {
    try {
      const { category = '' } = req.body || {};
      if (!category) return res.status(400).json({ error: 'category is required' });
  
      const { wm_coll, amz_coll } = mapLabelToCollections(category);
  
      const qs = new URLSearchParams({ wm_coll, amz_coll });
  
      const r = await fetch(`${process.env.PYAPI_URL}/amazon/index-by-title?${qs.toString()}`, {
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
  

  router.post('/deals', async (req, res) => {
    try {
      const { category = '', min_abs, min_pct, min_sim, limit } = req.body || {};
      if (!category) {
        return res.status(400).json({ error: 'category is required' });
      }
  
      const { wm_coll, amz_coll } = mapLabelToCollections(category);
  
      // Build a base QS with both coll names; add optional thresholds if provided
      const baseParams = new URLSearchParams({ wm_coll, amz_coll });
      if (min_abs != null) baseParams.set('min_abs', String(min_abs));
      if (min_pct != null) baseParams.set('min_pct', String(min_pct));
      if (min_sim != null) baseParams.set('min_sim', String(min_sim)); // for by-title
      if (limit    != null) baseParams.set('limit', String(limit));
  
      // UPC-based deals
      const upcRes = await fetch(`${process.env.PYAPI_URL}/deals/by-upc?${baseParams.toString()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const upcJson = await upcRes.json();
      const upcDeals = Array.isArray(upcJson.deals) ? upcJson.deals : [];
  
      // Title-based deals
      const titleRes = await fetch(`${process.env.PYAPI_URL}/deals/by-title?${baseParams.toString()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      const titleJson = await titleRes.json();
      const titleDeals = Array.isArray(titleJson.deals) ? titleJson.deals : [];
  
      res.status(200).json({ deals: [...upcDeals, ...titleDeals] });
    } catch (err) {
      console.error('Proxy error (combined deals):', err);
      res.status(500).json({ error: 'Failed to fetch deals' });
    }
  });