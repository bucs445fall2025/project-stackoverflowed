const express = require('express'); // Import express to so we can create a router object 

// Create a new express router instance to attach HTTP methods and paths to
const router = express.Router();

// Imports all exported functions from userController. They handle the logic at a certain route
const userController = require('../controllers/userController');

/* 
    Defines a the POST routes at /register and /login on this router that listen for GET reqs.
    When a client sends a POST request to /api/users/register or /login, express will call the 
    corresponding controller function
*/
router.post('/register', userController.registerUser);
router.post('/login', userController.loginUser);

// Exports the router so it can be imported into app.js
module.exports = router;