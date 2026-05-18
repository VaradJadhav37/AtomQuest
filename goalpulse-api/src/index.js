// src/index.js — GoalKeeper API server
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

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
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-goalkeeper-email'],
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions));
app.use(express.json());
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
app.use('/api/auth', authRouter);
app.use('/api/cycles', require('./routes/cycles'));
app.use('/api/goal-sheets', require('./routes/goals'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/team', require('./routes/team'));
app.use('/api/teams', require('./routes/teams'));
app.use('/api/v1/teams', require('./routes/teams'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/reports', require('./routes/reports'));

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
