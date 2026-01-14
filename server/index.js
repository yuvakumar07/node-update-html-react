const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs').promises;

const app = express();
const PORT = process.env.PORT || 3001;
const isProduction = process.env.NODE_ENV === 'production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const fetchAuth = async (userId) => {
  try {
    const fetch = (await import('node-fetch')).default;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    // Generate random user ID between 1 and 10
    // const randomUserId = Math.floor(Math.random() * 10) + 1;
    console.log('fetchAuth: Fetching user ID:', userId);

    // GET request to fetch actual user data
    const response = await fetch(`https://jsonplaceholder.typicode.com/users/${userId}`, {
      method: 'GET',
      headers: {
        'content-type': 'application/json'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const userData = await response.json();
    console.log('fetchAuth: User data retrieved:', userData);

    const dataT = {
      api1: userData,
      api2: null
    };

    if(userData && userData.id == userId) {

      // GET request to fetch actual user data
      const response2 = await fetch(`https://jsonplaceholder.typicode.com/users/${userId}`, {
        method: 'GET',
        headers: {
          'content-type': 'application/json'
        },
        signal: controller.signal
      });

      if (!response2.ok) {
        throw new Error(`HTTP error! status: ${response2.status}`);
      }

      const offersData = await response2.json();
      console.log('fetchAuth: User offers retrieved:', offersData);
      dataT.api2 = offersData;
    }

    return dataT;
  } catch (error) {
    console.error('Error in fetchAuth:', error.message);
    // Return a default user object instead of throwing
    return {
      id: 0,
      name: 'Guest User',
      username: 'guest',
      email: 'guest@example.com',
      error: error.message
    };
  }
}




// Serve static files in production (but not index.html - that's handled by catch-all route)
if (isProduction) {
  app.use(express.static(path.join(__dirname, '../dist'), { index: false }));
}


// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Serve React app for all non-API routes
app.get('*', async (req, res) => {
  console.log('req', req.query);
  // Skip if it's an API route
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ message: 'API endpoint not found' });
  }

  try {
    console.log('Serving HTML for path:', req.path);

    // Determine which HTML file to serve based on environment
    const htmlPath = isProduction
      ? path.join(__dirname, '../dist/index.html')
      : path.join(__dirname, '../public/index.html');

    console.log('Reading HTML from:', htmlPath);

    // Read the HTML file
    let html = await fs.readFile(htmlPath, 'utf-8');
    console.log('HTML file read successfully, length:', html.length);

    // Fetch auth data
    console.log('Fetching auth data...');
    const userId = req.query.id;
    const userData = await fetchAuth(userId);
    console.log('Auth data received:', JSON.stringify(userData));

    if (!userData) {
      console.error('WARNING: userData is null or undefined');
    }

    // Inject userData into the hidden input field
    // Use regex to match both minified and non-minified versions
    const userDataJson = JSON.stringify(userData || {});
    const escapedJson = userDataJson.replace(/'/g, "&#39;");
    const newInput = `<input type="hidden" id="userData" value='${escapedJson}'/>`;

    // Match both <input type="hidden" id="userData" /> and <input type="hidden" id="userData"/>
    const placeholderRegex = /<input type="hidden" id="userData"\s*\/?>/;
    const updatedHtml = html.replace(placeholderRegex, newInput);

    console.log('Updated HTML', updatedHtml);

    const wasReplaced = updatedHtml !== html;
    console.log('Replacement successful:', wasReplaced);

    if (!wasReplaced) {
      console.error('WARNING: HTML replacement did not occur!');
    }

    res.send(updatedHtml);
  } catch (error) {
    console.error('Error serving HTML:', error);
    console.error('Error stack:', error.stack);
    res.status(500).send('Internal Server Error');
  }
});


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Environment: ${isProduction ? 'production' : 'development'}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/todos`);
  if (isProduction) {
    console.log(`Serving static files from dist folder`);
  }
});
