const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User'); // Mongoose model

const router = express.Router();

/*
  POST /api/users/register
  Registers a new user
*/
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Missing required fields' });
    }

    // Check for existing user
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing) {
      return res.status(400).json({ message: 'Username or email already exists' });
    }

    // Hash password and save user
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ username, email, passwordHash });

    return res.status(201).json({ message: 'Account created successfully' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error during signup', error: err.message });
  }
});

/*
  POST /api/users/login
  Logs in an existing user
*/
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validate input
    if (!username || !password) {
      return res.status(400).json({ message: 'Missing credentials' });
    }

    // Find user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid username or password' });
    }

    return res.status(200).json({ message: 'Login successful', userId: user._id });
  } catch (err) {
    return res.status(500).json({ message: 'Server error during login', error: err.message });
  }
});

module.exports = router;
