const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);

const appState = {
  date: tomorrow.toISOString().slice(0, 10),
};

const trainSchedules = [
  {
    from: "Baku",
    to: "Ganja",
    depart: "08:15",
    arrive: "12:05",
    duration: "3h 50m",
    price: "12 AZN",
  },
  {
    from: "Ganja",
    to: "Baku",
    depart: "18:10",
    arrive: "22:00",
    duration: "3h 50m",
    price: "12 AZN",
  },
  {
    from: "Baku",
    to: "Sumgayit",
    depart: "09:00",
    arrive: "09:45",
    duration: "45m",
    price: "1.2 AZN",
  },
];

const esimPackages = {
  Azerbaijan: [
    {
      name: "Azerbaijan 1 day",
      data: "2 GB",
      duration: "1 day",
      price: "$2",
      url: "https://www.airalo.com/azerbaijan-esim",
    },
    {
      name: "Azerbaijan 7 days",
      data: "5 GB",
      duration: "7 days",
      price: "$5",
      url: "https://www.airalo.com/azerbaijan-esim",
    },
    {
      name: "Azerbaijan 30 days",
      data: "15 GB",
      duration: "30 days",
      price: "$15",
      url: "https://www.airalo.com/azerbaijan-esim",
    },
  ],
  Turkey: [
    {
      name: "Turkey starter",
      data: "3 GB",
      duration: "7 days",
      price: "$4.50",
      url: "https://www.airalo.com/turkey-esim",
    },
    {
      name: "Turkey travel",
      data: "10 GB",
      duration: "30 days",
      price: "$13",
      url: "https://www.airalo.com/turkey-esim",
    },
  ],
  Georgia: [
    {
      name: "Georgia travel",
      data: "5 GB",
      duration: "15 days",
      price: "$7",
      url: "https://www.airalo.com/georgia-esim",
    },
  ],
};

const scenarios = {
  outbound: {
    input: "Sabah 10:30-da Bakıdan İstanbula uçuram, Yasamaldan nə vaxt çıxım?",
    tripType: "outbound",
    origin: "Yasamal, Baku",
    destination: "Istanbul",
    time: "10:30",
    days: 3,
  },
  tourist: {
    input: "I am arriving in Baku for 7 days and need internet plus airport transfer.",
    tripType: "tourist",
    origin: "Heydar Aliyev International Airport",
    destination: "Baku city center",
    time: "14:20",
    days: 7,
  },
  ady: {
    input: "Sabah Gəncəyə gedib axşam Bakıya qayıtmaq istəyirəm.",
    tripType: "ady",
    origin: "Baku",
    destination: "Ganja",
    time: "08:00",
    days: 1,
  },
};

const els = {
  assistantInput: document.querySelector("#assistant-input"),
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
  status: document.querySelector("#status-label"),
};

els.date.value = appState.date;

document.querySelectorAll("[data-scenario]").forEach((button) => {
  button.addEventListener("click", () => applyScenario(button.dataset.scenario));
});

els.runAssistant.addEventListener("click", () => {
  const intent = parseIntent(els.assistantInput.value);
  fillForm(intent);
  renderPlan(intent);
});

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  renderPlan(readForm());
});

function applyScenario(name) {
  const scenario = scenarios[name];
  els.assistantInput.value = scenario.input;
  fillForm(scenario);
  renderPlan(scenario);
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
    date: els.date.value,
    time: els.time.value,
    days: Number(els.days.value || 1),
  };
}

function parseIntent(text) {
  const lower = text.toLowerCase();

  if (lower.includes("gəncə") || lower.includes("ganja") || lower.includes("ady")) {
    return { ...scenarios.ady, date: appState.date };
  }

  if (lower.includes("arriving") || lower.includes("tourist") || lower.includes("baku for")) {
    return { ...scenarios.tourist, date: appState.date };
  }

  const destination = lower.includes("istanbul") || lower.includes("istanbula")
    ? "Istanbul"
    : "Airport";

  return {
    ...scenarios.outbound,
    destination,
    date: appState.date,
  };
}

function renderPlan(data) {
  const plan = buildPlan(data);
  els.status.textContent = plan.status;
  els.title.textContent = plan.title;
  els.timeline.innerHTML = plan.timeline.map(renderTimelineItem).join("");
  els.metrics.innerHTML = plan.metrics.map(renderMetric).join("");
  els.esimList.innerHTML = plan.esims.map(renderEsim).join("");
}

function buildPlan(data) {
  if (data.tripType === "ady") return buildAdyPlan(data);
  if (data.tripType === "tourist") return buildTouristPlan(data);
  return buildOutboundPlan(data);
}

function buildOutboundPlan(data) {
  const flightTime = parseTime(data.time);
  const driveMinutes = estimateDriveMinutes(data.origin, "GYD");
  const airportBuffer = 150;
  const leaveTime = addMinutes(flightTime, -(driveMinutes + airportBuffer));
  const country = destinationCountry(data.destination);

  return {
    status: "Airport plan ready",
    title: `Outbound flight to ${data.destination}`,
    timeline: [
      {
        time: leaveTime,
        title: `Leave ${data.origin}`,
        body: `${driveMinutes} min estimated road time to Heydar Aliyev International Airport with traffic buffer.`,
      },
      {
        time: addMinutes(leaveTime, driveMinutes),
        title: "Arrive at GYD",
        body: "International check-in, passport control, and gate buffer are included.",
      },
      {
        time: data.time,
        title: `Flight to ${data.destination}`,
        body: "Travel eSIM can be bought before departure and activated after landing.",
      },
    ],
    metrics: [
      ["Leave at", leaveTime],
      ["Road ETA", `${driveMinutes} min`],
      ["Airport buffer", "150 min"],
      ["Trip internet", country],
    ],
    esims: getEsims(country),
  };
}

function buildTouristPlan(data) {
  const driveMinutes = estimateDriveMinutes("GYD", data.destination);
  return {
    status: "Tourist flow ready",
    title: "Tourist arrival in Azerbaijan",
    timeline: [
      {
        time: data.time,
        title: "Arrive at GYD",
        body: "Buy or prepare Azerbaijan eSIM, then continue with city transfer.",
      },
      {
        time: addMinutes(data.time, 45),
        title: "Exit arrivals",
        body: "AZCON ONE recommends taxi or airport express route to the city.",
      },
      {
        time: addMinutes(data.time, 45 + driveMinutes),
        title: "Reach Baku city",
        body: "AZCON Pass mock connects future Metro, BakuBus, Taxi, ADY, and airport services.",
      },
    ],
    metrics: [
      ["Stay", `${data.days} days`],
      ["City ETA", `${driveMinutes} min`],
      ["eSIM market", "Azerbaijan"],
      ["Next action", "City route"],
    ],
    esims: getEsims("Azerbaijan"),
  };
}

function buildAdyPlan(data) {
  const outbound = trainSchedules.find((trip) => trip.from === "Baku" && trip.to === "Ganja");
  const inbound = trainSchedules.find((trip) => trip.from === "Ganja" && trip.to === "Baku");

  return {
    status: "ADY round trip ready",
    title: "Baku to Ganja round trip",
    timeline: [
      {
        time: outbound.depart,
        title: `ADY ${outbound.from} → ${outbound.to}`,
        body: `Arrives ${outbound.arrive}. Duration ${outbound.duration}. Ticket ${outbound.price}.`,
      },
      {
        time: "12:05",
        title: "Time in Ganja",
        body: "Day plan can continue with local taxi, city route, or return reminder.",
      },
      {
        time: inbound.depart,
        title: `ADY ${inbound.from} → ${inbound.to}`,
        body: `Arrives ${inbound.arrive}. Duration ${inbound.duration}. Ticket ${inbound.price}.`,
      },
    ],
    metrics: [
      ["Total rail", "7h 40m"],
      ["Ticket total", "24 AZN"],
      ["Return", inbound.depart],
      ["Service", "ADY"],
    ],
    esims: getEsims("Azerbaijan").slice(0, 2),
  };
}

function getEsims(country) {
  return esimPackages[country] || [
    {
      name: `${country} eSIM search`,
      data: "Provider search",
      duration: "Flexible",
      price: "From partner",
      url: `https://www.airalo.com/search?search=${encodeURIComponent(country)}`,
    },
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

function parseTime(time) {
  return time || "10:30";
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
        <p>${packageItem.data} · ${packageItem.duration} · Partner checkout</p>
      </div>
      <a href="${packageItem.url}" target="_blank" rel="noreferrer">Get eSIM</a>
    </article>
  `;
}

applyScenario("outbound");
