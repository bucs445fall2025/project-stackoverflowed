// routes/userRoutes.js

const express = require("express"); // Import express to so we can create a router object 
const bcrypt = require("bcryptjs"); // Used to hash passwords
const jwt = require("jsonwebtoken"); // Used to create and verify authentication tokens
const User = require("../models/User"); // Imports the User model for database interactions

// Create a new express router instance to attach HTTP methods and paths to
const router = express.Router();

/* 
    Defines the POST route at /register that listens for POST requests.
    When a client sends a POST request to /api/users/register, 
    this route handles user registration logic directly.
*/
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Checks if all required fields were provided in the request body
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required." });
    }

    // Checks if a user with the same email already exists in the database
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(409)
        .json({ error: "User with this email already exists." });
    }

    // Hashes the password before storing it in the database
    const hashedPassword = await bcrypt.hash(password, 10);

    // Creates a new user document and saves it
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // Generates a JWT token that will be sent back to the client
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "dev_secret_change_me",
      { expiresIn: "7d" }
    );

    // Sends back user info and token upon successful registration
    return res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

/* 
    Defines the POST route at /login that listens for POST requests.
    When a client sends a POST request to /api/users/login,
    this route handles authentication by verifying user credentials.
*/
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Checks if both email and password were provided in the request body
    if (!email || !password) {
      return res
        .status(400)
        .json({ error: "Email and password are required." });
    }

    // Finds a user in the database by their email address
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Compares the entered password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    // Generates a new JWT token upon successful login
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET || "dev_secret_change_me",
      { expiresIn: "7d" }
    );

    // Sends back user info and token upon successful login
    return res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      token,
    });
  } catch (err) {
    next(err);
  }
});

// Exports the router so it can be imported into app.js
module.exports = router;
