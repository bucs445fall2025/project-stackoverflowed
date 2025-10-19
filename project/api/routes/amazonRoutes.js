const express = require('express'); // Import express to so we can create a router object 

// Create a new express router instance to attach HTTP methods and paths to
const router = express.Router();

// Imports all exported functions from amazonController. They handle the logic at a certain route
const amazonController = require('../controllers/amazonController');

// Define the routes that listen for GET reqs 
//    e.g.: Someone hits /api/amazon/auth/login and it runs amazonController.login (because of the mount in app.js),
router.get('/auth/login', amazonController.login);
router.get('/auth/callback', amazonController.callback);
router.get('/spapi/sandbox-check', amazonController.sandboxCheck);
router.get('/spapi/products', amazonController.sandboxCheck);

// Exports the router so it can be imported into app.js
module.exports = router;