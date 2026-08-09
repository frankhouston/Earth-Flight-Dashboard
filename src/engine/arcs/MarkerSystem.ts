/**
 * City marker system — places visual dots and labels at each hub city's
 * geographic position on the globe surface.
 *
 * Each marker consists of:
 *   • A colored dot (small sphere, slightly elevated to avoid z-fighting)
 *   • A transparent glow sphere behind the dot for a soft emissive halo
 *   • A billboard label sprite showing the IATA code, always facing the camera
 *
 * Dot colors are coded by hub type:
 *   - Passenger  → blue   (#4a90d9)
 *   - Cargo      → amber  (#ff9800)
 *   - Mixed      → purple (#9b59f0)
 *
 * Scene hierarchy:
 *   GlobeGroup
 *     └── MarkerGroup (this system)
 *         └── MarkerGroup (per city)
 *             ├── Dot mesh
 *             ├── Glow mesh
 *             └── Label sprite
 */
import * as THREE from 'three';
import { HubCity } from '@/data/cities';
import { latLonToSpherical } from '@/engine/arcs/ArcGenerator';

const DOT_RADIUS = 0.018;
const GLOW_RADIUS = 0.045;
const LABEL_SCALE_X = 0.09;
const LABEL_SCALE_Y = 0.024;
const ELEVATION = 1.012; // dot slightly above surface to avoid z-fighting

/**
 * Per-city latitude offsets for marker positioning only (does not affect
 * arc endpoints or geographic data). Used to prevent visual clutter when
 * nearby airports' markers overlap at certain globe orientations.
 * Offset is in degrees latitude; positive values nudge markers northward.
 */
const MARKER_LAT_OFFSETS: Record<string, number> = {
  // Central Asia: Tashkent marker visually overlaps with Nur-Sultan (NQZ);
  // shift slightly north for visual separation
  'TAS': 2.5,
};

const TYPE_COLORS: Record<HubCity['type'], number> = {
  passenger: 0x4a90d9, // blue
  cargo: 0xff9800, // amber
  mixed: 0x9b59f0, // purple
};

interface MarkerEntry {
  group: THREE.Group;
  dot: THREE.Mesh;
  glow: THREE.Mesh;
  label: THREE.Sprite;
  city: HubCity;
  basePos: THREE.Vector3;
}

export class MarkerSystem {
  private group: THREE.Group;
  private markers: Map<string, MarkerEntry> = new Map();
  private radius: number;
  private dotGeometry: THREE.SphereGeometry;
  private glowGeometry: THREE.SphereGeometry;
  private dotMaterials: Map<HubCity['type'], THREE.MeshBasicMaterial> = new Map();
  private highlightMaterial: THREE.MeshBasicMaterial;
  private glowMaterial: THREE.MeshBasicMaterial;
  private spriteMaterial: THREE.SpriteMaterial;
  private camera: THREE.Camera | null = null;
  private markerClickCallback: ((city: HubCity) => void) | null = null;
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouse: THREE.Vector2 = new THREE.Vector2();
  private domElement: HTMLElement | null = null;

  constructor(radius: number = 1.0) {
    this.radius = radius;
    this.group = new THREE.Group();
    this.group.name = 'CityMarkers';

    this.dotGeometry = new THREE.SphereGeometry(DOT_RADIUS, 16, 16);
    this.glowGeometry = new THREE.SphereGeometry(GLOW_RADIUS, 16, 16);

    this.glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      side: THREE.BackSide,
      toneMapped: false,
    });

    this.spriteMaterial = new THREE.SpriteMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      toneMapped: false,
    });

    // Gold highlight material for highlighted hub cities
    this.highlightMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      toneMapped: false,
    });
  }

  /** Gets the container group to add to the scene. */
  getGroup(): THREE.Group {
    return this.group;
  }

  /** Stores a reference to the camera for label billboarding. */
  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  /** Sets the DOM element for mouse interaction. */
  setDomElement(dom: HTMLElement): void {
    this.domElement = dom;
    dom.addEventListener('click', this.onMarkerClick);
  }

  /** Callback when a marker is clicked. */
  setOnMarkerClick(callback: (city: HubCity) => void): void {
    this.markerClickCallback = callback;
  }

  /** Creates markers for all hub cities. */
  createAllMarkers(cities: readonly HubCity[]): void {
    for (const city of cities) {
      this.createMarker(city);
    }
  }

  /** Gets the dot material for a given hub type, creating it on demand. */
  private getDotMaterial(type: HubCity['type']): THREE.MeshBasicMaterial {
    let mat = this.dotMaterials.get(type);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({
        color: TYPE_COLORS[type],
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        toneMapped: false,
      });
      this.dotMaterials.set(type, mat);
    }
    return mat;
  }

  /** Creates a single city marker at the given geographic position. */
  createMarker(city: HubCity): void {
    if (this.markers.has(city.code)) return;

    const markerGroup = new THREE.Group();
    markerGroup.name = `marker-${city.code}`;

    // Position on the globe surface. Apply a per-city lat offset (if any) to
    // avoid visual clutter with nearby markers; this does NOT change the
    // underlying geographic coordinates used for arc endpoints.
    const displayLat = city.lat + (MARKER_LAT_OFFSETS[city.code] ?? 0);
    const surfacePos = latLonToSpherical(displayLat, city.lon, this.radius);

    // Dot at the surface, slightly elevated to avoid z-fighting with the globe
    const dot = new THREE.Mesh(this.dotGeometry, this.getDotMaterial(city.type));
    dot.position.copy(surfacePos).multiplyScalar(ELEVATION);

    // Glow sphere (BackSide so it renders as a soft shell behind the dot)
    const glow = new THREE.Mesh(this.glowGeometry, this.glowMaterial);
    glow.position.copy(surfacePos).multiplyScalar(ELEVATION);

    // Label sprite (billboard, always faces camera)
    const label = this.createLabelSprite(city.code);
    label.position.copy(surfacePos).multiplyScalar(ELEVATION + 0.045);

    markerGroup.add(glow);
    markerGroup.add(dot);
    markerGroup.add(label);

    this.group.add(markerGroup);
    this.markers.set(city.code, { group: markerGroup, dot, glow, label, city, basePos: surfacePos.clone() });
  }

  /** Creates a billboard sprite texture with the city's IATA code. */
  private createLabelSprite(code: string): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Measure text first
    ctx.font = 'bold 12px "SF Mono", -apple-system, BlinkMacSystemFont, "Segoe UI", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const textMetrics = ctx.measureText(code);
    const padding = 8;
    canvas.width = Math.ceil(textMetrics.width) + padding * 2;
    canvas.height = 28;

    // Background pill
    ctx.fillStyle = 'rgba(10, 10, 26, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    roundRect(ctx, 0, 0, canvas.width, canvas.height, 6);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(code, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;

    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });

    const sprite = new THREE.Sprite(material);
    sprite.scale.set(LABEL_SCALE_X, LABEL_SCALE_Y, 1);

    return sprite;
  }

  /**
   * Updates label sprites to always face the camera (billboard effect).
   * Should be called each frame after camera movement.
   */
  update(): void {
    if (!this.camera) return;

    for (const entry of this.markers.values()) {
      // Copy camera quaternion so sprite always faces the camera
      entry.label.quaternion.copy(this.camera.quaternion);
    }
  }

  /**
   * Highlights specific cities (e.g. HND + NRT) with a bright gold dot and
   * larger scale. Non-highlighted cities revert to their default appearance.
   */
  highlightCities(codes: string[]): void {
    for (const [, entry] of this.markers) {
      const isHighlighted = codes.includes(entry.city.code);
      if (isHighlighted) {
        entry.dot.material = this.highlightMaterial;
        entry.dot.scale.setScalar(1.8);
        (entry.label.material as THREE.SpriteMaterial).color.setHex(0xffd700);
      } else {
        entry.dot.material = this.getDotMaterial(entry.city.type);
        entry.dot.scale.setScalar(1.0);
        (entry.label.material as THREE.SpriteMaterial).color.setHex(0xffffff);
      }
    }
  }


  /** Handles mouse click on a marker. */
  private onMarkerClick = (event: MouseEvent): void => {
    if (!this.camera || !this.domElement || !this.markerClickCallback) return;

    // Convert screen coords to normalized device coordinates
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast against all marker dots
    const markerDots: THREE.Object3D[] = [];
    for (const entry of this.markers.values()) {
      markerDots.push(entry.dot);
    }

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObjects(markerDots, false);

    if (intersects.length > 0) {
      const clickedDot = intersects[0].object;
      for (const entry of this.markers.values()) {
        if (entry.dot === clickedDot || entry.group === clickedDot.parent) {
          this.markerClickCallback(entry.city);
          break;
        }
      }
    }
  };

  /** Hides all marker labels (dots remain visible). */
  hideLabels(): void {
    for (const [, entry] of this.markers) {
      entry.label.visible = false;
    }
  }

  /** Shows all marker labels. */
  showLabels(): void {
    for (const [, entry] of this.markers) {
      entry.label.visible = true;
    }
  }

  /** Hides a marker by its city code. */
  hideMarker(code: string): void {
    const entry = this.markers.get(code);
    if (entry) {
      entry.group.visible = false;
    }
  }

  /** Shows a hidden marker by its city code. */
  showMarker(code: string): void {
    const entry = this.markers.get(code);
    if (entry) {
      entry.group.visible = true;
    }
  }

  /** Toggles marker visibility by city code. */
  toggleMarker(code: string, show: boolean): void {
    const entry = this.markers.get(code);
    if (entry) {
      entry.group.visible = show;
    }
  }

  /** Dims markers for cinematic mode. */
  dim(): void {
    for (const [, entry] of this.markers) {
      (entry.dot.material as THREE.MeshBasicMaterial).opacity = 0.4;
      (entry.label.material as THREE.SpriteMaterial).opacity = 0.3;
    }
  }

  /** Restores markers after cinematic mode. */
  undim(): void {
    for (const [, entry] of this.markers) {
      (entry.dot.material as THREE.MeshBasicMaterial).opacity = 0.9;
      (entry.label.material as THREE.SpriteMaterial).opacity = 1.0;
    }
  }

  /** Disposes of all geometry and materials. */
  dispose(): void {
    for (const [, entry] of this.markers) {
      entry.group.clear();
      (entry.label.material as THREE.SpriteMaterial).dispose();
      (entry.label.material as THREE.SpriteMaterial).map?.dispose();
    }
    this.markers.clear();
    this.dotGeometry.dispose();
    this.glowGeometry.dispose();
    this.glowMaterial.dispose();
    this.spriteMaterial.dispose();
    this.highlightMaterial.dispose();
    for (const mat of this.dotMaterials.values()) {
      mat.dispose();
    }
  }
}

/**
 * Draws a rounded rectangle path on a 2D canvas context.
 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
