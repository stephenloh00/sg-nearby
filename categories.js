// Hot-button categories.
//  q  = OpenStreetMap (Overpass) tag filters, used when no Google key is set
//       or when Google has no matching place type.
//  g  = Google Places (New) lookup: {types:[...]} for Nearby Search (Table A types)
//       or {text:'...'} for Text Search. Omit g to always use OpenStreetMap.
//  typeLabel = heading of the "type" filter chips.
window.CATEGORIES = [
  { id: 'food',   icon: '🍜', label: 'Restaurants', typeLabel: 'Cuisine', priceBands: true,
    g: { types: ['restaurant', 'cafe'] },
    q: ['["amenity"~"^(restaurant|fast_food|cafe)$"]'] },
  { id: 'hawker', icon: '🥘', label: 'Hawker',      typeLabel: 'Type', priceBands: true,
    g: { types: ['food_court'] },
    q: ['["amenity"="food_court"]', '["cuisine"="hawker"]'] },
  { id: 'mrt',    icon: '🚇', label: 'MRT',         typeLabel: 'Type', dedupe: true,
    g: { types: ['subway_station', 'train_station', 'light_rail_station'] },
    q: ['["railway"="station"]["station"="subway"]', '["railway"="station"]["network"~"MRT|LRT"]', '["railway"="subway_entrance"]'] },
  { id: 'bus',    icon: '🚌', label: 'Bus stop',    typeLabel: 'Type',
    g: { types: ['bus_stop', 'bus_station'] },
    q: ['["highway"="bus_stop"]'] },
  { id: 'taxi',   icon: '🚕', label: 'Taxi',        typeLabel: 'Type',
    g: { types: ['taxi_stand'] },
    q: ['["amenity"="taxi"]'] },
  { id: 'hotel',  icon: '🏨', label: 'Hotels',      typeLabel: 'Type',
    g: { types: ['lodging'] },
    q: ['["tourism"~"^(hotel|hostel|guest_house|motel)$"]'] },
  { id: 'attr',   icon: '📸', label: 'Attractions', typeLabel: 'Type',
    g: { types: ['tourist_attraction'] },
    q: ['["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium)$"]'] },
  { id: 'shop',   icon: '🛍️', label: 'Shopping',    typeLabel: 'Type',
    g: { types: ['shopping_mall', 'department_store'] },
    q: ['["shop"~"^(mall|department_store)$"]'] },
  { id: 'conv',   icon: '🏪', label: 'Convenience', typeLabel: 'Type',
    g: { types: ['convenience_store', 'supermarket'] },
    q: ['["shop"~"^(convenience|supermarket)$"]'] },
  { id: 'atm',    icon: '🏧', label: 'ATM',         typeLabel: 'Type',
    g: { types: ['atm'] },
    q: ['["amenity"="atm"]'] },
  { id: 'fx',     icon: '💱', label: 'Money exch.', typeLabel: 'Type',
    g: { text: 'currency exchange' },
    q: ['["amenity"="bureau_de_change"]'] },
  { id: 'toilet', icon: '🚻', label: 'Toilets',     typeLabel: 'Type',
    q: ['["amenity"="toilets"]'] },
  { id: 'pharm',  icon: '💊', label: 'Pharmacy',    typeLabel: 'Type',
    g: { types: ['pharmacy'] },
    q: ['["amenity"="pharmacy"]', '["healthcare"="pharmacy"]'] },
  { id: 'health', icon: '🏥', label: 'Clinic / Hospital', typeLabel: 'Type',
    g: { types: ['hospital', 'doctor'] },
    q: ['["amenity"~"^(hospital|clinic|doctors)$"]'] },
  { id: 'water',  icon: '🚰', label: 'Drinking water', typeLabel: 'Type',
    q: ['["amenity"="drinking_water"]'] },
  { id: 'park',   icon: '🌳', label: 'Parks',       typeLabel: 'Type',
    g: { types: ['park'] },
    q: ['["leisure"~"^(park|garden)$"]'] },
  { id: 'info',   icon: 'ℹ️', label: 'Tourist info', typeLabel: 'Type',
    g: { text: 'tourist information centre' },
    q: ['["tourism"="information"]["information"="office"]'] },
  { id: 'police', icon: '🚓', label: 'Police',      typeLabel: 'Type',
    g: { types: ['police'] },
    q: ['["amenity"="police"]'] }
];

// Fallback start points when GPS is denied / unavailable / outside Singapore.
window.PRESETS = [
  { name: 'Marina Bay Sands',    lat: 1.2834, lon: 103.8607 },
  { name: 'Changi Airport T3',   lat: 1.3554, lon: 103.9871 },
  { name: 'Orchard Road',        lat: 1.3048, lon: 103.8318 },
  { name: 'Chinatown',           lat: 1.2833, lon: 103.8440 },
  { name: 'Little India',        lat: 1.3066, lon: 103.8518 },
  { name: 'Bugis / Kampong Glam',lat: 1.3003, lon: 103.8554 },
  { name: 'Sentosa (Vivocity)',  lat: 1.2644, lon: 103.8222 },
  { name: 'Clarke Quay',         lat: 1.2906, lon: 103.8465 }
];
