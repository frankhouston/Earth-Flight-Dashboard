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
  // -- North America --
  { code: 'JFK', name: 'New York', country: 'US', lat: 40.6413, lon: -73.7781, volume: 1.0, type: 'passenger' },
  { code: 'LAX', name: 'Los Angeles', country: 'US', lat: 33.9416, lon: -118.4085, volume: 0.95, type: 'passenger' },
  { code: 'ORD', name: 'Chicago', country: 'US', lat: 41.9742, lon: -87.9073, volume: 0.92, type: 'mixed' },
  { code: 'DFW', name: 'Dallas', country: 'US', lat: 32.8998, lon: -97.0403, volume: 0.82, type: 'passenger' },
  { code: 'ATL', name: 'Atlanta', country: 'US', lat: 33.6070, lon: -84.5514, volume: 0.9, type: 'passenger' },
  { code: 'MEX', name: 'Mexico City', country: 'MX', lat: 19.4363, lon: -99.0721, volume: 0.65, type: 'passenger' },
  { code: 'YYZ', name: 'Toronto', country: 'CA', lat: 43.6777, lon: -79.6293, volume: 0.55, type: 'passenger' },

  // -- South America --
  { code: 'GRU', name: 'Sao Paulo', country: 'BR', lat: -23.4325, lon: -46.4731, volume: 0.75, type: 'passenger' },
  { code: 'SCL', name: 'Santiago', country: 'CL', lat: -33.3548, lon: -70.7982, volume: 0.48, type: 'passenger' },
  { code: 'LIM', name: 'Lima', country: 'PE', lat: -12.0301, lon: -77.1674, volume: 0.45, type: 'passenger' },
  { code: 'EZE', name: 'Buenos Aires', country: 'AR', lat: -34.8301, lon: -58.5000, volume: 0.44, type: 'passenger' },

  // -- Europe --
  { code: 'LHR', name: 'London', country: 'GB', lat: 51.4700, lon: -0.4543, volume: 0.9, type: 'mixed' },
  { code: 'CDG', name: 'Paris', country: 'FR', lat: 49.0128, lon: 2.5556, volume: 0.8, type: 'mixed' },
  { code: 'FRA', name: 'Frankfurt', country: 'DE', lat: 50.0379, lon: 8.5622, volume: 0.85, type: 'cargo' },
  { code: 'AMS', name: 'Amsterdam', country: 'NL', lat: 52.3086, lon: 4.7625, volume: 0.65, type: 'passenger' },
  { code: 'FCO', name: 'Rome', country: 'IT', lat: 41.7994, lon: 12.2462, volume: 0.55, type: 'passenger' },
  { code: 'MAD', name: 'Madrid', country: 'ES', lat: 40.4719, lon: -3.5356, volume: 0.5, type: 'passenger' },
  { code: 'IST', name: 'Istanbul', country: 'TR', lat: 41.0082, lon: 28.7775, volume: 0.78, type: 'passenger' },

  // -- Middle East / Africa --
  { code: 'DXB', name: 'Dubai', country: 'AE', lat: 25.2532, lon: 55.3657, volume: 0.88, type: 'mixed' },
  { code: 'JNB', name: 'Johannesburg', country: 'ZA', lat: -26.1363, lon: 28.7465, volume: 0.55, type: 'passenger' },
  { code: 'CPT', name: 'Cape Town', country: 'ZA', lat: -33.9249, lon: 18.4207, volume: 0.35, type: 'passenger' },
  { code: 'CAI', name: 'Cairo', country: 'EG', lat: 30.2394, lon: 31.4189, volume: 0.45, type: 'passenger' },

  // -- Asia --
  { code: 'HND', name: 'Tokyo Haneda', country: 'JP', lat: 35.5494, lon: 139.7841, volume: 0.85, type: 'passenger' },
  { code: 'KIX', name: 'Osaka Kansai', country: 'JP', lat: 34.4257, lon: 135.2445, volume: 0.45, type: 'passenger' },
  { code: 'PVG', name: 'Shanghai', country: 'CN', lat: 31.1451, lon: 121.7048, volume: 0.9, type: 'mixed' },
  { code: 'PEK', name: 'Beijing', country: 'CN', lat: 40.0724, lon: 116.5972, volume: 0.8, type: 'mixed' },
  { code: 'CAN', name: 'Guangzhou', country: 'CN', lat: 23.3080, lon: 113.3585, volume: 0.65, type: 'passenger' },
  { code: 'HKG', name: 'Hong Kong', country: 'HK', lat: 22.3089, lon: 113.9140, volume: 0.6, type: 'mixed' },
  { code: 'ICN', name: 'Seoul', country: 'KR', lat: 37.4602, lon: 127.0286, volume: 0.72, type: 'passenger' },
  { code: 'SIN', name: 'Singapore', country: 'SG', lat: 1.3597, lon: 103.9896, volume: 0.68, type: 'mixed' },
  { code: 'BKK', name: 'Bangkok', country: 'TH', lat: 13.6507, lon: 100.7523, volume: 0.62, type: 'passenger' },
  { code: 'DEL', name: 'Delhi', country: 'IN', lat: 28.5665, lon: 77.1031, volume: 0.48, type: 'passenger' },
  { code: 'BOM', name: 'Mumbai', country: 'IN', lat: 19.0907, lon: 72.8631, volume: 0.42, type: 'passenger' },

  // -- Oceania --
  { code: 'SYD', name: 'Sydney', country: 'AU', lat: -33.9461, lon: 151.1719, volume: 0.55, type: 'passenger' },
  { code: 'MEL', name: 'Melbourne', country: 'AU', lat: -37.6702, lon: 144.5229, volume: 0.42, type: 'passenger' },
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
