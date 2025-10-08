// app.js
const express = require('express'); // For webserver and routes
const cors = require('cors'); // Allows requests from other domains (like frontend running on localhost:3000)
const axios = require('axios'); // Used to make HTTP requests (specifically for exchanging auth codes for tokens)
require('dotenv').config(); // loads environment variables from .env file

const app = express(); // Creates the main Express app instance

// Allows any origin to access API, need to restrict later...
app.use(cors({ origin: '*' }));
// Allows Express to parse JSON bodies in incoming requests
app.use(express.json());

// Uses Railway's provided port or uses 8080 for local development
const port = process.env.PORT || 8080;

// GET endpoint so we can verify the backend is running
app.get('/', (_req, res) => res.send('Hello from backend'));

// ---------- LWA STEP 1: send user to Amazon ----------
// Front end sends user here when they click "Log in With Amazon" button
app.get('/auth/login', (req, res) => {

  const state = Math.random().toString(36).slice(2); // TODO: store/verify in prod

  // These get added to the Amazon OAuth URL:
  const params = new URLSearchParams({
    response_type: 'code', // Using the authorization code flow
    client_id: process.env.AMAZON_CLIENT_ID || '', // Our apps unique ID from amazon
    scope: 'profile', // Permissions we're asking for (profile gives basic user info)
    redirect_uri: process.env.AMAZON_REDIRECT_URI || '', // Where Amazon will send the user after log in
    state // The random string we generated above 
  });

  // The backend sends the user to the Amazon page to log in with a link built out of the params from above
  const authorizeUrl = `https://www.amazon.com/ap/oa?${params.toString()}`;
  return res.redirect(authorizeUrl);
});

// ---------- LWA STEP 2: Amazon redirects here with ?code=... ----------
app.get('/auth/callback', async (req, res) => {
  // Amazon sends ?code=... (&state=..., &error=...)
  // code= short-lived auth code
  // state= should match the one from earlier
  // error= if the user denied access
  const { code, state, error } = req.query;
  if (error) 
    return res.status(400).send(`Amazon error: ${error}`);
  if (!code) 
    return res.status(400).send('No auth code provided');

  try {
    // Exchange code for tokens (must be x-www-form-urlencoded body)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code, // from the query
      client_id: process.env.AMAZON_CLIENT_ID || '', // from Seller Central app credentials
      client_secret: process.env.AMAZON_CLIENT_SECRET || '', // from Seller Central app credentials
      redirect_uri: process.env.AMAZON_REDIRECT_URI || '' // MUST exactly match what was used in /auth/login and in Seller Central
    });

    const tokenRes = await axios.post(
      'https://api.amazon.com/auth/o2/token',
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // access_token, refresh_token, token_type, expires_in
    console.log('Tokens received:', tokenRes.data);

    // TODO: persist refresh_token securely (DB). For now, send user to your dashboard.
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    
    // Route the user to the dashboard
    return res.redirect(`${frontend}/dashboard`);
  } catch (err) {
    console.error('Error exchanging code:', err.response?.data || err.message);
    return res.status(500).send('Error exchanging auth code');
  }
});

// Start up the Express server
app.listen(port, '0.0.0.0', () => {
  console.log(`Backend running on port ${port}`);
});
