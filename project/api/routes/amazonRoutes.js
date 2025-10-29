const express = require('express'); // Import express to so we can create a router object 

// Create a new express router instance to attach HTTP methods and paths to
const router = express.Router();

// Imports all exported functions from amazonController. They handle the logic at a certain route
const amazonController = require('../controllers/amazonController');

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
      const r = await fetch(`${process.env.PYAPI_URL}/amazon/index-upc`, {
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

  router.get("/deals-by-upc", async (req, res) => {
    try {
      const qs = new URLSearchParams(req.query).toString();
      const r = await fetch(`${process.env.PYAPI_URL}/deals/by-upc?${qs}`, { headers: { "Cache-Control": "no-cache" }});
      const data = await r.json();
      res.set("Cache-Control", "no-store");
      res.status(r.status).json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post("/deals", async (req, res) => {
    try {
      const { category, min_pct = 0.2, min_abs = 5, limit = 200, min_sim = 90 } = req.body || {};
      const qs = new URLSearchParams({
        min_pct: String(min_pct),
        min_abs: String(min_abs),
        limit: String(limit),
        category: category || "",
      });
  
      // UPC-based deals
      const upcRes = await fetch(`${process.env.PYAPI_URL}/deals/by-upc?${qs.toString()}`, {
        headers: { "Cache-Control": "no-cache" },
      });
      const upcJson = await upcRes.json();
      const upcDeals = Array.isArray(upcJson.deals) ? upcJson.deals : [];
  
      // Title-based deals
      const qs2 = new URLSearchParams(qs);
      qs2.set("min_sim", String(min_sim));
      const titleRes = await fetch(`${process.env.PYAPI_URL}/deals/by-title?${qs2.toString()}`, {
        headers: { "Cache-Control": "no-cache" },
      });
      const titleJson = await titleRes.json();
      const titleDeals = Array.isArray(titleJson.deals) ? titleJson.deals : [];
  
      // Merge results
      const deals = [...upcDeals, ...titleDeals];
      res.status(200).json({ deals });
    } catch (err) {
      console.error("Proxy error (combined deals):", err);
      res.status(500).json({ error: "Failed to fetch deals" });
    }
  });