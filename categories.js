// Hot-button categories. `q` = Overpass tag filters (OpenStreetMap).
// `mode` = Google Maps travel mode used for the "Directions" link.
window.CATEGORIES = [
  { id: 'food',    icon: '🍜', label: 'Food',        q: ['["amenity"~"^(restaurant|fast_food|cafe)$"]'] },
  { id: 'hawker',  icon: '🥘', label: 'Hawker',      q: ['["amenity"="food_court"]', '["cuisine"="hawker"]'] },
  { id: 'mrt',     icon: '🚇', label: 'MRT',         q: ['["railway"="station"]["station"="subway"]', '["railway"="station"]["network"~"MRT|LRT"]', '["railway"="subway_entrance"]'], dedupe: true },
  { id: 'bus',     icon: '🚌', label: 'Bus stop',    q: ['["highway"="bus_stop"]'] },
  { id: 'taxi',    icon: '🚕', label: 'Taxi',        q: ['["amenity"="taxi"]'] },
  { id: 'hotel',   icon: '🏨', label: 'Hotels',      q: ['["tourism"~"^(hotel|hostel|guest_house|motel)$"]'] },
  { id: 'attr',    icon: '📸', label: 'Attractions', q: ['["tourism"~"^(attraction|museum|gallery|viewpoint|zoo|theme_park|aquarium)$"]'] },
  { id: 'shop',    icon: '🛍️', label: 'Shopping',    q: ['["shop"~"^(mall|department_store)$"]'] },
  { id: 'conv',    icon: '🏪', label: 'Convenience', q: ['["shop"~"^(convenience|supermarket)$"]'] },
  { id: 'atm',     icon: '🏧', label: 'ATM',         q: ['["amenity"="atm"]'] },
  { id: 'fx',      icon: '💱', label: 'Money exch.', q: ['["amenity"="bureau_de_change"]'] },
  { id: 'toilet',  icon: '🚻', label: 'Toilets',     q: ['["amenity"="toilets"]'] },
  { id: 'pharm',   icon: '💊', label: 'Pharmacy',    q: ['["amenity"="pharmacy"]', '["healthcare"="pharmacy"]'] },
  { id: 'health',  icon: '🏥', label: 'Clinic / Hospital', q: ['["amenity"~"^(hospital|clinic|doctors)$"]'] },
  { id: 'water',   icon: '🚰', label: 'Drinking water', q: ['["amenity"="drinking_water"]'] },
  { id: 'park',    icon: '🌳', label: 'Parks',       q: ['["leisure"~"^(park|garden)$"]'] },
  { id: 'info',    icon: 'ℹ️', label: 'Tourist info', q: ['["tourism"="information"]["information"="office"]'] },
  { id: 'police',  icon: '🚓', label: 'Police',      q: ['["amenity"="police"]'] }
];

// Fallback start points when GPS is denied / unavailable / outside Singapore.
window.PRESETS = [
  { name: 'Changi Airport T3',   lat: 1.3554, lon: 103.9871 },
  { name: 'Marina Bay Sands',    lat: 1.2834, lon: 103.8607 },
  { name: 'Orchard Road',        lat: 1.3048, lon: 103.8318 },
  { name: 'Chinatown',           lat: 1.2833, lon: 103.8440 },
  { name: 'Little India',        lat: 1.3066, lon: 103.8518 },
  { name: 'Bugis / Kampong Glam',lat: 1.3003, lon: 103.8554 },
  { name: 'Sentosa (Vivocity)',  lat: 1.2644, lon: 103.8222 },
  { name: 'Clarke Quay',         lat: 1.2906, lon: 103.8465 }
];
