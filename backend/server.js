const express = require('express');
const cors    = require('cors');
const path    = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const flightsRouter = require('./routes/flights');
const aiRouter = require('./routes/ai');
const weatherRouter = require('./routes/weather');
const currencyRouter = require('./routes/currency');
const smartRouteRouter = require('./routes/smartroute');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────
app.use(cors());
app.use(express.json());

// ── Static Files (serve the HTML pages) ─────────────────
// Serves everything from the project root (d:\AZCON)
app.use(express.static(path.join(__dirname, '..')));

// ── API Routes ───────────────────────────────────────────
app.use('/api/flights', flightsRouter);
app.use('/api/ai', aiRouter);
app.use('/api/weather', weatherRouter);
app.use('/api/currency', currencyRouter);
app.use('/api/smartroute', smartRouteRouter);

// ── Health Check ─────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', platform: 'AZCON DirectX', timestamp: new Date().toISOString() });
});

// ── Fallback → serve index ────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'directx-dashboard.html'));
});

// ── Start locally; export app for Vercel serverless runtime ──
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`\n╔══════════════════════════════════════════╗`);
    console.log(`║   AZCON DirectX · Server Running         ║`);
    console.log(`║   http://localhost:${PORT}                  ║`);
    console.log(`╚══════════════════════════════════════════╝\n`);
  });
}

module.exports = app;
