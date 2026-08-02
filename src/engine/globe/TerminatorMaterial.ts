import * as THREE from 'three';

/**
 * Custom ShaderMaterial for the Earth globe that combines:
 * - Day (Blue Marble) / Night (city lights) texture blending with terminator
 * - Topographic relief displacement + shading (elevation-based)
 * - Ocean specular highlights + sun glitter
 *
 * All illumination is computed in-shader (self-lit) -- no scene lights.
 */

export interface TerminatorMaterialOptions {
  radius?: number;
  terminatorWidth?: number;
  nightIntensity?: number;
  nightGlowMax?: number;
  sunDirection?: THREE.Vector3;
  /** Elevation displacement strength (0 = flat, 0.02 = visible mountains) */
  displacementScale?: number;
  /** Elevation threshold below which a pixel is considered ocean */
  oceanThreshold?: number;
  /** Ocean specular highlight intensity */
  specularIntensity?: number;
  /** Ocean specular shininess (higher = tighter highlight) */
  shininess?: number;
  /** Sun glitter intensity */
  glitterIntensity?: number;
}

const DEFAULT_OPTIONS: Required<
  Omit<TerminatorMaterialOptions, 'radius' | 'sunDirection'>
> = {
  terminatorWidth: 0.04,
  nightIntensity: 1.5,
  nightGlowMax: 0.8,
  displacementScale: 0.025,
  oceanThreshold: 0.3,
  specularIntensity: 0.8,
  shininess: 64,
  glitterIntensity: 0.6,
};

export class TerminatorMaterial extends THREE.ShaderMaterial {
  public readonly sunDirection: THREE.Vector3;
  public terminatorWidth: number;
  public nightIntensity: number;
  public nightGlowMax: number;
  public displacementScale: number;
  public oceanThreshold: number;
  public specularIntensity: number;
  public shininess: number;
  public glitterIntensity: number;

  constructor(
    textures: {
      day: THREE.Texture;
      night: THREE.Texture;
      elevation?: THREE.Texture;
    },
    options: TerminatorMaterialOptions = {},
  ) {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    super({
      uniforms: {
        dayTexture: { value: textures.day },
        nightTexture: { value: textures.night },
        elevationTexture: { value: textures.elevation ?? TerminatorMaterial.createFallbackElevation() },
        sunDirection: { value: (opts.sunDirection ?? new THREE.Vector3(0.5, 0.2, 0.8)).clone() },
        terminatorWidth: { value: opts.terminatorWidth },
        nightIntensity: { value: opts.nightIntensity },
        nightGlowMax: { value: opts.nightGlowMax },
        displacementScale: { value: opts.displacementScale },
        oceanThreshold: { value: opts.oceanThreshold },
        specularIntensity: { value: opts.specularIntensity },
        shininess: { value: opts.shininess },
        glitterIntensity: { value: opts.glitterIntensity },
        time: { value: 0 },
      },
      vertexShader: /* glsl */ `
        uniform sampler2D elevationTexture;
        uniform float displacementScale;
        uniform float oceanThreshold;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec3 vViewDirection;
        varying float vElevation;
        varying float vOceanMask;

        void main() {
          vUv = uv;

          // Sample elevation texture for displacement (always available)
          float height = texture(elevationTexture, vUv).r;
          vElevation = height;

          // Ocean detection: low elevation = water
          vOceanMask = 1.0 - smoothstep(oceanThreshold - 0.02, oceanThreshold + 0.02, height);

          // Displace vertices along normal for topo relief
          // Scale displacement relative to globe size (subtle for realism)
          float displacement = height * displacementScale * 0.05;
          vec3 displacedPosition = position + normal * displacement;

          // Recompute world normal from displaced position
          vec3 worldPos = (modelMatrix * vec4(displacedPosition, 1.0)).xyz;
          vWorldPosition = worldPos;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vViewDirection = normalize(cameraPosition - worldPos);

          gl_Position = projectionMatrix * modelViewMatrix * vec4(displacedPosition, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform sampler2D elevationTexture;
        uniform vec3 sunDirection;
        uniform float terminatorWidth;
        uniform float nightIntensity;
        uniform float nightGlowMax;
        uniform float specularIntensity;
        uniform float shininess;
        uniform float glitterIntensity;
        uniform float time;

        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec3 vViewDirection;
        varying float vElevation;
        varying float vOceanMask;

        void main() {
          vec3 normal = normalize(vWorldNormal);
          vec3 viewDir = normalize(vViewDirection);
          vec3 sunDir = normalize(sunDirection);

          // ---- Day/Night Terminator ----
          float dayFactor = dot(normal, sunDir);
          float terminator = smoothstep(
            -terminatorWidth,
            terminatorWidth,
            dayFactor
          );

          // Sample day and night textures
          vec3 dayColor = texture(dayTexture, vUv).rgb;
          vec3 nightColor = texture(nightTexture, vUv).rgb;

          // Boost city lights in the night hemisphere
          float nightBoost = 1.0 + nightGlowMax * (1.0 - dayFactor);
          nightColor *= nightIntensity * nightBoost * (1.0 - terminator);

          // Blend day and night
          vec3 color = mix(nightColor, dayColor, terminator);

          // ---- Topo Relief Shading ----
          // Use elevation for subtle terrain shading
          // Higher elevations get slightly brighter (snow caps)
          float elevation = vElevation;
          float topoTint = 0.92 + elevation * 0.12;
          color *= topoTint;

          // ---- Ocean Specular + Glitter ----
          float isOcean = vOceanMask;

          if (isOcean > 0.01) {
            // Blinn-Phong specular highlight on ocean surfaces
            vec3 halfDir = normalize(sunDir + viewDir);
            float NdotH = max(0.0, dot(normal, halfDir));
            float specular = pow(NdotH, shininess);

            // Specular color (sun-like with slight warmth)
            vec3 specColor = vec3(1.0, 0.95, 0.85);
            color += specular * specularIntensity * isOcean * terminator * specColor;

            // ---- Sun Glitter ----
            // Glitter appears where the view direction aligns with the
            // sun's perfect reflection off the water surface
            vec3 reflectDir = reflect(-sunDir, normal);
            float viewReflect = dot(viewDir, reflectDir);
            float glitterMask = smoothstep(0.90, 1.0, viewReflect);

            // 3D noise for glitter pattern
            float noise = fract(sin(dot(vWorldPosition * 30.0 + time * 0.3, vec3(12.9898, 78.233, 45.543))) * 43758.5453);
            // Raise to high power for sparse, bright glitter
            float glitter = pow(noise, 25.0) * glitterMask * isOcean * glitterIntensity;

            color += glitter * specColor * 3.0;
          }

          // Clamp and apply terminator rim glow
          color = min(color, 1.0);
          float rimGlow = pow(1.0 - abs(dayFactor), 10.0) * 0.1;
          color += rimGlow * nightColor * (1.0 - terminator);

          gl_FragColor = vec4(color, 1.0);
        }
      `,
      transparent: false,
      side: THREE.FrontSide,
    });

    this.sunDirection = (opts.sunDirection ?? new THREE.Vector3(0.5, 0.2, 0.8)).clone();
    this.terminatorWidth = opts.terminatorWidth;
    this.nightIntensity = opts.nightIntensity;
    this.nightGlowMax = opts.nightGlowMax;
    this.displacementScale = opts.displacementScale;
    this.oceanThreshold = opts.oceanThreshold;
    this.specularIntensity = opts.specularIntensity;
    this.shininess = opts.shininess;
    this.glitterIntensity = opts.glitterIntensity;
  }

  // -- Setters that sync to shader uniforms

  setSunDirection(direction: THREE.Vector3): void {
    this.sunDirection.copy(direction).normalize();
    this.uniforms['sunDirection'].value = this.sunDirection;
  }

  setTerminatorWidth(width: number): void {
    this.terminatorWidth = width;
    this.uniforms['terminatorWidth'].value = width;
  }

  setNightIntensity(intensity: number): void {
    this.nightIntensity = intensity;
    this.uniforms['nightIntensity'].value = intensity;
  }

  setDisplacementScale(scale: number): void {
    this.displacementScale = scale;
    this.uniforms['displacementScale'].value = scale;
  }

  setOceanThreshold(threshold: number): void {
    this.oceanThreshold = threshold;
    this.uniforms['oceanThreshold'].value = threshold;
  }

  setSpecularIntensity(intensity: number): void {
    this.specularIntensity = intensity;
    this.uniforms['specularIntensity'].value = intensity;
  }

  setShininess(value: number): void {
    this.shininess = value;
    this.uniforms['shininess'].value = value;
  }

  setGlitterIntensity(intensity: number): void {
    this.glitterIntensity = intensity;
    this.uniforms['glitterIntensity'].value = intensity;
  }

  updateTime(time: number): void {
    this.uniforms['time'].value = time;
  }

  getElevationTexture(): THREE.Texture | null {
    return this.uniforms['elevationTexture'].value as THREE.Texture | null;
  }

  /**
   * Creates a 1x1 mid-gray fallback elevation texture.
   * Used when no elevation map is available.
   */
  static createFallbackElevation(): THREE.DataTexture {
    const texture = new THREE.DataTexture(
      new Uint8Array([128]),
      1,
      1,
      THREE.RedFormat,
      THREE.UnsignedByteType,
    );
    texture.needsUpdate = true;
    return texture;
  }
}

/**
 * Computes the sun direction vector for a given UTC time.
 *
 * Uses the standard astronomical approximation:
 * - Solar declination varies with the season (23.4 degree axial tilt)
 * - Hour angle progresses through the day (15 degrees/hour)
 *
 * @param utcTime - UTC timestamp
 * @param daysSinceVernalEquinox - days since March 21 (default: calculated)
 * @returns Normalized sun direction in world space (pointing toward the sun)
 */
export function computeSunDirection(
  utcTime: Date,
  daysSinceVernalEquinox?: number,
): THREE.Vector3 {
  const AXIAL_TILT_DEG = 23.44;

  // Calculate day of year
  const start = Date.UTC(utcTime.getUTCFullYear(), 0, 1);
  const today = Date.UTC(
    utcTime.getUTCFullYear(),
    utcTime.getUTCMonth(),
    utcTime.getUTCDate(),
  );
  const dayOfYear = (today - start) / (1000 * 60 * 60 * 24) + 1;

  // Days since vernal equinox (~March 21 = day 80)
  const n = daysSinceVernalEquinox ?? (dayOfYear - 80);

  // Solar declination (seasonal axial tilt effect)
  const declination = THREE.MathUtils.degToRad(AXIAL_TILT_DEG) *
    Math.sin((2 * Math.PI * (n + 10)) / 365);

  // Hour angle: sun moves 360 degrees in 24 hours = 15 degrees/hour
  const hours = utcTime.getUTCHours() +
    utcTime.getUTCMinutes() / 60 +
    utcTime.getUTCSeconds() / 3600;
  const hourAngle = THREE.MathUtils.degToRad((hours - 12) * 15);

  // Convert to 3D direction vector pointing toward the sun
  const x = Math.cos(declination) * Math.sin(hourAngle);
  const y = Math.sin(declination);
  const z = Math.cos(declination) * Math.cos(hourAngle);

  return new THREE.Vector3(x, y, z).normalize();
}
