/**
 * Glassmorphism stat cards overlay for the Earth dashboard.
 *
 * Displays real-time flight statistics from the DataProvider stream:
 *   - Total Flights (cumulative)
 *   - Active Flights (currently in-air)
 *   - Avg Progress (% of journey completed)
 *   - Peak Hub (busiest city by route mentions)
 *
 * Uses a frosted-glass CSS effect (backdrop-filter blur) with
 * semi-transparent layers, subtle borders, and inner/outer glows.
 *
 * Values animate smoothly on change; the panel dims slightly during
 * cinematic camera mode for unobtrusive viewing.
 */
import { DashboardData } from '@/data/DataProvider';

const GROWTH_COLOR = '#4a90d9';
const TRAFFIC_COLOR = '#ff6b35';
const PROGRESS_COLOR = '#50e3a4';
const HUB_COLOR = '#9b59f0';

interface StatCardDefinition {
  id: string;
  icon: string;
  label: string;
  color: string;
  format: (data: DashboardData) => string;
  subtitle: (data: DashboardData) => string;
  /** When true, the card shows a hover/hint cursor and fires onCardClick */
  clickable?: boolean;
}

/** Four-card configuration: icon, label, value formatter, subtitle */
const CARD_DEFS: StatCardDefinition[] = [
  {
    id: 'total',
    icon: '🛫',
    label: 'Total Flights',
    color: GROWTH_COLOR,
    clickable: true,
    format: (d) => d.stats.totalFlights.toLocaleString(),
    subtitle: (d) => `${d.stats.totalFlights} routes spawned`,
  },
  {
    id: 'active',
    icon: '✈️',
    label: 'Active Flights',
    color: TRAFFIC_COLOR,
    format: (d) => d.stats.activeFlights.toLocaleString(),
    subtitle: (d) => `${d.routes.length} routes in flight`,
  },
  {
    id: 'progress',
    icon: '📊',
    label: 'Avg Progress',
    color: PROGRESS_COLOR,
    format: (d) => `${Math.round(d.stats.avgProgress * 100)}%`,
    subtitle: (d) => 'average journey complete',
  },
  {
    id: 'peak',
    icon: '🌍',
    label: 'Peak Hub',
    color: HUB_COLOR,
    format: (d) => d.stats.peakHub.name || 'N/A',
    subtitle: (d) => d.stats.peakHub.code !== '-' ? `${d.stats.peakHub.count} routes through ${d.stats.peakHub.code}` : 'No routes yet',
  },
];

/** Callback fired when a clickable stat card is clicked */
export type CardClickCallback = (cardId: string, card: HTMLElement) => void;

export class StatCards {
  private container: HTMLElement;
  private cards: Map<string, HTMLElement> = new Map();
  private styleEl: HTMLStyleElement;
  private isVisible: boolean = true;
  private onClickCallback: CardClickCallback | null = null;
  private resetThreshold: number = 200;

  constructor(parent: HTMLElement) {
    this.container = this.createContainer();
    parent.appendChild(this.container);
    this.styleEl = this.injectStyles();
    this.createCards();
  }

  /** Creates the grid container positioned in the top-right corner. */
  private createContainer(): HTMLElement {
    const div = document.createElement('div');
    div.className = 'stat-cards';
    div.style.cssText = [
      'position: fixed',
      'top: 20px',
      'right: 20px',
      'display: grid',
      'grid-template-columns: 1fr 1fr',
      'gap: 12px',
      'z-index: 100',
      'width: 340px',
      'max-width: calc(100vw - 40px)',
      'pointer-events: none',
    ].join(';');
    return div;
  }

  /** Injects glassmorphism CSS into the document head. */
  private injectStyles(): HTMLStyleElement {
    const style = document.createElement('style');
    style.textContent = `
      .stat-cards {
        opacity: 1;
        transition: opacity 0.3s ease;
      }

      .stat-cards.dimmed {
        opacity: 0.3;
      }

      .stat-card {
        background: rgba(10, 10, 26, 0.55);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 14px;
        padding: 16px;
        box-shadow:
          0 8px 32px rgba(0, 0, 0, 0.4),
          inset 0 1px 0 rgba(255, 255, 255, 0.18);
        pointer-events: auto;
        transition: all 0.2s ease;
      }

      .stat-card:hover {
        transform: translateY(-2px);
      }

      .stat-card__icon {
        font-size: 18px;
        margin-bottom: 6px;
      }

      .stat-card__label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        color: rgba(255, 255, 255, 0.45);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-weight: 500;
      }

      .stat-card__value {
        font-size: 22px;
        font-weight: 700;
        color: #fff;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        margin: 4px 0;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      }

      .stat-card__sub {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.32);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        line-height: 1.4;
      }

      /* Accent color per card */
      .stat-card[data-color] .stat-card__icon {
        filter: drop-shadow(0 0 4px var(--card-color));
      }

      /* ---- Responsive: tablet ---- */
      @media (max-width: 768px) {
        .stat-cards {
          width: calc(100vw - 24px);
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }

        .stat-card {
          padding: 12px;
        }

        .stat-card__icon { font-size: 15px; }
        .stat-card__label { font-size: 8px; }
        .stat-card__value { font-size: 19px; }
        .stat-card__sub { font-size: 9px; }
      }

      /* ---- Responsive: mobile ---- */
      @media (max-width: 480px) {
        .stat-cards {
          grid-template-columns: 1fr;
          gap: 8px;
          width: calc(100vw - 16px);
        }

        .stat-card__value { font-size: 16px; }
      }
    `;
    document.head.appendChild(style);
    return style;
  }

  /** Creates all four stat cards from the configuration. */
  private createCards(): void {
    for (const def of CARD_DEFS) {
      const card = this.createCard(def);
      this.container.appendChild(card);
      this.cards.set(def.id, card);
    }
  }

  /** Creates a single glassmorphic stat card element. */
  private createCard(def: StatCardDefinition): HTMLElement {
    const card = document.createElement('div');
    card.className = 'stat-card';
    card.dataset.color = def.color;
    card.style.setProperty('--card-color', def.color);

    const icon = document.createElement('div');
    icon.className = 'stat-card__icon';
    icon.textContent = def.icon;
    card.appendChild(icon);

    const label = document.createElement('div');
    label.className = 'stat-card__label';
    label.textContent = def.label;
    card.appendChild(label);

    const value = document.createElement('div');
    value.className = 'stat-card__value';
    value.textContent = '—';
    card.appendChild(value);

    const sub = document.createElement('div');
    sub.className = 'stat-card__sub';
    sub.textContent = 'Waiting for data…';
    card.appendChild(sub);

    // Wire up click handling for clickable cards
    if (def.clickable && this.onClickCallback) {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        this.onClickCallback?.(def.id, card);
      });
    }

    return card;
  }

  /** Registers a callback for click events on clickable stat cards. */
  setOnCardClick(cb: CardClickCallback): void {
    this.onClickCallback = cb;
    // Attach click listeners to already-created clickable cards
    for (const def of CARD_DEFS) {
      if (def.clickable) {
        const card = this.cards.get(def.id);
        if (card) {
          card.style.cursor = 'pointer';
          card.addEventListener('click', () => {
            this.onClickCallback?.(def.id, card);
          });
        }
      }
    }
  }

  /** Updates the reset threshold for the Total Flights card. */
  setResetThreshold(value: number): void {
    this.resetThreshold = value;
  }

  /** Gets the reset threshold for the Total Flights card. */
  getResetThreshold(): number {
    return this.resetThreshold;
  }

  /**
   * Updates all stat card values from the latest DashboardData.
   * Called on every data tick (30fps in simulation mode).
   */
  update(data: DashboardData): void {
    for (const def of CARD_DEFS) {
      const card = this.cards.get(def.id);
      if (!card) continue;

      const valueEl = card.querySelector('.stat-card__value') as HTMLElement;
      const subEl = card.querySelector('.stat-card__sub') as HTMLElement;

      if (valueEl && valueEl.textContent !== def.format(data)) {
        valueEl.textContent = def.format(data);
        valueEl.style.transform = 'scale(1.04)';
        setTimeout(() => { valueEl.style.transform = 'scale(1)'; }, 200);
      }
      if (subEl) {
        // For the total card, show the reset threshold instead of default subtitle
        if (def.id === 'total') {
          subEl.textContent = `Resets at ${this.resetThreshold} flights`;
        } else {
          subEl.textContent = def.subtitle(data);
        }
      }
    }
  }

  /** Gets the card element for a given card ID. */
  getCard(id: string): HTMLElement | undefined {
    return this.cards.get(id);
  }

  /** Shows the stat cards with a fade-in. */
  show(): void {
    if (!this.isVisible) {
      this.isVisible = true;
      this.container.classList.remove('dimmed');
      this.container.style.opacity = '1';
    }
  }

  /** Hides the stat cards with a fade-out. */
  hide(): void {
    if (this.isVisible) {
      this.isVisible = false;
      this.container.style.opacity = '0';
    }
  }

  /** Reduces opacity for cinematic camera mode — stats still visible but unobtrusive. */
  dim(): void {
    this.container.classList.add('dimmed');
  }

  /** Restores full opacity after cinematic mode ends. */
  undim(): void {
    this.container.classList.remove('dimmed');
  }

  /** Removes the stat cards and injected styles from the DOM. */
  dispose(): void {
    this.container.remove();
    this.styleEl.remove();
  }
}
