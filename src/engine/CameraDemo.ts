/**
 * CameraDemo — auto-demo cinematic camera mode.
 *
 * After a configurable period of user inactivity, takes over the camera
 * for a smooth cinematic tour of the Earth dashboard, then returns
 * control to the user on any input (mouse, touch, keyboard).
 *
 * The cinematic tour is defined as a sequence of waypoints, each with:
 *   - A target camera position
 *   - A target look-at direction
 *   - A duration for the transition
 *   - An optional FOV change
 *   - An easing function
 *
 * Usage in the render loop:
 *   cameraDemo.update(deltaTime)
 *
 * Listen for user interaction:
 *   cameraDemo.onUserInteraction()
 */
import * as THREE from 'three';

export interface CameraKeyframe {
  /** End position for this keyframe */
  position: THREE.Vector3;
  /** End look-at target for this keyframe */
  target: THREE.Vector3;
  /** Duration of the transition in seconds */
  duration: number;
  /** Target FOV at the end of the transition */
  fov?: number;
  /** Easing function for this transition */
  ease?: (t: number) => number;
  /** If true, camera orbits 360° around the globe during this keyframe */
  spin?: boolean;
}

/** Default idle time before cinematic mode starts (seconds) */
const DEFAULT_IDLE_THRESHOLD = 10;

/** Default easing for transitions */
const defaultEase = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

/**
 * Cinematic camera controller that produces smooth orbital tours of the globe.
 *
 * Designed to work alongside OrbitControls — when cinematic mode is active,
 * the OrbitControls are disabled. On any user interaction, control returns
 * to manual interaction.
 */
export class CameraDemo {
  private camera: THREE.PerspectiveCamera;
  private isActive: boolean = false;
  private idleTimer: number = 0;
  private idleThreshold: number;

  /** Current look-at target (what the camera is pointing at) */
  private currentTarget: THREE.Vector3 = new THREE.Vector3();

  /** Cinematic tour waypoints */
  private waypoints: CameraKeyframe[] = [];
  private wpIndex: number = 0;
  private wpElapsed: number = 0;
  private wpStartPos: THREE.Vector3 = new THREE.Vector3();
  private wpStartTarget: THREE.Vector3 = new THREE.Vector3();
  private wpStartFov: number = 45;

  /** Callbacks for the dashboard to react to mode changes */
  public onActivate?: () => void;
  public onDeactivate?: () => void;

  constructor(camera: THREE.PerspectiveCamera, idleThreshold: number = DEFAULT_IDLE_THRESHOLD) {
    this.camera = camera;
    this.idleThreshold = idleThreshold;
    this.currentTarget.set(0, 0, 0); // Default: look at globe center
    this.wpStartFov = camera.fov;
    this.buildWaypoints();
  }

  /**
   * Builds the cinematic tour waypoint sequence.
   * Each waypoint creates a smooth orbital transition around the globe,
   * focusing on different continents and perspectives.
   */
  private buildWaypoints(): void {
    const DIST = 2.8; // Camera distance from globe center
    this.waypoints = [
      // 1. Wide Earth overview from space
      {
        position: new THREE.Vector3(0, DIST, DIST),
        target: new THREE.Vector3(0, 0, 0),
        duration: 6,
        fov: 40,
      },
      // 2. North America focus
      {
        position: new THREE.Vector3(DIST * 0.6, DIST * 0.5, DIST * 0.6),
        target: new THREE.Vector3(-0.1, 0.1, 0.1),
        duration: 8,
        fov: 50,
      },
      // 3. North pole view — spinning globe from above
      {
        position: new THREE.Vector3(0.2, DIST, 0.01),
        target: new THREE.Vector3(0, 0, 0),
        duration: 7,
        fov: 35,
      },
      // 4. Europe/Africa — great circle routes visible
      {
        position: new THREE.Vector3(-DIST * 0.8, DIST * 0.3, DIST * 0.5),
        target: new THREE.Vector3(-0.3, 0.15, 0.2),
        duration: 9,
        fov: 45,
      },
      // 5. Asia-Pacific hub cluster
      {
        position: new THREE.Vector3(DIST * 0.95, DIST * 0.15, -DIST * 0.3),
        target: new THREE.Vector3(0.5, 0.1, -0.3),
        duration: 8,
        fov: 45,
      },
      // 6. Pacific crossing — Sydney to LA arc
      {
        position: new THREE.Vector3(DIST * 0.4, DIST * 0.4, -DIST * 0.85),
        target: new THREE.Vector3(0.2, 0.3, -0.5),
        duration: 8,
        fov: 50,
      },
      // 7. Americas view — New York to São Paulo
      {
        position: new THREE.Vector3(-DIST * 0.5, DIST * 0.5, -DIST * 0.7),
        target: new THREE.Vector3(-0.2, 0.1, -0.3),
        duration: 7,
        fov: 48,
      },
      // 8. Antarctica — Rothera Station (RYG) on Adelaide Island, focused on the far south
      {
        position: new THREE.Vector3(-DIST * 0.2, -DIST * 0.8, -DIST * 0.3),
        target: new THREE.Vector3(-0.1, -0.3, -0.1),
        duration: 10,
        fov: 30,
      },
      // 9. Cape of Good Hope (southern tip of Africa)
      {
        position: new THREE.Vector3(DIST * 0.2, DIST * 0.4, DIST * 0.8),
        target: new THREE.Vector3(0.1, 0.2, 0.3),
        duration: 8,
        fov: 38,
      },
      // 10. Cape Horn (southern tip of South America) — Falkland Islands nearby (FIE)
      {
        position: new THREE.Vector3(-DIST * 0.4, DIST * 0.5, -DIST * 0.6),
        target: new THREE.Vector3(-0.2, 0.3, -0.3),
        duration: 8,
        fov: 45,
      },
      // 11. New Zealand (WLG) and Southern Ocean
      {
        position: new THREE.Vector3(DIST * 0.8, DIST * 0.2, -DIST * 0.5),
        target: new THREE.Vector3(0.3, 0.1, -0.3),
        duration: 8,
        fov: 45,
      },
      // 12. Sydney, Australia (SYD)
      {
        position: new THREE.Vector3(DIST * 0.6, -DIST * 0.2, -DIST * 0.6),
        target: new THREE.Vector3(0.25, -0.1, -0.3),
        duration: 8,
        fov: 42,
      },
      // 13. Chicago (ORD) — transition through North American hub
      {
        position: new THREE.Vector3(-DIST * 0.6, DIST * 0.4, DIST * 0.4),
        target: new THREE.Vector3(-0.2, 0.2, 0.1),
        duration: 10,
        fov: 45,
      },
      // 14. London (LHR) — European perspective
      {
        position: new THREE.Vector3(-DIST * 0.8, DIST * 0.3, DIST * 0.5),
        target: new THREE.Vector3(-0.25, 0.1, 0.25),
        duration: 9,
        fov: 40,
      },
      // 15. Low orbit — close to surface, building tension for the spin
      {
        position: new THREE.Vector3(0.3, DIST * 0.3, DIST),
        target: new THREE.Vector3(0.1, 0.3, -0.1),
        duration: 7,
        fov: 60,
      },
      // 16. Back to the start — wide overview
      {
        position: new THREE.Vector3(-DIST, DIST * 0.6, DIST * 0.4),
        target: new THREE.Vector3(0, 0, 0),
        duration: 10,
        fov: 40,
      },
      // 17. Full 360° spinning globe — camera orbits around the globe
      {
        position: new THREE.Vector3(DIST * 0.5, DIST * 0.2, DIST * 0.7),
        target: new THREE.Vector3(0, 0, 0),
        duration: 15,
        fov: 35,
        spin: true,
      },
      // 18. Back to overview — complete the loop
      {
        position: new THREE.Vector3(0, DIST, DIST),
        target: new THREE.Vector3(0, 0, 0),
        duration: 10,
        fov: 40,
      },
    ];
  }

  /**
   * Main update loop — call in the render loop with delta time in seconds.
   * Advances idle timer or cinematic tour depending on mode.
   */
  update(dt: number): void {
    if (this.isActive) {
      this.advanceCinematic(dt);
    } else {
      this.idleTimer += dt;
      if (this.idleTimer >= this.idleThreshold) {
        this.startCinematic();
      }
    }
  }

  /** Advances through the cinematic waypoint sequence. */
  private advanceCinematic(dt: number): void {
    this.wpElapsed += dt;
    const wp = this.waypoints[this.wpIndex];

    let t = this.wpElapsed / wp.duration;
    const finished = t >= 1.0;
    if (finished) {
      t = 1.0;
    }

    if (wp.spin) {
      // Spin mode: camera orbits 360° around the globe
      this.applySpin(wp, t);
    } else {
      const eased = wp.ease ? wp.ease(t) : defaultEase(t);
      this.applyInterpolation(wp, eased);
    }

    if (finished) {
      this.advanceWaypoint();
    }
  }

  /** Moves to the next waypoint, capturing current state as the start. */
  private advanceWaypoint(): void {
    this.wpElapsed = 0;
    this.wpIndex = (this.wpIndex + 1) % this.waypoints.length;

    // Capture current camera state as the start of the next transition
    this.wpStartPos.copy(this.camera.position);
    this.wpStartTarget.copy(this.currentTarget);
    this.wpStartFov = this.camera.fov;
  }

  /** Interpolates camera position, look-at target, and FOV. */
  private applyInterpolation(wp: CameraKeyframe, eased: number): void {
    // Position
    this.camera.position.lerpVectors(this.wpStartPos, wp.position, eased);

    // Look-at target
    const target = this.wpStartTarget.clone().lerp(wp.target, eased);
    this.currentTarget.copy(target);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();

    // FOV
    if (wp.fov !== undefined) {
      this.camera.fov = THREE.MathUtils.lerp(this.wpStartFov, wp.fov, eased);
      this.camera.updateProjectionMatrix();
    }
  }

  /** Spins the camera 360° around the globe target. */
  private applySpin(wp: CameraKeyframe, t: number): void {
    const radius = this.wpStartPos.length();
    const angle = t * Math.PI * 2; // Full 360° rotation

    // Orbital position around origin
    this.camera.position.set(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius * 0.3, // Slight vertical oscillation for visual interest
      Math.sin(angle) * radius,
    );

    // Always look at the globe center
    this.currentTarget.copy(wp.target);
    this.camera.lookAt(wp.target);
    this.camera.updateMatrixWorld();

    // FOV interpolation
    if (wp.fov !== undefined) {
      this.camera.fov = THREE.MathUtils.lerp(this.wpStartFov, wp.fov, t);
      this.camera.updateProjectionMatrix();
    }
  }

  // -- Public control methods

  /** Starts the cinematic tour. */
  startCinematic(): void {
    this.isActive = true;
    this.idleTimer = 0;
    this.wpIndex = 0;
    this.wpElapsed = 0;

    // Capture current camera state as the start of the first transition
    this.wpStartPos.copy(this.camera.position);
    this.wpStartTarget.copy(this.currentTarget);
    this.wpStartFov = this.camera.fov;

    this.onActivate?.();
  }

  /** Stops the cinematic tour and returns to manual control. */
  stopCinematic(): void {
    this.isActive = false;
    this.idleTimer = 0;
    this.wpElapsed = 0;
    this.wpIndex = 0;
    this.onDeactivate?.();
  }

  /**
   * Called on any user interaction.
   * If cinematic mode is active, returns control to the user.
   * Otherwise, resets the idle timer.
   */
  onUserInteraction(): void {
    if (this.isActive) {
      this.stopCinematic();
    } else {
      this.idleTimer = 0;
    }
  }

  /** Returns whether cinematic mode is currently active. */
  isCinematicActive(): boolean {
    return this.isActive;
  }

  /** Sets the look-at target (used when syncing with external camera controls). */
  setCurrentTarget(target: THREE.Vector3): void {
    this.currentTarget.copy(target);
  }

  /** Sets the idle threshold in seconds. */
  setIdleThreshold(seconds: number): void {
    this.idleThreshold = seconds;
  }
}
