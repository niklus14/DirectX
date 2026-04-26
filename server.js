const fs = require("fs");
const http = require("http");
const path = require("path");

const root = __dirname;
const port = Number(process.env.PORT || 5173);
const keys = readKeys();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".txt": "text/plain; charset=utf-8",
};

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname === "/api/health") {
      return sendJson(res, {
        openRouteService: Boolean(keys.openRouteService),
        groq: Boolean(keys.groq)
      });
    }

    if (url.pathname === "/api/route" && req.method === "POST") {
      const body = await readJson(req);
      return handleRoute(body, res);
    }

    if (url.pathname === "/api/traffic" && req.method === "POST") {
      const body = await readJson(req);
      return handleTraffic(body, res);
    }

    if (url.pathname === "/api/resolve" && req.method === "POST") {
      const body = await readJson(req);
      return handleResolve(body, res);
    }

    if (url.pathname === "/api/recommendation" && req.method === "POST") {
      const body = await readJson(req);
      return handleRecommendation(body, res);
    }

    if (url.pathname === "/api/intent" && req.method === "POST") {
      const body = await readJson(req);
      return handleIntent(body, res);
    }

    if (url.pathname === "/api/weather" && req.method === "GET") {
      return handleWeather(res);
    }

    if (url.pathname === "/api/currency" && req.method === "GET") {
      return handleCurrency(res);
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    sendJson(res, { error: error.message || "Server error" }, 500);
  }
});

server.listen(port, () => {
  console.log(`DirectX dashboard running at http://127.0.0.1:${port}/`);
});

function readKeys() {
  const file = path.join(root, "apikeys");
  if (!fs.existsSync(file)) return {};
  const text = fs.readFileSync(file, "utf8");
  return {
    openRouteService: text.match(/openrouteservice\.org API key=\s*([^\s]+)/i)?.[1],
    groq: text.match(/openai\/gpt-oss-120b API key=\s*([^\s]+)/i)?.[1],
  };
}

async function handleTraffic(body, res) {
  const origin = await resolvePlace(body.origin);
  const destination = await resolvePlace(body.destination);

  if (!origin || !destination) {
    return sendJson(res, { error: "Origin and destination are required" }, 400);
  }

  if (!keys.openRouteService) {
    return sendJson(res, { error: "No route provider key is configured" }, 503);
  }

  sendJson(res, await getMultiModalRoutes(origin, destination));
}

async function getMultiModalRoutes(origin, destination) {
  const modes = [
    { profile: "driving-car", name: "Maşın (Avtomobil)", color: "#3B82F6" },
    { profile: "cycling-regular", name: "Velosiped", color: "#F59E0B" },
    { profile: "foot-walking", name: "Piyada", color: "#22C55E" }
  ];

  const coords = [
    [origin.lng, origin.lat],
    [destination.lng, destination.lat],
  ];

  const fetchRoute = async ({ profile, name, color }, index) => {
    try {
      const response = await fetch(`https://api.openrouteservice.org/v2/directions/${profile}/geojson`, {
        method: "POST",
        headers: {
          "Authorization": keys.openRouteService,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ coordinates: coords }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      const feature = data.features?.[0];
      if (!feature) return null;
      
      const summary = feature.properties?.summary || {};
      const minutes = Math.round((summary.duration || 0) / 60);
      const distanceKm = (summary.distance || 0) / 1000;
      const coordinates = (feature.geometry?.coordinates || []).map(([lon, lat]) => ({ lat, lng: lon }));
      
      // Simulate traffic for car just for visualization, others are unaffected
      let trafficMinutes = minutes;
      let delayMinutes = 0;
      if (profile === "driving-car") {
        delayMinutes = Math.floor(Math.random() * 15);
        trafficMinutes += delayMinutes;
      }

      return buildRouteResult({
        index,
        name,
        baseMinutes: minutes,
        trafficMinutes,
        delayMinutes,
        distanceKm,
        coordinates,
        liveTraffic: profile === "driving-car",
        color
      });
    } catch {
      return null;
    }
  };

  const results = await Promise.all(modes.map(fetchRoute));
  const routes = results.filter(Boolean);
  
  routes.sort((a, b) => a.trafficMinutes - b.trafficMinutes);

  return {
    source: "OpenRouteService Multi-Modal",
    liveTraffic: false,
    origin: origin.label,
    destination: destination.label,
    resolved: { origin, destination },
    directDistanceKm: directDistance(routes[0]?.coordinates || []),
    bestRouteId: routes[0]?.id,
    routes,
  };
}

async function handleResolve(body, res) {
  const origin = body.origin ? await resolvePlace(body.origin) : null;
  const destination = body.destination ? await resolvePlace(body.destination) : null;
  sendJson(res, { origin, destination });
}

function buildRouteResult({ index, name, baseMinutes, trafficMinutes, delayMinutes, distanceKm, coordinates, liveTraffic, color }) {
  const ratio = baseMinutes > 0 ? delayMinutes / baseMinutes : 0;
  const weight = liveTraffic ? trafficWeight(ratio, delayMinutes) : "free";
  const score = trafficMinutes + delayMinutes * 0.7 + index * 0.2;
  return {
    id: `route-${index + 1}`,
    name,
    baseMinutes,
    trafficMinutes,
    delayMinutes,
    distanceKm,
    coordinates,
    trafficRatio: ratio,
    trafficWeight: weight,
    color: color || routeColor(weight),
    score,
  };
}

function trafficWeight(ratio, delayMinutes) {
  if (delayMinutes >= 18 || ratio >= 0.45) return "heavy";
  if (delayMinutes >= 7 || ratio >= 0.18) return "moderate";
  return "free";
}

function routeColor(weight) {
  if (weight === "heavy") return "#d14b3f";
  if (weight === "moderate") return "#d49b28";
  if (weight === "free") return "#15996d";
  return "#2a6f97";
}

function directDistance(coordinates) {
  if (coordinates.length < 2) return 0;
  return haversine(coordinates[0], coordinates[coordinates.length - 1]);
}

function haversine(a, b) {
  const r = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(x));
}

function toRad(value) {
  return value * Math.PI / 180;
}

function decodePolyline(encoded) {
  let index = 0;
  let lat = 0;
  let lng = 0;
  const coordinates = [];

  while (index < encoded.length) {
    const latChange = decodePolylineValue(encoded, index);
    index = latChange.index;
    lat += latChange.value;

    const lngChange = decodePolylineValue(encoded, index);
    index = lngChange.index;
    lng += lngChange.value;

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return coordinates;
}

function decodePolylineValue(encoded, startIndex) {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte;

  do {
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return {
    value: result & 1 ? ~(result >> 1) : result >> 1,
    index,
  };
}

async function resolvePlace(input) {
  const text = String(input || "").trim();
  if (!text) return null;

  const queries = await buildAddressQueries(text);
  const candidates = [];
  const cached = knownPlaceCandidate(text);
  if (cached) candidates.push(cached);

  for (const query of queries) {
    const providerCandidates = [
      ...await geocodeNominatim(query).catch(() => []),
      ...await geocodeOpenRouteService(query).catch(() => []),
    ];
    candidates.push(...providerCandidates);
  }

  const ranked = dedupeCandidates(candidates)
    .filter((candidate) => candidate.lat && candidate.lng)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  const best = ranked[0];
  if (!best) return null;

  return {
    input: text,
    label: best.label,
    lat: best.lat,
    lng: best.lng,
    source: best.source,
    confidence: best.confidence,
    query: best.query,
    candidates: ranked.map(({ label, lat, lng, source, confidence, query }) => ({
      label,
      lat,
      lng,
      source,
      confidence,
      query,
    })),
  };
}

async function buildAddressQueries(input) {
  const base = compactList([
    input,
    normalizeAzerbaijaniAddress(input),
    `${input}, Baku, Azerbaijan`,
  ]);

  if (!keys.groq) return unique(base).slice(0, 5);

  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${keys.groq}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        temperature: 0.1,
        messages: [
          {
            role: "system",
            content: [
              "You help geocode vague place names in Baku.",
              "Return only JSON: {\"queries\":[\"...\"]}.",
              "Create up to 3 precise geocoding search queries.",
              "Keep original place names, add Baku/Azerbaijan context, expand abbreviations, and do not invent exact street numbers unless they are well-known from the user text.",
            ].join(" "),
          },
          { role: "user", content: input },
        ],
      }),
    });
    if (!response.ok) return unique(base).slice(0, 5);
    const data = await response.json();
    const jsonText = (data.choices?.[0]?.message?.content || "{}").match(/\{[\s\S]*\}/)?.[0] || "{}";
    const aiQueries = JSON.parse(jsonText).queries || [];
    return unique([...base, ...aiQueries]).slice(0, 6);
  } catch {
    return unique(base).slice(0, 5);
  }
}

async function geocodeGoogle(query) {
  const params = new URLSearchParams({
    address: query,
    region: "az",
    key: keys.googleMaps,
  });
  const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
  if (!response.ok) return [];
  const data = await response.json();
  if (data.status !== "OK") return [];

  return (data.results || []).slice(0, 4).map((result) => {
    const location = result.geometry?.location || {};
    const quality = result.geometry?.location_type === "ROOFTOP" ? 0.98 : 0.9;
    return {
      label: result.formatted_address,
      lat: location.lat,
      lng: location.lng,
      source: "Google Geocoding",
      confidence: quality,
      query,
    };
  });
}

async function geocodeNominatim(query) {
  const params = new URLSearchParams({
    format: "json",
    q: query,
    limit: "4",
    addressdetails: "1",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { "User-Agent": "DirectX-hackathon-prototype/1.0" },
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data
    .filter((item) => !isGenericBakuResult(item.display_name))
    .map((item) => ({
      label: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
      source: "OpenStreetMap",
      confidence: nominatimConfidence(item),
      query,
    }));
}

async function geocodeOpenRouteService(query) {
  if (!keys.openRouteService) return [];
  const params = new URLSearchParams({
    api_key: keys.openRouteService,
    text: query,
    size: "4",
    "boundary.country": "AZ",
  });
  const response = await fetch(`https://api.openrouteservice.org/geocode/search?${params}`);
  if (!response.ok) return [];
  const data = await response.json();
  return (data.features || [])
    .filter((feature) => !isGenericBakuResult(feature.properties?.label))
    .map((feature) => ({
      label: feature.properties?.label || query,
      lat: feature.geometry?.coordinates?.[1],
      lng: feature.geometry?.coordinates?.[0],
      source: "OpenRouteService Geocode",
      confidence: Math.min(0.72, feature.properties?.confidence || 0.58),
      query,
    }));
}

function knownPlaceCandidate(input) {
  const lower = input.toLowerCase();
  if (lower.includes("holberton")) {
    return {
      label: "Holberton School Baku, Heydar Aliyev Avenue 152",
      lat: 40.4099144,
      lng: 49.893893,
      source: "DirectX alias cache",
      confidence: 0.97,
      query: input,
    };
  }
  if (lower.includes("unec") && lower.includes("nizami")) {
    return {
      label: "UNEC Nizami korpusu, Murtuza Muxtarov 192",
      lat: 40.3727456,
      lng: 49.8305772,
      source: "DirectX alias cache",
      confidence: 0.96,
      query: input,
    };
  }
  return null;
}

function normalizeAzerbaijaniAddress(input) {
  return input
    .replace(/\bkorpusu\b/gi, "campus")
    .replace(/\bküçəsi\b/gi, "street")
    .replace(/\bprospekti\b/gi, "avenue")
    .replace(/\bpr\.\b/gi, "avenue")
    .trim();
}

function nominatimConfidence(item) {
  if (item.class === "amenity" || item.class === "office" || item.class === "building") return 0.82;
  if (item.addresstype === "road") return 0.72;
  if (item.addresstype === "city") return 0.25;
  return Math.min(0.78, Number(item.importance || 0.4) + 0.35);
}

function isGenericBakuResult(label = "") {
  return /^Baku,\s*(BA|Bakı|Azerbaijan)/i.test(label) || /^Baki,\s*Azerbaijan/i.test(label);
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${Number(candidate.lat).toFixed(5)}:${Number(candidate.lng).toFixed(5)}:${candidate.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function unique(values) {
  return compactList(values).filter((value, index, arr) => arr.indexOf(value) === index);
}

function compactList(values) {
  return values.map((value) => String(value || "").trim()).filter(Boolean);
}

async function handleRoute(body, res) {
  if (!keys.openRouteService) {
    return sendJson(res, { error: "OpenRouteService key is missing" }, 503);
  }

  const origin = await geocode(body.origin);
  const destination = await geocode(body.destination);
  const response = await fetch("https://api.openrouteservice.org/v2/directions/driving-car/geojson", {
    method: "POST",
    headers: {
      "Authorization": keys.openRouteService,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coordinates: [
        [origin.lon, origin.lat],
        [destination.lon, destination.lat],
      ],
    }),
  });

  if (!response.ok) {
    return sendJson(res, { error: `Route API failed: ${response.status}` }, 502);
  }

  const data = await response.json();
  const summary = data.features?.[0]?.properties?.summary;
  if (!summary) return sendJson(res, { error: "No route found" }, 404);

  sendJson(res, {
    minutes: Math.round(summary.duration / 60),
    distanceKm: summary.distance / 1000,
    source: "OpenRouteService",
  });
}

async function geocode(text) {
  const fixed = fixedCoordinate(text);
  if (fixed) return fixed;

  const params = new URLSearchParams({
    api_key: keys.openRouteService,
    text,
    size: "1",
  });
  const response = await fetch(`https://api.openrouteservice.org/geocode/search?${params}`);
  if (!response.ok) throw new Error(`Geocoding failed: ${response.status}`);
  const data = await response.json();
  const coords = data.features?.[0]?.geometry?.coordinates;
  if (!coords) throw new Error(`No coordinates found for ${text}`);
  return { lon: coords[0], lat: coords[1] };
}

function fixedCoordinate(text) {
  const lower = String(text || "").toLowerCase();
  if (lower.includes("heydar aliyev avenue 152") || lower.includes("h. aliyev pr. 152")) {
    return { lat: 40.4099144, lon: 49.8938930 };
  }
  if (lower.includes("murtuza muxtarov") || lower.includes("murtuza mukhtarov")) {
    return { lat: 40.3727456, lon: 49.8305772 };
  }
  return null;
}

async function handleIntent(body, res) {
  if (!keys.groq) {
    return sendJson(res, { error: "Groq key is missing" }, 503);
  }

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${keys.groq}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: [
            "Extract a JSON route request for DirectX.",
            "Return only JSON with origin and destination.",
            "The user can write in Azerbaijani, English, Russian, or Turkish.",
            "Examples: 'Holberton School-dan UNEC Nizami korpusuna getmək istəyirəm' means origin Holberton School Baku and destination UNEC Nizami korpusu.",
            "Do not invent a route if the text does not contain enough information. Use null for missing fields.",
          ].join(" "),
        },
        { role: "user", content: body.text || "" },
      ],
    }),
  });

  if (!response.ok) {
    return sendJson(res, { error: `Groq API failed: ${response.status}` }, 502);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || "{}";
  sendJson(res, { intent: JSON.parse(jsonText) });
}

async function handleWeather(res) {
  try {
    const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=40.4093&longitude=49.8671&current=temperature_2m,weather_code&timezone=auto");
    if (!response.ok) throw new Error("Weather fetch failed");
    const data = await response.json();
    sendJson(res, { 
      temperature: data.current.temperature_2m,
      weatherCode: data.current.weather_code
    });
  } catch (err) {
    sendJson(res, { error: "Weather not available", temperature: "--" }, 502);
  }
}

async function handleCurrency(res) {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!response.ok) throw new Error("Currency fetch failed");
    const data = await response.json();
    const aznRate = data.rates.AZN;
    const eurRate = data.rates.AZN / data.rates.EUR;
    sendJson(res, { 
      usdToAzn: aznRate.toFixed(2),
      eurToAzn: eurRate.toFixed(2)
    });
  } catch (err) {
    sendJson(res, { error: "Currency not available", usdToAzn: "--", eurToAzn: "--" }, 502);
  }
}

async function handleRecommendation(body, res) {
  const fallback = buildFallbackRecommendation(body);
  if (!keys.groq) return sendJson(res, { summary: fallback, source: "fallback" });

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${keys.groq}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-120b",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: [
            "You are DirectX traffic assistant.",
            "Write in Azerbaijani.",
            "Return exactly 2 short plain-text sentences.",
            "Do not use markdown, headings, bullets, or bold text.",
            "Recommend the most suitable transportation vehicle/method (Car, Walking, Cycling) based on duration, distance, and traffic.",
            "If live traffic is not available, mention that it's based on normal route duration.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({
            origin: body.origin,
            destination: body.destination,
            source: body.source,
            liveTraffic: body.liveTraffic,
            routes: (body.routes || []).map((route) => ({
              name: route.name,
              trafficMinutes: route.trafficMinutes,
              baseMinutes: route.baseMinutes,
              delayMinutes: route.delayMinutes,
              distanceKm: Number(route.distanceKm || 0).toFixed(1),
              trafficWeight: route.trafficWeight,
            })),
          }),
        },
      ],
    }),
  });

  if (!response.ok) return sendJson(res, { summary: fallback, source: "fallback" });
  const data = await response.json();
  const summary = data.choices?.[0]?.message?.content?.trim() || fallback;
  sendJson(res, { summary, source: "groq" });
}

function buildFallbackRecommendation(body) {
  const best = body.routes?.[0];
  if (!best) return "Marşrut tapılmadı. Başlanğıc və təyinat nöqtələrini daha dəqiq yazın.";
  const trafficNote = body.liveTraffic
    ? `Tıxac ağırlığı: ${best.trafficWeight}, gecikmə: ${best.delayMinutes} dəq.`
    : "Canlı tıxac datası aktiv deyil; nəticə yol geometriyası və məsafə əsasında verilir.";
  return `${best.name} ən uyğun seçimdir: təxminən ${best.trafficMinutes} dəqiqə və ${Number(best.distanceKm).toFixed(1)} km. ${trafficNote}`;
}

function serveStatic(pathname, res) {
  if (pathname === "/") pathname = "/index.html";
  if (pathname.includes("apikeys")) {
    return sendText(res, "Not found", 404);
  }

  const requested = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(root, requested);
  if (!filePath.startsWith(root)) return sendText(res, "Forbidden", 403);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return sendText(res, "Not found", 404);
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) req.destroy();
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function sendJson(res, data, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function sendText(res, text, status = 200) {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}
