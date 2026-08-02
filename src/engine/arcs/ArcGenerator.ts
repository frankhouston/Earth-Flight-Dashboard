import * as THREE from 'three';
import { HubCity } from '@/data/cities';

/**
 * Generates great-circle arc geometry between two geographic coordinates.
 *
 * Converts lat/lon to 3D Cartesian positions on a sphere, then creates
 * a smooth arc that lifts above the surface to form the characteristic
 * "great circle route" visualization used in flight dashboards.
 */

export interface ArcOptions {
  /** Radius of the globe */
  radius: number;
  /** Height above the surface at the arc's apex (in same units as radius) */
  altitude: number;
  /** Number of points along the curve (higher = smoother) */
  segments: number;
  /** Curvature of the arc -- controls how far above the great circle it bows */
  curveFactor: number;
}

export interface ArcGeometry {
  /** The 3D curve for positioning packets */
  curve: THREE.CatmullRomCurve3;
  /** The points along the curve (for rendering the arc line) */
  points: THREE.Vector3[];
  /** Total arc length in world units */
  length: number;
  /** Source city */
  from: HubCity;
  /** Destination city */
  to: HubCity;
}

const DEFAULT_OPTIONS: ArcOptions = {
  radius: 1.0,
  altitude: 0.08,
  segments: 64,
  curveFactor: 1.0,
};

/**
 * Converts geographic latitude/longitude to a 3D Cartesian position
 * on a sphere of the given radius.
 *
 * Uses standard lat/lon to Cartesian conversion:
 *   x = R * cos(lat) * cos(lon)
 *   y = R * cos(lat) * sin(lon)
 *   z = R * sin(lat)
 *
 * @param lat - Latitude in degrees (-90 to 90)
 * @param lon - Longitude in degrees (-180 to 180)
 * @param radius - Sphere radius
 */
export function latLonToCartesian(
  lat: number,
  lon: number,
  radius: number,
): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat); // Colatitude (from +Y axis)
  const theta = THREE.MathUtils.degToRad(lon); // Longitude

  const x = radius * Math.sin(phi) * Math.sin(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.cos(theta);

  return new THREE.Vector3(x, y, z);
}

/**
 * Converts geographic lat/lon to a 3D Cartesian position using
 * an alternative convention where +Z points to lat=0, lon=0 (sub-solar point
 * aligned with +Z for the Earth texture mapping).
 *
 * This matches the typical Three.js globe orientation where:
 *   - North pole is at +Y
 *   - Prime meridian (0deg lon) faces +Z
 *   - The "front" of a standard world map
 *
 * @param lat - Latitude in degrees (-90 to 90)
 * @param lon - Longitude in degrees (-180 to 180)
 * @param radius - Sphere radius
 */
export function latLonToSpherical(
  lat: number,
  lon: number,
  radius: number,
): THREE.Vector3 {
  const latRad = THREE.MathUtils.degToRad(lat);
  const lonRad = THREE.MathUtils.degToRad(lon);

  const x = radius * Math.cos(latRad) * Math.sin(lonRad);
  const y = radius * Math.sin(latRad);
  const z = radius * Math.cos(latRad) * Math.cos(lonRad);

  return new THREE.Vector3(x, y, z);
}

/**
 * Computes the great-circle midpoint between two lat/lon coordinates
 * on the sphere's surface.
 */
function greatCircleMidpoint(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  radius: number,
): THREE.Vector3 {
  // Convert both points to Cartesian
  const p1 = latLonToSpherical(fromLat, fromLon, 1);
  const p2 = latLonToSpherical(toLat, toLon, 1);

  // Slerp midpoint on the unit sphere, then scale to radius
  const mid = new THREE.Vector3().addVectors(p1, p2).normalize();
  return mid.multiplyScalar(radius);
}

/**
 * Generates a great-circle arc between two hub cities.
 *
 * The arc is constructed as a Catmull-Rom curve through 3 control points:
 * 1. The source city (on the surface)
 * 2. The great-circle midpoint, lifted above the surface
 * 3. The destination city (on the surface)
 *
 * For a more accurate great-circle, the midpoint is computed as the
 * normalized sum of the two vectors, then lifted by `altitude`.
 */
export function createGreatCircleArc(
  from: HubCity,
  to: HubCity,
  options?: Partial<ArcOptions>,
): ArcGeometry {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const { radius, altitude, segments, curveFactor } = opts;

  // Convert cities to 3D positions on the surface
  const fromPos = latLonToSpherical(from.lat, from.lon, radius);
  const toPos = latLonToSpherical(to.lat, to.lon, radius);

  // Compute the great-circle midpoint on the surface
  const midSurface = greatCircleMidpoint(
    from.lat,
    from.lon,
    to.lat,
    to.lon,
    radius,
  );

  // Lift the midpoint above the surface for arc effect
  const midDir = midSurface.clone().normalize();
  const arcMid = midDir.multiplyScalar(radius + altitude * curveFactor);

  // For antipodal or very close points, the midpoint can be near zero.
  // Fall back to a higher arc in those cases.
  if (arcMid.lengthSq() < 0.001) {
    const fallbackDir = new THREE.Vector3(0, 1, 0);
    arcMid.copy(fallbackDir).multiplyScalar(radius + altitude * curveFactor);
  }

  // Create the curve
  const points = [fromPos, arcMid, toPos];
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom');
  curve.arcLengthDivisions = segments;

  // Generate evenly-spaced points along the curve
  const samplePoints: THREE.Vector3[] = [];
  const length = curve.getLength();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    samplePoints.push(curve.getPointAt(t));
  }

  return {
    curve,
    points: samplePoints,
    length,
    from,
    to,
  };
}

/**
 * Creates a THREE.Line from arc points for rendering.
 * Returns a line mesh with the given material.
 */
export function createArcLine(
  arc: ArcGeometry,
  material: THREE.Material,
): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(arc.points);
  const line = new THREE.Line(geometry, material);
  return line;
}

/**
 * Gets the 3D position on an arc for a given progress (0..1).
 */
export function getPositionOnArc(
  arc: ArcGeometry,
  progress: number,
): THREE.Vector3 {
  return arc.curve.getPointAt(Math.max(0, Math.min(1, progress)));
}
