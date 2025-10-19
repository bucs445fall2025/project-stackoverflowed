const mongoose = require('mongoose');

// Defines what a user document looks like in the MongoDB
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

// Creates and exports the User model
module.exports = mongoose.model('User', userSchema);