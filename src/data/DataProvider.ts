/**
 * DataProvider -- live data source + simulation bridge.
 *
 * In simulation mode (default), spawns random routes between hub cities
 * at realistic intervals, moves "packets" along them, and emits a
 * DashboardData snapshot at ~30fps for UI consumption.
 *
 * Real-data mode can be enabled via setApiEndpoint() -- the provider
 * attempts to fetch from the configured endpoint and falls back to
 * simulation on any error (CORS, network, parse failure).
 *
 * The Dashboard subscribes to receive live route updates and stats.
 */
import { HubCity, HUB_CITIES, HUB_BY_CODE, getRandomHub, getRandomRoute } from '@/data/cities';

export interface FlightRoute {
  /** Unique identifier for this route instance */
  id: string;
  /** Source city */
  from: HubCity;
  /** Destination city */
  to: HubCity;
  /** Progress along the route (0.0 to 1.0) */
  progress: number;
  /** Speed in normalized progress-units per second */
  speed: number;
  /** Timestamp when this route was created (ms) */
  createdAt: number;
}

export interface PeakHubStat {
  code: string;
  name: string;
  count: number;
}

export interface DashboardData {
  /** Currently active flight routes */
  routes: FlightRoute[];
  /** Aggregate statistics for UI display */
  stats: {
    totalFlights: number;
    activeFlights: number;
    avgProgress: number;
    peakHub: PeakHubStat;
  };
}

/** Snapshot of the data source state for diagnostics */
export type DataSource = 'simulation' | 'api';

/* ---- Simulation tunables */

const TICK_RATE = 30; // fps for data updates
const SIM_SPAWN_INTERVAL_MIN = 0.8; // seconds between new route spawns
const SIM_SPAWN_INTERVAL_MAX = 1.5;
const SIM_ROUTE_SPEED_MIN = 0.05; // normalized units/sec
const SIM_ROUTE_SPEED_MAX = 0.20;
const SIM_MAX_ACTIVE_ROUTES = 80;
const SIM_FADE_DURATION = 0.08; // progress range at arc endpoints

/** Easing function: ease-in-out cubic */
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/** Type for data update callbacks */
export type DataCallback = (data: DashboardData, source: DataSource) => void;

/**
 * Bridges real flight data (or a simulation fallback) with the dashboard.
 * Emits a stream of DashboardData objects containing route data and stats.
 */
export class DataProvider {
  private subscribers: Set<DataCallback> = new Set();
  private routes: Map<string, FlightRoute> = new Map();
  private totalSpawned: number = 0;
  private animationId: number | null = null;
  private lastTimestamp: number = 0;
  private lastSpawnTime: number = 0;
  private nextSpawnInterval: number = 0;
  private source: DataSource = 'simulation';
  private apiEndpoint: string | null = null;
  private apiAbort: AbortController | null = null;

  /**
   * Creates a new DataProvider.
   *
   * @param simulationOnly - If true, never attempt to fetch real API data.
   *   Set to false to enable live data fetching (falls back to simulation).
   */
  constructor(private simulationOnly: boolean = true) {}

  // -- Subscriber management

  /**
   * Subscribes to data updates. Immediately emits the current snapshot.
   * Returns an unsubscribe function.
   */
  subscribe(cb: DataCallback): () => void {
    this.subscribers.add(cb);
    cb(this.computeSnapshot(), this.source);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  // -- Lifecycle

  /**
   * Starts the data update loop.
   * If an API endpoint is configured, first attempts to fetch real data.
   */
  start(): void {
    if (this.animationId !== null) return;
    this.lastTimestamp = performance.now();
    this.lastSpawnTime = 0;
    this.nextSpawnInterval =
      SIM_SPAWN_INTERVAL_MIN +
      Math.random() * (SIM_SPAWN_INTERVAL_MAX - SIM_SPAWN_INTERVAL_MIN);

    if (!this.simulationOnly && this.apiEndpoint) {
      this.tryFetchRealData().catch(() => {
        // Fall back to simulation silently
        this.source = 'simulation';
      });
    }

    this.animationId = requestAnimationFrame(this.tick);
  }

  /**
   * Stops the data update loop.
   */
  stop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    if (this.apiAbort) {
      this.apiAbort.abort();
      this.apiAbort = null;
    }
  }

  /** Configures a real-data API endpoint. */
  setApiEndpoint(url: string): void {
    this.apiEndpoint = url;
    this.simulationOnly = false;
  }

  /** Returns the current data source. */
  getDataSource(): DataSource {
    return this.source;
  }

  // -- Real data fetching

  /**
   * Attempts to fetch real flight data from the configured API endpoint.
   * Falls back to simulation mode on any error.
   */
  private async tryFetchRealData(): Promise<void> {
    if (!this.apiEndpoint) return;

    this.apiAbort = new AbortController();
    const response = await fetch(this.apiEndpoint, {
      signal: this.apiAbort.signal,
    });
    if (!response.ok) throw new Error(`API returned ${response.status}`);

    const data = await response.json();
    // Parse response -- expect an array of { from: string, to: string } route objects
    if (Array.isArray(data)) {
      this.source = 'api';
      for (const item of data) {
        if (typeof item.from === 'string' && typeof item.to === 'string') {
          this.addRoute(item.from, item.to);
        }
      }
    } else {
      throw new Error('Unexpected API response format');
    }
  }

  // -- Simulation tick

  private tick = (timestamp: number): void => {
    const dt = (timestamp - this.lastTimestamp) / 1000; // seconds
    this.lastTimestamp = timestamp;

    // Update simulation: move routes forward
    this.updateSimulation(dt);

    // Emit updated state
    this.emit();

    this.animationId = requestAnimationFrame(this.tick);
  };

  /** Updates route progress and spawns new routes in simulation mode. */
  private updateSimulation(dt: number): void {
    // Move existing routes
    const completed: string[] = [];
    for (const [id, route] of this.routes) {
      route.progress += route.speed * dt;
      if (route.progress >= 1.0) {
        completed.push(id);
      }
    }
    // Remove completed routes
    for (const id of completed) {
      this.routes.delete(id);
    }

    // Spawn new routes if under cap
    if (this.source === 'simulation' && this.routes.size < SIM_MAX_ACTIVE_ROUTES) {
      this.lastSpawnTime += dt;
      if (this.lastSpawnTime >= this.nextSpawnInterval) {
        this.spawnRoute();
        this.lastSpawnTime = 0;
        this.nextSpawnInterval =
          SIM_SPAWN_INTERVAL_MIN +
          Math.random() * (SIM_SPAWN_INTERVAL_MAX - SIM_SPAWN_INTERVAL_MIN);
      }
    }
  }

  /** Spawns a new random route between two hub cities. */
  private spawnRoute(): void {
    const { from, to } = getRandomRoute();
    const route: FlightRoute = {
      id: `sim-${this.totalSpawned++}`,
      from,
      to,
      progress: 0,
      speed:
        SIM_ROUTE_SPEED_MIN +
        Math.random() * (SIM_ROUTE_SPEED_MAX - SIM_ROUTE_SPEED_MIN),
      createdAt: performance.now(),
    };
    this.routes.set(route.id, route);
  }

  // -- Data emission

  /** Computes a snapshot of current state for emission. */
  private computeSnapshot(): DashboardData {
    const routes = Array.from(this.routes.values());
    const activeFlights = routes.length;

    // Average progress
    let totalProgress = 0;
    for (const r of routes) totalProgress += r.progress;
    const avgProgress = activeFlights > 0 ? totalProgress / activeFlights : 0;

    // Peak hub (busiest by total route mentions)
    const hubCounts = new Map<string, PeakHubStat>();
    for (const r of routes) {
      for (const city of [r.from, r.to]) {
        const existing =
          hubCounts.get(city.code) ??
          { code: city.code, name: city.name, count: 0 };
        existing.count += 1;
        hubCounts.set(city.code, existing);
      }
    }
    let peakHub: PeakHubStat = { code: '-', name: 'N/A', count: 0 };
    for (const v of hubCounts.values()) {
      if (v.count > peakHub.count) peakHub = v;
    }

    return {
      routes,
      stats: {
        totalFlights: this.totalSpawned,
        activeFlights,
        avgProgress,
        peakHub,
      },
    };
  }

  /** Emits the current snapshot to all subscribers. */
  private emit(): void {
    if (this.subscribers.size === 0) return;
    const snapshot = this.computeSnapshot();
    for (const cb of this.subscribers) {
      cb(snapshot, this.source);
    }
  }

  // -- Manual route injection (for real data mode)

  /**
   * Manually adds a route by city code. Used by the API fetch flow.
   * Returns the route, or null if either city code is invalid.
   */
  addRoute(fromCode: string, toCode: string): FlightRoute | null {
    const from = HUB_BY_CODE.get(fromCode);
    const to = HUB_BY_CODE.get(toCode);
    if (!from || !to || from.code === to.code) return null;

    const route: FlightRoute = {
      id: `api-${this.totalSpawned++}`,
      from,
      to,
      progress: 0,
      speed:
        SIM_ROUTE_SPEED_MIN +
        Math.random() * (SIM_ROUTE_SPEED_MAX - SIM_ROUTE_SPEED_MIN),
      createdAt: performance.now(),
    };
    this.routes.set(route.id, route);
    return route;
  }

  /** Removes a route by ID. */
  removeRoute(id: string): boolean {
    return this.routes.delete(id);
  }

  /** Returns all active routes. */
  getRoutes(): FlightRoute[] {
    return Array.from(this.routes.values());
  }

  /** Returns the latest snapshot without emitting. */
  getLatestSnapshot(): DashboardData {
    return this.computeSnapshot();
  }
}
