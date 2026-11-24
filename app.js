(function () {
  'use strict';

  var OVERPASS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
  ];
  var SG_BOUNDS = { minLat: 1.15, maxLat: 1.50, minLon: 103.55, maxLon: 104.15 };
  var WALK_M_PER_MIN = 80;

  var state = { pos: null, radius: 500, cat: null, reqId: 0, cache: {} };
  var $ = function (id) { return document.getElementById(id); };
  var statusEl = $('status'), listEl = $('results');

  // ---------- Map ----------
  var map = L.map('map', { zoomControl: true }).setView([1.3521, 103.8198], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, attribution: '© OpenStreetMap contributors'
  }).addTo(map);
  var youMarker = null, circle = null, poiLayer = L.layerGroup().addTo(map), markers = {};

  map.on('click', function (e) {
    setPosition(e.latlng.lat, e.latlng.lng, 'Custom spot (tapped on map)');
  });

  // ---------- Category buttons ----------
  var catsEl = $('cats');
  CATEGORIES.forEach(function (c) {
    var b = document.createElement('button');
    b.className = 'cat'; b.dataset.id = c.id;
    var i = document.createElement('i'); i.textContent = c.icon;
    var s = document.createElement('span'); s.textContent = c.label;
    b.append(i, s);
    b.addEventListener('click', function () { selectCat(c.id); });
    catsEl.appendChild(b);
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
      function (p) { setPosition(p.coords.latitude, p.coords.longitude, 'Your location', p.coords.accuracy); },
      function (err) {
        needManual(err.code === 1
          ? 'Location permission was denied.'
          : 'Could not get your location.');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  }

  function inSingapore(lat, lon) {
    return lat >= SG_BOUNDS.minLat && lat <= SG_BOUNDS.maxLat && lon >= SG_BOUNDS.minLon && lon <= SG_BOUNDS.maxLon;
  }

  function setPosition(lat, lon, label, accuracy) {
    state.pos = { lat: lat, lon: lon, label: label };
    state.cache = {};
    if (youMarker) youMarker.setLatLng([lat, lon]);
    else youMarker = L.circleMarker([lat, lon], { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map).bindTooltip('You are here');
    drawRadius();
    map.fitBounds(circle.getBounds(), { padding: [20, 20] });

    if (!inSingapore(lat, lon)) {
      needManual('You appear to be outside Singapore, so there is nothing nearby to show.');
    } else {
      var acc = accuracy && accuracy > 60 ? ' (GPS accuracy ±' + Math.round(accuracy) + ' m — try outdoors)' : '';
      setStatus('📍 ' + label + acc + ' ');
      statusEl.appendChild(presetPicker('Not here? Pick a place'));
    }
    refresh();
  }

  function needManual(msg) {
    statusEl.className = 'status warn';
    statusEl.textContent = msg + ' ';
    statusEl.appendChild(presetPicker('Choose a starting point'));
    var tip = document.createElement('span');
    tip.textContent = 'or tap the map.';
    statusEl.appendChild(tip);
  }

  function presetPicker(placeholder) {
    var sel = document.createElement('select');
    var o = document.createElement('option'); o.textContent = placeholder; o.value = ''; sel.appendChild(o);
    PRESETS.forEach(function (p, i) {
      var op = document.createElement('option'); op.value = i; op.textContent = p.name; sel.appendChild(op);
    });
    sel.addEventListener('change', function () {
      if (sel.value === '') return;
      var p = PRESETS[+sel.value];
      setPosition(p.lat, p.lon, p.name);
    });
    return sel;
  }

  function setStatus(t) { statusEl.className = 'status'; statusEl.textContent = t; }

  function drawRadius() {
    if (!state.pos) return;
    if (circle) map.removeLayer(circle);
    circle = L.circle([state.pos.lat, state.pos.lon], {
      radius: state.radius, color: '#d6224a', weight: 1, fillOpacity: 0.06
    }).addTo(map);
    map.fitBounds(circle.getBounds(), { padding: [20, 20] });
  }

  // ---------- Search ----------
  function selectCat(id) {
    state.cat = state.cat === id ? null : id;
    document.querySelectorAll('.cat').forEach(function (b) { b.classList.toggle('on', b.dataset.id === state.cat); });
    refresh();
  }

  function buildQuery(cat, lat, lon, r) {
    var parts = cat.q.map(function (f) { return 'nwr' + f + '(around:' + r + ',' + lat + ',' + lon + ');'; });
    return '[out:json][timeout:15];(' + parts.join('') + ');out center tags 200;';
  }

  async function fetchOverpass(query) {
    var lastErr;
    for (var i = 0; i < OVERPASS.length; i++) {
      try {
        var res = await fetch(OVERPASS[i], {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query)
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return (await res.json()).elements || [];
      } catch (e) { lastErr = e; }
    }
    throw lastErr;
  }

  async function refresh() {
    clearResults();
    if (!state.cat) return showMsg(state.pos ? 'Tap a button above to see what is nearby.' : 'Waiting for a location…');
    if (!state.pos) return showMsg('Waiting for a location…');
    if (!inSingapore(state.pos.lat, state.pos.lon)) return;

    var cat = CATEGORIES.find(function (c) { return c.id === state.cat; });
    var id = ++state.reqId;
    var key = cat.id + '|' + state.radius;
    showMsg('Searching…');
    try {
      var items = state.cache[key];
      if (!items) {
        var els = await fetchOverpass(buildQuery(cat, state.pos.lat, state.pos.lon, state.radius));
        items = normalise(els, cat);
        state.cache[key] = items;
      }
      if (id !== state.reqId) return; // a newer request superseded this one
      render(items, cat);
    } catch (e) {
      if (id !== state.reqId) return;
      showMsg('Could not load places (' + e.message + '). Check your connection and try again.');
    }
  }

  function normalise(els, cat) {
    var seen = {}, out = [];
    els.forEach(function (el) {
      var lat = el.lat != null ? el.lat : el.center && el.center.lat;
      var lon = el.lon != null ? el.lon : el.center && el.center.lon;
      if (lat == null || lon == null) return;
      var t = el.tags || {};
      var name = t['name:en'] || t.name || '';
      // Merge duplicates (e.g. an MRT station plus its entrances share a name).
      if (cat.dedupe && name) { if (seen[name]) return; seen[name] = 1; }
      if (!name && t.railway === 'subway_entrance') return;
      out.push({
        key: el.type + el.id, lat: lat, lon: lon, tags: t,
        name: name || (t.ref && cat.id === 'bus' ? 'Bus stop ' + t.ref : cat.label),
        dist: haversine(state.pos.lat, state.pos.lon, lat, lon)
      });
    });
    out.sort(function (a, b) { return a.dist - b.dist; });
    return out.filter(function (p) { return p.dist <= state.radius * 1.05; });
  }

  // ---------- Rendering ----------
  function clearResults() {
    poiLayer.clearLayers(); markers = {};
    listEl.textContent = '';
  }

  function showMsg(t) {
    listEl.textContent = '';
    var li = document.createElement('li'); li.className = 'msg'; li.textContent = t; listEl.appendChild(li);
  }

  function render(items, cat) {
    clearResults();
    if (!items.length) {
      return showMsg('No ' + cat.label.toLowerCase() + ' found within ' + state.radius + ' m. Try a larger radius.');
    }
    items.forEach(function (p) {
      var m = L.marker([p.lat, p.lon], {
        icon: L.divIcon({ className: '', html: '<div style="font-size:22px;text-shadow:0 1px 3px #0006">' + cat.icon + '</div>', iconSize: [26, 26], iconAnchor: [13, 13] })
      }).addTo(poiLayer).bindTooltip(p.name);
      markers[p.key] = m;

      var li = document.createElement('li'); li.className = 'item'; li.dataset.key = p.key;
      var info = document.createElement('div'); info.className = 'info';
      var name = document.createElement('div'); name.className = 'name';
      if (p.tags.ref && (cat.id === 'mrt')) {
        p.tags.ref.split(/[;,]/).slice(0, 3).forEach(function (r) {
          var b = document.createElement('span'); b.className = 'badge'; b.textContent = r.trim(); name.appendChild(b);
        });
      }
      name.appendChild(document.createTextNode(p.name));
      var meta = document.createElement('div'); meta.className = 'meta';
      meta.textContent = metaText(p, cat);
      info.append(name, meta);
      info.addEventListener('click', function () { highlight(p); });

      var dist = document.createElement('div'); dist.className = 'dist';
      dist.append(Math.round(p.dist) + ' m', document.createElement('br'));
      dist.append('~' + Math.max(1, Math.round(p.dist / WALK_M_PER_MIN)) + ' min ' + compass(bearing(state.pos.lat, state.pos.lon, p.lat, p.lon)));

      var go = document.createElement('a'); go.className = 'go'; go.textContent = 'Go';
      go.target = '_blank'; go.rel = 'noopener';
      go.href = 'https://www.google.com/maps/dir/?api=1&origin=' + state.pos.lat + ',' + state.pos.lon +
        '&destination=' + p.lat + ',' + p.lon + '&travelmode=walking';
      go.setAttribute('aria-label', 'Walking directions to ' + p.name);

      li.append(info, dist, go);
      listEl.appendChild(li);
      m.on('click', function () { highlight(p, true); });
    });
  }

  function metaText(p, cat) {
    var t = p.tags, bits = [];
    if (cat.id === 'bus' && t.ref) bits.push('Stop code ' + t.ref);
    if (t.cuisine) bits.push(t.cuisine.replace(/[;_]/g, ', '));
    if (t.opening_hours) bits.push('Hours: ' + t.opening_hours);
    if (t.brand && t.brand !== p.name) bits.push(t.brand);
    if (t.wheelchair === 'yes') bits.push('♿');
    return bits.join(' · ');
  }

  function highlight(p, fromMap) {
    document.querySelectorAll('.item').forEach(function (n) { n.classList.toggle('sel', n.dataset.key === p.key); });
    var m = markers[p.key];
    if (m) { m.openTooltip(); if (!fromMap) map.panTo([p.lat, p.lon]); }
    if (fromMap) {
      var n = listEl.querySelector('[data-key="' + p.key + '"]');
      if (n) n.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  // ---------- Geometry ----------
  function toRad(d) { return d * Math.PI / 180; }
  function haversine(a, b, c, d) {
    var R = 6371000, dLat = toRad(c - a), dLon = toRad(d - b);
    var x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a)) * Math.cos(toRad(c)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function bearing(a, b, c, d) {
    var y = Math.sin(toRad(d - b)) * Math.cos(toRad(c));
    var x = Math.cos(toRad(a)) * Math.sin(toRad(c)) - Math.sin(toRad(a)) * Math.cos(toRad(c)) * Math.cos(toRad(d - b));
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }
  function compass(deg) {
    return ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(deg / 45) % 8];
  }

  // ---------- Go ----------
  showMsg('Waiting for a location…');
  locate();
})();
