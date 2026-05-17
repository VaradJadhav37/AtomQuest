// src/index.js — GoalPulse API server
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
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
