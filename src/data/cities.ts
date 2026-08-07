/**
 * Major global aviation/logistics hub cities.
 * Used as source/destination nodes for great-circle flight arcs.
 *
 * Coordinates are WGS84 (latitude, longitude) in degrees.
 * Volume is a relative proxy for traffic (passenger or cargo tonnage).
 */

export interface HubCity {
  /** IATA airport code (3-letter) */
  code: string;
  /** City name */
  name: string;
  /** Country code (ISO 3166-1 alpha-2) */
  country: string;
  /** Latitude in degrees (-90 to 90) */
  lat: number;
  /** Longitude in degrees (-180 to 180) */
  lon: number;
  /** Relative traffic volume (0-1 scale for normalization) */
  volume: number;
  /** Category: passenger hub, cargo hub, or mixed */
  type: 'passenger' | 'cargo' | 'mixed';
}

/**
 * 40 major global aviation and logistics hubs across all continents.
 * Sorted by continent for readability.
 */
export const HUB_CITIES: readonly HubCity[] = [
  // -- Lunar Gateway (Sea of Tranquility, Apollo 11 landing site) --
  { code: 'TQN', name: 'Luna', country: 'XA', lat: 0.6741, lon: 23.4730, volume: 0.5, type: 'mixed' },

  // -- North America --
  { code: 'JFK', name: 'New York', country: 'US', lat: 40.6413, lon: -73.7781, volume: 1.0, type: 'passenger' },
  { code: 'LAX', name: 'Los Angeles', country: 'US', lat: 33.9416, lon: -118.4085, volume: 0.95, type: 'passenger' },
  { code: 'HNL', name: 'Honolulu', country: 'US', lat: 21.3099, lon: -157.9224, volume: 0.45, type: 'passenger' },
  { code: 'ORD', name: 'Chicago', country: 'US', lat: 41.9742, lon: -87.9073, volume: 0.92, type: 'mixed' },
  { code: 'DFW', name: 'Dallas', country: 'US', lat: 32.8998, lon: -97.0403, volume: 0.82, type: 'passenger' },
  { code: 'ATL', name: 'Atlanta', country: 'US', lat: 33.6070, lon: -84.5514, volume: 0.9, type: 'passenger' },
  { code: 'MEX', name: 'Mexico City', country: 'MX', lat: 19.4363, lon: -99.0721, volume: 0.65, type: 'passenger' },
  { code: 'YYZ', name: 'Toronto', country: 'CA', lat: 43.6777, lon: -79.6293, volume: 0.55, type: 'passenger' },
  { code: 'SEA', name: 'Seattle', country: 'US', lat: 47.4502, lon: -122.3088, volume: 0.75, type: 'passenger' },
  { code: 'ANC', name: 'Anchorage', country: 'US', lat: 61.1744, lon: -149.9728, volume: 0.15, type: 'cargo' },
  { code: 'SCC', name: 'Deadhorse', country: 'US', lat: 70.4934, lon: -148.4648, volume: 0.12, type: 'cargo' }, // Prudhoe Bay oil field
  { code: 'OME', name: 'Nome', country: 'US', lat: 64.5039, lon: -165.4433, volume: 0.08, type: 'passenger' },
  { code: 'YXY', name: 'Whitehorse', country: 'CA', lat: 60.7092, lon: -135.0463, volume: 0.1, type: 'passenger' }, // Yukon's largest airport
  { code: 'YZF', name: 'Yellowknife', country: 'CA', lat: 62.4647, lon: -114.4472, volume: 0.15, type: 'passenger' }, // Northwest Territories
  { code: 'YFB', name: 'Iqaluit', country: 'CA', lat: 63.7449, lon: -68.5674, volume: 0.12, type: 'passenger' }, // Nunavut (Baffin Island)
  { code: 'YRB', name: 'Rankin Inlet', country: 'CA', lat: 62.8125, lon: -92.0678, volume: 0.08, type: 'passenger' }, // Nunavut (Hudson Bay)
  { code: 'YLT', name: 'Lethbridge', country: 'CA', lat: 49.9467, lon: -112.7999, volume: 0.1, type: 'cargo' }, // Alberta
  { code: 'GOH', name: 'Nuuk', country: 'GL', lat: 64.1854, lon: -51.6866, volume: 0.15, type: 'passenger' }, // Greenland's largest airport
  { code: 'KEF', name: 'Reykjavik', country: 'IS', lat: 64.1355, lon: -21.7979, volume: 0.55, type: 'passenger' }, // Iceland (Keflavik)
  { code: 'MIA', name: 'Miami', country: 'US', lat: 25.7933, lon: -80.2906, volume: 0.85, type: 'passenger' },
  { code: 'ILM', name: 'Wilmington', country: 'US', lat: 34.4134, lon: -77.9115, volume: 0.25, type: 'passenger' }, // Cape Fear region, North Carolina
  { code: 'CUN', name: 'Cancun', country: 'MX', lat: 21.0470, lon: -86.8640, volume: 0.55, type: 'passenger' },

  // -- South America --
  { code: 'ASU', name: 'Asuncion', country: 'PY', lat: -25.2583, lon: -57.5181, volume: 0.35, type: 'passenger' },
  { code: 'GRU', name: 'Sao Paulo', country: 'BR', lat: -23.4353, lon: -46.4731, volume: 0.9, type: 'mixed' },
  { code: 'GIG', name: 'Rio de Janeiro', country: 'BR', lat: -22.9083, lon: -43.2500, volume: 0.65, type: 'passenger' },
  { code: 'BSB', name: 'Brasilia', country: 'BR', lat: -15.8711, lon: -47.9314, volume: 0.4, type: 'passenger' },
  { code: 'PUQ', name: 'Punta Arenas', country: 'CL', lat: -53.0167, lon: -71.4083, volume: 0.3, type: 'passenger' }, // Gateway to Antarctica
  { code: 'SCL', name: 'Santiago', country: 'CL', lat: -33.3548, lon: -70.7982, volume: 0.48, type: 'passenger' },
  { code: 'LIM', name: 'Lima', country: 'PE', lat: -12.0301, lon: -77.1674, volume: 0.45, type: 'passenger' },
  { code: 'EZE', name: 'Buenos Aires', country: 'AR', lat: -34.8301, lon: -58.5000, volume: 0.44, type: 'passenger' },
  { code: 'FIE', name: 'Mount Pleasant', country: 'FK', lat: -50.2134, lon: -61.1435, volume: 0.1, type: 'cargo' }, // Falkland Islands (RAF Mount Pleasant)
  // -- Caribbean coast of Colombia --
  { code: 'CTG', name: 'Cartagena', country: 'CO', lat: 10.4516, lon: -75.5403, volume: 0.35, type: 'passenger' },
  { code: 'POS', name: 'Port of Spain', country: 'TT', lat: 10.5923, lon: -61.3015, volume: 0.3, type: 'passenger' }, // Trinidad
  { code: 'CAY', name: 'Cayenne', country: 'GF', lat: 4.8133, lon: -52.3533, volume: 0.1, type: 'mixed' }, // Near Guiana Space Centre (CSG) — French satellite launch site
  { code: 'BOG', name: 'Bogota', country: 'CO', lat: 4.7005, lon: -74.1426, volume: 0.45, type: 'passenger' },

  // -- Landlocked South American capitals --
  { code: 'CAR', name: 'Caracas', country: 'VE', lat: 10.1754, lon: -67.0549, volume: 0.4, type: 'passenger' },
  // Landlocked South American capitals
  { code: 'LPJ', name: 'La Paz', country: 'BO', lat: -16.4850, lon: -68.1198, volume: 0.3, type: 'passenger' },
  { code: 'VVI', name: 'Santa Cruz', country: 'BO', lat: -17.3932, lon: -63.4941, volume: 0.25, type: 'passenger' },
  { code: 'UIO', name: 'Quito', country: 'EC', lat: -0.2297, lon: -78.5247, volume: 0.35, type: 'passenger' },

  // -- Europe --
  { code: 'LHR', name: 'London', country: 'GB', lat: 51.4700, lon: -0.4543, volume: 0.9, type: 'mixed' },
  { code: 'CDG', name: 'Paris', country: 'FR', lat: 49.0128, lon: 2.5556, volume: 0.8, type: 'mixed' },
  { code: 'FRA', name: 'Frankfurt', country: 'DE', lat: 50.0379, lon: 8.5622, volume: 0.85, type: 'cargo' },
  { code: 'AMS', name: 'Amsterdam', country: 'NL', lat: 52.3086, lon: 4.7625, volume: 0.65, type: 'passenger' },
  { code: 'FCO', name: 'Rome', country: 'IT', lat: 41.7994, lon: 12.2462, volume: 0.55, type: 'passenger' },
  { code: 'MAD', name: 'Madrid', country: 'ES', lat: 40.4719, lon: -3.5356, volume: 0.5, type: 'passenger' },
  { code: 'IST', name: 'Istanbul', country: 'TR', lat: 41.0082, lon: 28.7775, volume: 0.78, type: 'passenger' },
  { code: 'HEL', name: 'Helsinki', country: 'FI', lat: 60.1739, lon: 24.9426, volume: 0.55, type: 'passenger' },
  { code: 'ARN', name: 'Stockholm', country: 'SE', lat: 59.6517, lon: 17.9037, volume: 0.55, type: 'passenger' },
  { code: 'SVO', name: 'Moscow', country: 'RU', lat: 55.9712, lon: 36.9175, volume: 0.7, type: 'mixed' },
  { code: 'WAW', name: 'Warsaw', country: 'PL', lat: 52.1780, lon: 20.9810, volume: 0.5, type: 'passenger' },
  { code: 'KBP', name: 'Kiev', country: 'UA', lat: 50.2839, lon: 30.3273, volume: 0.45, type: 'passenger' },
  { code: 'ATH', name: 'Athens', country: 'GR', lat: 37.4300, lon: 23.7500, volume: 0.25, type: 'passenger' }, // Greece

  // -- Ring of Fire --
  { code: 'PTY', name: 'Panama City', country: 'PA', lat: 8.9712, lon: -79.5595, volume: 0.5, type: 'passenger' },
  { code: 'TGU', name: 'Tegucigalpa', country: 'HN', lat: 14.4210, lon: -87.5946, volume: 0.35, type: 'passenger' },
  { code: 'MGA', name: 'Managua', country: 'NI', lat: 12.1464, lon: -86.2353, volume: 0.3, type: 'passenger' },
  { code: 'PTY', name: 'Panama City', country: 'PA', lat: 8.9712, lon: -79.5595, volume: 0.5, type: 'passenger' },
  { code: 'POM', name: 'Port Moresby', country: 'PG', lat: -9.4443, lon: 147.1830, volume: 0.3, type: 'passenger' },
  { code: 'SLH', name: 'Honiara', country: 'SB', lat: -9.4280, lon: 159.8654, volume: 0.25, type: 'passenger' },
  { code: 'IPC', name: 'Easter Island', country: 'CL', lat: -27.1759, lon: -109.3573, volume: 0.15, type: 'passenger' },

  // -- Middle East / Africa --
  { code: 'ROB', name: 'Monrovia', country: 'LR', lat: 6.3024, lon: -10.7280, volume: 0.2, type: 'passenger' }, // Liberia
  { code: 'PDL', name: 'Ponta Delgada', country: 'PT', lat: 37.7439, lon: -25.6991, volume: 0.15, type: 'passenger' }, // Azores
  { code: 'COO', name: 'Conakry', country: 'GN', lat: 9.6360, lon: -13.5927, volume: 0.2, type: 'passenger' }, // Guinea
  { code: 'FIH', name: 'Kinshasa', country: 'CD', lat: -4.4167, lon: 15.4667, volume: 0.25, type: 'mixed' }, // DR Congo
  { code: 'LAD', name: 'Luanda', country: 'AO', lat: -8.2739, lon: 13.2333, volume: 0.3, type: 'mixed' }, // Angola
  { code: 'NKC', name: 'Nouakchott', country: 'MR', lat: 18.2925, lon: -15.9444, volume: 0.15, type: 'passenger' }, // Mauritania
  { code: 'TOM', name: 'Timbuktu', country: 'ML', lat: 16.7667, lon: -3.0050, volume: 0.1, type: 'passenger' }, // Mali — historic trans-Saharan trade hub
  { code: 'ALG', name: 'Algiers', country: 'DZ', lat: 36.7188, lon: 3.2623, volume: 0.25, type: 'passenger' }, // Algeria
  { code: 'CMN', name: 'Casablanca', country: 'MA', lat: 33.3650, lon: -7.5866, volume: 0.3, type: 'passenger' }, // Morocco
  { code: 'NIM', name: 'Niamey', country: 'NE', lat: 13.5586, lon: 2.1932, volume: 0.15, type: 'passenger' }, // Niger
  { code: 'NDJ', name: 'Ndjamena', country: 'TD', lat: 12.2058, lon: 15.0396, volume: 0.2, type: 'passenger' }, // Chad
  { code: 'TIP', name: 'Tripoli', country: 'LY', lat: 32.6396, lon: 13.1616, volume: 0.2, type: 'passenger' }, // Libya
  { code: 'KRT', name: 'Khartoum', country: 'SD', lat: 15.5897, lon: 32.5241, volume: 0.3, type: 'passenger' }, // Sudan
  { code: 'KBL', name: 'Mogadishu', country: 'SO', lat: 2.0133, lon: 45.3752, volume: 0.15, type: 'passenger' }, // Somalia
  { code: 'JIB', name: 'Djibouti', country: 'DJ', lat: 11.5369, lon: 42.9316, volume: 0.2, type: 'passenger' }, // Djibouti
  { code: 'DXB', name: 'Dubai', country: 'AE', lat: 25.2532, lon: 55.3657, volume: 0.88, type: 'mixed' },
  { code: 'RUH', name: 'Riyadh', country: 'SA', lat: 24.7136, lon: 46.7259, volume: 0.65, type: 'passenger' },
  { code: 'BGW', name: 'Baghdad', country: 'IQ', lat: 33.2646, lon: 44.2611, volume: 0.4, type: 'passenger' },
  { code: 'IKA', name: 'Tehran', country: 'IR', lat: 35.2780, lon: 51.3193, volume: 0.55, type: 'mixed' },
  { code: 'JNB', name: 'Johannesburg', country: 'ZA', lat: -26.1363, lon: 28.7465, volume: 0.55, type: 'passenger' },
  { code: 'CPT', name: 'Cape Town', country: 'ZA', lat: -33.9249, lon: 18.4207, volume: 0.35, type: 'passenger' },
  { code: 'WDH', name: 'Windhoek', country: 'NA', lat: -22.5609, lon: 17.0658, volume: 0.2, type: 'passenger' }, // Namibia
  { code: 'CAI', name: 'Cairo', country: 'EG', lat: 30.2394, lon: 31.4189, volume: 0.45, type: 'passenger' },
  { code: 'TLV', name: 'Tel Aviv', country: 'IL', lat: 32.0162, lon: 34.7208, volume: 0.25, type: 'passenger' }, // Near Jerusalem
  { code: 'ADD', name: 'Addis Ababa', country: 'ET', lat: 8.4816, lon: 38.7918, volume: 0.5, type: 'mixed' },
  { code: 'LOS', name: 'Lagos', country: 'NG', lat: 6.5774, lon: 3.3254, volume: 0.4, type: 'passenger' },
  { code: 'MAP', name: 'Maputo', country: 'MZ', lat: -25.2848, lon: 32.5327, volume: 0.25, type: 'passenger' }, // Mozambique
  { code: 'TNR', name: 'Antananarivo', country: 'MG', lat: -18.8492, lon: 47.5091, volume: 0.2, type: 'passenger' }, // Madagascar
  { code: 'MBA', name: 'Mombasa', country: 'KE', lat: -4.0324, lon: 39.5925, volume: 0.3, type: 'passenger' }, // Kenya

  // -- Asia --
  { code: 'HAN', name: 'Hanoi', country: 'VN', lat: 21.2180, lon: 105.8030, volume: 0.45, type: 'passenger' },
  { code: 'CGK', name: 'Jakarta', country: 'ID', lat: -6.2297, lon: 106.7856, volume: 0.5, type: 'passenger' },
  { code: 'WLG', name: 'Wellington', country: 'NZ', lat: -41.3155, lon: 174.8056, volume: 0.4, type: 'passenger' },
  { code: 'RYG', name: 'Rothera Station', country: 'AQ', lat: -71.9445, lon: -60.8127, volume: 0.1, type: 'cargo' }, // Antarctic research airport on Adelaide Island
  { code: 'HND', name: 'Tokyo Haneda', country: 'JP', lat: 35.5494, lon: 139.7841, volume: 0.85, type: 'passenger' },
  { code: 'NRT', name: 'Tokyo Narita', country: 'JP', lat: 35.7647, lon: 140.3864, volume: 0.75, type: 'passenger' },
  { code: 'KIX', name: 'Osaka Kansai', country: 'JP', lat: 34.4257, lon: 135.2445, volume: 0.45, type: 'passenger' },
  { code: 'CTS', name: 'Sapporo', country: 'JP', lat: 42.7925, lon: 141.6633, volume: 0.4, type: 'passenger' }, // New Chitose Airport (CTS), Hokkaido
  { code: 'OKA', name: 'Okinawa', country: 'JP', lat: 26.2036, lon: 127.6505, volume: 0.25, type: 'passenger' },
  { code: 'IWO', name: 'Iwo Jima', country: 'JP', lat: 24.4667, lon: 141.3333, volume: 0.05, type: 'cargo' }, // Volcanic island, US/Japan Military Base
  { code: 'PVG', name: 'Shanghai', country: 'CN', lat: 31.1451, lon: 121.7048, volume: 0.9, type: 'mixed' },
  { code: 'PEK', name: 'Beijing', country: 'CN', lat: 40.0724, lon: 116.5972, volume: 0.8, type: 'mixed' },
  { code: 'SGN', name: 'Ho Chi Minh', country: 'VN', lat: 10.8195, lon: 106.6525, volume: 0.45, type: 'passenger' },
  { code: 'HKG', name: 'Hong Kong', country: 'HK', lat: 22.3089, lon: 113.9140, volume: 0.6, type: 'mixed' },
  { code: 'ICN', name: 'Seoul', country: 'KR', lat: 37.4602, lon: 127.0286, volume: 0.72, type: 'passenger' },
  { code: 'SIN', name: 'Singapore', country: 'SG', lat: 1.3597, lon: 103.9896, volume: 0.68, type: 'mixed' },
  { code: 'BKK', name: 'Bangkok', country: 'TH', lat: 13.6507, lon: 100.7523, volume: 0.62, type: 'passenger' },
  { code: 'DEL', name: 'Delhi', country: 'IN', lat: 28.5665, lon: 77.1031, volume: 0.48, type: 'passenger' },
  { code: 'BOM', name: 'Mumbai', country: 'IN', lat: 19.0907, lon: 72.8631, volume: 0.42, type: 'passenger' },
  { code: 'MNL', name: 'Manila', country: 'PH', lat: 14.5078, lon: 121.2375, volume: 0.5, type: 'passenger' },
  { code: 'NAN', name: 'Nadi', country: 'FJ', lat: -17.7110, lon: 177.4830, volume: 0.3, type: 'passenger' }, // Fiji

  // -- Former Soviet Muslim republics (Central Asia) --
  { code: 'GYD', name: 'Baku', country: 'AZ', lat: 40.3777, lon: 49.8060, volume: 0.35, type: 'mixed' },
  { code: 'NQZ', name: 'Nur-Sultan', country: 'KZ', lat: 51.1657, lon: 71.4312, volume: 0.25, type: 'mixed' },
  { code: 'FRU', name: 'Bishkek', country: 'KG', lat: 42.8333, lon: 74.5756, volume: 0.2, type: 'mixed' },
  { code: 'RND', name: 'Dushanbe', country: 'TJ', lat: 38.5367, lon: 68.7893, volume: 0.15, type: 'passenger' },
  { code: 'ASB', name: 'Ashgabat', country: 'TM', lat: 37.6603, lon: 58.3937, volume: 0.15, type: 'passenger' },
  { code: 'TAS', name: 'Tashkent', country: 'UZ', lat: 41.2574, lon: 69.2907, volume: 0.3, type: 'mixed' },
  { code: 'ULN', name: 'Ulaan Baatar', country: 'MN', lat: 47.8869, lon: 106.8881, volume: 0.2, type: 'passenger' },
  { code: 'VVO', name: 'Vladivostok', country: 'RU', lat: 45.8734, lon: 131.9193, volume: 0.3, type: 'passenger' },

  // -- Oceania --
  { code: 'SYD', name: 'Sydney', country: 'AU', lat: -33.9461, lon: 151.1719, volume: 0.55, type: 'passenger' },
  { code: 'MEL', name: 'Melbourne', country: 'AU', lat: -37.6702, lon: 144.5229, volume: 0.42, type: 'passenger' },
  { code: 'PER', name: 'Perth', country: 'AU', lat: -31.9496, lon: 115.9437, volume: 0.35, type: 'passenger' }, // Western Australia
  { code: 'DRW', name: 'Darwin', country: 'AU', lat: -12.4079, lon: 130.9811, volume: 0.2, type: 'mixed' }, // Northern Territory
];

// Ensure uniqueness of codes -- useful for lookups and route generation
export const HUB_BY_CODE = new Map<string, HubCity>(
  HUB_CITIES.map((city) => [city.code, city]),
);

/**
 * Returns a random hub city, optionally weighted by traffic volume.
 */
export function getRandomHub(weighted: boolean = true): HubCity {
  if (!weighted) {
    const idx = Math.floor(Math.random() * HUB_CITIES.length);
    return HUB_CITIES[idx];
  }

  const totalVolume = HUB_CITIES.reduce((sum, city) => sum + city.volume, 0);
  let r = Math.random() * totalVolume;
  for (const city of HUB_CITIES) {
    r -= city.volume;
    if (r <= 0) return city;
  }
  return HUB_CITIES[HUB_CITIES.length - 1];
}

/**
 * Generates a random route between two distinct hub cities.
 */
export function getRandomRoute(): { from: HubCity; to: HubCity } {
  let from = getRandomHub();
  let to = getRandomHub();
  while (from.code === to.code) {
    to = getRandomHub();
  }
  return { from, to };
}
