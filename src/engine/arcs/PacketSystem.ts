import * as THREE from 'three';
import { ArcGeometry, getPositionOnArc } from '@/engine/arcs/ArcGenerator';

/**
 * Animated packet flow along great-circle arcs.
 *
 * Creates glowing particles (packets) that flow along arc curves at a
 * consistent speed, simulating data/traffic movement. Packets fade in/out
 * at their start and end points for a smooth trail effect.
 *
 * Uses a pool-based approach for performance: packets are reused rather
 * than garbage-collected, keeping GC pressure minimal for 60fps.
 */

export interface PacketSystemOptions {
  /** How many packets to spawn per arc */
  packetsPerArc?: number;
  /** Base speed in arc-length units per second */
  baseSpeed?: number;
  /** Speed variation -- randomness factor (0 = uniform) */
  speedVariance?: number;
  /** Size of each packet sprite */
  packetSize?: number;
  /** Color of the packets */
  color?: THREE.ColorRepresentation;
  /** How long packets take to fade in/out at endpoints (in arc progress 0..1) */
  fadeDuration?: number;
}

const DEFAULT_OPTIONS: PacketSystemOptions = {
  packetsPerArc: 5,
  baseSpeed: 0.15, // 0 to 1 progress per second for a typical arc
  speedVariance: 0.3,
  packetSize: 0.025,
  color: 0xff6b35,
  fadeDuration: 0.08,
};

interface Packet {
  /** Progress along the arc (0 = start, 1 = end) */
  progress: number;
  /** Speed in progress-units per second */
  speed: number;
  /** Size multiplier */
  size: number;
  /** Sprite mesh reference */
  sprite: THREE.Sprite;
  /** Current arc this packet belongs to */
  arc: ArcGeometry | null;
  /** Whether this packet is active */
  active: boolean;
}

/**
 * Manages animated packets flowing along great-circle arcs.
 * Attach to the scene's arc group and call update() in the render loop.
 */
export class PacketSystem {
  private parent: THREE.Object3D;
  private options: Required<Omit<PacketSystemOptions, 'color'>> & {
    color: THREE.Color;
  };
  private packets: Packet[] = [];
  private spriteMaterial: THREE.SpriteMaterial;
  private clock: THREE.Clock = new THREE.Clock();
  private activeArcs: ArcGeometry[] = [];

  constructor(
    parent: THREE.Object3D,
    options: PacketSystemOptions = {},
  ) {
    this.parent = parent;
    this.options = {
      packetsPerArc: options.packetsPerArc ?? 3,
      baseSpeed: options.baseSpeed ?? 0.15,
      speedVariance: options.speedVariance ?? 0.3,
      packetSize: options.packetSize ?? 0.03,
      color: new THREE.Color(options.color ?? 0xff6b35),
      fadeDuration: options.fadeDuration ?? 0.08,
    };

    // Sprite material for packets -- additive blending for glow
    this.spriteMaterial = new THREE.SpriteMaterial({
      color: this.options.color,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    // Create sprite texture (simple circle)
    this.spriteMaterial.map = this.createSpriteTexture();
  }

  /**
   * Creates a simple circular sprite texture for packets.
   * White circle with soft edges for additive glow effect.
   */
  private createSpriteTexture(): THREE.CanvasTexture {
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // Radial gradient for soft circle
    const gradient = ctx.createRadialGradient(
      size / 2, size / 2, 0,
      size / 2, size / 2, size / 2,
    );
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.4, 'rgba(255, 107, 53, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 107, 53, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  /**
   * Registers an arc for packet flow.
   * Packets will be spawned along this arc.
   */
  addArc(arc: ArcGeometry): void {
    this.activeArcs.push(arc);
    this.spawnPacketsForArc(arc);
  }

  /**
   * Removes an arc from packet flow.
   */
  removeArc(arc: ArcGeometry): void {
    const index = this.activeArcs.indexOf(arc);
    if (index >= 0) this.activeArcs.splice(index, 1);
  }

  /**
   * Clears all active arcs and deactivates all packets without
   * disposing materials. Useful for resetting the visualization
   * when the globe becomes saturated.
   */
  clear(): void {
    this.activeArcs = [];
    for (const packet of this.packets) {
      packet.active = false;
      packet.arc = null;
      this.parent.remove(packet.sprite);
    }
  }

  /**
   * Spawns the initial set of packets for an arc.
   */
  private spawnPacketsForArc(arc: ArcGeometry): void {
    for (let i = 0; i < this.options.packetsPerArc; i++) {
      const packet = this.getOrCreatePacket();
      packet.arc = arc;
      packet.active = true;
      packet.progress = (i / this.options.packetsPerArc) * (1 - this.options.fadeDuration * 2);
      packet.speed = this.options.baseSpeed * (1 + (Math.random() * 2 - 1) * this.options.speedVariance);
      packet.size = 0.8 + Math.random() * 0.4; // Size variation
      packet.sprite.scale.setScalar(this.options.packetSize * packet.size);

      this.parent.add(packet.sprite);
    }
  }

  /**
   * Gets a packet from the pool, or creates a new one.
   */
  private getOrCreatePacket(): Packet {
    // Find an inactive packet to reuse
    for (const packet of this.packets) {
      if (!packet.active) {
        return packet;
      }
    }

    // Create new packet
    const sprite = new THREE.Sprite(this.spriteMaterial);
    sprite.center.set(0.5, 0.5);
    sprite.renderOrder = 10; // Render above arcs

    const packet: Packet = {
      progress: 0,
      speed: this.options.baseSpeed,
      size: 1,
      sprite,
      arc: null,
      active: false,
    };
    this.packets.push(packet);
    return packet;
  }

  /**
   * Updates all packets -- call in the render loop.
   */
  update(deltaTime: number): void {
    for (const packet of this.packets) {
      if (!packet.active || !packet.arc) continue;

      // Advance packet along arc
      packet.progress += packet.speed * deltaTime;

      // Reset packet when it reaches the end
      if (packet.progress >= 1.0) {
        packet.progress = 0;
      }

      // Position the sprite on the arc
      const position = getPositionOnArc(packet.arc, packet.progress);
      packet.sprite.position.copy(position);

      // Fade in/out at endpoints
      const fadeStart = this.options.fadeDuration;
      const fadeEnd = 1.0 - this.options.fadeDuration;
      let alpha: number;

      if (packet.progress < fadeStart) {
        alpha = packet.progress / fadeStart;
      } else if (packet.progress > fadeEnd) {
        alpha = (1.0 - packet.progress) / fadeStart;
      } else {
        alpha = 1.0;
      }

      // Set sprite opacity (Three.js auto-uploads changed uniforms)
      if (packet.sprite.material instanceof THREE.SpriteMaterial) {
        packet.sprite.material.opacity = alpha;
      }

      // Optional: scale up at midpoint for "pulse" effect
      const midPulse = 1.0 + Math.sin(packet.progress * Math.PI) * 0.1;
      packet.sprite.scale.setScalar(this.options.packetSize * packet.size * midPulse);
    }
  }

  /**
   * Changes the packet color for all existing and future packets.
   */
  setColor(color: THREE.ColorRepresentation): void {
    this.options.color.set(color);
    this.spriteMaterial.color.set(color);
    this.spriteMaterial.needsUpdate = true;
  }

  /**
   * Sets the global speed multiplier.
   */
  setSpeedMultiplier(multiplier: number): void {
    this.options.baseSpeed = 0.15 * multiplier;
  }

  /**
   * Disposes all resources.
   */
  dispose(): void {
    for (const packet of this.packets) {
      this.parent.remove(packet.sprite);
      packet.sprite.material.dispose();
    }
    this.packets = [];
    this.spriteMaterial.dispose();
    this.spriteMaterial.map?.dispose();
  }
}
