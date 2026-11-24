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

## Google Places key (ratings, prices, photos, reviews)
1. console.cloud.google.com → create a project → enable billing (Google gives a monthly free credit).
2. APIs & Services → Library → enable **Places API (New)**.
3. APIs & Services → Credentials → Create credentials → API key.
4. Edit the key and **restrict it**:
   - Application restrictions: Websites → add `https://stephenloh00.github.io/*`
   - API restrictions: Places API (New) only
5. Also set a budget alert and a daily quota cap (Quotas page) so a traffic spike cannot overspend.
6. Paste the key into `config.js`, commit, push. Without a key the app falls back to free OpenStreetMap data.

Google Nearby Search returns at most 20 places per request.
