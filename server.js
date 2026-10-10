require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('cookie-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DEV_USERNAME = 'Admin';
const DEV_PASSWORD_HASH = '$2a$10$X0H0G35m9j6P5ltQbzjcqeVnOz0f73Cs1vuWdMUIOjcIO/ENtb5bC';
const isProduction = process.env.NODE_ENV === 'production';

function getDashboardCredentials() {
  const configuredUsername = process.env.DASHBOARD_USERNAME;
  const configuredPasswordHash = process.env.DASHBOARD_PASSWORD_HASH;
  const hasPlaceholderHash = configuredPasswordHash && configuredPasswordHash.includes('your-bcrypt-hash-here');

  if (configuredUsername && configuredPasswordHash && !hasPlaceholderHash) {
    return {
      username: configuredUsername,
      passwordHash: configuredPasswordHash,
    };
  }

  if (!isProduction) {
    return {
      username: configuredUsername || DEV_USERNAME,
      passwordHash: DEV_PASSWORD_HASH,
    };
  }

  return null;
}

// Trust proxy for Render (HTTPS)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  frameguard: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      frameAncestors: ["'self'", "http://localhost:5173", "https://stock-blocking.vercel.app", "https://nipponstock.vercel.app"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      // The dashboard talks to the operator's local updater (loopback) and
      // to the Supabase-backed API worker that serves the registrations
      // dataset (see RECORDS_API_URL in index.html).
      connectSrc: [
        "'self'",
        "http://127.0.0.1:3099",
        "http://localhost:3099",
        "https://market-share-api.bharath-c.workers.dev",
        "http://localhost:4000"
      ],
      // The updater is intentionally plain HTTP on loopback. Do not rewrite
      // that local request to HTTPS, where the helper does not listen.
      upgradeInsecureRequests: null
    }
  }
}));

// Strictly disable caching for all responses to guarantee fresh browser execution
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Body parsing middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'none',
    secure: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  },
  name: 'dashboard.sid'
}));

// Login rate limiting (30 attempts per 15 minutes window)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 attempts per window
  message: 'Too many login attempts. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware to check authentication
const requireAuth = (req, res, next) => {
  if (req.session.isAuthenticated) {
    next();
  } else {
    res.redirect('/login');
  }
};

// Render health check endpoint; intentionally does not require authentication.
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Serve login page
app.get('/login', (req, res) => {
  if (req.session.isAuthenticated) {
    res.redirect('/dashboard');
  } else {
    res.sendFile(path.join(__dirname, 'login.html'));
  }
});

// Serve login.js
app.get('/login.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.js'));
});

// Handle login POST
app.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  // Validate input
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const credentials = getDashboardCredentials();

  if (!credentials) {
    console.error('Server configuration error: Missing credentials in environment');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Verify username (case-insensitive check)
  if (username.trim().toLowerCase() !== credentials.username.trim().toLowerCase()) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Verify password
  try {
    const passwordMatch = await bcrypt.compare(password, credentials.passwordHash);
    if (passwordMatch) {
      req.session.isAuthenticated = true;
      req.session.username = username;
      res.json({ success: true, redirect: '/dashboard' });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (error) {
    console.error('Password verification error:', error);
    res.status(500).json({ error: 'Authentication error' });
  }
});

// Handle logout (both POST and GET supported)
const handleLogout = (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
    }
    res.clearCookie('dashboard.sid', { path: '/' });
    if (req.method === 'POST') {
      res.json({ success: true, redirect: '/login' });
    } else {
      res.redirect('/login');
    }
  });
};

app.post('/logout', handleLogout);
app.get('/logout', handleLogout);

// Middleware to disable caching for live development & demo
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});


// Unified SSO Route for CEO and Branch Managers
app.get('/api/sso', (req, res) => {
  const validTokens = ['nippon-ceo-token-2026', 'nippon-branch-token-2026'];
  if (validTokens.includes(req.query.token)) {
    req.session.isAuthenticated = true;
    let target = req.query.redirect || '/ceo-dashboard';
    if (!target.startsWith('/')) target = '/' + target;
    res.redirect(target);
  } else {
    res.status(401).send('Unauthorized SSO');
  }
});

// Serve CEO Dashboard
app.get('/ceo-dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'ceo-dashboard.html'));
});

// Protect dashboard route
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});
app.get('/index.html', requireAuth, (req, res) => {
  res.redirect('/dashboard');
});

// Serve rto.css
app.get('/rto.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(path.join(__dirname, 'rto.css'));
});

// TEMP DEBUG: Test style injection (no auth required)
app.get('/test-theme', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-theme.html'));
});

// Serve rto_data.json securely for authenticated users
app.get('/rto_data.json', requireAuth, (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.sendFile(path.join(__dirname, 'rto_data.json'));
});

// Protect RTO Selection routes
app.get('/rto-selection', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'rto-selection.html'));
});
app.get('/rto-selection.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'rto-selection.html'));
});

// Protect RTO Detail routes
app.get('/rto-detail', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'rto-detail.html'));
});
app.get('/rto-detail.html', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'rto-detail.html'));
});

// Serve root - redirect to login or dashboard
app.get('/', (req, res) => {
  if (req.session.isAuthenticated) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Performance Dashboard server running on http://localhost:${PORT}`);
  console.log('Login page: http://localhost:' + PORT + '/login');
  console.log('Dashboard: http://localhost:' + PORT + '/dashboard');
});

