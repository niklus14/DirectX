const express = require('express');
const axios = require('axios');
const router = express.Router();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const YOU_API_KEY = process.env.YOU_API_KEY;
const MAPBOX_API_KEY = process.env.MAPBOX_API_KEY;

router.get('/config', (req, res) => {
  if (!MAPBOX_API_KEY) {
    return res.status(500).json({ error: 'MAPBOX_API_KEY is not configured.' });
  }

  res.json({ mapboxAccessToken: MAPBOX_API_KEY });
});

// Waze Mock Data Generator
function getWazeMockHazard(coordinates) {
  const hazardsList = [
    { type: 'accident', title: 'Car Accident', desc: 'Minor accident blocking right lane.' },
    { type: 'jam', title: 'Heavy Traffic', desc: 'Average speed 15 km/h.' },
    { type: 'construction', title: 'Roadworks', desc: 'Left lane closed for repairs.' },
    { type: 'police', title: 'Police Checkpoint', desc: 'Speed check ahead.' }
  ];
  
  if (!coordinates || coordinates.length < 5) return null;
  
  // Pick a point roughly in the middle of the route for the hazard
  const midIndex = Math.floor(coordinates.length / 2);
  const hazardLoc = coordinates[midIndex];
  const hazard = hazardsList[Math.floor(Math.random() * hazardsList.length)];
  
  return {
    lng: hazardLoc[0],
    lat: hazardLoc[1],
    type: hazard.type,
    title: hazard.title,
    desc: hazard.desc
  };
}

router.post('/analyze', async (req, res) => {
  try {
    const { origin, destination, distance, duration, coordinates } = req.body;

    if (!origin || !destination) {
      return res.status(400).json({ error: 'Origin and Destination are required.' });
    }

    const hazard = getWazeMockHazard(coordinates);
    let wazeReport = hazard ? `Waze Report: ${hazard.title} - ${hazard.desc}` : 'Waze: Clear roads.';
    let youResearch = '';

    // 1. You.com Research API
    try {
      if (YOU_API_KEY) {
        const query = `Current traffic, roadworks, or news regarding route from ${origin} to ${destination} in Baku`;
        const youResponse = await axios.post('https://api.you.com/v1/research', 
          { input: query, research_effort: 'standard' },
          { headers: { 'X-API-Key': YOU_API_KEY, 'Content-Type': 'application/json' } }
        );
        
        if (youResponse.data) {
          if (youResponse.data.output && youResponse.data.output.content) {
             youResearch = youResponse.data.output.content;
          } else if (youResponse.data.answer) {
             youResearch = youResponse.data.answer;
          }
        }
      }
    } catch (youError) {
      console.error('You.com Research Error:', youError.response ? youError.response.data : youError.message);
    }

    // 2. Prepare System Prompt for Groq
    const systemPrompt = `
You are DirectX AI, specializing in intelligent routing and transit analysis for the AZCON platform in Baku.
You need to analyze the route between "${origin}" and "${destination}".

Here is the data collected from the ecosystem:
- **Mapbox Routing Info:** Distance is ${distance}, Estimated Time is ${duration}.
- **Waze Live Traffic/Hazards:** ${wazeReport}
- **You.com Web Intelligence:** ${youResearch || 'No critical web alerts at the moment.'}

Your Task:
Provide a highly professional, detailed, yet well-structured analysis of the route. 
Do not write a scattered paragraph. Use Markdown to structure your answer beautifully with the following sections:
### 📍 Route Overview
(Explain the distance, time, and general path)

### ⚠️ Live Hazards & Traffic
(Detail any Waze or You.com alerts clearly)

### 💡 AI Recommendation
(Give your final advice on whether to proceed, avoid certain roads, or use an alternative route)

Reply in the language the user most likely used for their locations (usually Azerbaijani or English). Keep it very clean and easy to read.
`;

    // 3. Call Groq API
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Groq API Key is missing.' });
    }

    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Please analyze the route from ${origin} to ${destination}.` }
        ],
        temperature: 0.3,
        max_tokens: 800
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const aiAnalysis = groqResponse.data.choices[0].message.content;
    
    res.json({
      hazard: hazard, // Return the exact coordinate object to the frontend
      analysis: aiAnalysis
    });

  } catch (error) {
    console.error('Smart Route Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to analyze route', details: error.message });
  }
});

module.exports = router;
