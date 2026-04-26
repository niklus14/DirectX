const els = {
  landingView: document.querySelector("#landing-view"),
  dashboardView: document.querySelector("#dashboard-view"),
  startJourney: document.querySelector("#start-journey"),
  landingTemp: document.querySelector("#landing-temp"),
  landingUsd: document.querySelector("#landing-usd"),
  landingEur: document.querySelector("#landing-eur"),
  prompt: document.querySelector("#assistant-input"),
  assistantState: document.querySelector("#assistant-state"),
  origin: document.querySelector("#origin"),
  destination: document.querySelector("#destination"),
  analyze: document.querySelector("#run-assistant"),
  sample: document.querySelector("#sample-route"),
  apiStatus: document.querySelector("#api-status"),
  trafficSource: document.querySelector("#traffic-source"),
  title: document.querySelector("#result-title"),
  status: document.querySelector("#status-label"),
  metrics: document.querySelector("#metrics"),
  addressResolution: document.querySelector("#address-resolution"),
  routeList: document.querySelector("#route-list"),
  summary: document.querySelector("#ai-summary"),
  mapState: document.querySelector("#map-state"),
  routeSignal: document.querySelector("#route-signal"),
  trafficWeightSignal: document.querySelector("#traffic-weight-signal"),
  bestRouteSignal: document.querySelector("#best-route-signal"),
  aiSignal: document.querySelector("#ai-signal"),
};

let lastTrafficResult = null;
let leafletMap = null;
let routeLayers = null;
let markerLayers = null;

els.analyze.addEventListener("click", analyzeTraffic);
els.sample.addEventListener("click", () => {
  els.origin.value = "Holberton School Baku";
  els.destination.value = "UNEC Nizami korpusu";
  els.prompt.value = "";
  analyzeTraffic();
});

checkHealth();
initLanding();
renderEmptyState();

function initLanding() {
  fetchWeather();
  fetchCurrency();
  els.startJourney.addEventListener("click", () => {
    els.landingView.classList.add("fade-out");
    setTimeout(() => {
      els.landingView.style.display = "none";
      els.dashboardView.style.display = "block";
      initMap();
    }, 800);
  });
}

async function fetchWeather() {
  try {
    const res = await fetch("/api/weather");
    const data = await res.json();
    if (data.temperature) els.landingTemp.textContent = `${data.temperature}°C`;
  } catch (e) {
    console.error(e);
  }
}

async function fetchCurrency() {
  try {
    const res = await fetch("/api/currency");
    const data = await res.json();
    if (data.usdToAzn) els.landingUsd.textContent = data.usdToAzn;
    if (data.eurToAzn) els.landingEur.textContent = data.eurToAzn;
  } catch (e) {
    console.error(e);
  }
}

function initMap() {
  leafletMap = L.map('map').setView([40.409261, 49.867092], 12);
  
  // Esri World Imagery (Satellite)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
  }).addTo(leafletMap);
  
  // Esri Reference Labels (Hybrid)
  L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Labels &copy; Esri'
  }).addTo(leafletMap);

  routeLayers = L.layerGroup().addTo(leafletMap);
  markerLayers = L.layerGroup().addTo(leafletMap);
}

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    els.apiStatus.textContent = health.openRouteService ? "Routing ready" : "Routing offline";
    els.trafficSource.textContent = health.openRouteService ? "Multi-modal enabled" : "Need ORS API key";
  } catch {
    els.apiStatus.textContent = "API check failed";
    els.trafficSource.textContent = "Server unavailable";
  }
}

async function analyzeTraffic() {
  els.assistantState.textContent = "Analyzing";
  els.status.textContent = "Loading";
  els.summary.textContent = "Analyzing routes and preparing recommendation...";

  const request = await resolveRouteRequest();
  if (!request.origin || !request.destination) {
    els.assistantState.textContent = "Needs route";
    els.status.textContent = "Missing input";
    els.summary.textContent = "Başlanğıc və təyinat nöqtəsini yazın. Prompt və ya From/To sahələri istifadə oluna bilər.";
    return;
  }

  try {
    const response = await fetch("/api/traffic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Traffic request failed");

    lastTrafficResult = result;
    renderTrafficResult(result);
    await renderRecommendation(result);
  } catch (error) {
    els.assistantState.textContent = "Failed";
    els.status.textContent = "Route error";
    els.summary.textContent = error.message;
    drawEmptyMap("Route data unavailable");
  }
}

async function resolveRouteRequest() {
  const fields = {
    origin: els.origin.value.trim(),
    destination: els.destination.value.trim(),
  };

  if (fields.origin && fields.destination) return fields;

  const prompt = els.prompt.value.trim();
  if (!prompt) return fields;

  const local = parsePromptLocally(prompt);
  if (local.origin && local.destination) return local;

  try {
    const response = await fetch("/api/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: prompt }),
    });
    if (!response.ok) return local;
    const data = await response.json();
    return {
      origin: fields.origin || data.intent?.origin || local.origin,
      destination: fields.destination || data.intent?.destination || local.destination,
    };
  } catch {
    return local;
  }
}

function parsePromptLocally(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const azMatch = cleaned.match(/(.+?)(?:-dan|-dən|dan|dən)\s+(.+?)(?:-a|-ə|a|ə)?\s+(?:getmək|gedirəm|get|gedəcəm|gedecem)/i);
  if (azMatch) {
    return {
      origin: azMatch[1].trim(),
      destination: azMatch[2].trim(),
    };
  }

  const enMatch = cleaned.match(/from\s+(.+?)\s+to\s+(.+)/i);
  if (enMatch) {
    return {
      origin: enMatch[1].trim(),
      destination: enMatch[2].trim(),
    };
  }

  return { origin: "", destination: "" };
}

function renderTrafficResult(result) {
  const best = result.routes.find((route) => route.id === result.bestRouteId) || result.routes[0];
  const weightLabel = formatTrafficWeight(best.trafficWeight);
  els.assistantState.textContent = "Route ready";
  els.status.textContent = "Multi-Modal";
  els.title.textContent = `${shortPlace(result.origin)} → ${shortPlace(result.destination)}`;
  els.routeSignal.textContent = `${result.routes.length} route${result.routes.length > 1 ? "s" : ""} visualized`;
  els.trafficWeightSignal.textContent = "Simulated Traffic";
  els.bestRouteSignal.textContent = `${best.name} · ${best.trafficMinutes} min`;
  els.trafficSource.textContent = result.source;
  els.metrics.innerHTML = [
    ["Best time", `${best.trafficMinutes} min`],
    ["Traffic", weightLabel],
    ["Delay", `${best.delayMinutes} min`],
    ["Distance", `${Number(best.distanceKm || 0).toFixed(1)} km`],
  ].map(renderMetric).join("");
  els.addressResolution.innerHTML = renderAddressResolution(result.resolved);
  els.routeList.innerHTML = result.routes.map((route) => renderRouteCard(route, route.id === best.id, true)).join("");
  drawRoutes(result, best.id);
}

async function renderRecommendation(result) {
  els.aiSignal.textContent = "Summarizing";
  try {
    const response = await fetch("/api/recommendation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(result),
    });
    const data = await response.json();
    els.summary.textContent = data.summary || "Recommendation unavailable.";
    els.aiSignal.textContent = data.source === "groq" ? "Groq summary" : "Fallback summary";
  } catch {
    els.summary.textContent = localSummary(result);
    els.aiSignal.textContent = "Local summary";
  }
}

function renderEmptyState() {
  els.metrics.innerHTML = [
    ["Best time", "--"],
    ["Traffic", "--"],
    ["Delay", "--"],
    ["Distance", "--"],
  ].map(renderMetric).join("");
  els.addressResolution.innerHTML = "";
  els.routeList.innerHTML = "";
  drawEmptyMap("Enter a route");
}

function drawEmptyMap(label) {
  els.mapState.textContent = label;
  routeLayers.clearLayers();
  markerLayers.clearLayers();
}

function drawRoutes(result, bestRouteId) {
  routeLayers.clearLayers();
  markerLayers.clearLayers();
  
  const coordinates = result.routes.flatMap((route) => route.coordinates || []);
  if (!coordinates.length) {
    drawEmptyMap("No route geometry");
    return;
  }

  els.mapState.textContent = "Multi-Modal visualized";

  const best = result.routes.find((route) => route.id === bestRouteId) || result.routes[0];

  result.routes.forEach(route => {
    const latlngs = route.coordinates.map(p => [p.lat, p.lng]);
    const isBest = route.id === bestRouteId;
    const weight = isBest ? 8 : 4;
    const opacity = isBest ? 0.9 : 0.6;
    
    L.polyline(latlngs, {
      color: route.color || '#3B82F6',
      weight: weight,
      opacity: opacity
    }).addTo(routeLayers);
  });

  const start = best.coordinates[0];
  const end = best.coordinates[best.coordinates.length - 1];

  L.circleMarker([start.lat, start.lng], { radius: 8, color: '#0F172A', fillColor: '#22C55E', fillOpacity: 1 }).addTo(markerLayers);
  L.circleMarker([end.lat, end.lng], { radius: 8, color: '#0F172A', fillColor: '#EF4444', fillOpacity: 1 }).addTo(markerLayers);

  const allLatLngs = result.routes.flatMap(r => r.coordinates.map(p => [p.lat, p.lng]));
  leafletMap.fitBounds(L.latLngBounds(allLatLngs), { padding: [50, 50] });
}

function renderRouteCard(route, isBest, liveTraffic) {
  return `
    <article class="route-card ${isBest ? "best" : ""}">
      <div>
        <span class="route-dot" style="background:${route.color}"></span>
        <strong>${route.name}</strong>
        ${isBest ? "<em>Recommended</em>" : ""}
      </div>
      <p>
        ${route.trafficMinutes} min · ${Number(route.distanceKm || 0).toFixed(1)} km ·
        ${liveTraffic ? `${route.delayMinutes} min delay, ${formatTrafficWeight(route.trafficWeight)}` : "traffic not available"}
      </p>
    </article>
  `;
}

function renderAddressResolution(resolved) {
  if (!resolved?.origin || !resolved?.destination) return "";
  return `
    <section class="resolved-grid" aria-label="Resolved addresses">
      ${renderResolvedPlace("From", resolved.origin)}
      ${renderResolvedPlace("To", resolved.destination)}
    </section>
  `;
}

function renderResolvedPlace(label, place) {
  return `
    <article class="resolved-place">
      <span>${label} resolved as</span>
      <strong>${place.label}</strong>
      <p>${place.source} · confidence ${(Number(place.confidence || 0) * 100).toFixed(0)}%</p>
    </article>
  `;
}

function renderMetric([label, value]) {
  return `
    <div class="metric">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `;
}

function localSummary(result) {
  const best = result.routes[0];
  if (!best) return "Marşrut tapılmadı.";
  return `${best.name} ən uyğun yoldur: ${best.trafficMinutes} dəqiqə, ${Number(best.distanceKm || 0).toFixed(1)} km. Tıxac səviyyəsi: ${formatTrafficWeight(best.trafficWeight)}.`;
}

function formatTrafficWeight(weight) {
  if (weight === "free") return "Free";
  if (weight === "moderate") return "Moderate";
  if (weight === "heavy") return "Heavy";
  return "Unknown";
}

function shortPlace(value) {
  return String(value || "")
    .replace(", Azerbaijan", "")
    .replace("Azerbaijan, ", "")
    .replace("Holberton School Azerbaijan", "Holberton School")
    .replace("UNEC Nizami campus", "UNEC Nizami");
}
