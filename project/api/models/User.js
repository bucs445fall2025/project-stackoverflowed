const mongoose = require('mongoose'); // Import Mongoose, a node.js library for working with MongoDB

// Define what a user document looks like in MongoDB
const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email:    { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },

  amazon: {
    accessToken: String,
    refreshToken: String,
    tokenExpiry: Date,
  },
}, { timestamps: true });

// Create and export the User model to be 
module.exports = mongoose.model('User', userSchema);