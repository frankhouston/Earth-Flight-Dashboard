# Project Restart Checkpoint

## Tag: `checkpoint-earth-dashboard-v1`

**Date:** 2026-08-02
**Commit:** `f0f7f7f`

## Current State

### ✅ Completed
| Task | Description | Files |
|---|---|---|
| #12 | Live data source + simulation bridge | `DataProvider.ts`, `cities.ts` |
| #15 | Auto-demo cinematic mode | `CameraDemo.ts`, integrated in `Dashboard.ts` |
| APNG | 10-second cinematic capture | `animated-earth.png` (8.4MB), `capture-apng.js` |

### 🚧 In Progress
| Task | Description |
|---|---|
| — | (next: glassmorphism stat cards) |

### ⏳ Pending
| Task | Description |
|---|---|
| #13 | Build glassmorphism stat cards |
| #14 | Build route ticker + HUD overlay |
| #16 | Optimize performance + responsive layout |

## Key Dependencies

```bash
npm install        # Vite 8.2 + Three.js r185
npm run dev        # Start dev server on localhost:3000
npm run build      # Production build
node capture-apng.js && ffmpeg ...  # Regenerate APNG
```

## Configuration

| Component | Value |
|---|---|
| Sim spawn interval | 0.8–1.5s |
| Max active routes | 80 |
| Packets per arc | 5 |
| Camera idle threshold | 12s |
| APNG capture | 150 frames @ 15fps, 1280×720 |

## Restart Instructions

To resume work from this checkpoint:

```bash
git checkout checkpoint-earth-dashboard-v1
npm install
npm run dev
# Visit http://localhost:3000
```
