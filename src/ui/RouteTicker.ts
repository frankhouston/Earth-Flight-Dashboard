/**
 * Route ticker — scrolling HUD element showing active flight routes.
 *
 * Displays currently active FlightRoute entries in a continuous marquee
 * at the bottom of the screen. Each item shows:
 *   • Origin → Destination (city codes)
 *   • Progress indicator (colored dot based on journey stage)
 *
 * The ticker pauses on hover (when interactive) and auto-scrolling
 * resumes when no mouse is present. Uses CSS animations for performance.
 *
 * Styled with the same glassmorphism glassmorphism aesthetic as StatCards.
 */
import { DashboardData, FlightRoute } from '@/data/DataProvider';

export class RouteTicker {
  private container: HTMLElement;
  private track: HTMLElement;
  private styleEl: HTMLStyleElement;
  private items: Map<string, HTMLElement> = new Map();
  private isHovered: boolean = false;

  constructor(parent: HTMLElement) {
    this.container = this.createContainer();
    parent.appendChild(this.container);
    this.track = this.createTrack();
    this.container.appendChild(this.track);
    this.styleEl = this.injectStyles();
  }

  private createContainer(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'route-ticker';
    div.style.cssText = [
      'position: fixed',
      'bottom: 20px',
      'left: 20px',
      'right: 20px',
      'z-index: 100',
      'pointer-events: none',
      'overflow: hidden',
    ].join(';');
    return div;
  }

  private createTrack(): HTMLElement {
    const track = document.createElement('div');
    track.className = 'route-ticker__track';
    track.style.cssText = [
      'display: flex',
      'gap: 16px',
      'align-items: center',
      'animation: route-ticker-scroll 20s linear infinite',
    ].join(';');
    return track;
  }

  private injectStyles(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      /* Route ticker — continuous marquee */
      .route-ticker {
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }

      .route-ticker.visible {
        opacity: 1;
        pointer-events: auto;
      }

      .route-ticker__track {
        background: rgba(10, 10, 26, 0.55);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        padding: 8px 16px;
        box-shadow:
          0 8px 32px rgba(0, 0, 0, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.18);
      }

      .route-ticker__item {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-family: 'SF Mono', -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
        font-size: 11px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.75);
        white-space: nowrap;
      }

      .route-ticker__dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        display: inline-block;
        flex-shrink: 0;
      }

      .route-ticker__route {
        color: rgba(255, 255, 255, 0.45);
        font-variant-numeric: tabular-nums;
      }

      .route-ticker__separator {
        color: rgba(255, 107, 53, 0.6);
        margin: 0 4px;
      }

      .route-ticker__progress {
        margin-left: 4px;
        width: 32px;
        height: 2px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 1px;
        overflow: hidden;
      }

      .route-ticker__progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #ff6b35, #ffa726);
        border-radius: 1px;
        transition: width 0.3s ease;
      }

      @keyframes route-ticker-scroll {
        0% { transform: translateX(0); }
        100% { transform: translateX(calc(-100% - 16px * var(--ticker-item-count, 1))); }
      }

      /* ---- Responsive ---- */
      @media (max-width: 768px) {
        .route-ticker__item { font-size: 10px; gap: 4px; }
        .route-ticker__track { padding: 6px 12px; }
        .route-ticker__dot { width: 5px; height: 5px; }
        .route-ticker__progress { width: 24px; }
      }

      @media (max-width: 480px) {
        .route-ticker__item { font-size: 9px; }
        .route-ticker__track { padding: 4px 10px; }
      }
    `;
    document.head.appendChild(style);
    return style;
  }

  /** Creates or updates a ticker item for a route. */
  private createItem(route: FlightRoute): HTMLElement {
    const item = document.createElement('div');
    item.className = 'route-ticker__item';
    item.dataset.routeId = route.id;

    const dot = this.createProgressDot(route.progress);

    const fromCode = document.createElement('span');
    fromCode.className = 'route-ticker__route';
    fromCode.textContent = route.from.code;

    const sep = document.createElement('span');
    sep.className = 'route-ticker__separator';
    sep.textContent = '→';

    const toCode = document.createElement('span');
    toCode.className = 'route-ticker__route';
    toCode.textContent = route.to.code;

    const progress = document.createElement('span');
    progress.className = 'route-ticker__progress';
    const fill = document.createElement('span');
    fill.className = 'route-ticker__progress-fill';
    fill.style.width = `${Math.round(route.progress * 100)}%`;
    progress.appendChild(fill);

    item.appendChild(dot);
    item.appendChild(fromCode);
    item.appendChild(sep);
    item.appendChild(toCode);
    item.appendChild(progress);

    return item;
  }

  /** Creates a dot colored by journey stage: green=early, amber=mid, red=late. */
  private createProgressDot(progress: number): HTMLElement {
    const dot = document.createElement('span');
    dot.className = 'route-ticker__dot';
    if (progress < 0.5) {
      dot.style.background = '#50e3a4';       // green — early
    } else if (progress < 0.8) {
      dot.style.background = '#ffa726';       // amber — mid
    } else {
      dot.style.background = '#ff6b35';       // orange-red — late
    }
    return dot;
  }

  /**
   * Updates the ticker with the latest route data.
   * Adds new items, removes completed routes, updates progress.
   */
  update(data: DashboardData): void {
    const incomingIds = new Set(data.routes.map((r) => r.id));

    // Remove items for completed routes
    for (const [id, item] of this.items) {
      if (!incomingIds.has(id)) {
        this.track.removeChild(item);
        this.items.delete(id);
      }
    }

    // Add new items for new routes
    for (const route of data.routes) {
      if (!this.items.has(route.id)) {
        const item = this.createItem(route);
        this.track.appendChild(item);
        this.items.set(route.id, item);
      }
    }

    // Update progress/dots for existing items
    for (const route of data.routes) {
      const item = this.items.get(route.id);
      if (!item) continue;

      const fill = item.querySelector('.route-ticker__progress-fill') as HTMLElement;
      if (fill) {
        fill.style.width = `${Math.round(route.progress * 100)}%`;
      }

      // Update dot color
      const dot = item.querySelector('.route-ticker__dot') as HTMLElement;
      if (dot) {
        if (route.progress < 0.5) {
          dot.style.background = '#50e3a4';
        } else if (route.progress < 0.8) {
          dot.style.background = '#ffa726';
        } else {
          dot.style.background = '#ff6b35';
        }
      }
    }

    // Update animation speed based on item count
    const count = this.items.size;
    if (count > 0) {
      this.container.style.setProperty('--ticker-item-count', String(count));
      // Adjust scroll speed: slower with more items
      const duration = Math.max(15, Math.min(60, count * 2));
      (this.track.style as any)._animationDuration = duration;
      this.track.style.animation = `route-ticker-scroll ${duration}s linear infinite`;
    }

    // Pause animation on hover
    if (this.isHovered) {
      this.track.style.animationPlayState = 'paused';
    }
  }

  /** Shows the ticker with a fade-in. */
  show(): void {
    this.container.classList.add('visible');
  }

  /** Hides the ticker with a fade-out. */
  hide(): void {
    this.container.classList.remove('visible');
  }

  /** Dims during cinematic mode. */
  dim(): void {
    this.container.classList.add('dimmed');
  }

  /** Restores opacity after cinematic mode. */
  undim(): void {
    this.container.classList.remove('dimmed');
  }

  /** Pauses auto-scroll on hover. */
  pauseOnHover(): void {
    this.isHovered = true;
    this.track.style.animationPlayState = 'paused';
  }

  /** Resumes auto-scroll after hover. */
  resumeAfterHover(): void {
    this.isHovered = false;
    this.track.style.animationPlayState = 'running';
  }

  /** Removes the ticker from the DOM. */
  dispose(): void {
    this.container.remove();
    this.styleEl.remove();
  }
}
