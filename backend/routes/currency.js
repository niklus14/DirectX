const express = require('express');
const axios = require('axios');
const router = express.Router();

const API_KEY = process.env.EXCHANGERATE_API_KEY;

router.get('/', async (req, res) => {
  try {
    if (!API_KEY) {
      return res.status(500).json({ error: 'EXCHANGERATE_API_KEY is not configured.' });
    }

    // ExchangeRate-API URL format
    const response = await axios.get(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`);

    if (response.data && response.data.conversion_rates) {
      const azn = response.data.conversion_rates.AZN;
      const eur = response.data.conversion_rates.EUR;
      
      // We'll return USD->AZN and EUR->AZN (which we calculate by AZN / EUR)
      res.json({
        usd_to_azn: azn.toFixed(2),
        eur_to_azn: eur ? (azn / eur).toFixed(2) : 'N/A'
      });
    } else {
      res.status(500).json({ error: 'Invalid currency data received.' });
    }
  } catch (error) {
    console.error('Currency API Error:', error.message);
    res.status(500).json({ error: 'Failed to fetch currency data.' });
  }
});

module.exports = router;
