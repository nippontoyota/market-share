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
      scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://fonts.gstatic.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"]
    }
  }
}));

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

// Login rate limiting
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
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

  // Verify username
  if (username !== validUsername) {
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

// Handle logout
app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.status(500).json({ error: 'Logout failed' });
    }
    res.clearCookie('dashboard.sid');
    res.json({ success: true, redirect: '/login' });
  });
});

// Protect dashboard route
app.get('/dashboard', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve root - redirect to login or dashboard
app.get('/', (req, res) => {
  if (req.session.isAuthenticated) {
    res.redirect('/dashboard');
  } else {
    res.redirect('/login');
  }
});

// Do NOT serve sensitive data files publicly
// dashboard_data.json and RTO_2025_2026_Combined.csv are not served
// They are only used as source data, not runtime dependencies

// Start server
app.listen(PORT, () => {
  console.log(`Performance Dashboard server running on http://localhost:${PORT}`);
  console.log('Login page: http://localhost:' + PORT + '/login');
  console.log('Dashboard: http://localhost:' + PORT + '/dashboard');
});
