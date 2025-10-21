const bcrypt = require('bcryptjs'); // Import bcryptjs to hash and compare passwords
const User = require('../models/User'); // Import User model/schema

/*
  Asynchronous: The function might take time to complete, so dont halt the program, 
    return a Promise that eventually resolves with a value (or rejects with an error)
  'async' allows the use of 'await' for asynchronous operations like database calls
*/

/*
  Asynchronous function to handle user registration
  
  ARGS:
    req = Incoming request from client
    res = Response to client
*/ 
const registerUser = async (req, res) => {
  try {
    // Extract these values from req body
    const { username, email, password } = req.body; 
    
    // Make sure they entered something for all fields
    if (!username || !email || !password)
      return res.status(400).json({ message: 'Missing required fields' });

    // Check if username or email already exist in DB. 'await' pauses till DB responds
    const existing = await User.findOne({ $or: [{ username }, { email }] });
    if (existing)
      return res.status(400).json({ message: 'Username or email already exists' });

    // Hash the password using bcrypt. '10' = the "salt rounds", the higher the more secure
    const passwordHash = await bcrypt.hash(password, 10);
    await User.create({ username, email, passwordHash });

    res.status(201).json({ message: 'Account created successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error during signup', error: err.message });
  }
};



/*
  Asynchronous function to handle user log in

  ARGS:
    req = Incoming request from client
    res = Response to client
*/ 
const loginUser = async (req, res) => {
  try {
    // Extract these values from req body
    const { username, password } = req.body;
    
    // Make sure they entered something for all fields
    if (!username || !password)
      return res.status(400).json({ message: 'Missing credentials' });

    // Look for that user within the DB
    const user = await User.findOne({ username });
    if (!user)
      return res.status(400).json({ message: 'Invalid username or password' }); // maybe make this more specific

    // Compare provided password with hashed password in DB
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch)
      return res.status(400).json({ message: 'Invalid username or password' }); // maybe make this more specific

    res.status(200).json({ message: 'Login successful', userId: user._id });
  } catch (err) {
    res.status(500).json({ message: 'Server error during login', error: err.message });
  }
};

// Export the functions for use in other files
module.exports = { registerUser, loginUser };