// app.js
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const https = require('https');
const aws4 = require('aws4');
require('dotenv').config();

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// Bind 0.0.0.0 for Railway/Docker, fall back for local
const port = process.env.PORT || 8080;

let currentAccessToken = null;   // LWA access token (short-lived)
let refreshToken = null;         // save this in DB later
let sellerId = null;
let marketplaceId = null;        // must be module-scoped so other routes can use it

// Health check
app.get('/', (_req, res) => res.send('Hello from backend (sandbox)'));

// ---------- LWA STEP 1 ----------
// ---------- LWA STEP 1 ----------
app.get('/auth/login', (_req, res) => {
  const state = Math.random().toString(36).slice(2); // store & verify in prod
  const params = new URLSearchParams({
    application_id: process.env.AMAZON_CLIENT_ID || '',
    state,
    redirect_uri: process.env.AMAZON_REDIRECT_URI || ''
  });
  res.redirect(`https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}`);
});

// ---------- LWA STEP 2 ----------
app.get('/auth/callback', async (req, res) => {
  const { spapi_oauth_code, error } = req.query;
  if (error) return res.status(400).send(`Amazon error: ${error}`);
  if (!spapi_oauth_code) return res.status(400).send('No spapi_oauth_code provided');

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: spapi_oauth_code,
      client_id: process.env.AMAZON_CLIENT_ID || '',
      client_secret: process.env.AMAZON_CLIENT_SECRET || '',
      redirect_uri: process.env.AMAZON_REDIRECT_URI || ''
    });

    const tokenRes = await axios.post(
      'https://api.amazon.com/auth/o2/token',
      body.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    currentAccessToken = tokenRes.data.access_token;
    refreshToken = tokenRes.data.refresh_token;

    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontend}`);
  } catch (err) {
    console.error('Token exchange failed:', err.response?.status, err.response?.data || err.message);
    return res.status(500).send('Error exchanging auth code');
  }
});
/**
 * Helper to sign and GET an SP-API endpoint (sandbox)
 */
async function signedGetSandbox(path, accessToken) {
  const host = 'sandbox.sellingpartnerapi-na.amazon.com'; // 👈 sandbox host (NA)
  const region = 'us-east-1';
  const reqOpts = {
    host,
    path,
    method: 'GET',
    service: 'execute-api',
    region,
    headers: {
      'x-amz-access-token': accessToken,
      'user-agent': 'StackOverflowed-App/0.1 (Language=Node)'
    }
  };
  aws4.sign(reqOpts); // uses AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from env
  const url = `https://${host}${path}`;
  const httpsAgent = new https.Agent({ keepAlive: true });
  const { data } = await axios.get(url, { headers: reqOpts.headers, httpsAgent });
  return data;
}

/**
 * Quick sandbox check: fetch mock marketplace participations
 * (Also grabs sellerId & marketplaceId for later.)
 */
app.get('/spapi/sandbox-check', async (_req, res) => {
  if (!currentAccessToken) return res.status(401).json({ error: 'Login first via /auth/login' });
  try {
    const data = await signedGetSandbox('/sellers/v1/marketplaceParticipations', currentAccessToken);

    // These fields vary in sandbox; adapt if structure differs
    const first = data?.payload?.[0];
    if (first) {
      sellerId = first.sellerId || sellerId;
      // marketplace object can be { id: 'ATVPDKIKX0DER', name: 'Amazon.com' } in NA
      marketplaceId = (first.marketplace && (first.marketplace.id || first.marketplace.marketplaceId)) || marketplaceId;
    }

    res.json({ ok: true, data, sellerId, marketplaceId });
  } catch (err) {
    console.error('Sandbox check failed:', err.response?.status, err.response?.data || err.message);
    res.status(500).json({ error: 'Sandbox call failed', detail: err.response?.data || err.message });
  }
});

/**
 * Example sandbox "products" route — uses Listings Items in sandbox.
 * Note: sandbox data is canned; this is mainly to prove signing+headers.
 */
app.get('/spapi/products', async (_req, res) => {
  if (!currentAccessToken) return res.status(401).json({ error: 'Login first' });
  if (!sellerId || !marketplaceId) return res.status(400).json({ error: 'Run /spapi/sandbox-check first to set sellerId/marketplaceId' });

  try {
    const path = `/listings/2021-08-01/items/${encodeURIComponent(sellerId)}?marketplaceIds=${encodeURIComponent(marketplaceId)}`;
    const data = await signedGetSandbox(path, currentAccessToken);
    res.json(data);
  } catch (err) {
    console.error('Listings sandbox failed:', err.response?.status, err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to fetch products (sandbox)', detail: err.response?.data || err.message });
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Backend (sandbox) running on port ${port}`);
});