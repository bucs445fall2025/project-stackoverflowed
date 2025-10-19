const mongoose = require('mongoose'); // Import Mongoose, a node.js library for working with MongoDB
require('dotenv').config(); // Loads variables from .env into process.env

// Connection string tells app how to connect to DB, just an address. 
// Uses the one from environment variables on Railway
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/fbalgo';

/* 
    Asynchronous function that connects to MongoDB 
    Asynchronous: The function might take time to complete, so dont halt the program, 
    return a Promise that eventually resolves with a value (or rejects with an error)
*/
const connectDB = async () => {
  try {
    await mongoose.connect(MONGO_URL, { // 'await' Pauses execution until Promise resolves
      useNewUrlParser: true, // Tells Mongoose to use the new MongoDB connection string parser
      useUnifiedTopology: true, // Tells Mongoose to use the new topology engine, for beter connection handling and monitoring
    });
    console.log('Connected to MongoDB');
  } catch (err) {
    console.error('MongoDB connection error:', err);
    process.exit(1); // Stop Node.js process cause it cant work without a DB
  }
};

// Exports the connectDB function so it can be imported into app.js
module.exports = connectDB;