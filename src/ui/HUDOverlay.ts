/**
 * HUD overlay — top-level status bar for the Earth dashboard.
 *
 * Displays:
 *   • Data source badge (SIMULATION / LIVE API)
 *   • Current simulated UTC time
 *   • Active route count (quick reference)
 *   • Arc/packet legend (color-coded)
 *
 * Positioned at the top-left of the screen, styled with the same
 * glassmorphism aesthetic as StatCards and RouteTicker.
 */
import { DashboardData, DataSource } from '@/data/DataProvider';

export class HUDOverlay {
  private container: HTMLElement;
  private styleEl: HTMLStyleElement;
  private elements: {
    sourceBadge: HTMLElement;
    timeDisplay: HTMLElement;
    activeCount: HTMLElement;
  };

  constructor(parent: HTMLElement) {
    this.container = this.createContainer();
    parent.appendChild(this.container);
    this.elements = this.createContent();
    this.container.appendChild(this.elements.sourceBadge.parentElement!);
    this.container.appendChild(this.createLegend());
    this.styleEl = this.injectStyles();
  }

  private createContainer(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'hud-overlay';
    div.style.cssText = [
      'position: fixed',
      'top: 20px',
      'left: 20px',
      'z-index: 100',
      'display: flex',
      'flex-direction: column',
      'gap: 10px',
      'pointer-events: none',
    ].join(';');
    return div;
  }

  private createContent(): { sourceBadge: HTMLElement; timeDisplay: HTMLElement; activeCount: HTMLElement } {
    // Top bar: data source + time + active count
    const topBar = document.createElement('div');
    topBar.className = 'hud-topbar';
    topBar.style.cssText = [
      'display: flex',
      'gap: 12px',
      'align-items: center',
      'background: rgba(10, 10, 26, 0.55)',
      'backdrop-filter: blur(12px)',
      '-webkit-backdrop-filter: blur(12px)',
      'border: 1px solid rgba(255, 255, 255, 0.12)',
      'border-radius: 12px',
      'padding: 8px 12px',
      'box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4)',
    ].join(';');

    // Data source badge
    const sourceBadge = document.createElement('span');
    sourceBadge.className = 'hud-badge hud-badge--sim';
    sourceBadge.textContent = 'SIM';
    sourceBadge.style.cssText = [
      'font-size: 9px',
      'font-weight: 700',
      'text-transform: uppercase',
      'letter-spacing: 1px',
      'padding: 4px 10px',
      'border-radius: 6px',
      'background: rgba(80, 227, 164, 0.15)',
      'color: #50e3a4',
      'border: 1px solid rgba(80, 227, 164, 0.3)',
      'white-space: nowrap',
    ].join(';');

    // Time display
    const timeDisplay = document.createElement('span');
    timeDisplay.className = 'hud-time';
    timeDisplay.textContent = '00:00 UTC';
    timeDisplay.style.cssText = [
      'font-family: "SF Mono", -apple-system, BlinkMacSystemFont, "Segoe UI", monospace',
      'font-size: 12px',
      'font-variant-numeric: tabular-nums',
      'color: rgba(255, 255, 255, 0.65)',
      'white-space: nowrap',
    ].join(';');

    // Active count
    const activeCount = document.createElement('span');
    activeCount.className = 'hud-active';
    activeCount.textContent = '— active';
    activeCount.style.cssText = [
      'font-family: "SF Mono", -apple-system, BlinkMacSystemFont, "Segoe UI", monospace',
      'font-size: 12px',
      'font-variant-numeric: tabular-nums',
      'color: rgba(255, 255, 255, 0.65)',
      'white-space: nowrap',
    ].join(';');

    topBar.appendChild(sourceBadge);
    topBar.appendChild(timeDisplay);
    topBar.appendChild(activeCount);

    return { sourceBadge, timeDisplay, activeCount };
  }

  private createLegend(): HTMLElement {
    const legend = document.createElement('div');
    legend.className = 'hud-legend';
    legend.style.cssText = [
      'display: flex',
      'gap: 8px',
      'flex-wrap: wrap',
      'background: rgba(10, 10, 26, 0.45)',
      'backdrop-filter: blur(12px)',
      '-webkit-backdrop-filter: blur(12px)',
      'border: 1px solid rgba(255, 255, 255, 0.08)',
      'border-radius: 10px',
      'padding: 6px 10px',
    ].join(';');

    const entries = [
      { color: '#ff6b35', label: 'Flight route' },
      { color: '#ffa726', label: 'Data packet' },
      { color: '#4a90d9', label: 'Atmosphere' },
      { color: '#50e3a4', label: 'Terminator' },
    ];

    for (const entry of entries) {
      const item = document.createElement('div');
      item.style.cssText = [
        'display: inline-flex',
        'align-items: center',
        'gap: 4px',
        'font-size: 10px',
        'color: rgba(255, 255, 255, 0.55)',
        'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      ].join(';');

      const dot = document.createElement('span');
      dot.style.cssText = [
        'width: 6px',
        'height: 6px',
        'border-radius: 50%',
        `background: ${entry.color}`,
        'flex-shrink: 0',
      ].join(';');

      const label = document.createElement('span');
      label.textContent = entry.label;

      item.appendChild(dot);
      item.appendChild(label);
      legend.appendChild(item);
    }

    return legend;
  }

  private injectStyles(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      .hud-overlay {
        opacity: 0;
        transition: opacity 0.3s ease;
      }

      .hud-overlay.visible {
        opacity: 1;
      }

      .hud-overlay.dimmed {
        opacity: 0.3;
      }
    `;
    document.head.appendChild(style);
    return style;
  }

  /**
   * Updates the HUD with the latest data snapshot.
   *
   * @param data - Latest DashboardData from the DataProvider
   * @param source - Current data source ('simulation' | 'api')
   * @param simulatedTime - Current simulated Date (for the time display)
   */
  update(data: DashboardData, source: DataSource, simulatedTime: Date): void {
    // Update data source badge
    if (source === 'simulation') {
      this.elements.sourceBadge.textContent = 'SIM';
      this.elements.sourceBadge.className = 'hud-badge hud-badge--sim';
      this.elements.sourceBadge.style.background = 'rgba(80, 227, 164, 0.15)';
      this.elements.sourceBadge.style.color = '#50e3a4';
      this.elements.sourceBadge.style.borderColor = 'rgba(80, 227, 164, 0.3)';
    } else {
      this.elements.sourceBadge.textContent = 'LIVE';
      this.elements.sourceBadge.className = 'hud-badge hud-badge--live';
      this.elements.sourceBadge.style.background = 'rgba(74, 144, 217, 0.15)';
      this.elements.sourceBadge.style.color = '#4a90d9';
      this.elements.sourceBadge.style.borderColor = 'rgba(74, 144, 217, 0.3)';
    }

    // Update time display
    const hours = String(simulatedTime.getUTCHours()).padStart(2, '0');
    const minutes = String(simulatedTime.getUTCMinutes()).padStart(2, '0');
    this.elements.timeDisplay.textContent = `${hours}:${minutes} UTC`;

    // Update active count
    this.elements.activeCount.textContent = `${data.stats.activeFlights} active`;
  }

  /** Shows the HUD with a fade-in. */
  show(): void {
    this.container.classList.add('visible');
  }

  /** Hides the HUD with a fade-out. */
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

  /** Removes the HUD from the DOM. */
  dispose(): void {
    this.container.remove();
    this.styleEl.remove();
  }
}
