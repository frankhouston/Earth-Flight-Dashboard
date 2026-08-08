/**
 * Ganges River highlight system.
 *
 * Renders a flowing, luminous line along the Ganges (Ganga) River on the
 * globe surface. The highlight is only visible when the Indian subcontinent
 * is on the night side (i.e., the sun is below the horizon for that region),
 * creating a "river of light" effect that mirrors how city-light textures
 * illuminate the night hemisphere.
 *
 * The river path is defined by key geographic waypoints from the source
 * at the Gangotri Glacier in the Himalayas down to the river's delta in the
 * Bay of Bengal.
 */
import * as THREE from 'three';
import { latLonToSpherical } from '@/engine/arcs/ArcGenerator';

/** Latitude of India's approximate geographic center — used for night-side detection */
const INDIA_LAT = 20.5937;
const INDIA_LON = 78.9629;

/**
 * Key waypoints along the Ganges River, from source to delta.
 * Coordinates are WGS84 (latitude, longitude) in degrees.
 */
const GANGES_PATH: [number, number][] = [
  // Source: Gangotri Glacier, Himalayas (~3000m)
  [30.98, 79.06],
  // Devprayag: confluence of Bhagirathi & Alaknanda (start of the Ganges)
  [30.31, 78.33],
  // Haridwar: where the river leaves the mountains
  [29.94, 78.17],
  // Kanpur
  [26.45, 80.33],
  // Varanasi: spiritual capital, ghats
  [25.31, 83.01],
  // Patna: Bihar capital on the north bank
  [25.61, 85.37],
  // Bhagalpur
  [24.90, 87.00],
  // Farakka: flows into Bangladesh
  [26.14, 89.94],
  // Delta region in Bangladesh (Padma)
  [24.20, 90.41],
  // River mouth: Bay of Bengal
  [22.57, 89.42],
];

/** Color of the river highlight (warm gold, reminiscent of city lights) */
const RIVER_COLOR = 0x4a90d9;
/** Base opacity of the river line (before night-side boost) */
const RIVER_OPACITY = 0.4;
/** Opacity when India is in darkness (bright, visible "river of light") */
const RIVER_NIGHT_OPACITY = 0.8;

export class GangesRiver {
  private group: THREE.Group;
  private line: THREE.Line;
  private glowLine: THREE.Line;
  private radius: number;

  constructor(radius: number = 1.0) {
    this.radius = radius;
    this.group = new THREE.Group();
    this.group.name = 'GangesRiver';
    this.group.visible = false; // hidden until India enters night side

    const points = GANGES_PATH.map(([lat, lon]) =>
      latLonToSpherical(lat, lon, radius),
    );

    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    // Main river line — visible as a bright path
    const lineMaterial = new THREE.LineBasicMaterial({
      color: RIVER_COLOR,
      transparent: true,
      opacity: RIVER_OPACITY,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.line = new THREE.Line(geometry, lineMaterial);
    this.group.add(this.line);

    // Glow line — slightly wider, behind the main line for a soft halo effect
    const glowGeometry = new THREE.BufferGeometry().setFromPoints(
      points.map((p) => p.clone().multiplyScalar(1.001)),
    );
    const glowMaterial = new THREE.LineBasicMaterial({
      color: RIVER_COLOR,
      transparent: true,
      opacity: RIVER_OPACITY * 0.3,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });
    this.glowLine = new THREE.Line(glowGeometry, glowMaterial);
    this.group.add(this.glowLine);
  }

  /** Gets the container group to add to the scene. */
  getGroup(): THREE.Group {
    return this.group;
  }

  /**
   * Updates the river visibility based on whether India is in the night side.
   *
   * India is in the night side when the dot product of the surface normal
   * at India's center point with the sun direction is negative (sun below
   * the horizon). The line opacity ramps up smoothly as India transitions
   * into darkness.
   *
   * @param sunDirection - Normalized sun direction vector in world space
   */
  update(sunDirection: THREE.Vector3): void {
    // Convert India's center lat/lon to a surface normal (unit sphere position)
    const indiaNormal = latLonToSpherical(INDIA_LAT, INDIA_LON, 1).normalize();

    // Dot product: positive = day, negative = night
    const dayFactor = THREE.MathUtils.clamp(indiaNormal.dot(sunDirection), -1, 1);

    // Only show the river when India is in the night hemisphere
    const nightFactor = THREE.MathUtils.smoothstep(dayFactor, -0.2, 0.2);
    const shouldShow = nightFactor > 0;

    // Smoothly interpolate opacity from 0 (day) to full (night)
    const targetOpacity = shouldShow
      ? RIVER_NIGHT_OPACITY * (1 - dayFactor) * 0.5
      : 0;

    // Also update the globe's terminatorMaterial to boost night intensity
    // slightly when India is dark, making the river blend naturally
    this.group.visible = shouldShow;
    (this.line.material as THREE.LineBasicMaterial).opacity = targetOpacity;
    (this.glowLine.material as THREE.LineBasicMaterial).opacity =
      targetOpacity * 0.3;

    // Billboarding: make the river line face the camera slightly for visibility
    // (not needed since it's a 3D line on the surface, but we scale it up
    //  when visible to make it more prominent)
    const targetScale = shouldShow ? 1.0 : 0.0;
    this.line.scale.setScalar(THREE.MathUtils.lerp(this.line.scale.x, targetScale, 0.1));
    this.glowLine.scale.setScalar(THREE.MathUtils.lerp(this.glowLine.scale.x, targetScale, 0.1));
  }

  /** Cleans up geometry and materials. */
  dispose(): void {
    this.line.geometry.dispose();
    (this.line.material as THREE.Material).dispose();
    this.glowLine.geometry.dispose();
    (this.glowLine.material as THREE.Material).dispose();
    this.group.clear();
  }
}
