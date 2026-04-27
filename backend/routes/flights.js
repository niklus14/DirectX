const express = require('express');
const axios   = require('axios');
const router  = express.Router();

const API_KEY  = process.env.AVIATIONSTACK_API_KEY;
const BASE_URL = 'http://api.aviationstack.com/v1/flights';
const GYD_IATA = 'GYD';

// ─────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────

/** Simulate gate if not provided by API */
function simulateGate(flightNumber) {
  const gates = ['A1','A2','A3','A4','B1','B2','B3','C1','C2'];
  const idx = (parseInt(flightNumber.replace(/\D/g, ''), 10) || 0) % gates.length;
  return gates[idx];
}

/** Simulate baggage belt if not provided */
function simulateBelt(flightNumber) {
  return ((parseInt(flightNumber.replace(/\D/g, ''), 10) || 0) % 6) + 1;
}

/** Map Aviationstack flight_status to our status vocabulary */
function normalizeStatus(raw) {
  if (!raw) return 'unknown';
  const map = {
    scheduled: 'scheduled',
    active:    'active',
    landed:    'landed',
    cancelled: 'cancelled',
    incident:  'cancelled',
    diverted:  'diverted',
  };
  return map[raw.toLowerCase()] || raw.toLowerCase();
}

/** Build a clean, consistent flight object from raw API data */
function formatFlight(f) {
  const dep = f.departure || {};
  const arr = f.arrival   || {};
  const al  = f.airline   || {};
  const fl  = f.flight    || {};

  const flightIata = fl.iata || fl.icao || '—';
  const status     = normalizeStatus(f.flight_status);
  const delay      = dep.delay || arr.delay || 0;

  return {
    flightNumber:  flightIata,
    airline:       al.name || '—',
    origin:        { iata: dep.iata, airport: dep.airport, city: dep.timezone },
    destination:   { iata: arr.iata, airport: arr.airport, city: arr.timezone },
    scheduled:     dep.scheduled || arr.scheduled || null,
    estimated:     dep.estimated || arr.estimated || null,
    actual:        dep.actual    || arr.actual    || null,
    status,
    delay,          // minutes
    delayed:       delay >= 15,
    terminal:      dep.terminal || arr.terminal || 'Terminal 1',
    gate:          dep.gate     || arr.gate     || simulateGate(flightIata),
    baggage:       arr.baggage  || simulateBelt(flightIata),
  };
}

// ─────────────────────────────────────────────────────────────
//  GET /api/flights/departures  — GYD departures
// ─────────────────────────────────────────────────────────────
router.get('/departures', async (req, res) => {
  try {
    const { data } = await axios.get(BASE_URL, {
      params: {
        access_key: API_KEY,
        dep_iata:   GYD_IATA,
        limit:      25,
      },
      timeout: 10000,
    });

    if (!data || !data.data) {
      return res.status(502).json({ error: 'No data from Aviationstack' });
    }

    const flights = data.data.map(formatFlight);
    res.json({ airport: GYD_IATA, type: 'departures', count: flights.length, flights });
  } catch (err) {
    console.error('[DEPARTURES ERROR]', err.message);
    res.status(500).json({ error: 'Failed to fetch departures', detail: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  GET /api/flights/arrivals  — GYD arrivals
// ─────────────────────────────────────────────────────────────
router.get('/arrivals', async (req, res) => {
  try {
    const { data } = await axios.get(BASE_URL, {
      params: {
        access_key: API_KEY,
        arr_iata:   GYD_IATA,
        limit:      25,
      },
      timeout: 10000,
    });

    if (!data || !data.data) {
      return res.status(502).json({ error: 'No data from Aviationstack' });
    }

    const flights = data.data.map(formatFlight);
    res.json({ airport: GYD_IATA, type: 'arrivals', count: flights.length, flights });
  } catch (err) {
    console.error('[ARRIVALS ERROR]', err.message);
    res.status(500).json({ error: 'Failed to fetch arrivals', detail: err.message });
  }
});

// ─────────────────────────────────────────────────────────────
//  GET /api/flights/search?flight=J2123  — specific flight
// ─────────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const { flight } = req.query;
  if (!flight) {
    return res.status(400).json({ error: 'Missing ?flight= parameter (e.g., J2123)' });
  }

  // Normalise: remove spaces, uppercase
  const flightIata = flight.replace(/\s+/g, '').toUpperCase();

  try {
    const { data } = await axios.get(BASE_URL, {
      params: {
        access_key:  API_KEY,
        flight_iata: flightIata,
        limit:       5,
      },
      timeout: 10000,
    });

    if (!data || !data.data || data.data.length === 0) {
      return res.status(404).json({ error: `No flight found for "${flightIata}"` });
    }

    // Return the most recent result
    const result = formatFlight(data.data[0]);
    res.json(result);
  } catch (err) {
    console.error('[SEARCH ERROR]', err.message);
    res.status(500).json({ error: 'Search failed', detail: err.message });
  }
});

module.exports = router;
