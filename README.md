# SG Nearby

Mobile-first web app for first-time visitors to Singapore. On launch it takes the
user's GPS position and shows hot buttons (Food, Hawker, MRT, Bus, Taxi, Hotels,
ATM, Toilets, Pharmacy, …). Pick one to see places within 100 / 250 / 500 m,
sorted by distance with walking time, compass direction, and a one-tap
walking-directions link.

## Run
GPS needs HTTPS or localhost:

    cd sg-tourist-guide && python3 -m http.server 8000   # open http://localhost:8000

To deploy, upload the folder to any static host (Netlify, Cloudflare Pages, GitHub Pages).

## Data
OpenStreetMap via the public Overpass API (no API key). Fine for a prototype; for
production use a paid/self-hosted Overpass or a Places API, and use a proper tile provider.

## Edit
- `categories.js` – add or change buttons (Overpass tag filters) and preset start points
- `app.js` – logic · `style.css` – look
