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