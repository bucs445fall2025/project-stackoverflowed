const aws4 = require('aws4'); // For signing Amazon API reqs
const axios = require('axios'); // A HTTP client for Node.js, 
const https = require('https'); // Node.js's native HTTPS module, can be used alonside Axios

let currentAccessToken = null; // LWA access token (short-lived)
let refreshToken = null;       // Used to refresh Access Token. Need save this in DB later
let sellerId = null;           // The users Amazon account ID
let marketplaceId = null;      // Defines what geographical market we're working in



/*  ---------- LWA STEP 1 ----------
    Function used to log send the user to Amazon to log in to their FBA account

    ARGS:
        req = The request from Express. '_' means we're not using it
        res = The response, used to redirect the browser
*/
async function login(_req, res) {
  // Generates a random "state" string for security reasons. Prevents CSRF attacks
  const state = Math.random().toString(36).slice(2); // store & verify in prod
  
  // Creates a set of query params that Amazon expects in the auth URL
  const params = new URLSearchParams({
    application_id: process.env.SP_APP_ID || '', // Credentials from Amazon. Identifies our app in Seller Central
    state, // The random string generated above
    redirect_uri: process.env.AMAZON_REDIRECT_URI || '', // The callback URL Amazon will send the user back to
    version: 'beta' // API version we're targeting
  });

  // Sends the user's browser to Amazons consent page, with the params we created above
  return res.redirect(`https://sellercentral.amazon.com/apps/authorize/consent?${params.toString()}`);
}



/*  ---------- LWA STEP 2 ----------
    Function used to define the route that Amazon redirects to after the user 
    authorizes our app (the same URL in the redirect_uri in Step 1)

    ARGS:
        req = The request from Express. '_' means we're not using it
        res = The response, used to redirect the browser
*/
async function callback(req, res) {
  // Extracts values from query parameters in the redirect URL that Amazon sends
  const { spapi_oauth_code, error } = req.query;

  // Error check the parameters we just extracted
  if (error) return res.status(400).send(`Amazon error: ${error}`);
  if (!spapi_oauth_code) return res.status(400).send('No spapi_oauth_code provided');

  try {
    // Building a POST req body for Amazons token endpoint
    const body = new URLSearchParams({
      grant_type: 'authorization_code', // Tells Amazon what kind of OAuth flow we're doing
      code: spapi_oauth_code, // The temp code amazon gave in the redirect URL
      client_id: process.env.AMAZON_CLIENT_ID || '', // Our apps credentials for talking to Amazons OAuth server
      client_secret: process.env.AMAZON_CLIENT_SECRET || '', // Our apps credentials for talking to Amazons OAuth server
      redirect_uri: process.env.AMAZON_REDIRECT_URI || '' // Must match the URI from step 1
    });

    // Using Axios to make a POST req to Amazons token endpoint
    const tokenRes = await axios.post(
      'https://api.amazon.com/auth/o2/token',
      body.toString(), // Send the body as a string
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } } // A header specifying content type
    );

    // The tokens Amazon responded with
    currentAccessToken = tokenRes.data.access_token;
    refreshToken = tokenRes.data.refresh_token;

    // Sets a variable queal to where to redirect the user after log in. 'FRONTEND_URL' Defined as env variable on Railway
    const frontend = process.env.FRONTEND_URL || 'http://localhost:3000';
    return res.redirect(`${frontend}`); // Use that variable to redirect 
  } catch (err) {
    console.error('Token exchange failed:', err.response?.status, err.response?.data || err.message);
    return res.status(500).send('Error exchanging auth code');
  }
}



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
async function sandboxCheck(_req, res) {
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
}



/**
 * Example sandbox "products" route — uses Listings Items in sandbox.
 * Note: sandbox data is canned; this is mainly to prove signing+headers.
 */
async function products(_req, res) {
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
}

module.exports = { login, callback, sandboxCheck, products };