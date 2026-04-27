const express = require('express');
const axios = require('axios');
const router = express.Router();

const API_KEY = process.env.OPENWEATHERMAP_API_KEY;

router.get('/', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: 'OPENWEATHERMAP_API_KEY is not configured.' });
    }

    const city = req.query.city || 'Baku';
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather`, {
      params: {
        q: city,
        appid: API_KEY,
        units: 'metric'
      }
    });

    res.json({
      city: response.data.name,
      temp: Math.round(response.data.main.temp),
      description: response.data.weather[0].description,
      icon: response.data.weather[0].icon
    });
  } catch (error) {
    console.error('Weather API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch weather data.' });
  }
});

module.exports = router;
