# AZCON DirectX Ecosystem

![AZCON Banner](https://img.shields.io/badge/Platform-AZCON-3AE2CE?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Beta_MVP-0B1D26?style=for-the-badge)
![Node.js](https://img.shields.io/badge/Node.js-18.x-43853D?style=for-the-badge&logo=node.js)
![Express](https://img.shields.io/badge/Express-Backend-000000?style=for-the-badge&logo=express)

**AZCON** is a unified, next-generation travel and transit ecosystem designed specifically for Azerbaijan (Baku). The **DirectX** platform serves as the central digital hub, offering a seamless, high-fidelity experience that connects flights, public transit, connectivity (eSIM), digital payments, and artificial intelligence into a single, intuitive interface.

## 🚀 Key Features

### 1. DirectX Dashboard
A premium, scroll-triggered 3D landing page featuring smooth animations (powered by GSAP/ScrollTrigger) and a glassmorphism design. It introduces users to the core pillars of the AZCON ecosystem.

### 2. Transit & Flights Board (`azal-flights.html`)
Live, real-time flight tracking for Heydar Aliyev International Airport (GYD).
- **Aviationstack Integration:** Real-time departures, arrivals, gates, and delays.
- **Live Widgets:** Built-in real-time Weather (OpenWeatherMap) and Currency Exchange (ExchangeRate-API) widgets for travelers.
- **Delay Intelligence:** Smart banners that detect delayed flights and offer contextual advice (e.g., lounge access, route updates).

### 3. DirectX AI Assistant (`directx-ai.html`)
A powerful, multilingual AI assistant embedded deep into the ecosystem.
- **Groq OSS Integration:** Utilizes high-speed, large-scale Open Source LLMs (e.g., `openai/gpt-oss-120b`).
- **Hybrid Real-Time Research:** Connected to **You.com Research API** to fetch live, up-to-date information from the web before generating a response.
- **Multilingual:** Automatically detects the user's language (Azerbaijani, English, Russian, etc.) and responds fluently in the same language with rich Markdown formatting.

### 4. Smart Services
- **eSIM Connectivity:** Instant tourist and resident eSIM activation modules.
- **Unified Wallet:** A centralized digital payment system for metro, retail, and platform services.
- **Smart Route & Tracing:** Intelligent pathfinding across Baku's transport grid.

---

## 🛠 Tech Stack

- **Frontend:** HTML5, Vanilla JavaScript, CSS3 (Custom Glassmorphism Design System)
- **Animations:** GSAP (GreenSock) & ScrollTrigger
- **Backend:** Node.js, Express.js
- **API Integrations:** 
  - Groq API (LLM inference)
  - You.com API (Web Search & RAG)
  - Aviationstack API (Live Flights)
  - OpenWeatherMap API (Weather)
  - ExchangeRate-API (Currency)
- **Deployment:** Pre-configured for serverless deployment on Vercel (`vercel.json`).

---

## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/your-username/azcon-directx.git
cd azcon-directx
```

### 2. Install Dependencies
Ensure you have Node.js installed, then run:
```bash
npm install express cors axios dotenv
```

### 3. Environment Variables
Create a `.env` file inside the `backend/` directory with the following API keys:
```env
# AI Models & Search
GROQ_API_KEY=your_groq_key_here
YOU_API_KEY=your_you_dot_com_key_here

# Transit & Utilities
AVIATIONSTACK_API_KEY=your_aviationstack_key_here
EXCHANGERATE_API_KEY=your_exchange_rate_key_here
OPENWEATHERMAP_API_KEY=your_openweathermap_key_here
```

### 4. Run the Development Server
```bash
npm start
```
The server will start on `http://localhost:3000`. Navigate to the URL in your browser to experience the DirectX Dashboard.

---

## 📂 Project Structure

```text
├── backend/
│   ├── routes/
│   │   ├── ai.js           # Groq & You.com hybrid logic
│   │   ├── flights.js      # Aviationstack live data logic
│   │   ├── weather.js      # OpenWeatherMap logic
│   │   └── currency.js     # ExchangeRate API logic
│   ├── server.js           # Express App Entry Point
│   └── .env                # Secret API Keys
├── index.css               # Global Styles & Tokens
├── directx-dashboard.html  # 3D Landing Page
├── azcon-one.html          # Ecosystem Hub
├── azal-flights.html       # Transit & Live Flights Dashboard
├── directx-ai.html         # Multilingual AI Assistant UI
├── vercel.json             # Serverless deployment config
└── README.md
```

---

## 🛡 License
© 2026 AZCON. All rights reserved. Proprietary and confidential.
