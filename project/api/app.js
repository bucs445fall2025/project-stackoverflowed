// app.js
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const amazonRoutes = require('./routes/amazonRoutes'); // Importing amazon routes
app.use('/api/amazon', amazonRoutes); // Mount amazon routes

const userRoutes = require('./routes/userRoutes'); // Importing user routes
app.use('/api/users', userRoutes); // Mount user routes

require('dotenv').config();

// Bind 0.0.0.0 for Railway/Docker, fall back for local
const port = process.env.PORT || 8080;

/*  
  Establishes connection to Mongo database using Mongoose
  
  "fbalgo database" is the name of the MongoDB databse the backend will use if running a local MongoDB instance
  MongoDB doesnt create database until data is inserted
*/
mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/fbalgo', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Health check
app.get('/', (_req, res) => res.send('Hello from backend (sandbox)'));

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend (sandbox) running on port ${port}`);
});