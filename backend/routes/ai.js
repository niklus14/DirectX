const express = require('express');
const axios = require('axios');

const router = express.Router();

// Ensure keys exist
const YOU_API_KEY = process.env.YOU_API_KEY;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

router.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let searchContext = '';

    // 1. Fetch real-time data from You.com Research API
    try {
      if (YOU_API_KEY) {
        const youResponse = await axios.post('https://api.you.com/v1/research', 
          { input: message, research_effort: 'standard' },
          { headers: { 'X-API-Key': YOU_API_KEY, 'Content-Type': 'application/json' } }
        );
        
        // You.com v1/research usually returns output in 'answer' or 'output.content'
        if (youResponse.data) {
          if (youResponse.data.output && youResponse.data.output.content) {
             searchContext = youResponse.data.output.content;
          } else if (youResponse.data.answer) {
             searchContext = youResponse.data.answer;
          } else {
             searchContext = JSON.stringify(youResponse.data);
          }
        }
      }
    } catch (youError) {
      console.error('You.com API Error:', youError.response ? youError.response.data : youError.message);
      // Continue even if You.com fails, the model can still answer
    }

    // 2. Prepare System Context
    const systemPrompt = `
You are DirectX AI, the central artificial intelligence of the AZCON platform (a unified travel and transit ecosystem in Azerbaijan).
Your name is EXACTLY "DirectX AI".
You have access to knowledge about the AZCON app features: AZAL flight schedules, Smart Route optimization, eSIM connectivity (via Aztelekom), Unified Wallet, and Tracing Intelligence.
Real-time Search Context (if any): ${searchContext}

CRITICAL INSTRUCTION: You must respond in the SAME LANGUAGE as the user's prompt. 
For example, if the user asks in Azerbaijani, reply in Azerbaijani. If Russian, reply in Russian.
Be helpful, concise, and professional. Use markdown for formatting (e.g., **bold**).
    `;

    // 3. Call Groq API (using a large OSS model like llama-3.1-70b-versatile)
    if (!GROQ_API_KEY) {
      return res.status(500).json({ error: 'Groq API Key is missing.' });
    }

    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        temperature: 0.5,
        max_tokens: 1024
      },
      {
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const responseText = groqResponse.data.choices[0].message.content;
    res.json({ reply: responseText });

  } catch (error) {
    console.error('AI Chat Error:', error.response ? error.response.data : error.message);
    res.status(500).json({ error: 'Failed to process AI request', details: error.message });
  }
});

module.exports = router;
