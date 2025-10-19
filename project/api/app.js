// app.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const connectDB = require('./db'); 

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
const amazonRoutes = require('./routes/amazonRoutes'); // Importing amazon routes
app.use('/api/amazon', amazonRoutes); // Mount amazon routes

const userRoutes = require('./routes/userRoutes'); // Importing user routes
app.use('/api/users', userRoutes); // Mount user routes

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong (app.js)' });
});

// Health check
app.get('/', (_req, res) => res.send('Hello from backend (sandbox)'));

// Bind 0.0.0.0 for Railway/Docker, fall back for local
const port = process.env.PORT || 8080;
connectDB().then(() => {
  app.listen(port, '0.0.0.0', () => {
  console.log(`Backend (sandbox) running on port ${port}`);
  });
});