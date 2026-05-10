# DubaiMove

DubaiMove is a standalone HTML5, CSS3, and vanilla JavaScript smart transportation web app for Dubai. It includes GPS-based nearby transport discovery, an interactive simulated map, journey planning, fare comparison, a simulated Nol card, taxi booking, tourist guides, analytics, rewards, and an AI-style assistant with predefined travel intelligence.

## Project Structure

```text
.
├── index.html
├── style.css
├── script.js
├── transport-data.json
├── assets/
├── images/
│   └── dubai-skyline.svg
└── README.md
```

## Run Locally

Because the app loads `transport-data.json` with the Fetch API, run it through a local web server.

```powershell
cd C:\Windows\System32\ecom
python -m http.server 8080
```

Open:

```text
http://localhost:8080
```

## Features

- Browser Geolocation API with permission request and fallback demo coordinates.
- Haversine distance calculation for nearest metro, bus, tram, taxi, water taxi, scooter, and bike options.
- Auto-refreshing nearby transport list with distance sorting.
- Simulated interactive map with markers, filters, route lines, moving transport icons, traffic badges, and zoom controls.
- Google Maps live-location panel using browser GPS coordinates, direct Google Maps links, and transit directions to nearby stations.
- Journey planner with source/destination entry, transport mode selection, ETA, distance, fare, and carbon savings.
- Fare engine with base fares, per-kilometer pricing, minimum fares, unlock fees, waiting charges, peak/night multipliers, and dynamic ride-share pricing.
- Multiple currencies with AED as the primary currency.
- Nol card simulation with balance, recharge, QR ticket, trip history, spending analytics, and rewards.
- Taxi booking simulation with fare calculation, driver assignment, and ETA countdown.
- Tourist guides for Dubai attractions, airport assistance, station guidance, and pass recommendations.
- Dark/light mode, local storage persistence, responsive mobile-first layouts, glassmorphism styling, animated loaders, and dashboard cards.

## Notes

All transport stations, fare rules, ETAs, taxi assignment, live vehicles, and traffic indicators are simulated with realistic mock Dubai data for demonstration purposes. Real RTA production integrations would require official APIs, authentication, rate limits, and compliance review.

The Google Maps panel uses public Google Maps embed and directions URLs so it works without a Google Maps API key. A fully programmable Google Maps JavaScript API map with custom native Google markers requires a valid Google Maps Platform API key.
