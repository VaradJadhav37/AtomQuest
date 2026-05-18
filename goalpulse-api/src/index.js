// src/index.js — GoalKeeper API server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  throw new Error('JWT_SECRET must be set to a strong value (min 16 chars)');
}

const allowedOrigins = new Set(
  String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean)
);

[
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'https://atom-quest-kappa.vercel.app',
].forEach(origin => allowedOrigins.add(origin));

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-goalkeeper-email', 'x-csrf-token'],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));

// ── Security headers ──────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// ── Rate limiting ──────────────────────────────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
  skip: (req) => req.path === '/health',
});

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AI_RATE_LIMIT || 50),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI rate limit exceeded. Please wait before retrying.' },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

app.use(globalLimiter);
app.use(express.json({ limit: '1mb' }));
app.use((req, res, next) => {
  const method = String(req.method || '').toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = req.headers['x-csrf-token'];
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) return res.status(403).json({ error: 'Invalid origin' });
    if (!csrf || String(csrf).trim().length < 12) return res.status(403).json({ error: 'Missing/invalid CSRF token' });
  }
  next();
});
app.get('/', (req, res) => {
  res.json({
    service: 'GoalKeeper API',
    status: 'ok',
    health: '/health',
    debug: '/api/debug/routes',
  });
});

// ── Routes ────────────────────────────────────────────────────────────────
const { router: authRouter } = require('./routes/auth');
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRouter);
app.use('/api/cycles', require('./routes/cycles'));
app.use('/api/goal-sheets', require('./routes/goalSheets'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/team', require('./routes/team'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/v1/teams', require('./routes/teams'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ai', aiLimiter, require('./routes/ai'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/notifications', require('./routes/notifications'));

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString(), service: 'GoalKeeper API' });
});

// ── 404 handler ───────────────────────────────────────────────────────────
function collectRoutes(stack, prefix = '') {
  const routes = [];

  for (const layer of stack || []) {
    if (layer.route?.path) {
      routes.push({
        path: `${prefix}${layer.route.path}`,
        methods: Object.keys(layer.route.methods || {}).map(method => method.toUpperCase()),
      });
      continue;
    }

    if (Array.isArray(layer.handle?.stack) && layer.handle.stack.length > 0) {
      routes.push(...collectRoutes(layer.handle.stack, prefix));
    }
  }

  return routes;
}

// ── Debug routes (development only) ─────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  app.get('/api/debug/routes', (req, res) => {
    const stack = app._router?.stack || app.router?.stack || [];
    const routes = collectRoutes(stack);
    res.json({
      service: 'GoalKeeper API',
      pid: process.pid,
      node: process.version,
      env: process.env.NODE_ENV || 'development',
      routeCount: routes.length,
      routes,
    });
  });
} else {
  // In production, return 404 for this endpoint
  app.get('/api/debug/routes', (req, res) => res.status(404).json({ error: 'Not found' }));
}

app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));

// ── Error handler ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 GoalKeeper API running on http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
});
