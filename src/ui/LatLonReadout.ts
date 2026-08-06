/**
 * Latitude/longitude readout — shows geographic coordinates of the point
 * under the cursor on the globe surface.
 *
 * Uses raycasting against the globe mesh to find the hit point, then
 * converts the world-space position back to lat/lon using the inverse of
 * the latLonToSpherical coordinate convention (lon=0° → -X, lon=90°E → +Z).
 *
 * The conversion is done in the GlobeGroup's local space, so the 23.4° axial
 * tilt and time-of-day rotation are accounted for — coordinates on the
 * texture don't change as the Earth rotates.
 *
 * Styled with the same glassmorphism aesthetic as StatCards and RouteTicker.
 */
import * as THREE from 'three';

/** Formats latitude in degrees with hemisphere indicator (e.g., "40.6° N"). */
function formatLat(lat: number): string {
  const dir = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(1)}° ${dir}`;
}

/** Formats longitude in degrees with hemisphere indicator (e.g., "73.8° W"). */
function formatLon(lon: number): string {
  const dir = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lon).toFixed(1)}° ${dir}`;
}

export class LatLonReadout {
  private container: HTMLElement;
  private latLabel: HTMLElement;
  private lonLabel: HTMLElement;
  private styleEl: HTMLStyleElement;

  private camera: THREE.Camera | null = null;
  private domElement: HTMLElement | null = null;
  private globe: THREE.Mesh | null = null;
  private globeGroup: THREE.Object3D | null = null;

  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private mouse: THREE.Vector2 = new THREE.Vector2();
  private isVisible: boolean = false;

  constructor(parent: HTMLElement) {
    this.container = this.createContainer();
    parent.appendChild(this.container);

    this.latLabel = this.createCoordLabel();
    this.lonLabel = this.createCoordLabel();
    this.container.appendChild(this.latLabel);
    this.container.appendChild(this.lonLabel);

    this.styleEl = this.injectStyles();
    this.hide();
  }

  // -- Setup

  /** Sets the camera for raycasting (called after createCamera). */
  setCamera(camera: THREE.Camera): void {
    this.camera = camera;
  }

  /** Binds mouse events on the renderer canvas for cursor tracking. */
  setDomElement(dom: HTMLElement): void {
    this.domElement = dom;
    dom.addEventListener('mousemove', this.onMouseMove);
    dom.addEventListener('mouseleave', this.onMouseLeave);
  }

  /**
   * Sets the globe mesh and its parent group.
   * Called after the globe is created (textures loaded).
   */
  setGlobe(globe: THREE.Mesh, globeGroup: THREE.Object3D): void {
    this.globe = globe;
    this.globeGroup = globeGroup;
  }

  // -- DOM creation

  private createContainer(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'latlon-readout';
    return div;
  }

  private createCoordLabel(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'latlon-readout__label';
    span.textContent = '--° --';
    return span;
  }

  private injectStyles(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      /* Lat/Lon coordinate readout — follows cursor on globe hover */
      .latlon-readout {
        position: fixed;
        top: 0;
        left: 0;
        transform: translate(10px, -50%);
        display: flex;
        gap: 6px;
        align-items: center;
        pointer-events: none;
        z-index: 99;
        opacity: 0;
        transition: opacity 0.2s ease;
      }

      .latlon-readout.visible {
        opacity: 1;
      }

      .latlon-readout.dimmed {
        opacity: 0.3;
      }

      .latlon-readout__label {
        background: rgba(10, 10, 26, 0.65);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 8px;
        padding: 4px 10px;
        font-family: 'SF Mono', -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.85);
        white-space: nowrap;
        text-shadow: 0 0 4px rgba(80, 227, 164, 0.3);
      }
    `;
    document.head.appendChild(style);
    return style;
  }

  // -- Event handlers

  private onMouseMove = (event: MouseEvent): void => {
    if (!this.camera || !this.domElement || !this.globe || !this.globeGroup) return;

    // Convert screen coords to normalized device coordinates (-1 to +1)
    const rect = this.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    // Raycast against the globe mesh
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersects = this.raycaster.intersectObject(this.globe);

    if (intersects.length > 0) {
      const hitPoint = intersects[0].point;

      // Convert to GlobeGroup local space — this undoes the axial tilt
      // (rotation.x) and the time-of-day rotation (rotation.y), giving us
      // coordinates in the same system as latLonToSpherical.
      const localPoint = this.globeGroup.worldToLocal(hitPoint.clone());

      // Inverse of latLonToSpherical:
      //   x =  radius * cos(lat) * cos(lon)
      //   y =  radius * sin(lat)
      //   z = -radius * cos(lat) * sin(lon)
      // => lat = asin(y / r),  lon = atan2(-z, x)
      const radius = 1;
      const lat = THREE.MathUtils.radToDeg(Math.asin(localPoint.y / radius));
      const lon = THREE.MathUtils.radToDeg(Math.atan2(-localPoint.z, localPoint.x));

      this.latLabel.textContent = formatLat(lat);
      this.lonLabel.textContent = formatLon(lon);

      // Position near the cursor
      this.container.style.left = `${event.clientX}px`;
      this.container.style.top = `${event.clientY}px`;

      if (!this.isVisible) this.show();
    } else {
      if (this.isVisible) this.hide();
    }
  };

  private onMouseLeave = (): void => {
    if (this.isVisible) this.hide();
  };

  // -- Visibility

  /** Shows the readout with a fade-in. */
  show(): void {
    this.container.classList.add('visible');
    this.isVisible = true;
  }

  /** Hides the readout with a fade-out. */
  hide(): void {
    this.container.classList.remove('visible');
    this.isVisible = false;
  }

  /** Dims the readout for cinematic mode. */
  dim(): void {
    this.container.classList.add('dimmed');
  }

  /** Restores the readout after cinematic mode. */
  undim(): void {
    this.container.classList.remove('dimmed');
  }

  /** Removes the readout from the DOM. */
  dispose(): void {
    this.domElement?.removeEventListener('mousemove', this.onMouseMove);
    this.domElement?.removeEventListener('mouseleave', this.onMouseLeave);
    this.container.remove();
    this.styleEl.remove();
  }
}
