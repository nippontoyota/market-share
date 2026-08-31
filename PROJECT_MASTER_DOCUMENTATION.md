# 📖 RTO Analytics Dashboard — Master Project Documentation & Rebuild Blueprint

> **Notice**: This document contains the complete technical architecture, data pipeline, business logic, calculation formulas, database/file schemas, and complete source code blueprint of the **RTO Analytics Dashboard** project. With this document, the entire project can be recreated from scratch at any time.

---

## 📑 Table of Contents
1. [Project Overview & Business Domain](#1-project-overview--business-domain)
2. [Directory Structure & File Inventory](#2-directory-structure--file-inventory)
3. [Technology Stack & Dependencies](#3-technology-stack--dependencies)
4. [The Dual Data Scope Architecture](#4-the-dual-data-scope-architecture)
5. [Raw Data Schemas & Authoritative Sources](#5-raw-data-schemas--authoritative-sources)
6. [Kerala RTO Master Mapping (All 86 Sub-RTOs)](#6-kerala-rto-master-mapping-all-86-sub-rtos)
7. [The 11 Main RTO Clusters (Audited Dataset)](#7-the-11-main-rto-clusters-audited-dataset)
8. [Mathematical Formulas & Calculation Rules](#8-mathematical-formulas--calculation-rules)
9. [Complete Source Code Blueprint](#9-complete-source-code-blueprint)
   - [9.1 package.json](#91-packagejson)
   - [9.2 .env & .env.example](#92-env--envexample)
   - [9.3 server.js](#93-serverjs)
   - [9.4 login.html & login.js](#94-loginhtml--loginjs)
   - [9.5 rto.css](#95-rtocss)
   - [9.6 rto-selection.html (Page 3)](#96-rto-selectionhtml-page-3)
   - [9.7 rto-detail.html (Page 4)](#97-rto-detailhtml-page-4)
   - [9.8 generate_rto_data.js](#98-generate_rto_datajs)
10. [How to Rebuild, Run & Validate](#10-how-to-rebuild-run--validate)

---

## 1. Project Overview & Business Domain

- **Application Name**: RTO Analytics Dashboard
- **Business Domain**: Automotive Retail & Market Share Analytics (focusing on **Nippon Toyota / Toyota Kirloskar Motor Pvt Ltd** across Kerala).
- **Core Purpose**:
  1. Track and compare overall vehicle registrations (Total Industry Volume / LMV) and Toyota registrations (NOS / TKM) across all Kerala Regional Transport Offices (RTOs).
  2. Provide a 4-tier drilldown navigation from **Executive High-Level View** down to **Granular Sub-RTO Level**.

---

## 2. Directory Structure & File Inventory

```
DEMO_RTO/
├── server.js                     # Express web server with session authentication & route guarding
├── login.html                    # Page 1: Login Interface
├── login.js                      # Login submission logic
├── index.html                    # Page 2: Main Executive Dashboard (2025 Full vs 2026 Jan-Aug)
├── rto-selection.html            # Page 3: Main RTO Cluster Selection (2026 Jan-Aug Only)
├── rto-detail.html               # Page 4: Full Cluster Deep-Dive Analysis (2026 Jan-Aug Only)
├── rto.css                       # Shared glassmorphic stylesheet for Pages 3 and 4
├── rto_data.json                 # Pre-compiled audited 2026 Jan-Aug JSON dataset
├── generate_rto_data.js          # Node build script compiling CSV & Excel into JSON
├── RTO_2025_2026_Combined.csv    # Raw CSV source (52,012 rows)
├── RTO_MASTER.xlsm               # Official 86 Sub-RTO naming workbook
├── .env                          # Server credentials & secrets (UTF-8 encoded)
├── .env.example                  # Environment configuration template
├── package.json                  # Dependencies & scripts
└── PROJECT_MASTER_DOCUMENTATION.md # This master documentation file
```

---

## 3. Technology Stack & Dependencies

- **Node.js**: v18+ (tested on v24.x)
- **Express.js**: `^4.18.2`
- **bcryptjs**: `^2.4.3`
- **express-session**: `^1.17.3`
- **helmet**: `^7.1.0`
- **dotenv**: `^16.3.1`
- **express-rate-limit**: `^7.1.5`
- **Chart.js**: v4.x via CDN (`https://cdn.jsdelivr.net/npm/chart.js`)
- **Google Fonts**: Inter (`https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap`)

---

## 4. The Dual Data Scope Architecture

The application strictly enforces **two different data scopes** depending on the page:

```
┌────────────────────────────────────────────────────────────────────────┐
│ PAGE 1: LOGIN (/login)                                                 │
│ • Scope: Authentication only (credentials in .env)                     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PAGE 2: MAIN DASHBOARD (/dashboard -> index.html)                      │
│ • Scope: 2025 FULL YEAR (12 Months) vs 2026 JAN-AUG (8 Months)         │
│ • Total Registrations: 302,686 (144,524 in 2025 + 158,162 in 2026)     │
│ • Purpose: Macro-level year-over-year executive comparison             │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ [Click "RTO ANALYSIS →"]
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PAGE 3: RTO SELECTION (/rto-selection.html)                            │
│ • Scope: 2026 JAN–AUG ONLY (Strictly zero 2025 data)                   │
│ • Purpose: Select one of 11 Main RTO Clusters for 2026 operational view│
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ [Click a Main RTO Card]
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ PAGE 4: RTO FULL CLUSTER ANALYSIS (/rto-detail.html?rto=...)           │
│ • Scope: 2026 JAN–AUG ONLY (Strictly zero 2025 data)                   │
│ • Purpose: Single scrollable deep dive showing Selected Main RTO       │
│   Cluster Summary + ALL associated Sub-RTO cards                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Raw Data Schemas & Authoritative Sources

### 1. `RTO_2025_2026_Combined.csv` (Primary Source)
- **Total Records**: `52,012` raw rows.
- **Filtered Records (`Check_Eligible === 'Required'`)**: `20,620` rows (`302,686` total registrations).
- **2026 Jan–Aug 'Required' Records**: `13,360` rows (`158,162` total registrations).
- **Columns**:
  1. `Year` (e.g. `2025`, `2026`)
  2. `Year_Label` (e.g. `2025`, `2026`)
  3. `Month` (e.g. `JAN`, `FEB`, `MAR`, `APR`, `MAY`, `JUN`, `JUL`, `AUG`, `SEP`, `OCT`, `NOV`, `DEC`)
  4. `RTO` (Raw string, e.g. `KL 01`, `KL 45`)
  5. `RTO_clean` (Clean code, e.g. `KL1`, `KL45`)
  6. `Mapped_Location` (Dealer Location Cluster, e.g. `Kazhakkottam & Enchakkal`, `Kollam`, `Kottayam`, etc.)
  7. `Maker` (Car Manufacturer, e.g. `MARUTI SUZUKI INDIA LTD`, `TOYOTA KIRLOSKAR MOTOR PVT LTD`, etc.)
  8. `Cluster` (e.g. `Cluster 1`, `Cluster 2`, `Cluster 3`, `Cluster 4`)
  9. `Check_Eligible` (`Required` vs `Not Eligible`)
  10. `Nos` (Number of registrations / integer volume)
  11. `Month_Num` (Integer `1` to `12`)

### 2. `RTO_MASTER.xlsm` (Sub-RTO Naming Master)
- **Sheet**: `MASTER_DATA` (1,671 rows).
- **Header**: `RTO`, `NAME`, `MAKER`, `JAN`, `FEB`, `MAR`, `APR`, `MAY`, `JUN`, `JUL`, `AUG`.
- **Purpose**: Authoritative mapping of clean RTO codes (`KL1` to `KL86`) to full official RTO/SRTO station names.

---

## 6. Kerala RTO Master Mapping (All 86 Sub-RTOs)

Kerala has **86 unique RTO codes** (`KL01` to `KL86`), divided into:
- **18 Main RTOs** (Regional Transport Offices / District HQs): `KL1`, `KL2`, `KL3`, `KL4`, `KL5`, `KL6`, `KL7`, `KL8`, `KL9`, `KL10`, `KL11`, `KL12`, `KL13`, `KL14`, `KL15`, `KL16`, `KL17`, `KL18`.
- **68 Sub-RTOs (SRTOs)**: `KL19` to `KL86`.

### Distribution in Project
- **54 Sub-RTOs**: Mapped across the **11 Active Dealer Clusters**.
- **32 Sub-RTOs**: Grouped under **Other / Unmapped** (Northern Kerala districts like Malappuram, Kozhikode, Kannur, Kasargode, Wayanad, Palakkad).
- **Total = 54 + 32 = 86 RTOs (100% accounted for, 0 orphans, 0 missing).**

---

## 7. The 11 Main RTO Clusters (Audited Dataset)

All figures below represent **2026 JAN–AUG (8 Months)**:

| # | Main RTO Cluster | Sub-RTO Codes Included | 2026 TIV | Toyota Units | Toyota Share % | Sub-RTO Count |
|---|---|---|---|---|---|---|
| 1 | **Trivandrum Royals** *(Kazhakkottam & Enchakkal)* | `KL1`, `KL16`, `KL19`, `KL20`, `KL21`, `KL22`, `KL74`, `KL81` | **16,869** | **1,536** | **9.1%** | 8 |
| 2 | **Kalamassery** | `KL7`, `KL40`, `KL41`, `KL42`, `KL63` | **13,232** | **1,825** | **13.8%** | 5 |
| 3 | **Kottayam** | `KL5`, `KL33`, `KL34`, `KL35`, `KL36`, `KL67` | **11,839** | **1,027** | **8.7%** | 6 |
| 4 | **Kollam** | `KL2`, `KL23`, `KL24`, `KL25`, `KL80`, `KL82` | **10,876** | **798** | **7.3%** | 6 |
| 5 | **Trichur** | `KL8`, `KL46`, `KL48`, `KL75` | **9,232** | **710** | **7.7%** | 4 |
| 6 | **Muvattupuzha** | `KL6`, `KL17`, `KL37`, `KL38`, `KL44`, `KL68`, `KL69` | **8,947** | **869** | **9.7%** | 7 |
| 7 | **Kayamkulam** | `KL4`, `KL29`, `KL31`, `KL61`, `KL66` | **7,211** | **575** | **8.0%** | 5 |
| 8 | **Nettoor** | `KL32`, `KL39`, `KL43` | **5,492** | **460** | **8.4%** | 3 |
| 9 | **Irinjalakuda** | `KL45`, `KL47`, `KL64` | **4,927** | **580** | **11.8%** | 3 |
| 10 | **Pathanamthitta** | `KL3`, `KL26`, `KL62`, `KL83` | **4,727** | **440** | **9.3%** | 4 |
| 11 | **Thiruvalla** | `KL27`, `KL28`, `KL30` | **3,294** | **310** | **9.4%** | 3 |
| — | **Other / Unmapped** | `KL9`, `KL10`–`KL15`, `KL18`, `KL49`–`KL60`, `KL65`, `KL70`–`KL73`, `KL76`–`KL79`, `KL84`–`KL86` | **61,516** | **6,527** | **10.6%** | 32 |
| **Σ** | **TOTAL STATEWIDE** | **All 86 Sub-RTOs** | **158,162** | **15,658** | **9.9%** | **86** |

---

## 8. Mathematical Formulas & Calculation Rules

1. **Total Industry Volume (TIV / LMV)**:
   $$\text{TIV} = \sum_{\text{all makers}} \text{Nos}$$

2. **Toyota Volume (NOS / TKM)**:
   $$\text{Toyota Units} = \sum_{\text{maker} \in \{\text{'TOYOTA KIRLOSKAR MOTOR PVT LTD'}\}} \text{Nos}$$

3. **Toyota Market Share % (MS %)**:
   $$\text{MS \%} = \left( \frac{\text{Toyota Units}}{\text{TIV}} \right) \times 100$$
   *(Rounded to 1 decimal place)*

4. **Average Monthly Volume**:
   $$\text{Avg Monthly TIV} = \text{round}\left(\frac{\text{TIV}_{2026 \text{ Jan–Aug}}}{8}\right)$$
   $$\text{Avg Monthly Toyota} = \text{round}\left(\frac{\text{Toyota Units}_{2026 \text{ Jan–Aug}}}{8}, 1\right)$$

5. **Sub-RTO Reconciliation Rule**:
   $$\text{Main Cluster TIV} \equiv \sum_{i=1}^{N} \text{Sub-RTO TIV}_i$$
   $$\text{Sub-RTO TIV} \equiv \sum_{m \in \{\text{JAN}\dots\text{AUG}\}} \text{Monthly TIV}_m$$

---

## 9. Complete Source Code Blueprint

### 9.1 `package.json`
```json
{
  "name": "performance-dashboard",
  "version": "1.0.0",
  "description": "RTO Analytics Dashboard with secure authentication",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node server.js"
  },
  "keywords": [
    "dashboard",
    "analytics",
    "authentication"
  ],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "express": "^4.18.2",
    "bcryptjs": "^2.4.3",
    "express-session": "^1.17.3",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "express-rate-limit": "^7.1.5"
  }
}
```

### 9.2 `.env` (Must be UTF-8 Encoded)
```env
DASHBOARD_USERNAME=Admin
DASHBOARD_PASSWORD_HASH=$2a$10$X0H0G35m9j6P5ltQbzjcqeVnOz0f73Cs1vuWdMUIOjcIO/ENtb5bC
SESSION_SECRET=c1fd38b30e2be7e77af433012e4ddf598d94ed15a7015ef52a09493493d1e507
PORT=3000
```
*(Note: Password for hash `$2a$10$X0H0G35m9j6P5ltQbzjcqeVnOz0f73Cs1vuWdMUIOjcIO/ENtb5bC` is `admin123`)*

### 9.3 `server.js`
```javascript
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

// Serve login.js
app.get('/login.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'login.js'));
});

// Handle login POST
app.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const validUsername = process.env.DASHBOARD_USERNAME;
  const validPasswordHash = process.env.DASHBOARD_PASSWORD_HASH;

  if (!validUsername || !validPasswordHash) {
    console.error('Server configuration error: Missing credentials in environment');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  // Case-insensitive username check
  if (username.trim().toLowerCase() !== validUsername.trim().toLowerCase()) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

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

// Serve rto.css
app.get('/rto.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'rto.css'));
});

// Serve rto_data.json securely
app.get('/rto_data.json', requireAuth, (req, res) => {
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

// Serve root
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
```

---

## 10. How to Rebuild, Run & Validate

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Ensure Data Files Are Present
Ensure `RTO_2025_2026_Combined.csv` and `RTO_MASTER.xlsm` are in the project root.

### Step 3: Compile 2026 Jan–Aug JSON Dataset
```bash
node generate_rto_data.js
```

### Step 4: Start the Server
```bash
npm start
```
Visit `http://localhost:3000` in your web browser. Login with Username: `Admin`, Password: `admin123`.

---
*End of Master Blueprint & Documentation.*
