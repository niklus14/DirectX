const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

const appState = {
  date: tomorrow.toISOString().slice(0, 10),
  routeSource: "Demo estimate",
  apiOnline: false,
};

const trainSchedules = [
  { from: "Baku", to: "Ganja", depart: "08:15", arrive: "12:05", duration: "3h 50m", price: "12 AZN" },
  { from: "Ganja", to: "Baku", depart: "18:10", arrive: "22:00", duration: "3h 50m", price: "12 AZN" },
  { from: "Baku", to: "Sumgayit", depart: "09:00", arrive: "09:45", duration: "45m", price: "1.20 AZN" },
];

const esimPackages = {
  Azerbaijan: [
    { name: "Azerbaijan day pass", data: "2 GB", duration: "1 day", price: "$2", url: "https://www.airalo.com/azerbaijan-esim" },
    { name: "Azerbaijan visitor", data: "5 GB", duration: "7 days", price: "$5", url: "https://www.airalo.com/azerbaijan-esim" },
    { name: "Azerbaijan monthly", data: "15 GB", duration: "30 days", price: "$15", url: "https://www.airalo.com/azerbaijan-esim" },
  ],
  Turkey: [
    { name: "Turkey starter", data: "3 GB", duration: "7 days", price: "$4.50", url: "https://www.airalo.com/turkey-esim" },
    { name: "Turkey travel", data: "10 GB", duration: "30 days", price: "$13", url: "https://www.airalo.com/turkey-esim" },
  ],
  Georgia: [
    { name: "Georgia travel", data: "5 GB", duration: "15 days", price: "$7", url: "https://www.airalo.com/georgia-esim" },
  ],
};

const scenarios = {
  outbound: {
    input: "Sabah 10:30-da Bakıdan İstanbula uçuram, Yasamaldan nə vaxt çıxım?",
    tripType: "outbound",
    origin: "Yasamal, Baku",
    destination: "Istanbul",
    routeDestination: "Heydar Aliyev International Airport",
    time: "10:30",
    days: 3,
  },
  tourist: {
    input: "I am arriving in Baku for 7 days and need internet plus airport transfer.",
    tripType: "tourist",
    origin: "Heydar Aliyev International Airport",
    destination: "Baku city center",
    routeDestination: "Baku city center",
    time: "14:20",
    days: 7,
  },
  ady: {
    input: "Sabah Gəncəyə gedib axşam Bakıya qayıtmaq istəyirəm.",
    tripType: "ady",
    origin: "Baku",
    destination: "Ganja",
    routeDestination: "Ganja",
    time: "08:00",
    days: 1,
  },
};

const els = {
  assistantInput: document.querySelector("#assistant-input"),
  assistantState: document.querySelector("#assistant-state"),
  runAssistant: document.querySelector("#run-assistant"),
  form: document.querySelector("#planner-form"),
  tripType: document.querySelector("#trip-type"),
  origin: document.querySelector("#origin"),
  destination: document.querySelector("#destination"),
  date: document.querySelector("#date"),
  time: document.querySelector("#time"),
  days: document.querySelector("#days"),
  title: document.querySelector("#result-title"),
  timeline: document.querySelector("#timeline"),
  metrics: document.querySelector("#metrics"),
  esimList: document.querySelector("#esim-list"),
  esimCountry: document.querySelector("#esim-country"),
  status: document.querySelector("#status-label"),
  apiStatus: document.querySelector("#api-status"),
  routeSignal: document.querySelector("#route-signal"),
};

els.date.value = appState.date;

document.querySelectorAll("[data-scenario]").forEach((button) => {
  button.addEventListener("click", () => applyScenario(button.dataset.scenario));
});

els.runAssistant.addEventListener("click", async () => {
  els.assistantState.textContent = "Thinking";
  const intent = await parseIntent(els.assistantInput.value);
  fillForm(intent);
  await renderPlan(intent);
  els.assistantState.textContent = appState.apiOnline ? "Groq/API flow" : "Local fallback";
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  await renderPlan(readForm());
});

checkApiHealth();
applyScenario("outbound");

async function checkApiHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    appState.apiOnline = Boolean(data.openRouteService);
    els.apiStatus.textContent = data.openRouteService ? "OpenRouteService connected" : "Demo routing";
  } catch {
    els.apiStatus.textContent = "Static fallback";
  }
}

async function applyScenario(name) {
  const scenario = scenarios[name];
  document.querySelectorAll(".scenario").forEach((button) => {
    button.classList.toggle("active", button.dataset.scenario === name);
  });
  els.assistantInput.value = scenario.input;
  fillForm(scenario);
  await renderPlan(scenario);
}

function fillForm(data) {
  els.tripType.value = data.tripType;
  els.origin.value = data.origin;
  els.destination.value = data.destination;
  els.time.value = data.time;
  els.days.value = data.days;
  els.date.value = data.date || appState.date;
}

function readForm() {
  return {
    tripType: els.tripType.value,
    origin: els.origin.value.trim(),
    destination: els.destination.value.trim(),
    routeDestination: els.tripType.value === "outbound" ? "Heydar Aliyev International Airport" : els.destination.value.trim(),
    date: els.date.value,
    time: els.time.value,
    days: Number(els.days.value || 1),
  };
}

async function parseIntent(text) {
  try {
    const response = await fetch("/api/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (response.ok) {
      const data = await response.json();
      return normalizeIntent(data.intent || localIntent(text));
    }
  } catch {
    // Local fallback keeps the demo reliable if the AI endpoint is unavailable.
  }
  return normalizeIntent(localIntent(text));
}

function localIntent(text) {
  const lower = text.toLowerCase();
  if (lower.includes("gəncə") || lower.includes("ganja") || lower.includes("ady")) return scenarios.ady;
  if (lower.includes("arriving") || lower.includes("tourist") || lower.includes("baku for")) return scenarios.tourist;
  return scenarios.outbound;
}

function normalizeIntent(intent) {
  const base = scenarios[intent.tripType] || scenarios.outbound;
  return {
    ...base,
    ...cleanIntent(intent),
    date: intent.date || appState.date,
    routeDestination: intent.tripType === "outbound"
      ? "Heydar Aliyev International Airport"
      : intent.routeDestination || intent.destination || base.routeDestination,
  };
}

function cleanIntent(intent) {
  return Object.fromEntries(
    Object.entries(intent).filter(([, value]) => value !== null && value !== undefined && value !== "")
  );
}

async function renderPlan(data) {
  markModule(data.tripType);
  const route = await getRoute(data);
  const plan = buildPlan(data, route);
  els.status.textContent = plan.status;
  els.title.textContent = plan.title;
  els.routeSignal.textContent = appState.routeSource;
  els.timeline.innerHTML = plan.timeline.map(renderTimelineItem).join("");
  els.metrics.innerHTML = plan.metrics.map(renderMetric).join("");
  els.esimCountry.textContent = plan.esimCountry;
  els.esimList.innerHTML = plan.esims.map(renderEsim).join("");
}

function markModule(tripType) {
  document.querySelectorAll(".module-card").forEach((card) => card.classList.remove("active"));
  const active = tripType === "ady" ? "ady" : tripType === "tourist" ? "esim" : "azal";
  document.querySelector(`[data-module="${active}"]`)?.classList.add("active");
}

async function getRoute(data) {
  if (data.tripType === "ady") return null;
  const destination = data.routeDestination || data.destination;
  try {
    const response = await fetch("/api/route", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ origin: data.origin, destination }),
    });
    const result = await response.json();
    if (response.ok && result.minutes) {
      appState.routeSource = "Real route API";
      return result;
    }
  } catch {
    // Fall through to deterministic demo estimate.
  }
  appState.routeSource = "Demo estimate";
  return {
    minutes: estimateDriveMinutes(data.origin, destination),
    distanceKm: data.tripType === "tourist" ? 25 : 29,
  };
}

function buildPlan(data, route) {
  if (data.tripType === "ady") return buildAdyPlan();
  if (data.tripType === "tourist") return buildTouristPlan(data, route);
  return buildOutboundPlan(data, route);
}

function buildOutboundPlan(data, route) {
  const driveMinutes = Math.round(route?.minutes || 35);
  const airportBuffer = 150;
  const leaveTime = addMinutes(data.time, -(driveMinutes + airportBuffer));
  const country = destinationCountry(data.destination);

  return {
    status: "Airport plan ready",
    title: `Outbound flight to ${data.destination}`,
    esimCountry: country,
    timeline: [
      { time: leaveTime, title: `Leave ${data.origin}`, body: `${driveMinutes} min road ETA to GYD. Source: ${appState.routeSource}.` },
      { time: addMinutes(leaveTime, driveMinutes), title: "Arrive at GYD", body: "Check-in, passport control, security and gate buffer are included." },
      { time: data.time, title: `Flight to ${data.destination}`, body: "Travel eSIM is recommended before departure and activated after landing." },
    ],
    metrics: [
      ["Leave at", leaveTime],
      ["Road ETA", `${driveMinutes} min`],
      ["Distance", route?.distanceKm ? `${route.distanceKm.toFixed(1)} km` : "Demo"],
      ["Buffer", "150 min"],
    ],
    esims: getEsims(country),
  };
}

function buildTouristPlan(data, route) {
  const driveMinutes = Math.round(route?.minutes || 32);
  return {
    status: "Tourist flow ready",
    title: "Tourist arrival in Azerbaijan",
    esimCountry: "Azerbaijan",
    timeline: [
      { time: data.time, title: "Arrive at GYD", body: "Azerbaijan eSIM tariffs are shown before the city transfer." },
      { time: addMinutes(data.time, 45), title: "Exit arrivals", body: "AZCON ONE continues with airport to city route and pass activation." },
      { time: addMinutes(data.time, 45 + driveMinutes), title: "Reach Baku city", body: `${driveMinutes} min road ETA. Source: ${appState.routeSource}.` },
    ],
    metrics: [
      ["Stay", `${data.days} days`],
      ["City ETA", `${driveMinutes} min`],
      ["Distance", route?.distanceKm ? `${route.distanceKm.toFixed(1)} km` : "Demo"],
      ["Next", "AZCON Pass"],
    ],
    esims: getEsims("Azerbaijan"),
  };
}

function buildAdyPlan() {
  const outbound = trainSchedules.find((trip) => trip.from === "Baku" && trip.to === "Ganja");
  const inbound = trainSchedules.find((trip) => trip.from === "Ganja" && trip.to === "Baku");
  return {
    status: "ADY plan ready",
    title: "Baku to Ganja round trip",
    esimCountry: "Azerbaijan",
    timeline: [
      { time: outbound.depart, title: `ADY ${outbound.from} to ${outbound.to}`, body: `Arrives ${outbound.arrive}. Duration ${outbound.duration}. Ticket ${outbound.price}.` },
      { time: "12:05", title: "Time in Ganja", body: "The same dashboard can attach city taxi, return reminder and AZCON Pass." },
      { time: inbound.depart, title: `ADY ${inbound.from} to ${inbound.to}`, body: `Arrives ${inbound.arrive}. Duration ${inbound.duration}. Ticket ${inbound.price}.` },
    ],
    metrics: [
      ["Rail time", "7h 40m"],
      ["Ticket total", "24 AZN"],
      ["Return", inbound.depart],
      ["Source", "Static ADY"],
    ],
    esims: getEsims("Azerbaijan").slice(0, 2),
  };
}

function getEsims(country) {
  return esimPackages[country] || [
    { name: `${country} eSIM search`, data: "Provider search", duration: "Flexible", price: "Partner", url: `https://www.airalo.com/search?search=${encodeURIComponent(country)}` },
  ];
}

function destinationCountry(destination) {
  const value = destination.toLowerCase();
  if (value.includes("istanbul") || value.includes("turkey")) return "Turkey";
  if (value.includes("tbilisi") || value.includes("georgia")) return "Georgia";
  if (value.includes("baku") || value.includes("azerbaijan")) return "Azerbaijan";
  return destination;
}

function estimateDriveMinutes(origin, destination) {
  const pair = `${origin} ${destination}`.toLowerCase();
  if (pair.includes("yasamal")) return 35;
  if (pair.includes("city center")) return 32;
  if (pair.includes("airport")) return 30;
  return 40;
}

function addMinutes(time, minutes) {
  const [hours, mins] = time.split(":").map(Number);
  const date = new Date(2026, 0, 1, hours, mins);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toTimeString().slice(0, 5);
}

function renderTimelineItem(item) {
  return `
    <article class="timeline-item">
      <div class="timeline-time">${item.time}</div>
      <div>
        <strong>${item.title}</strong>
        <p>${item.body}</p>
      </div>
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

function renderEsim(packageItem) {
  return `
    <article class="esim-card">
      <div>
        <strong>${packageItem.name} · ${packageItem.price}</strong>
        <p>${packageItem.data} · ${packageItem.duration} · partner checkout</p>
      </div>
      <a href="${packageItem.url}" target="_blank" rel="noreferrer">Get eSIM</a>
    </article>
  `;
}
