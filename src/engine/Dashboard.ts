import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GlobeTextureLoader, DEFAULT_TEXTURES } from '@/textures/TextureLoader';
import { TerminatorMaterial, computeSunDirection } from '@/engine/globe/TerminatorMaterial';
import { Atmosphere } from '@/engine/globe/Atmosphere';
import { createGreatCircleArc, createArcLine, ArcGeometry } from '@/engine/arcs/ArcGenerator';
import { PacketSystem } from '@/engine/arcs/PacketSystem';
import { MarkerSystem } from '@/engine/arcs/MarkerSystem';
import { AirportPopup } from '@/ui/AirportPopup';
import { HUB_CITIES, HubCity } from '@/data/cities';
import { DataProvider, FlightRoute, DashboardData } from '@/data/DataProvider';
import { CameraDemo } from '@/engine/CameraDemo';
import { StatCards } from '@/ui/StatCards';
import { RouteTicker } from '@/ui/RouteTicker';
import { HUDOverlay } from '@/ui/HUDOverlay';
import { LatLonReadout } from '@/ui/LatLonReadout';

/**
 * Core dashboard orchestrator.
 * Owns the Three.js scene, camera, renderer, and the render loop.
 *
 * Scene hierarchy:
 *   Scene
 *     └── GlobeGroup (23.4 degree tilt + Y rotation)
 *         ├── Globe (SphereGeometry + TerminatorMaterial)
 *         ├── Atmosphere (glow shell)
 *         ├── MarkerGroup (city dots + labels at lat/lon positions)
 *         └── ArcGroup
 *             ├── Arc lines (great-circle routes)
 *             └── Packet sprites (animated data packets)
 *
 * Data flow:
 *   DataProvider (simulation or API) → DashboardData → Arc sync + UI stats
 *   CameraDemo → orbital cinematic tour after idle
 *   Mouse hover → LatLonReadout (cursor-following lat/lon via raycast)
 */

interface ArcEntry {
  arc: ArcGeometry;
  line: THREE.Line;
}

export class EarthDashboard {
  // -- Core Three.js
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private clock: THREE.Clock = new THREE.Clock();
  private animationId: number | null = null;

  // -- Globe hierarchy
  private globeGroup!: THREE.Group;
  private globe!: THREE.Mesh;
  private terminatorMaterial!: TerminatorMaterial;
  private atmosphere!: Atmosphere;
  private arcGroup!: THREE.Group;
  private markerSystem!: MarkerSystem;
  private packetSystem!: PacketSystem;

  // -- Data integration
  private dataProvider!: DataProvider;
  private arcMaterial!: THREE.LineBasicMaterial;
  private arcEntries: Map<string, ArcEntry> = new Map();
  private dashboardData: DashboardData | null = null;
  private statCards!: StatCards;
  private routeTicker!: RouteTicker;
  private hudOverlay!: HUDOverlay;
  private latLonReadout!: LatLonReadout;
  private airportPopup!: AirportPopup;

  // -- Cinematic camera
  private cameraDemo!: CameraDemo;

  // -- Systems
  private textureLoader: GlobeTextureLoader;

  // -- Animation control
  private timeScale: number = 60; // 60x = 1 real second ~= 1 minute simulated
  private isTimeDriven: boolean = true;

  // -- Reset threshold
  private resetThreshold: number = 100; // Total flights before auto-reset

  // -- Loading UI
  private loadingEl: HTMLElement | null = null;
  private mountPoint: HTMLElement | null = null;

  constructor() {
    this.textureLoader = new GlobeTextureLoader();
  }

  /**
   * Initializes the scene, camera, renderer, controls, and globe.
   * Loads textures asynchronously, then creates the terminator-shaded globe.
   */
  init(): void {
    this.mountPoint = document.getElementById('app');
    if (!this.mountPoint) {
      throw new Error('Mount point not found: #app');
    }

    this.createScene();
    this.createCamera();
    this.markerSystem.setCamera(this.camera);
    this.createRenderer();
    this.textureLoader.setMaxAnisotropy(this.renderer.capabilities.getMaxAnisotropy());
    this.createControls();
    this.createLoadingUI();
    this.setupEventListeners();

    // Camera demo — cinematic tour after idle
    this.cameraDemo = new CameraDemo(this.camera, 12);
    this.cameraDemo.onActivate = () => {
      this.controls.enabled = false;
      this.statCards.dim();
      this.routeTicker.dim();
      this.hudOverlay.dim();
      this.markerSystem.dim();
      this.latLonReadout.hide();
    };
    this.cameraDemo.onDeactivate = () => {
      this.controls.enabled = true;
      this.statCards.undim();
      this.routeTicker.undim();
      this.hudOverlay.undim();
      this.markerSystem.undim();
    };

    // Stat cards — glassmorphism overlay for real-time flight stats
    this.statCards = new StatCards(this.mountPoint!);
    this.statCards.setOnCardClick((cardId) => {
      if (cardId === 'total') {
        const input = window.prompt(
          'Enter total flight count before reset:',
          String(this.resetThreshold),
        );
        if (input !== null) {
          const value = parseInt(input, 10);
          if (!isNaN(value) && value > 0) {
            this.resetThreshold = value;
            this.statCards.setResetThreshold(value);
          }
        }
      }
    });

    // Route ticker — scrolling marquee of active flight routes
    this.routeTicker = new RouteTicker(this.mountPoint!);

    // HUD overlay — data source, time, active count, legend
    this.hudOverlay = new HUDOverlay(this.mountPoint!);

    // Lat/Lon readout — cursor-following coordinate display
    this.latLonReadout = new LatLonReadout(this.mountPoint!);
    this.latLonReadout.setCamera(this.camera);
    this.latLonReadout.setDomElement(this.renderer.domElement);

    // Airport popup — shows airport info, hide/unhide options on marker click
    this.airportPopup = new AirportPopup(this.mountPoint!);
    this.markerSystem.setOnMarkerClick((city) => {
      this.airportPopup.show(city, this.camera);

      // Listen for hide event (close button)
      this.airportPopup.getContainer().addEventListener('hide-marker', ((e: CustomEvent) => {
        this.markerSystem.hideMarker(e.detail.code);
      }) as EventListener);

      // Listen for toggle event (eye button)
      this.airportPopup.getContainer().addEventListener('toggle-marker', ((e: CustomEvent) => {
        this.markerSystem.toggleMarker(e.detail.code, e.detail.show);
      }) as EventListener);

      // Listen for reset globe event (trash button)
      this.airportPopup.getContainer().addEventListener('reset-globe', (() => {
        this.resetGlobe();
      }) as EventListener);
    });
    this.markerSystem.setDomElement(this.renderer.domElement);

    // Kick off texture loading (async -- globe created on completion)
    this.loadTextures();
  }

  // -- Scene Setup

  private createScene(): void {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0a1a);

    // Tilted parent group for 23.4 degree axial tilt
    this.globeGroup = new THREE.Group();
    this.scene.add(this.globeGroup);

    // Marker group is a child of globe group so city markers rotate with the globe
    this.markerSystem = new MarkerSystem(1.0);
    this.globeGroup.add(this.markerSystem.getGroup());

    // Arc group is a child of globe group so arcs rotate with the globe
    this.arcGroup = new THREE.Group();
    this.globeGroup.add(this.arcGroup);

    // Packet system operates on the arc group
    this.packetSystem = new PacketSystem(this.arcGroup);
  }

  private createCamera(): void {
    const fov = 45;
    const aspect = window.innerWidth / window.innerHeight;
    const near = 0.1;
    const far = 20;
    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.camera.position.set(0, 0, 3.5);
  }

  private createRenderer(): void {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setClearColor(0x0a0a1a, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.mountPoint!.appendChild(this.renderer.domElement);
  }

  private createControls(): void {
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = false;
    this.controls.minDistance = 1.5;
    this.controls.maxDistance = 8;
    this.controls.autoRotate = false;
  }

  // -- Loading UI

  private createLoadingUI(): void {
    this.loadingEl = document.createElement('div');
    this.loadingEl.style.cssText = [
      'position: fixed',
      'top: 50%',
      'left: 50%',
      'transform: translate(-50%, -50%)',
      'color: #fff',
      'font-family: -apple-system, BlinkMacSystemFont, sans-serif',
      'font-size: 14px',
      'z-index: 1000',
      'text-align: center',
    ].join(';');
    this.loadingEl.innerHTML =
      '<div id="loading-text">Initializing Earth dashboard...</div>' +
      '<div id="loading-bar" style="margin-top:10px;width:200px;height:4px;background:#333;border-radius:2px;overflow:hidden;">' +
      '<div id="progress-fill" style="height:100%;background:#4a90d9;width:0%;transition:width 0.3s;"></div>' +
      '</div>';
    this.mountPoint!.appendChild(this.loadingEl);
  }

  private updateLoadingProgress(loaded: number, total: number): void {
    const percent = Math.round((loaded / total) * 100);
    const fill = this.loadingEl?.querySelector('#progress-fill') as HTMLElement;
    if (fill) fill.style.width = percent + '%';
    const text = this.loadingEl?.querySelector('#loading-text') as HTMLElement;
    if (text) text.textContent = 'Loading Earth textures... ' + loaded + '/' + total;
  }

  hideLoadingUI(): void {
    if (this.loadingEl) {
      this.loadingEl.style.opacity = '0';
      this.loadingEl.style.transition = 'opacity 0.5s';
      setTimeout(() => {
        this.mountPoint?.removeChild(this.loadingEl!);
        this.loadingEl = null;
      }, 500);
    }
    // Reveal all UI overlays once textures are loaded
    this.statCards.show();
    this.routeTicker.show();
    this.hudOverlay.show();
    this.airportPopup.hide();
  }

  // -- Texture Loading

  private async loadTextures(): Promise<void> {
    try {
      const textures = await this.textureLoader.loadAll(
        DEFAULT_TEXTURES,
        (progress) => {
          this.updateLoadingProgress(progress.loaded, progress.total);
        },
      );
      this.createGlobe(textures);
      this.createAtmosphere();
      this.createCityMarkers();
      this.latLonReadout.setGlobe(this.globe, this.globeGroup);
      this.initDataFeed();
      this.hideLoadingUI();
    } catch (error) {
      console.error('Failed to load textures:', error);
      const fallbackDay = this.textureLoader.createFallbackTexture(0x1a3a5c);
      const fallbackNight = this.textureLoader.createFallbackTexture(0x081a2c);
      this.createGlobe({ day: fallbackDay, night: fallbackNight, elevation: fallbackNight });
      this.createAtmosphere();
      this.createCityMarkers();
      this.latLonReadout.setGlobe(this.globe, this.globeGroup);
      this.initDataFeed();
      this.hideLoadingUI();
    }
  }

  // -- Globe Creation

  private createGlobe(textures: { day: THREE.Texture; night: THREE.Texture; elevation?: THREE.Texture }): void {
    const geometry = new THREE.SphereGeometry(1, 256, 128);

    this.terminatorMaterial = new TerminatorMaterial(textures, {
      radius: 1.0,
      terminatorWidth: 0.06,
      nightIntensity: 2.5,
      nightGlowMax: 0.9,
      displacementScale: 0.03,
      oceanThreshold: 0.3,
      specularIntensity: 0.8,
      shininess: 64,
      glitterIntensity: 0.6,
    });

    this.globe = new THREE.Mesh(geometry, this.terminatorMaterial);
    this.globeGroup.add(this.globe);

    // Apply 23.4 degree axial tilt to the entire GlobeGroup so the tilt
    // affects the globe texture, markers, arcs, and atmosphere equally.
    const AXIAL_TILT = THREE.MathUtils.degToRad(23.44);
    this.globeGroup.rotation.x = AXIAL_TILT;
  }

  // -- Atmosphere

  private createAtmosphere(): void {
    this.atmosphere = new Atmosphere(1.0, {
      glowColor: 0x4a90d9,
      intensity: 0.6,
      scale: 1.02,
      falloffPower: 3.5,
      sunDirection: new THREE.Vector3(0.5, 0.2, 0.8),
    });
    this.globeGroup.add(this.atmosphere);
  }

  // -- City Markers

  /**
   * Creates visual markers at each hub city's geographic position on the globe.
   * Uses latLonToSpherical to convert lat/lon/WGS84 coordinates to 3D positions,
   * the same function used for arc endpoints in ArcGenerator.
   */
  private createCityMarkers(): void {
    this.markerSystem.createAllMarkers(HUB_CITIES);
    // Highlight major international hubs across all continents:
    // Only top-tier international gateway airports with significant
    // passenger volumes and global route networks.
    this.markerSystem.highlightCities([
      // Middle East
      'DXB',  // Dubai — world's busiest international airport
      // Asia
      'PVG',  // Shanghai Pudong — Asia's largest international hub
      'PEK',  // Beijing Capital — major international gateway
      'ICN',  // Seoul Incheon — major Northeast Asia hub
      'SIN',  // Singapore Changi — Southeast Asia hub
      'HND',  // Tokyo Haneda — Japan's main international airport
      'DEL',  // Delhi — South Asia international hub
      // Asia-Pacific / Oceania
      'HND',  // Tokyo Haneda (duplicate for Asia-Pacific grouping clarity)
      'SYD',  // Sydney — Australia's main international gateway
      // North America (US)
      'ORD',  // Chicago O'Hare — major US international hub
      'LAX',  // Los Angeles — West Coast international gateway
      'JFK',  // New York JFK — primary US international airport
      // Europe
      'LHR',  // London Heathrow — Europe's busiest international hub
      'CDG',  // Paris Charles de Gaulle — major European hub
      'FRA',  // Frankfurt — major European cargo + passenger hub
      // Africa
      'JNB',  // Johannesburg — major Africa international hub
      'CPT',  // Cape Town — secondary South Africa international gateway
      // South America
      'GRU',  // São Paulo — Latin America's largest international hub
      'EZE',  // Buenos Aires — major South American international airport
    ]);
  }

  // -- Data Feed

  /**
   * Initializes the DataProvider and subscribes to route updates.
   *
   * The DataProvider runs in simulation mode by default, generating
   * realistic random routes between hub cities. Real-data mode can be
   * enabled by calling dataProvider.setApiEndpoint(url).
   */
  private initDataFeed(): void {
    // Shared arc material for all routes
    this.arcMaterial = new THREE.LineBasicMaterial({
      color: 0xff6b35,
      transparent: true,
      opacity: 0.5,
      linewidth: 2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    // DataProvider in simulation mode (real API fetch is available via setApiEndpoint)
    this.dataProvider = new DataProvider(true);

    // Subscribe to route updates — sync the 3D scene + all UI overlays
    this.dataProvider.subscribe((data, source) => {
      // Auto-reset when total flights hits the configurable threshold
      if (data.stats.totalFlights >= this.resetThreshold) {
        this.resetGlobe();
        this.dataProvider.reset();
        return; // Skip stale sync — resetGlobe + reset() already emitted an empty snapshot
      }

      this.dashboardData = data;
      this.syncRoutes(data.routes);
      this.statCards.update(data);
      this.routeTicker.update(data);
      this.hudOverlay.update(
        data,
        source,
        new Date(Date.now() * this.timeScale),
      );
    });

    this.dataProvider.start();
  }

  /**
   * Syncs the 3D scene's arcs with the incoming route list.
   * Adds new arcs, removes completed ones.
   */
  private syncRoutes(routes: FlightRoute[]): void {
    const incomingIds = new Set(routes.map((r) => r.id));

    // Remove arcs not in the incoming set
    for (const [id, entry] of this.arcEntries) {
      if (!incomingIds.has(id)) {
        this.removeArcEntry(id, entry);
      }
    }

    // Add new arcs
    for (const route of routes) {
      if (!this.arcEntries.has(route.id)) {
        this.addArcForRoute(route);
      }
    }
  }

  private addArcForRoute(route: FlightRoute): void {
    const arc = createGreatCircleArc(route.from, route.to, {
      radius: 1.0,
      altitude: 0.06,
      segments: 32,
      curveFactor: 1.0,
    });

    const line = createArcLine(arc, this.arcMaterial);
    line.userData = { routeId: route.id, from: route.from, to: route.to };
    this.arcGroup.add(line);

    this.arcEntries.set(route.id, { arc, line });
    this.packetSystem.addArc(arc);
  }

  private removeArcEntry(id: string, entry: ArcEntry): void {
    this.arcGroup.remove(entry.line);
    entry.line.geometry.dispose();
    this.arcEntries.delete(id);
    this.packetSystem.removeArc(entry.arc);
  }

  // -- Event Listeners

  private setupEventListeners(): void {
    window.addEventListener('resize', this.onResize);
  }

  /**
   * Binds user-input events to the camera demo so that any interaction
   * resets the idle timer or exits cinematic mode.
   */
  private setupCameraInput(): void {
    const dom = this.renderer.domElement;
    const onInput = () => this.cameraDemo.onUserInteraction();

    // Note: enablePan=false (set in createControls) already prevents right-click
    // from triggering camera pan, so right-drag is free for marker calibration.

    // Left click: stop cinematic mode (or reset idle timer)
    dom.addEventListener('mousedown', onInput);
    // Double click: restart cinematic tour
    dom.addEventListener('dblclick', () => {
      this.cameraDemo.startCinematic();
    });

    dom.addEventListener('touchstart', onInput);
    dom.addEventListener('wheel', onInput);

    // Escape key: reset globe when flight paths become saturated
    dom.setAttribute('tabindex', '0');
    dom.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.resetGlobe();
    });

    window.addEventListener('keydown', (e) => {
      // Any key press resets idle timer (or exits cinematic)
      if (e.key.length === 1 || e.key === ' ' || e.key === 'Escape') {
        onInput();
      }
    });
  }

  // -- Time-Driven Updates

  /**
   * Updates the sun direction, globe rotation, and all animated systems.
   */
  private updateTime(delta: number): void {
    if (!this.terminatorMaterial) return;

    // Compute simulated time for sun position
    const simulatedDate = new Date(Date.now() * this.timeScale);

    // Update sun direction in the terminator shader
    const sunDir = computeSunDirection(simulatedDate);
    this.terminatorMaterial.setSunDirection(sunDir);
    this.terminatorMaterial.updateTime(this.clock.elapsedTime);

    // Update atmosphere glow (sun direction + time)
    if (this.atmosphere) {
      this.atmosphere.setSunDirection(sunDir);
      this.atmosphere.updateTime(this.clock.elapsedTime);
    }

    // Rotate the globe on its tilted axis for daily rotation
    if (this.isTimeDriven) {
      const rotationRate = (2 * Math.PI) / (24 * 60 * 60 / this.timeScale);
      this.globeGroup.rotation.y += rotationRate * delta;
    }
  }

  start(): void {
    if (this.animationId) return;
    this.setupCameraInput();
    this.animate();
  }

  stop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    this.dataProvider?.stop();
    this.markerSystem?.dispose();
    this.latLonReadout?.dispose();
    this.airportPopup?.dispose();
    this.statCards?.dispose();
    this.routeTicker?.dispose();
    this.hudOverlay?.dispose();
  }

  private animate = (): void => {
    const delta = this.clock.getDelta();

    // Update time-driven rotation and sun direction
    this.updateTime(delta);

    // Update animated packets
    this.packetSystem.update(delta);

    // Update cinematic camera demo
    this.cameraDemo.update(delta);

    // Billboard city label sprites to face the camera
    this.markerSystem.update();

    this.controls.update();
    this.renderer.render(this.scene, this.camera);

    this.animationId = requestAnimationFrame(this.animate);
  };

  // -- Resize

  private onResize = (): void => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  };

  // -- Public API for other modules

  /** Gets the scene for adding UI meshes, atmosphere, etc. */
  getScene(): THREE.Scene { return this.scene; }
  /** Gets the globe group (tilted, rotating). */
  getGlobeGroup(): THREE.Group { return this.globeGroup; }
  /** Gets the globe mesh. */
  getGlobe(): THREE.Mesh { return this.globe; }
  /** Gets the arc group for adding/modifying flight paths. */
  getArcGroup(): THREE.Group { return this.arcGroup; }
  /** Gets the marker system for city dots and labels. */
  getMarkerSystem(): MarkerSystem { return this.markerSystem; }
  /** Gets the renderer for shader uniforms and capabilities. */
  getRenderer(): THREE.WebGLRenderer { return this.renderer; }
  /** Gets the packet system for managing animated flow. */
  getPacketSystem(): PacketSystem { return this.packetSystem; }
  /** Gets the cinematic camera demo controller. */
  getCameraDemo(): CameraDemo { return this.cameraDemo; }
  /** Gets the data provider for live/simulated flight data. */
  getDataProvider(): DataProvider { return this.dataProvider; }
  /** Gets the latest dashboard data for UI consumption. */
  getLatestData(): DashboardData | null { return this.dashboardData; }
  /** Sets the time scale for simulation (1=realtime, 60=1min=1day, etc). */
  setTimeScale(scale: number): void { this.timeScale = scale; }
  /** Resets the globe visualization by clearing all arcs and packets. */
  resetGlobe(): void {
    // Remove all arc entries
    const entriesCopy = new Map(this.arcEntries);
    for (const [id, entry] of entriesCopy) {
      this.removeArcEntry(id, entry);
    }
    this.arcEntries.clear();

    // Clear all packets
    this.packetSystem.clear();

    // Reset dashboard data reference
    this.dashboardData = null;
  }
}
