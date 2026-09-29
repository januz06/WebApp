const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for your GitHub Pages domain
app.use(cors({
  origin: 'https://januz06.github.io/WebApp/'
}));

// Proxy endpoint for Firebase requests
app.use('/firebase-api', express.json(), (req, res) => {
  // Get the API key from environment variable
  const apiKey = process.env.FIREBASE_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Create a new URL object for the Firebase request
  const firebaseUrl = new URL(req.originalUrl.replace('/firebase-api', ''));
  firebaseUrl.searchParams.set('key', apiKey);

  // Forward the request to Firebase
  fetch(firebaseUrl, {
    method: req.method,
    headers: req.headers,
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined
  })
    .then(firebaseRes => firebaseRes.json())
    .then(data => res.json(data))
    .catch(error => res.status(500).json({ error: error.message }));
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
