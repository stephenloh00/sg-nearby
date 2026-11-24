(function () {
  'use strict';

  var KEY = String(window.GOOGLE_PLACES_API_KEY || '').trim();
  var USE_GOOGLE = !!KEY;
  var PLACES = 'https://places.googleapis.com/v1/';
  var OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  var SG = { minLat: 1.15, maxLat: 1.50, minLon: 103.55, maxLon: 104.15 };
  var WALK_M_PER_MIN = 80;
  var DEFAULT_FILTERS = { sort: 'dist', rating: 0, price: null, type: null, open: false };

  var state = { pos: null, radius: 500, cat: null, reqId: 0, cache: {}, places: [], filters: Object.assign({}, DEFAULT_FILTERS), detail: {} };
  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('status'), listEl = $('results'), filtersEl = $('filters');

  // ---------- tiny DOM helper (all text goes through textContent, never innerHTML) ----------
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) {
      var c = arguments[i];
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : document.createTextNode(c));
    }
    return el;
  }
  function safeUrl(u) { return /^https?:\/\//i.test(u || '') ? u : null; }

  // Surface unexpected errors instead of failing silently.
  window.addEventListener('error', function (e) {
    statusEl.className = 'status warn';
    statusEl.textContent = 'Something went wrong: ' + e.message;
  });

  // ---------- Map ----------
  var map = L.map('map').setView([1.3521, 103.8198], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
  var youMarker = null, circle = null, poiLayer = L.layerGroup().addTo(map), markers = {};
  map.on('click', function (e) { setPosition(e.latlng.lat, e.latlng.lng, 'Custom spot (tapped on map)'); });

  if (USE_GOOGLE) $('credit').textContent = 'Place data: Google. Map © OpenStreetMap contributors.';

  // ---------- Category + radius buttons ----------
  CATEGORIES.forEach(function (c) {
    $('cats').appendChild(h('button', { class: 'cat', 'data-id': c.id, onclick: function () { selectCat(c.id); } },
      h('i', { text: c.icon }), h('span', { text: c.label })));
  });
  document.querySelectorAll('.radius button').forEach(function (b) {
    b.addEventListener('click', function () {
      state.radius = +b.dataset.r;
      document.querySelectorAll('.radius button').forEach(function (x) { x.classList.toggle('on', x === b); });
      drawRadius(); refresh();
    });
  });
  $('locate').addEventListener('click', locate);

  // ---------- Location ----------
  function locate() {
    setStatus('Finding your location…');
    if (!navigator.geolocation) return needManual('Your browser does not support location.');
    navigator.geolocation.getCurrentPosition(
      function (p) {
        var lat = p.coords.latitude, lon = p.coords.longitude;
        if (!inSingapore(lat, lon)) {
          // Visitor is not in Singapore yet (planning ahead or testing): show a demo spot so the app is not empty.
          var d = PRESETS[0];
          return setPosition(d.lat, d.lon, d.name + ' (demo: your device is outside Singapore)');
        }
        setPosition(lat, lon, 'Your location', p.coords.accuracy);
      },
      function (err) { needManual(err.code === 1 ? 'Location permission was denied.' : 'Could not get your location.'); },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }
  function inSingapore(lat, lon) { return lat >= SG.minLat && lat <= SG.maxLat && lon >= SG.minLon && lon <= SG.maxLon; }

  function setPosition(lat, lon, label, accuracy) {
    state.pos = { lat: lat, lon: lon, label: label };
    state.cache = {};
    if (youMarker) youMarker.setLatLng([lat, lon]);
    else youMarker = L.circleMarker([lat, lon], { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map).bindTooltip('You are here');
    drawRadius();
    var acc = accuracy && accuracy > 60 ? ' (GPS accuracy ±' + Math.round(accuracy) + ' m, try outdoors)' : '';
    setStatus('📍 ' + label + acc + ' ');
    statusEl.appendChild(presetPicker('Not here? Pick a place'));
    refresh();
  }
  function needManual(msg) {
    statusEl.className = 'status warn';
    statusEl.textContent = msg + ' ';
    statusEl.append(presetPicker('Choose a starting point'), ' or tap the map.');
    showMsg('Choose a starting point to see what is nearby.');
  }
  function presetPicker(placeholder) {
    var sel = h('select', { 'aria-label': 'Choose a place' }, h('option', { value: '', text: placeholder }));
    PRESETS.forEach(function (p, i) { sel.appendChild(h('option', { value: i, text: p.name })); });
    sel.addEventListener('change', function () { if (sel.value !== '') { var p = PRESETS[+sel.value]; setPosition(p.lat, p.lon, p.name); } });
    return sel;
  }
  function setStatus(t) { statusEl.className = 'status'; statusEl.textContent = t; }
  function drawRadius() {
    if (!state.pos) return;
    if (circle) map.removeLayer(circle);
    circle = L.circle([state.pos.lat, state.pos.lon], { radius: state.radius, color: '#d6224a', weight: 1, fillOpacity: 0.06 }).addTo(map);
    map.fitBounds(circle.getBounds(), { padding: [20, 20] });
  }

  // ---------- Fetching ----------
  function selectCat(id) {
    state.cat = state.cat === id ? null : id;
    state.filters = Object.assign({}, DEFAULT_FILTERS);
    document.querySelectorAll('.cat').forEach(function (b) { b.classList.toggle('on', b.dataset.id === state.cat); });
    refresh();
  }

  async function fetchJSON(url, opts, ms) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, ms || 12000);
    try {
      var res = await fetch(url, Object.assign({ signal: ctl.signal }, opts));
      if (!res.ok) {
        var detail = '';
        try { detail = (await res.json()).error.message; } catch (e) { /* ignore */ }
        throw new Error('HTTP ' + res.status + (detail ? ': ' + detail : ''));
      }
      return await res.json();
    } catch (e) {
      throw e.name === 'AbortError' ? new Error('request timed out') : e;
    } finally { clearTimeout(t); }
  }

  var LIST_FIELDS = ['id', 'displayName', 'formattedAddress', 'shortFormattedAddress', 'location', 'rating', 'userRatingCount',
    'priceLevel', 'priceRange', 'primaryTypeDisplayName', 'types', 'photos', 'currentOpeningHours.openNow', 'businessStatus'];
  var DETAIL_FIELDS = ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount', 'priceLevel', 'priceRange',
    'primaryTypeDisplayName', 'photos', 'nationalPhoneNumber', 'internationalPhoneNumber', 'websiteUri', 'googleMapsUri',
    'regularOpeningHours', 'currentOpeningHours', 'reviews', 'editorialSummary', 'dineIn', 'takeout', 'delivery', 'reservable',
    'servesVegetarianFood', 'servesBeer', 'servesWine', 'outdoorSeating', 'goodForChildren', 'accessibilityOptions'];

  function googleHeaders(fields) {
    return { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': fields };
  }

  async function googleSearch(cat) {
    var center = { latitude: state.pos.lat, longitude: state.pos.lon };
    var mask = LIST_FIELDS.map(function (f) { return 'places.' + f; }).join(',');
    var url, body;
    if (cat.g.types) {
      url = PLACES + 'places:searchNearby';
      body = { includedTypes: cat.g.types, maxResultCount: 20, rankPreference: 'DISTANCE', languageCode: 'en', regionCode: 'SG',
        locationRestriction: { circle: { center: center, radius: state.radius } } };
    } else {
      url = PLACES + 'places:searchText';
      body = { textQuery: cat.g.text, maxResultCount: 20, rankPreference: 'DISTANCE', languageCode: 'en', regionCode: 'SG',
        locationBias: { circle: { center: center, radius: state.radius } } };
    }
    var data = await fetchJSON(url, { method: 'POST', headers: googleHeaders(mask), body: JSON.stringify(body) });
    return (data.places || []).filter(function (g) { return g.businessStatus !== 'CLOSED_PERMANENTLY'; }).map(function (g) { return fromGoogle(g, cat); });
  }

  async function osmSearch(cat) {
    var parts = cat.q.map(function (f) { return 'nwr' + f + '(around:' + state.radius + ',' + state.pos.lat + ',' + state.pos.lon + ');'; });
    var query = '[out:json][timeout:15];(' + parts.join('') + ');out center tags 200;';
    var lastErr;
    for (var i = 0; i < OVERPASS.length; i++) {
      try {
        var data = await fetchJSON(OVERPASS[i], { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) }, 15000);
        return fromOsm(data.elements || [], cat);
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  async function refresh() {
    poiLayer.clearLayers(); markers = {}; state.places = [];
    if (!state.pos) { filtersEl.textContent = ''; return showMsg('Waiting for a location…'); }
    if (!state.cat) { filtersEl.textContent = ''; return showMsg('Tap a button above to see what is nearby.'); }
    var cat = catById(state.cat), id = ++state.reqId;
    var useG = USE_GOOGLE && cat.g;
    var key = cat.id + '|' + state.radius + '|' + (useG ? 'g' : 'o');
    filtersEl.textContent = '';
    showMsg('Searching…');
    try {
      var places = state.cache[key];
      if (!places) { places = useG ? await googleSearch(cat) : await osmSearch(cat); state.cache[key] = places; }
      if (id !== state.reqId) return;
      state.places = places;
      renderAll();
    } catch (e) {
      if (id !== state.reqId) return;
      var hint = /HTTP 40[13]|API key|referer|blocked/i.test(e.message)
        ? ' Check that your Google API key allows this website and "Places API (New)".' : ' Check your connection and try again.';
      showMsg('Could not load places (' + e.message + ').' + hint);
    }
  }
  function catById(id) { return CATEGORIES.find(function (c) { return c.id === id; }); }

  // ---------- Normalising ----------
  function distTo(lat, lon) { return haversine(state.pos.lat, state.pos.lon, lat, lon); }

  function fromGoogle(g, cat) {
    var loc = g.location || {};
    return {
      id: g.id, src: 'google', catId: cat.id,
      name: (g.displayName && g.displayName.text) || 'Unnamed place',
      lat: loc.latitude, lon: loc.longitude, dist: distTo(loc.latitude, loc.longitude),
      rating: g.rating || null, count: g.userRatingCount || 0,
      price: priceBand(g, cat), priceText: priceText(g),
      typeLabel: (g.primaryTypeDisplayName && g.primaryTypeDisplayName.text) || '',
      address: g.shortFormattedAddress || g.formattedAddress || '',
      openNow: g.currentOpeningHours ? g.currentOpeningHours.openNow : undefined,
      photos: g.photos || []
    };
  }
  function priceBand(g, cat) {
    var r = g.priceRange;
    if (cat.priceBands && r && r.startPrice) {
      var s = +r.startPrice.units || 0, e = r.endPrice ? (+r.endPrice.units || s) : s, mid = (s + e) / 2;
      return mid < 15 ? 1 : mid < 30 ? 2 : mid < 60 ? 3 : 4;
    }
    return { PRICE_LEVEL_INEXPENSIVE: 1, PRICE_LEVEL_MODERATE: 2, PRICE_LEVEL_EXPENSIVE: 3, PRICE_LEVEL_VERY_EXPENSIVE: 4 }[g.priceLevel] || null;
  }
  function priceText(g) {
    var r = g.priceRange;
    if (!r || !r.startPrice) return '';
    var cur = r.startPrice.currencyCode === 'SGD' ? 'S$' : (r.startPrice.currencyCode || '') + ' ';
    return cur + r.startPrice.units + (r.endPrice ? '–' + r.endPrice.units : '+');
  }

  function fromOsm(els, cat) {
    var seen = {}, out = [];
    els.forEach(function (el) {
      var lat = el.lat != null ? el.lat : el.center && el.center.lat;
      var lon = el.lon != null ? el.lon : el.center && el.center.lon;
      if (lat == null || lon == null) return;
      var t = el.tags || {}, name = t['name:en'] || t.name || '';
      if (cat.dedupe && name) { if (seen[name]) return; seen[name] = 1; }
      if (!name && t.railway === 'subway_entrance') return;
      var d = distTo(lat, lon);
      if (d > state.radius * 1.05) return;
      var addr = [t['addr:housenumber'], t['addr:street']].filter(Boolean).join(' ');
      out.push({
        id: el.type + el.id, src: 'osm', catId: cat.id, tags: t,
        name: name || (t.ref && cat.id === 'bus' ? 'Bus stop ' + t.ref : cat.label),
        lat: lat, lon: lon, dist: d, rating: null, count: 0, price: null, priceText: '',
        typeLabel: t.cuisine ? t.cuisine.split(';')[0].replace(/_/g, ' ') : '',
        address: addr, openNow: undefined, photos: [],
        ref: t.ref, hoursText: t.opening_hours, phone: t.phone || t['contact:phone'],
        website: safeUrl(t.website || t['contact:website'])
      });
    });
    return out;
  }

  // ---------- Filters ----------
  function renderFilters() {
    var f = state.filters, cat = catById(state.cat), P = state.places;
    filtersEl.textContent = '';
    if (!P.length) return;

    var hasRating = P.some(function (p) { return p.rating; });
    var hasPrice = P.some(function (p) { return p.price; });
    var hasOpen = P.some(function (p) { return p.openNow !== undefined; });
    var typeCounts = {};
    P.forEach(function (p) { if (p.typeLabel) typeCounts[p.typeLabel] = (typeCounts[p.typeLabel] || 0) + 1; });
    var types = Object.keys(typeCounts).sort(function (a, b) { return typeCounts[b] - typeCounts[a]; }).slice(0, 10);

    // Sort
    var sort = h('select', { id: 'sort', 'aria-label': 'Sort by', onchange: function () { f.sort = this.value; renderList(); } });
    [['dist', 'Nearest first']].concat(hasRating ? [['rating', 'Highest rated'], ['count', 'Most reviewed']] : [])
      .forEach(function (o) { sort.appendChild(h('option', { value: o[0], text: o[1], selected: f.sort === o[0] })); });
    var topRow = h('div', { class: 'frow' }, h('label', { for: 'sort', class: 'flabel', text: 'Sort' }), sort);
    if (hasOpen) topRow.appendChild(chip('Open now', f.open, function () { f.open = !f.open; renderFilters(); renderList(); }));
    filtersEl.appendChild(topRow);

    if (hasRating) filtersEl.appendChild(chipRow('Rating', [[0, 'Any'], [3.5, '3.5+ ★'], [4, '4.0+ ★'], [4.5, '4.5+ ★']], f.rating, function (v) { f.rating = v; }));
    if (hasPrice) {
      var opts = cat.priceBands
        ? [[null, 'Any'], [1, '$ <S$15'], [2, '$$ S$15–30'], [3, '$$$ S$30–60'], [4, '$$$$ S$60+']]
        : [[null, 'Any'], [1, '$'], [2, '$$'], [3, '$$$'], [4, '$$$$']];
      filtersEl.appendChild(chipRow('Price', opts, f.price, function (v) { f.price = v; }));
    }
    if (types.length > 1) filtersEl.appendChild(chipRow(cat.typeLabel || 'Type', [[null, 'All']].concat(types.map(function (t) { return [t, t + ' (' + typeCounts[t] + ')']; })), f.type, function (v) { f.type = v; }));
  }
  function chip(label, on, fn) { return h('button', { class: 'chip' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: fn, text: label }); }
  function chipRow(label, opts, current, set) {
    var row = h('div', { class: 'frow' }, h('span', { class: 'flabel', text: label }));
    opts.forEach(function (o) {
      row.appendChild(chip(o[1], current === o[0], function () { set(o[0]); renderFilters(); renderList(); }));
    });
    return row;
  }

  function visiblePlaces() {
    var f = state.filters;
    var out = state.places.filter(function (p) {
      if (f.rating && (p.rating || 0) < f.rating) return false;
      if (f.price && p.price !== f.price) return false;
      if (f.type && p.typeLabel !== f.type) return false;
      if (f.open && p.openNow !== true) return false;
      return true;
    });
    out.sort(function (a, b) {
      if (f.sort === 'rating') return (b.rating || 0) - (a.rating || 0) || b.count - a.count;
      if (f.sort === 'count') return b.count - a.count;
      return a.dist - b.dist;
    });
    return out;
  }

  // ---------- List rendering (Google-business style cards) ----------
  function renderAll() { renderFilters(); renderList(); }

  function renderList() {
    poiLayer.clearLayers(); markers = {}; listEl.textContent = '';
    var cat = catById(state.cat), items = visiblePlaces();
    if (!state.places.length) {
      return showMsg('No ' + cat.label.toLowerCase() + ' found within ' + state.radius + ' m. Try a larger radius.');
    }
    if (!items.length) return showMsg('No places match these filters. Try clearing one.');

    listEl.appendChild(h('li', { class: 'count', text: items.length + ' place' + (items.length === 1 ? '' : 's') + ' within ' + state.radius + ' m' +
      (USE_GOOGLE && cat.g ? '' : ' · free map data (no ratings or prices)') }));

    items.forEach(function (p) {
      var m = L.marker([p.lat, p.lon], {
        icon: L.divIcon({ className: '', html: '<div class="pin">' + cat.icon + '</div>', iconSize: [28, 28], iconAnchor: [14, 14] })
      }).addTo(poiLayer).bindTooltip(p.name);
      m.on('click', function () { markSelected(p.id); openDetail(p); });
      markers[p.id] = m;

      var thumb = p.photos.length
        ? h('img', { class: 'thumb', src: photoUrl(p.photos[0].name, 240), alt: '', loading: 'lazy', referrerpolicy: 'origin' })
        : h('div', { class: 'thumb ph', 'aria-hidden': 'true', text: cat.icon });

      var meta1 = h('div', { class: 'rate' });
      if (p.rating) {
        meta1.append(h('b', { text: p.rating.toFixed(1) }), ' ', stars(p.rating), ' ', h('span', { class: 'mute', text: '(' + p.count.toLocaleString() + ')' }));
      } else meta1.appendChild(h('span', { class: 'mute', text: p.src === 'google' ? 'No reviews yet' : (p.ref && cat.id === 'mrt' ? 'Station ' + p.ref : '') }));
      var price = p.price ? '$'.repeat(p.price) : '';
      if (price) meta1.append(' · ', h('span', { text: p.priceText ? price + ' (' + p.priceText + ')' : price }));

      var meta2 = [p.typeLabel, p.address].filter(Boolean).join(' · ');
      var openEl = p.openNow === undefined ? null : h('span', { class: p.openNow ? 'open' : 'closed', text: p.openNow ? 'Open now' : 'Closed now' });
      var mins = Math.max(1, Math.round(p.dist / WALK_M_PER_MIN));
      var line3 = h('div', { class: 'meta' }, openEl, openEl ? ' · ' : null,
        Math.round(p.dist) + ' m · ' + mins + ' min walk ' + compass(bearing(state.pos.lat, state.pos.lon, p.lat, p.lon)));

      var body = h('button', { class: 'card', onclick: function () { markSelected(p.id); openDetail(p); } },
        h('div', { class: 'ctext' }, h('div', { class: 'name', text: p.name }), meta1, h('div', { class: 'meta', text: meta2 }), line3), thumb);
      var go = h('a', { class: 'go', href: directionsUrl(p), target: '_blank', rel: 'noopener', 'aria-label': 'Walking directions to ' + p.name, text: '➜ Directions' });
      listEl.appendChild(h('li', { class: 'item', 'data-id': p.id }, body, go));
    });
  }

  function showMsg(t) { listEl.textContent = ''; listEl.appendChild(h('li', { class: 'msg', text: t })); }
  function markSelected(id) {
    document.querySelectorAll('.item').forEach(function (n) { n.classList.toggle('sel', n.dataset.id === id); });
    var m = markers[id]; if (m) { m.openTooltip(); map.panTo(m.getLatLng()); }
  }
  function stars(r) { return h('span', { class: 'stars', style: '--p:' + Math.max(0, Math.min(100, r / 5 * 100)) + '%', 'aria-label': r.toFixed(1) + ' out of 5 stars', text: '★★★★★' }); }
  function photoUrl(name, px) { return PLACES + name + '/media?maxHeightPx=' + px + '&maxWidthPx=' + px + '&key=' + encodeURIComponent(KEY); }
  function directionsUrl(p) {
    return 'https://www.google.com/maps/dir/?api=1&origin=' + state.pos.lat + ',' + state.pos.lon +
      '&destination=' + p.lat + ',' + p.lon + (p.src === 'google' ? '&destination_place_id=' + encodeURIComponent(p.id) : '') + '&travelmode=walking';
  }

  // ---------- Detail pop-up ----------
  var modal = $('modal'), mBody = $('m-body'), lastFocus = null;
  $('m-close').addEventListener('click', closeDetail);
  modal.addEventListener('click', function (e) { if (e.target === modal) closeDetail(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) closeDetail(); });

  function closeDetail() { modal.hidden = true; document.body.classList.remove('lock'); if (lastFocus) lastFocus.focus(); }

  async function openDetail(p) {
    lastFocus = document.activeElement;
    modal.hidden = false; document.body.classList.add('lock');
    $('m-close').focus();
    var token = p.id;
    state.openId = token;
    renderDetail(p, state.detail[p.id] || null, p.src === 'google' && !state.detail[p.id]);
    if (p.src !== 'google' || state.detail[p.id]) return;
    try {
      var d = await fetchJSON(PLACES + 'places/' + encodeURIComponent(p.id) + '?languageCode=en&regionCode=SG',
        { headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': DETAIL_FIELDS.join(',') } });
      state.detail[p.id] = d;
      if (state.openId === token && !modal.hidden) renderDetail(p, d, false);
    } catch (e) {
      if (state.openId === token && !modal.hidden) renderDetail(p, null, false, 'Could not load full details (' + e.message + ').');
    }
  }

  function renderDetail(p, d, loading, err) {
    mBody.textContent = '';
    var cat = catById(p.catId);
    var photos = (d && d.photos && d.photos.length ? d.photos : p.photos).slice(0, 10);
    if (photos.length) {
      var strip = h('div', { class: 'photos' });
      photos.forEach(function (ph) { strip.appendChild(h('img', { src: photoUrl(ph.name, 600), alt: p.name + ' photo', loading: 'lazy', referrerpolicy: 'origin' })); });
      mBody.appendChild(strip);
    } else mBody.appendChild(h('div', { class: 'hero-ph', 'aria-hidden': 'true', text: cat.icon }));

    var inner = h('div', { class: 'minner' });
    inner.appendChild(h('h2', { id: 'm-title', text: p.name }));
    var r = h('div', { class: 'rate big' });
    if (p.rating) r.append(h('b', { text: p.rating.toFixed(1) }), ' ', stars(p.rating), ' ', h('span', { class: 'mute', text: '(' + p.count.toLocaleString() + ' reviews)' }));
    var price = p.price ? '$'.repeat(p.price) + (p.priceText ? ' (' + p.priceText + ' per person)' : '') : '';
    if (price) r.append(p.rating ? ' · ' : '', price);
    if (r.childNodes.length) inner.appendChild(r);
    var sub = [p.typeLabel, Math.round(p.dist) + ' m away'].filter(Boolean).join(' · ');
    inner.appendChild(h('div', { class: 'meta', text: sub }));
    if (p.openNow !== undefined) inner.appendChild(h('div', { class: p.openNow ? 'open' : 'closed', text: p.openNow ? 'Open now' : 'Closed now' }));

    // Action buttons
    var acts = h('div', { class: 'acts' }, h('a', { class: 'go', href: directionsUrl(p), target: '_blank', rel: 'noopener', text: '➜ Directions' }));
    var mapsUri = safeUrl(d && d.googleMapsUri), site = safeUrl((d && d.websiteUri) || p.website);
    if (mapsUri) acts.appendChild(h('a', { class: 'btn', href: mapsUri, target: '_blank', rel: 'noopener', text: 'Open in Google Maps' }));
    if (site) acts.appendChild(h('a', { class: 'btn', href: site, target: '_blank', rel: 'noopener', text: 'Website' }));
    inner.appendChild(acts);

    if (loading) inner.appendChild(h('p', { class: 'mute', text: 'Loading full details…' }));
    if (err) inner.appendChild(h('p', { class: 'closed', text: err }));

    var info = h('dl', { class: 'info' });
    function row(k, v) { if (v) info.append(h('dt', { text: k }), h('dd', null, v)); }
    row('Address', (d && d.formattedAddress) || p.address);
    var phone = d && (d.nationalPhoneNumber || d.internationalPhoneNumber) || p.phone;
    row('Phone', phone && h('span', { text: phone }));
    if (p.src === 'osm') {
      row('Station code', p.ref && h('span', { text: p.ref }));
      row('Hours', p.hoursText && h('span', { text: p.hoursText }));
    }
    var hrs = d && d.regularOpeningHours && d.regularOpeningHours.weekdayDescriptions;
    if (hrs) {
      var today = (new Date().getDay() + 6) % 7; // Google lists Monday first
      var ul = h('ul', { class: 'hours' });
      hrs.forEach(function (line, i) { ul.appendChild(h('li', { class: i === today ? 'today' : null, text: line })); });
      row('Hours', ul);
    }
    row('About', d && d.editorialSummary && d.editorialSummary.text && h('span', { text: d.editorialSummary.text }));
    var feats = [];
    if (d) {
      if (d.dineIn) feats.push('Dine-in'); if (d.takeout) feats.push('Takeaway'); if (d.delivery) feats.push('Delivery');
      if (d.reservable) feats.push('Reservations'); if (d.servesVegetarianFood) feats.push('Vegetarian options');
      if (d.outdoorSeating) feats.push('Outdoor seating'); if (d.goodForChildren) feats.push('Good for kids');
      if (d.accessibilityOptions && d.accessibilityOptions.wheelchairAccessibleEntrance) feats.push('Wheelchair accessible');
    } else if (p.tags && p.tags.wheelchair === 'yes') feats.push('Wheelchair accessible');
    row('Features', feats.length && h('span', { text: feats.join(' · ') }));
    inner.appendChild(info);

    if (d && d.reviews && d.reviews.length) {
      inner.appendChild(h('h3', { text: 'Reviews' }));
      d.reviews.slice(0, 5).forEach(function (rv) {
        var who = (rv.authorAttribution && rv.authorAttribution.displayName) || 'Google user';
        var txt = (rv.text && rv.text.text) || (rv.originalText && rv.originalText.text) || '';
        inner.appendChild(h('div', { class: 'review' },
          h('div', { class: 'rhead' }, h('b', { text: who }), ' ', stars(rv.rating || 0), ' ', h('span', { class: 'mute', text: rv.relativePublishTimeDescription || '' })),
          txt ? h('p', { text: txt }) : null));
      });
    }
    if (p.src === 'google') inner.appendChild(h('p', { class: 'mute small', text: 'Business information and reviews from Google.' }));
    else inner.appendChild(h('p', { class: 'mute small', text: 'Map data © OpenStreetMap contributors. Add a Google Places key for ratings, photos and reviews.' }));
    mBody.appendChild(inner);
    mBody.parentNode.scrollTop = 0;
  }

  // ---------- Geometry ----------
  function toRad(d) { return d * Math.PI / 180; }
  function haversine(a, b, c, d) {
    var R = 6371000, dLat = toRad(c - a), dLon = toRad(d - b);
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function bearing(a, b, c, d) {
    var y = Math.sin(toRad(d - b)) * Math.cos(toRad(c));
    var x = Math.cos(toRad(a)) * Math.sin(toRad(c)) - Math.sin(toRad(a)) * Math.cos(toRad(c)) * Math.cos(toRad(d - b));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function compass(deg) { return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8]; }

  // ---------- Go ----------
  showMsg('Waiting for a location…');
  locate();
})();
