// app.js
require('dotenv').config(); // Loads variables from .env into process.env
const express = require('express'); // Import express for back-end framework
const cors = require('cors'); // Import CORS middleware to allow front-end to request to this server  
const connectDB = require('./config/db');  // Import connectDB()


const app = express(); // Create a new express app instance
app.use(cors({ origin: '*' })); // Add CORS middleware to the app instance. '*' = any domain can send reqs here
app.use(express.json()); // Adds middleware to automatically parse incoming JSON in request bodies 

// Routes --- using /api/amazon for all the data ingestion/processing routes for continuity and ease of use
const amazonRoutes = require('./routes/amazonRoutes'); // Importing amazon routes
app.use('/api/amazon', amazonRoutes); // Mounts them under /api/amazon so any reqs to /api/amazon/... will be handled by that router
const userRoutes = require('./routes/userRoutes'); // Importing user routes
app.use('/api/users', userRoutes); // Mounts them under /api/users
//for walmart stuff
const walmartRoutes = require('./routes/walmartRoutes');
app.use('/api/amazon', walmartRoutes); 
const walmartRead = require('./routes/walmartRead');
app.use('/api/amazon', walmartRead);


const dbDebug = require("./routes/dbDebug");
app.use("/api", dbDebug);
const usersDebug = require("./routes/usersDebug");
app.use("/api", usersDebug);



// Global error handler for routes
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong (app.js)' });
});

// Health check, for checking if server is running
app.get('/', (_req, res) => res.send('Hello from backend (sandbox)'));

 // Sets the port for the server to listen on
const port = process.env.PORT || 8080;

// Connect database first, then start express server
connectDB().then(() => {
  // 0.0.0.0 Allows the server to accept connections from any network interface (important for Docker/railway)
  app.listen(port, '0.0.0.0', () => { 
  console.log(`Backend (sandbox) running on port ${port}`);
  });

  
});