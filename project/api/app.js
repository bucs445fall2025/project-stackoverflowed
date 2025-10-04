const express = require('express');
const cors = require('cors');
const app = express();
const port = 5001;

const axios = require('axios'); // Make axios is installed: npm install axios
require('dotenv').config(); // To load Client ID / Secret from .env

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello from backend');
});

app.listen(port, () => {
  console.log(`Backend running on port ${port}`);
});

// A GET route called by Amazon after the user logs in and authorizes our app to get data from their account
app.get('/auth/callback', async (req, res) => { // 'async' allows us to use 'await' to make HTTP requests to Amazon
  // Extracts authorization code (spapi_oauth_code) from the query string in the URL
  const { spapi_oauth_code } = req.query;

  // Makes sure Amazon sent the code
  if (!spapi_oauth_code) {
    return res.status(400).send('No auth code provided');
  }

  // Sends a POST request to Amazons LWA token endpoint
  // Exchanges the temporary spapi_oauth_code for real access and refresh tokens
  try {
    const response = await axios.post('https://api.amazon.com/auth/o2/token', null, {
      params: {
        grant_type: 'authorization_code', // Tells Amazon we're using the standard OAuth flow
        code: spapi_oauth_code, // The temporary auth code recieved
        client_id: process.env.AMAZON_CLIENT_ID, // Identifies our app from Mikes account
        client_secret: process.env.AMAZON_CLIENT_SECRET, // Identifies our app from Mikes account
        redirect_uri: 'http://localhost:3000/dashboard', // Must match whats registered in Seller Central
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    // Logs access and refresh tokens returned by Amazon
    console.log('Tokens received:', response.data); 
    res.send('Login successful! You can close this window.');

  } catch (err) {
    console.error('Error exchanging auth code:', err.response?.data || err.message);
    res.status(500).send('Error exchanging auth code');
  }
});