require('dotenv').config();
const express = require('express');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy for Render (HTTPS)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
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
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
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

  // Get credentials from environment
  const validUsername = process.env.DASHBOARD_USERNAME;
  const validPasswordHash = process.env.DASHBOARD_PASSWORD_HASH;

  if (!validUsername || !validPasswordHash) {
    console.error('Server configuration error: Missing credentials in environment');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Verify username (case-insensitive check)
  if (username.trim().toLowerCase() !== validUsername.trim().toLowerCase()) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  // Verify password
  try {
    const passwordMatch = await bcrypt.compare(password, validPasswordHash);
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
