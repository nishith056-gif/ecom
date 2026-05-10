const state = {
  data: null,
  user: null,
  watchId: null,
  activeFilters: new Set(["metro", "bus", "tram", "taxi", "bike", "water", "scooter"]),
  selectedModes: new Set(["metro", "bus", "taxi", "rideshare", "bike"]),
  zoom: 1,
  currency: "AED",
  overlayBounds: null,
  timers: []
};

const icons = { metro: "M", bus: "B", tram: "TR", taxi: "TX", bike: "BK", water: "WT", scooter: "SC", rideshare: "RS" };
const fallbackLocation = { lat: 25.2048, lng: 55.2708, accuracy: null, source: "Downtown Dubai demo location" };
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

document.addEventListener("DOMContentLoaded", init);

async function init() {
  wireUI();
  await loadData();
  restoreLocalState();
  renderFilters();
  renderModePicker();
  renderTouristCards();
  renderFareCards();
  setLocation(fallbackLocation, false);
  startRealtimeLoops();
  setTimeout(() => $("#loader").classList.add("hidden"), 650);
}

async function loadData() {
  try {
    const response = await fetch("transport-data.json");
    state.data = await response.json();
  } catch (error) {
    $("#permissionText").textContent = "Could not load transport-data.json. Run through a local server.";
    throw error;
  }
}

function wireUI() {
  $("#menuBtn").addEventListener("click", () => $("#nav").classList.toggle("open"));
  $("#themeToggle").addEventListener("click", toggleTheme);
  $("#locateBtn").addEventListener("click", requestLocation);
  $("#fabLocate").addEventListener("click", requestLocation);
  $("#zoomIn").addEventListener("click", () => setZoom(state.zoom + 0.1));
  $("#zoomOut").addEventListener("click", () => setZoom(state.zoom - 0.1));
  $("#resetMap").addEventListener("click", () => setZoom(1));
  $("#planBtn").addEventListener("click", renderRoutes);
  $("#fareBtn").addEventListener("click", renderFareCards);
  $("#currencySelect").addEventListener("change", (event) => { state.currency = event.target.value; renderFareCards(); });
  $("#rechargeBtn").addEventListener("click", rechargeNol);
  $("#qrBtn").addEventListener("click", showQrTicket);
  $("#bookTaxiBtn").addEventListener("click", bookTaxi);
  $("#sosBtn").addEventListener("click", () => openModal(`<h2>Emergency SOS</h2><p>Call Dubai emergency services: <strong>999 Police</strong>, <strong>998 Ambulance</strong>, <strong>997 Fire</strong>.</p><p>Your last known coordinates are ${formatCoords()}.</p>`));
  $("#voiceBtn").addEventListener("click", voiceSearch);
  $("#chatForm").addEventListener("submit", handleChat);
  $$("[data-open]").forEach((button) => button.addEventListener("click", () => $(button.dataset.open).showModal()));
  $$("[data-close]").forEach((button) => button.addEventListener("click", () => button.closest("dialog").close()));
  window.addEventListener("hashchange", setActiveNav);
  setActiveNav();
}

function requestLocation() {
  if (!navigator.geolocation) {
    $("#permissionText").textContent = "Geolocation is not supported. Demo location is active.";
    setLocation(fallbackLocation, false);
    return;
  }
  $("#permissionText").textContent = "Requesting browser location permission...";
  if (state.watchId !== null) navigator.geolocation.clearWatch(state.watchId);
  state.watchId = navigator.geolocation.watchPosition(
    (position) => setLocation({
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      source: "Live GPS"
    }, true),
    () => {
      $("#permissionText").textContent = "Location permission denied. Using Downtown Dubai demo GPS.";
      setLocation(fallbackLocation, false);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 5000 }
  );
}

function setLocation(location, live) {
  state.user = location;
  const accuracy = location.accuracy ? ` Accuracy about ${Math.round(location.accuracy)} meters.` : "";
  $("#permissionText").textContent = live ? `Live GPS connected with Google Maps.${accuracy}` : `Using ${location.source}.`;
  $("#latText").textContent = `Lat: ${location.lat.toFixed(5)}`;
  $("#lngText").textContent = `Lng: ${location.lng.toFixed(5)}`;
  $("#accuracyText").textContent = `Accuracy: ${location.accuracy ? `${Math.round(location.accuracy)} m` : "demo"}`;
  updateGoogleMap();
  renderMap();
  renderNearby();
  renderRoutes();
  updateAnalytics();
}

function updateGoogleMap() {
  if (!state.user) return;
  const coords = `${state.user.lat.toFixed(7)},${state.user.lng.toFixed(7)}`;
  const mapsUrl = `https://www.google.com/maps?q=${coords}`;
  const nearest = stationsWithDistance()[0];
  $("#googleMapFrame").src = `https://maps.google.com/maps?q=${coords}&z=16&output=embed`;
  $("#openGoogleMaps").href = mapsUrl;
  $("#googleSearchNearby").href = `https://www.google.com/maps/search/transport+near+me/@${coords},15z`;
  $("#googleDirections").href = nearest ? googleDirectionsUrl(nearest) : mapsUrl;
}

function haversine(a, b) {
  const radius = 6371;
  const dLat = degToRad(b.lat - a.lat);
  const dLng = degToRad(b.lng - a.lng);
  const lat1 = degToRad(a.lat);
  const lat2 = degToRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(x));
}

function degToRad(value) { return value * Math.PI / 180; }
function stationsWithDistance() {
  return state.data.stations
    .map((station) => ({ ...station, distance: state.user ? haversine(state.user, station) : 0 }))
    .sort((a, b) => a.distance - b.distance);
}

function renderNearby() {
  const stations = stationsWithDistance().filter((station) => state.activeFilters.has(station.type));
  const nearest = stations[0];
  if (nearest) {
    $("#nearestText").textContent = nearest.name;
    $("#nearestEta").textContent = `${nearest.distance.toFixed(2)} km away`;
  }
  renderNearestByType();
  $("#nearbyList").innerHTML = stations.slice(0, 8).map((station) => `
    <article class="glass station-card">
      <h3>${icons[station.type]} ${station.name}</h3>
      <p>${station.area} · ${station.line}</p>
      <strong>${station.distance.toFixed(2)} km</strong>
      <div class="tag-row">${station.amenities.map((item) => `<span class="tag">${item}</span>`).join("")}</div>
      <button class="secondary full" onclick="showStation('${station.id}')">Details</button>
      <a class="secondary full map-link" href="${googleDirectionsUrl(station)}" target="_blank" rel="noopener">Google Maps Directions</a>
    </article>
  `).join("");
}

function renderNearestByType() {
  const types = ["metro", "bus", "tram", "taxi", "bike"];
  $("#categoryNearest").innerHTML = types.map((type) => {
    const station = stationsWithDistance().find((item) => item.type === type);
    if (!station) return "";
    return `<article class="glass mini-nearest"><small>Nearest ${title(type)}</small><strong>${icons[type]} ${station.distance.toFixed(2)} km</strong><p>${station.name}</p></article>`;
  }).join("");
}

function renderMap() {
  const map = $("#dubaiMap");
  map.querySelectorAll(".marker, .vehicle, .traffic, .overlay-lines").forEach((element) => element.remove());
  state.overlayBounds = getOverlayBounds();
  renderNetworkLines();
  renderTrafficLabels();
  if (state.user) addMarker({ ...state.user, type: "user", name: "You" });
  stationsWithDistance().filter((station) => state.activeFilters.has(station.type)).forEach(addMarker);
  renderVehicles();
}

function addMarker(item) {
  const point = projectPoint(item);
  const marker = document.createElement("button");
  marker.className = `marker ${item.type === "user" ? "user" : ""}`;
  marker.style.left = `${point.x}%`;
  marker.style.top = `${point.y}%`;
  marker.textContent = item.type === "user" ? "GPS" : icons[item.type];
  marker.title = item.name;
  marker.addEventListener("click", () => item.type === "user" ? openModal(`<h2>Your Location</h2><p>${formatCoords()}</p>`) : showStation(item.id));
  $("#dubaiMap").appendChild(marker);
}

function getOverlayBounds() {
  const points = [...state.data.stations, ...(state.user ? [state.user] : [])];
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latPad = Math.max((maxLat - minLat) * 0.14, 0.012);
  const lngPad = Math.max((maxLng - minLng) * 0.14, 0.012);
  return { minLat: minLat - latPad, maxLat: maxLat + latPad, minLng: minLng - lngPad, maxLng: maxLng + lngPad };
}

function projectPoint(point) {
  const bounds = state.overlayBounds || getOverlayBounds();
  const x = ((point.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
  const y = (1 - ((point.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat))) * 100;
  return { x: clamp(x, 3, 97), y: clamp(y, 3, 97) };
}

function renderNetworkLines() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "overlay-lines");
  svg.setAttribute("viewBox", "0 0 100 100");
  state.data.networkLines
    .filter((line) => state.activeFilters.has(line.type))
    .forEach((line) => {
      const points = line.stationIds.map(findStationById).filter(Boolean).map(projectPoint);
      if (points.length < 2) return;
      const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      polyline.setAttribute("class", `network-line ${line.type}`);
      polyline.setAttribute("points", points.map((point) => `${point.x},${point.y}`).join(" "));
      polyline.setAttribute("aria-label", line.name);
      svg.appendChild(polyline);
    });
  $("#dubaiMap").appendChild(svg);
}

function renderVehicles() {
  state.data.networkLines
    .filter((line) => state.activeFilters.has(line.type))
    .forEach((line) => {
      const points = line.stationIds.map(findStationById).filter(Boolean).map(projectPoint);
      if (points.length < 2) return;
      const vehicle = document.createElement("div");
      vehicle.className = `vehicle vehicle-${line.type}`;
      vehicle.textContent = `${icons[line.type]} ${title(line.type)}`;
      vehicle.dataset.points = JSON.stringify(points);
      vehicle.dataset.speed = String(line.frequencyMin || 6);
      $("#dubaiMap").appendChild(vehicle);
    });
  updateOverlayVehicles();
}

function updateOverlayVehicles() {
  $$(".vehicle").forEach((vehicle, index) => {
    const points = JSON.parse(vehicle.dataset.points || "[]");
    if (points.length < 2) return;
    const duration = Number(vehicle.dataset.speed) * 1500;
    const progress = ((Date.now() + index * 1800) % duration) / duration;
    const position = interpolatePath(points, progress);
    vehicle.style.left = `${position.x}%`;
    vehicle.style.top = `${position.y}%`;
  });
}

function renderTrafficLabels() {
  state.data.networkLines.slice(0, 4).forEach((line, index) => {
    const points = line.stationIds.map(findStationById).filter(Boolean).map(projectPoint);
    if (points.length < 2) return;
    const mid = points[Math.floor(points.length / 2)];
    const traffic = trafficForLine(line, index);
    const label = document.createElement("div");
    label.className = `traffic ${traffic.level}`;
    label.style.left = `${clamp(mid.x + 2, 5, 84)}%`;
    label.style.top = `${clamp(mid.y + 2, 5, 90)}%`;
    label.textContent = `${line.name}: ${traffic.text}`;
    $("#dubaiMap").appendChild(label);
  });
}

function renderFilters() {
  $("#filters").innerHTML = [...state.activeFilters].map((type) => `<button class="active" data-filter="${type}">${icons[type]} ${type}</button>`).join("");
  $$("#filters button").forEach((button) => button.addEventListener("click", () => {
    const type = button.dataset.filter;
    state.activeFilters.has(type) ? state.activeFilters.delete(type) : state.activeFilters.add(type);
    button.classList.toggle("active");
    renderMap();
    renderNearby();
  }));
}

function renderModePicker() {
  const modes = ["metro", "bus", "tram", "taxi", "water", "scooter", "bike", "rideshare"];
  $("#modePicker").innerHTML = modes.map((mode) => `<button class="${state.selectedModes.has(mode) ? "active" : ""}" data-mode="${mode}">${icons[mode]} ${mode}</button>`).join("");
  $$("#modePicker button").forEach((button) => button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    state.selectedModes.has(mode) ? state.selectedModes.delete(mode) : state.selectedModes.add(mode);
    button.classList.toggle("active");
  }));
}

function renderRoutes() {
  if (!state.data || !state.user) return;
  const destination = $("#destinationInput").value.trim() || "Dubai Mall";
  const attraction = findDestination(destination);
  const sourceText = $("#sourceInput").value.trim();
  const source = sourceText ? findDestination(sourceText) : state.user;
  const distance = attraction && source ? haversine(source, attraction) : 10 + Math.random() * 12;
  const modes = [...state.selectedModes];
  if (!modes.length) {
    $("#routes").innerHTML = `<article class="glass route-card"><h3>No transport modes selected</h3><p>Select at least one mode to generate fastest, cheapest, and eco route comparisons.</p></article>`;
    return;
  }
  const routes = modes.map((mode) => buildRoute(mode, distance, destination)).sort((a, b) => a.time - b.time);
  const cheapest = routes.reduce((a, b) => a.fare < b.fare ? a : b, routes[0]);
  const eco = routes.reduce((a, b) => a.carbon > b.carbon ? a : b, routes[0]);
  $("#routes").innerHTML = routes.map((route, index) => `
    <article class="glass route-card ${index === 0 ? "best" : ""}">
      <h3>${icons[route.mode]} ${title(route.mode)} to ${destination}</h3>
      <p>${route.summary}</p>
      <div class="tag-row">
        <span class="tag">${route.distance.toFixed(1)} km</span>
        <span class="tag">${route.time} min</span>
        <span class="tag">${formatMoney(route.fare)}</span>
        <span class="tag">${route.carbon.toFixed(1)} kg CO2 saved</span>
      </div>
      <p class="breakdown">${index === 0 ? "Fastest route" : ""} ${route === cheapest ? " Cheapest option" : ""} ${route === eco ? " Most eco-friendly" : ""}</p>
      <button class="primary full" onclick="saveTrip('${route.mode}', ${route.fare.toFixed(2)}, ${route.carbon.toFixed(2)})">Start Simulated Trip</button>
    </article>
  `).join("");
}

function buildRoute(mode, distance, destination) {
  const speeds = { metro: 48, bus: 28, tram: 24, taxi: 36, water: 26, scooter: 16, bike: 14, rideshare: 34 };
  const access = ["metro", "bus", "tram", "water"].includes(mode) ? 9 : 4;
  const time = Math.round((distance / speeds[mode]) * 60 + access + Math.random() * 6);
  const fare = calculateFare(mode, distance).total;
  const carbon = Math.max(0, distance * (0.19 - state.data.fareRules[mode].eco));
  return { mode, distance, time, fare, carbon, summary: `${title(mode)} route with live-style ETA updates, traffic weighting, and route progress to ${destination}.` };
}

function calculateFare(mode, distance) {
  const rule = state.data.fareRules[mode];
  const hour = new Date().getHours();
  const peak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
  const night = hour >= 22 || hour < 6;
  const multiplier = (peak ? rule.peakMultiplier : 1) * (night ? rule.nightMultiplier : 1) * (rule.dynamic ? 1 + Math.random() * .28 : 1);
  const base = rule.base + (rule.unlock || 0);
  const distanceCost = distance * rule.perKm;
  const waiting = ["taxi", "rideshare"].includes(mode) ? Math.min(8, distance * .4) : 0;
  const total = Math.max(rule.minimum, (base + distanceCost + waiting) * multiplier);
  return { mode, base, distanceCost, waiting, multiplier, total };
}

function renderFareCards() {
  if (!state.data) return;
  const distance = Number($("#fareDistance")?.value || 12);
  const fares = Object.keys(state.data.fareRules).map((mode) => calculateFare(mode, distance)).sort((a, b) => a.total - b.total);
  const premium = fares[fares.length - 1];
  $("#fareGrid").innerHTML = fares.map((fare, index) => `
    <article class="glass fare-card ${index === 0 ? "cheapest" : ""} ${fare === premium ? "premium" : ""}">
      <h3>${icons[fare.mode]} ${title(fare.mode)}</h3>
      <strong>${formatMoney(fare.total)}</strong>
      <p class="breakdown">Base ${formatMoney(fare.base)} · Distance ${formatMoney(fare.distanceCost)} · Multiplier ${fare.multiplier.toFixed(2)}x</p>
      <button class="secondary full" onclick="showFare('${fare.mode}', ${distance})">Breakdown</button>
    </article>
  `).join("");
}

function showStation(id) {
  const station = stationsWithDistance().find((item) => item.id === id);
  openModal(`<h2>${icons[station.type]} ${station.name}</h2><p>${station.area} · ${station.line}</p><p>Status: <strong>${station.status}</strong></p><p>${station.distance.toFixed(2)} km from your current location.</p><p>Coordinates: ${station.lat.toFixed(5)}, ${station.lng.toFixed(5)}</p><div class="tag-row">${station.amenities.map((item) => `<span class="tag">${item}</span>`).join("")}</div><a class="primary map-link" href="${googleDirectionsUrl(station)}" target="_blank" rel="noopener">Open Google Maps Directions</a>`);
}

function showFare(mode, distance) {
  const fare = calculateFare(mode, distance);
  openModal(`<h2>${title(mode)} fare</h2><p>Total: <strong>${formatMoney(fare.total)}</strong></p><p>Base/unlock: ${formatMoney(fare.base)}<br>Distance cost: ${formatMoney(fare.distanceCost)}<br>Waiting/dynamic: ${formatMoney(fare.waiting)}<br>Time multiplier: ${fare.multiplier.toFixed(2)}x</p>`);
}

function rechargeNol() {
  const amount = Number($("#rechargeAmount").value || 0);
  const balance = getNumber("nolBalance") + amount;
  localStorage.setItem("nolBalance", balance.toFixed(2));
  updateAnalytics();
  openModal(`<h2>Nol recharge complete</h2><p>Added ${formatMoney(amount)}. New balance: <strong>${formatMoney(balance)}</strong>.</p>`);
}

function showQrTicket() {
  const code = Math.random().toString(36).slice(2, 10).toUpperCase();
  openModal(`<h2>QR Ticket</h2><div class="nol-card"><strong>${code}</strong><span>Valid for one simulated DubaiMove trip</span></div>`);
}

function bookTaxi() {
  const distance = 8 + Math.random() * 18;
  const fare = calculateFare("taxi", distance).total;
  let eta = Math.ceil(2 + Math.random() * 6);
  $("#rideStatus").innerHTML = `Driver assigned: Aisha K. · ETA <strong>${eta}:00</strong> · Fare ${formatMoney(fare)}`;
  const timer = setInterval(() => {
    eta -= 1;
    $("#rideStatus").innerHTML = eta > 0 ? `Driver approaching · ETA <strong>${eta}:00</strong> · route tracking active` : `Driver arrived. Ride simulation ready.`;
    if (eta <= 0) clearInterval(timer);
  }, 2500);
  state.timers.push(timer);
}

function handleChat(event) {
  event.preventDefault();
  const input = $("#chatInput");
  const text = input.value.trim();
  if (!text) return;
  addMessage(text, "user");
  input.value = "";
  setTimeout(() => addMessage(aiReply(text), "bot"), 350);
}

function aiReply(text) {
  const q = text.toLowerCase();
  const nearest = stationsWithDistance()[0];
  if (q.includes("cheap")) return `The cheapest current option is usually metro or bus. From your GPS, ${nearest.name} is ${nearest.distance.toFixed(2)} km away.`;
  if (q.includes("fast")) return `For speed, choose metro for long corridors and taxi for short door-to-door trips. I recommend checking ${nearest.name} first.`;
  if (q.includes("airport") || q.includes("dxb")) return "For DXB, use the Red Line Metro to Terminal 1 or Terminal 3, or book an airport taxi for luggage-heavy trips.";
  if (q.includes("near")) return `Nearby top option: ${nearest.name}, ${nearest.distance.toFixed(2)} km away in ${nearest.area}.`;
  return "I can compare metro, bus, tram, taxi, water taxi, scooter, bike, and ride-share routes using GPS, fare, time, and carbon data.";
}

function addMessage(text, type) {
  $("#chatLog").insertAdjacentHTML("beforeend", `<div class="msg ${type === "user" ? "user" : ""}">${text}</div>`);
  $("#chatLog").scrollTop = $("#chatLog").scrollHeight;
}

function renderTouristCards() {
  $("#touristGrid").innerHTML = state.data.attractions.map((place) => `
    <article class="glass tourist-card">
      <h3>${place.name}</h3>
      <p>${place.tip}</p>
      <button class="secondary full" onclick="setDestination('${place.name}')">Plan Trip</button>
    </article>
  `).join("");
}

function setDestination(name) {
  $("#destinationInput").value = name;
  location.hash = "#planner";
  renderRoutes();
}

function saveTrip(mode, fare, carbon) {
  const history = JSON.parse(localStorage.getItem("tripHistory") || "[]");
  history.unshift({ mode, fare, carbon, date: new Date().toISOString() });
  localStorage.setItem("tripHistory", JSON.stringify(history.slice(0, 30)));
  localStorage.setItem("rewards", String(getNumber("rewards") + Math.round(carbon * 12)));
  localStorage.setItem("nolBalance", Math.max(0, getNumber("nolBalance") - fare).toFixed(2));
  updateAnalytics();
  openModal(`<h2>Trip started</h2><p>${title(mode)} route progress is now simulated on the live map. Rewards and analytics were updated.</p>`);
}

function updateAnalytics() {
  const history = JSON.parse(localStorage.getItem("tripHistory") || "[]");
  const spend = history.reduce((sum, trip) => sum + Number(trip.fare), 0);
  const carbon = history.reduce((sum, trip) => sum + Number(trip.carbon), 0);
  $("#spendCounter").textContent = formatMoney(spend);
  $("#carbonCounter").textContent = `${carbon.toFixed(1)} kg`;
  $("#rewardCounter").textContent = `${getNumber("rewards")} pts`;
  $("#nolBalance").textContent = formatMoney(getNumber("nolBalance"));
}

function restoreLocalState() {
  if (!localStorage.getItem("nolBalance")) localStorage.setItem("nolBalance", "50");
  if (localStorage.getItem("theme") === "light") document.body.classList.add("light");
  updateAnalytics();
}

function startRealtimeLoops() {
  state.timers.push(setInterval(() => {
    if (!state.user) return;
    renderNearby();
    updateOverlayVehicles();
    renderMap();
  }, 6000));
  state.timers.push(setInterval(updateOverlayVehicles, 1000));
}

function openModal(html) {
  $("#modalBody").innerHTML = html;
  $("#detailModal").showModal();
}

function setZoom(value) {
  state.zoom = Math.max(.8, Math.min(1.45, value));
  $("#dubaiMap").style.transform = `scale(${state.zoom})`;
}

function toggleTheme() {
  document.body.classList.toggle("light");
  localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
}

function voiceSearch() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    openModal("<h2>Voice search</h2><p>Speech recognition is not available in this browser. Try Chrome or Edge.</p>");
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "en-AE";
  recognition.onresult = (event) => {
    $("#destinationInput").value = event.results[0][0].transcript;
    renderRoutes();
  };
  recognition.start();
}

function findDestination(query) {
  return state.data.attractions.find((item) => item.name.toLowerCase().includes(query.toLowerCase()));
}

function findStationById(id) {
  return state.data.stations.find((station) => station.id === id);
}

function interpolatePath(points, progress) {
  const segmentCount = points.length - 1;
  const scaled = progress * segmentCount;
  const index = Math.min(Math.floor(scaled), segmentCount - 1);
  const local = scaled - index;
  const start = points[index];
  const end = points[index + 1];
  return {
    x: start.x + (end.x - start.x) * local,
    y: start.y + (end.y - start.y) * local
  };
}

function trafficForLine(line, index) {
  const hour = new Date().getHours();
  const peak = (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 20);
  if (line.type === "metro" || line.type === "tram") return { level: peak ? "busy" : "clear", text: peak ? "high passenger load" : "regular service" };
  if (line.type === "bus") return { level: peak ? "busy" : "", text: peak ? "road delays likely" : "moderate road flow" };
  if (line.type === "water") return { level: "clear", text: "marine route open" };
  return { level: index % 2 ? "clear" : "", text: "availability based on nearby docks" };
}

function setActiveNav() {
  const id = location.hash || "#dashboard";
  $$(".nav a").forEach((link) => link.classList.toggle("active", link.getAttribute("href") === id));
}

function formatMoney(value) {
  const rate = state.data?.currencyRates[state.currency] || 1;
  return `${state.currency} ${(value * rate).toFixed(2)}`;
}
function googleDirectionsUrl(destination) {
  const origin = state.user ? `${state.user.lat},${state.user.lng}` : `${fallbackLocation.lat},${fallbackLocation.lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(`${destination.lat},${destination.lng}`)}&travelmode=transit`;
}
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function getNumber(key) { return Number(localStorage.getItem(key) || 0); }
function title(value) { return value.replace(/^\w/, (letter) => letter.toUpperCase()); }
function formatCoords() { return state.user ? `${state.user.lat.toFixed(5)}, ${state.user.lng.toFixed(5)}` : "--"; }

window.showStation = showStation;
window.showFare = showFare;
window.saveTrip = saveTrip;
window.setDestination = setDestination;
