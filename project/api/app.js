// app.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const aws4 = require('aws4');
require('dotenv').config();

const app = express();
app.use(express.json());

// CORS (dev-friendly; tighten later)
app.use(
  cors({
    origin: process.env.FRONTEND_URL || '*', // e.g. https://your-frontend.com
    credentials: false,                      // we're not using cookies yet
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-amz-access-token', 'x-requested-with'],
  })
);

// --- Config ---
const port = process.env.PORT || 8080;
const FRONTEND = process.env.FRONTEND_URL || 'http://localhost:3000';
const LWA_CLIENT_ID = process.env.AMAZON_CLIENT_ID || '';
const LWA_CLIENT_SECRET = process.env.AMAZON_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.AMAZON_REDIRECT_URI || ''; // must exactly match app registration

// --- In-memory (replace with DB in prod) ---
let refreshToken = null;          // long-lived; store securely
let currentAccessToken = null;    // short-lived
let accessTokenExpiresAt = 0;     // epoch ms
let sellerId = null;
let marketplaceId = null;

// Health check
app.get('/', (_req, res) => res.send('Hello from backend (sandbox SP-API with consent flow)'));

// ---------- STEP 1: Send seller to Seller Central consent ----------
app.get('/auth/login', (_req, res) => {
  const state = Math.random().toString(36).slice(2);
  const authUrl = new URL('https://www.amazon.com/ap/oa');
  authUrl.search = new URLSearchParams({
    client_id: process.env.AMAZON_CLIENT_ID,
    scope: 'sellingpartnerapi::migration',
    response_type: 'code',
    redirect_uri: process.env.AMAZON_REDIRECT_URI,
    state,
  }).toString();
  console.log("Redirecting to Amazon LWA:", url.toString());
  res.redirect(authUrl.toString());
});

// ---------- STEP 2: Callback receives ?spapi_oauth_code=... ----------
app.get('/auth/callback', async (req, res) => {
  const { spapi_oauth_code, state, error } = req.query;
  if (error) return res.status(400).send(`Amazon error: ${error}`);
  if (!spapi_oauth_code) return res.status(400).send('No spapi_oauth_code provided');

  try {
    // Exchange SP-API oauth code for refresh_token (+ optional access_token)
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: spapi_oauth_code,
      client_id: LWA_CLIENT_ID,
      client_secret: LWA_CLIENT_SECRET,
      redirect_uri: REDIRECT_URI,
    });

    const tokenRes = await axios.post(
      'https://api.amazon.com/auth/o2/token',
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    // Persist these (DB in real app)
    refreshToken = tokenRes.data.refresh_token || refreshToken;
    currentAccessToken = tokenRes.data.access_token || null;
    accessTokenExpiresAt = currentAccessToken
      ? Date.now() + ((tokenRes.data.expires_in || 3600) - 60) * 1000 // -60s buffer
      : 0;

    // Redirect to dashboard now that consent is complete
    return res.redirect(`${FRONTEND}/dashboard`);
  } catch (err) {
    console.error('Token exchange failed:', err.response?.status, err.response?.data || err.message);
    return res.status(500).send('Error exchanging spapi_oauth_code');
  }
});

// ---------- Helper: mint a fresh access token from the refresh token ----------
async function getAccessTokenFromRefresh() {
  if (!refreshToken) throw new Error('No refresh token (seller hasn’t granted consent yet)');
  // Reuse if not expired
  if (currentAccessToken && Date.now() < accessTokenExpiresAt) return currentAccessToken;

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: LWA_CLIENT_ID,
    client_secret: LWA_CLIENT_SECRET,
  });

  const r = await axios.post('https://api.amazon.com/auth/o2/token', body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  currentAccessToken = r.data.access_token;
  accessTokenExpiresAt = Date.now() + ((r.data.expires_in || 3600) - 60) * 1000; // buffer
  return currentAccessToken;
}

// ---------- Helper: signed GET to SP-API (sandbox) ----------
async function signedGetSandbox(path, accessToken) {
  const host = 'sandbox.sellingpartnerapi-na.amazon.com'; // NA sandbox
  const region = 'us-east-1';

  const reqOpts = {
    host,
    path,
    method: 'GET',
    service: 'execute-api',
    region,
    headers: {
      'x-amz-access-token': accessToken,
      'user-agent': 'StackOverflowed-App/0.1 (Language=Node)',
    },
  };

  // Sign with your IAM creds from env: AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY
  aws4.sign(reqOpts);
  const url = `https://${host}${path}`;
  const httpsAgent = new https.Agent({ keepAlive: true });
  const { data } = await axios.get(url, { headers: reqOpts.headers, httpsAgent });
  return data;
}

// ---------- Probe seller + marketplace (also primes sellerId/marketplaceId) ----------
app.get('/spapi/sandbox-check', async (_req, res) => {
  try {
    const token = await getAccessTokenFromRefresh(); // ensure valid access token
    const data = await signedGetSandbox('/sellers/v1/marketplaceParticipations', token);

    const first = data?.payload?.[0];
    if (first) {
      sellerId = first.sellerId || sellerId;
      // marketplace object sometimes { id: 'ATVPDKIKX0DER' }
      marketplaceId =
        (first.marketplace && (first.marketplace.id || first.marketplace.marketplaceId)) || marketplaceId;
    }

    res.json({ ok: true, data, sellerId, marketplaceId });
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('Sandbox check failed:', err.response?.status, detail);
    res.status(500).json({ error: 'Sandbox call failed', detail });
  }
});

// ---------- Example listings call (sandbox) ----------
app.get('/spapi/products', async (_req, res) => {
  try {
    if (!sellerId || !marketplaceId) {
      return res.status(400).json({ error: 'Run /spapi/sandbox-check first to set sellerId/marketplaceId' });
    }

    const token = await getAccessTokenFromRefresh(); // ensure valid access token
    const path = `/listings/2021-08-01/items/${encodeURIComponent(
      sellerId
    )}?marketplaceIds=${encodeURIComponent(marketplaceId)}`;

    const data = await signedGetSandbox(path, token);
    res.json(data);
  } catch (err) {
    const detail = err.response?.data || err.message;
    console.error('Listings sandbox failed:', err.response?.status, detail);
    res.status(500).json({ error: 'Failed to fetch products (sandbox)', detail });
  }
});

// Start server
app.listen(port, '0.0.0.0', () => {
  console.log(`Backend (sandbox) running on port ${port}`);
});
