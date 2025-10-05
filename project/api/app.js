// app.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();

// Allow your frontend (keep * while testing)
app.use(cors({ origin: '*' }));
app.use(express.json());

// ✅ Use Railway's dynamic port (fallback for local)
const port = process.env.PORT || 8080;

// Health check
app.get('/', (_req, res) => res.send('Hello from backend'));

// ---------- LWA STEP 1: send user to Amazon ----------
app.get('/auth/login', (req, res) => {
  const state = Math.random().toString(36).slice(2); // TODO: store/verify in prod

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.AMAZON_CLIENT_ID || '',
    scope: 'profile', // add extra scopes if needed
    redirect_uri: process.env.AMAZON_REDIRECT_URI || '',
    state
  });

  const authorizeUrl = `https://www.amazon.com/ap/oa?${params.toString()}`;
  return res.redirect(authorizeUrl);
});

// ---------- LWA STEP 2: Amazon redirects here with ?code=... ----------
app.get('/auth/callback', async (req, res) => {
  // Amazon sends ?code=... (&state=..., &error=...)
  const { code, state, error } = req.query;
  if (error) return res.status(400).send(`Amazon error: ${error}`);
  if (!code) return res.status(400).send('No auth code provided');

  try {
    // Exchange code for tokens (must be x-www-form-urlencoded body)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.AMAZON_CLIENT_ID || '',
      client_secret: process.env.AMAZON_CLIENT_SECRET || '',
      redirect_uri: process.env.AMAZON_REDIRECT_URI || '' // MUST exactly match what you used in /auth/login and in Seller Central
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
    return res.redirect(`${frontend}/dashboard`);
  } catch (err) {
    console.error('Error exchanging code:', err.response?.data || err.message);
    return res.status(500).send('Error exchanging auth code');
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend running on port ${port}`);
});
