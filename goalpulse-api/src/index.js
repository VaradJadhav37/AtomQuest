// src/index.js — GoalPulse API server
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

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(origin)) return callback(null, true);
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-goalpulse-email'],
}));
app.options('*', cors());
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────
const { router: authRouter } = require('./routes/auth');
app.use('/api/auth', authRouter);
app.use('/api/cycles', require('./routes/cycles'));
app.use('/api/goal-sheets', require('./routes/goals'));
app.use('/api/goals', require('./routes/goals'));
app.use('/api/checkins', require('./routes/checkins'));
app.use('/api/team', require('./routes/team'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ai', require('./routes/ai'));
app.use('/api/reports', require('./routes/reports'));

// ── Health ────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString(), service: 'GoalPulse API' });
});

// ── 404 handler ───────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: `${req.method} ${req.path} not found` }));

// ── Error handler ─────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 GoalPulse API running on http://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
});
