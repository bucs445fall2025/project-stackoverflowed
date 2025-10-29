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

  router.post("/deals", async (req, res) => {
    try {
      const { categoryLabel, collection } = req.body || {};
      const resolved = COLLECTION_MAP[categoryLabel];
  
      // do not trust client-provided "collection"; use our map
      const coll = resolved || null;
      if (!coll) {
        return res.status(400).json({ error: "Unknown category label" });
      }
  
      // forward to PyAPI with a query override, e.g. ?amz_coll=amz_electronics
      const url = `${process.env.PYAPI_URL}/deals/by-title?amz_coll=${encodeURIComponent(coll)}&min_abs=5&min_pct=0.2&min_sim=86&limit=120`;
      const r = await fetch(url, { headers: { "Cache-Control": "no-cache" } });
  
      // always return JSON to the client
      const ct = r.headers.get("content-type") || "";
      const payload = ct.includes("application/json") ? await r.json() : { error: await r.text() };
  
      res.status(r.status).json(payload);
    } catch (err) {
      console.error("Proxy error (/api/amazon/deals):", err);
      res.status(500).json({ error: "Proxy to pyapi failed" });
    }
  });