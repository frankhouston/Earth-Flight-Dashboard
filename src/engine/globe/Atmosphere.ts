import * as THREE from 'three';

/**
 * Atmospheric glow shell.
 *
 * Renders a slightly-larger transparent sphere around the globe with an
 * additive-blend shader that simulates Rayleigh scattering. The glow
 * is strongest at the limb (edge-on view) and fades smoothly.
 *
 * This is a standalone pass -- the globe itself is self-lit and does not
 * use scene lighting. The atmosphere provides the characteristic blue
 * "limb glow" seen in satellite imagery and space photography.
 */

export interface AtmosphereOptions {
  /** Color of the atmospheric glow (blue-ish by default) */
  glowColor?: THREE.ColorRepresentation;
  /** Intensity of the glow */
  intensity?: number;
  /** Radius multiplier -- how much larger than the globe */
  scale?: number;
  /** Falloff exponent -- higher = tighter glow at limb */
  falloffPower?: number;
  /** Sun direction for directional glow (terminator-aligned) */
  sunDirection?: THREE.Vector3;
}

export class Atmosphere extends THREE.Mesh {
  public glowColor: THREE.Color;
  public intensity: number;
  public falloffPower: number;
  public sunDirection: THREE.Vector3;

  constructor(
    globeRadius: number,
    options: AtmosphereOptions = {},
  ) {
    const {
      glowColor = 0x4a90d9,
      intensity = 0.8,
      scale = 1.02,
      falloffPower = 3.0,
      sunDirection = new THREE.Vector3(0.5, 0.2, 0.8),
    } = options;

    // Geometry: slightly inflated sphere
    const geometry = new THREE.SphereGeometry(1, 256, 128);

    // Shader material with additive blending for glow effect
    const material = new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide, // Render only the back faces for glow at limb
      depthWrite: false,     // Don't write to depth buffer
      uniforms: {
        glowColor: { value: new THREE.Color(glowColor) },
        intensity: { value: intensity },
        falloffPower: { value: falloffPower },
        sunDirection: { value: sunDirection.clone().normalize() },
        time: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec3 vViewDirection;

        void main() {
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          vViewDirection = normalize(cameraPosition - vWorldPosition);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 glowColor;
        uniform float intensity;
        uniform float falloffPower;
        uniform vec3 sunDirection;
        uniform float time;

        varying vec3 vWorldNormal;
        varying vec3 vWorldPosition;
        varying vec3 vViewDirection;

        void main() {
          // Fresnel term: 1.0 at limb (grazing angle), 0.0 at center
          float fresnel = pow(1.0 - abs(dot(vWorldNormal, vViewDirection)), falloffPower);

          // Sun-aligned glow: enhance near the terminator for realism
          float sunAngle = dot(vWorldNormal, normalize(sunDirection));
          // The atmosphere glows most at the terminator (sunAngle ~ 0)
          float terminatorGlow = pow(1.0 - abs(sunAngle), 2.0) * 0.5 + 0.5;

          float alpha = fresnel * intensity * terminatorGlow;

          // Add subtle time-based flicker for organic feel (very subtle)
          alpha *= 1.0 + sin(vWorldPosition.x * 10.0 + time * 0.5) * 0.02;

          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
    });

    // Scale the geometry to be slightly larger than the globe
    geometry.scale(scale, scale, scale);

    super(geometry, material);

    this.glowColor = new THREE.Color(glowColor);
    this.intensity = intensity;
    this.falloffPower = falloffPower;
    this.sunDirection = sunDirection.clone().normalize();

    // Store references for updates
    this.userData.uniforms = material.uniforms;
    this.userData.material = material;
  }

  /**
   * Updates the sun direction in the shader.
   * Call this when the globe's sun direction changes.
   */
  setSunDirection(direction: THREE.Vector3): void {
    this.sunDirection.copy(direction).normalize();
    const uniforms = this.userData.uniforms;
    if (uniforms) {
      uniforms['sunDirection'].value = this.sunDirection;
    }
  }

  /**
   * Updates the time uniform for animated effects.
   */
  updateTime(time: number): void {
    const uniforms = this.userData.uniforms;
    if (uniforms) {
      uniforms['time'].value = time;
    }
  }

  /**
   * Sets the glow color.
   */
  setGlowColor(color: THREE.ColorRepresentation): void {
    this.glowColor.set(color);
    const uniforms = this.userData.uniforms;
    if (uniforms) {
      uniforms['glowColor'].value = this.glowColor;
    }
  }

  /**
   * Sets the glow intensity.
   */
  setIntensity(value: number): void {
    this.intensity = value;
    const uniforms = this.userData.uniforms;
    if (uniforms) {
      uniforms['intensity'].value = value;
    }
  }

  /**
   * Enables or disables the atmosphere glow.
   */
  setVisible(visible: boolean): void {
    this.visible = visible;
  }
}
