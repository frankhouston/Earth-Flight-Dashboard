/**
 * Airport popup — displays airport information when a marker is clicked,
 * with ability to hide/unhide the marker from the globe.
 *
 * Styled with the same glassmorphism aesthetic as StatCards and LatLonReadout.
 */
import * as THREE from 'three';
import { HubCity } from '@/data/cities';

export class AirportPopup {
  private container: HTMLElement;
  private styleEl: HTMLStyleElement;
  private isVisible: boolean = false;
  private currentCity: HubCity | null = null;

  constructor(parent: HTMLElement) {
    this.container = this.createContainer();
    parent.appendChild(this.container);
    this.styleEl = this.injectStyles();
    this.hide();
  }

  private createContainer(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'airport-popup';
    div.innerHTML =
      '<div class="airport-popup__content">' +
      '<div class="airport-popup__header">' +
      '<span class="airport-popup__title"></span>' +
      '<button class="airport-popup__reset-btn" title="Reset globe">🗑️</button>' +
      '<button class="airport-popup__toggle-btn">👁️</button>' +
      '<button class="airport-popup__hide-btn">×</button>' +
      '</div>' +
      '<div class="airport-popup__body">' +
      '<div class="airport-popup__row"><span class="airport-popup__label">City:</span><span class="airport-popup__value"></span></div>' +
      '<div class="airport-popup__row"><span class="airport-popup__label">Country:</span><span class="airport-popup__value"></span></div>' +
      '<div class="airport-popup__row"><span class="airport-popup__label">Type:</span><span class="airport-popup__value"></span></div>' +
      '<div class="airport-popup__row"><span class="airport-popup__label">Traffic:</span><span class="airport-popup__value"></span></div>' +
      '<div class="airport-popup__row"><span class="airport-popup__label">Coordinates:</span><span class="airport-popup__value"></span></div>' +
      '</div>';
    return div;
  }

  private injectStyles(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      .airport-popup {
        position: fixed;
        top: 0;
        left: 0;
        transform: translate(20px, 20px);
        background: rgba(10, 10, 26, 0.85);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        padding: 16px;
        font-family: 'SF Mono', -apple-system, BlinkMacSystemFont, 'Segoe UI', monospace;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.85);
        pointer-events: auto;
        z-index: 100;
        opacity: 0;
        transition: opacity 0.2s ease;
        min-width: 220px;
      }

      .airport-popup.visible {
        opacity: 1;
      }

      .airport-popup__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding-bottom: 6px;
      }

      .airport-popup__title {
        font-weight: 600;
        color: #ff6b35;
      }

      .airport-popup__reset-btn,
      .airport-popup__toggle-btn,
      .airport-popup__hide-btn {
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.6);
        border-radius: 4px;
        width: 24px;
        height: 24px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      }

      .airport-popup__toggle-btn:hover {
        background: rgba(74, 144, 217, 0.3);
        color: #4a90d9;
        border-color: rgba(74, 144, 217, 0.5);
      }

      .airport-popup__toggle-btn.hidden {
        color: #ff6b35;
      }

      .airport-popup__reset-btn {
        width: 24px;
        height: 24px;
        font-size: 12px;
      }

      .airport-popup__reset-btn:hover {
        background: rgba(255, 107, 53, 0.3);
        color: #ff6b35;
        border-color: rgba(255, 107, 53, 0.5);
      }

      .airport-popup__hide-btn {
        width: 20px;
        height: 20px;
        font-size: 14px;
      }

      .airport-popup__hide-btn:hover {
        background: rgba(255, 107, 53, 0.3);
        color: #ff6b35;
        border-color: rgba(255, 107, 53, 0.5);
      }

      .airport-popup__body {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      .airport-popup__row {
        display: flex;
        justify-content: space-between;
        gap: 8px;
      }

      .airport-popup__label {
        color: rgba(255, 255, 255, 0.5);
      }

      .airport-popup__value {
        color: rgba(255, 255, 255, 0.85);
        text-align: right;
      }
    `;
    document.head.appendChild(style);
    return style;
  }

  show(city: HubCity, camera: THREE.Camera | null): void {
    this.currentCity = city;

    const title = this.container.querySelector('.airport-popup__title') as HTMLElement;
    const values = this.container.querySelectorAll('.airport-popup__value');
    const toggleBtn = this.container.querySelector('.airport-popup__toggle-btn') as HTMLElement;

    title.textContent = `${city.code}`;
    values[0].textContent = city.name;        // City name
    values[1].textContent = city.country;     // Country
    values[2].textContent = city.type;        // Type
    values[3].textContent = `${Math.round(city.volume * 100)}%`;  // Traffic
    values[4].textContent = `${city.lat.toFixed(2)}°, ${city.lon.toFixed(2)}°`;  // Coordinates

    // Position near center of screen
    this.container.style.transform = 'translate(50%, 50%)';
    this.showNow();

    // Toggle button - hide/unhide marker
    toggleBtn.classList.remove('hidden');
    toggleBtn.onclick = () => {
      const isHidden = toggleBtn.classList.contains('hidden');
      toggleBtn.classList.toggle('hidden', !isHidden);
      toggleBtn.textContent = isHidden ? '👁️' : '🙈';
      this.container.dispatchEvent(new CustomEvent('toggle-marker', {
        detail: { code: city.code, show: isHidden }
      }));
    };

    // Reset globe button
    const resetBtn = this.container.querySelector('.airport-popup__reset-btn') as HTMLElement;
    resetBtn.onclick = () => {
      this.hide();
      this.container.dispatchEvent(new CustomEvent('reset-globe'));
    };

    // Hide (close) button
    const hideBtn = this.container.querySelector('.airport-popup__hide-btn') as HTMLElement;
    hideBtn.onclick = () => {
      this.hide();
      this.container.dispatchEvent(new CustomEvent('hide-marker', { detail: { code: city.code } }));
    };
  }

  showNow(): void {
    this.container.classList.add('visible');
    this.isVisible = true;
  }

  hide(): void {
    this.container.classList.remove('visible');
    this.isVisible = false;
  }

  /** Gets the popup container for event listening. */
  getContainer(): HTMLElement {
    return this.container;
  }

  dispose(): void {
    this.container.remove();
    this.styleEl.remove();
  }
}
