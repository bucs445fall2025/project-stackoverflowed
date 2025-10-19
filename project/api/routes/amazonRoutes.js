// Import express to so we can create a router object 
const express = require('express');

/* Import functions from amazonController.js, using destructuring in order to only import 
   the funcs, not the whole controller object */
const amazonController = require('../controllers/amazonController');

// Create a new express router instance to attach HTTP methods and paths to
const router = express.Router();

router.get('/auth/login', amazonController.login);
router.get('/auth/callback', amazonController.callback);
router.get('/spapi/sandbox-check', amazonController.sandboxCheck);
router.get('/spapi/products', amazonController.sandboxCheck);

module.exports = router;