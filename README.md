# Three.js Sojournwith.us

A cinematic Earth flight dashboard built with Three.js r185 and Vite 8.2.

## 🎬 Cinematic Tour

![Animated Earth Dashboard](animated-earth.png)

A 10-second animated PNG (APNG) of the running dashboard showing the auto-demo
cinematic camera tour. The camera orbits from a wide Earth overview through
North America, the North Pole, Europe/Africa, the Asia-Pacific hub cluster,
the Pacific crossing, the Americas, low orbit, and back.

## ✈️ Features

| Feature | Stack |
|---|---|
| **Day/Night Terminator** | Custom ShaderMaterial with smoothstep blend |
| **Topo Relief** | Elevation-displaced sphere geometry |
| **Ocean Specular + Glitter** | Blinn-Phong highlights with noise-based glitter |
| **Atmospheric Glow** | BackSide sphere, additive blending, fresnel rim |
| **Flight Packets** | Great-circle arcs with pool-based animated sprites |
| **Live Data Bridge** | Simulation + API mode (30fps tick, 40 hub cities) |
| **Cinematic Camera** | 9-keyframe auto-demo tour (12s idle → activate) |

## 🚀 Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000` in Chrome/Firefox with WebGL support.

### Build for production

```bash
npm run build
```

### Regenerate the APNG

```bash
node capture-apng.js   # requires Puppeteer + headless Chrome
ffmpeg -framerate 15 -i /tmp/canvas-frames/frame-%04d.png -plays 0 -pix_fmt rgb24 animated-earth.png
```

## 📁 Project Structure

```
src/
  main.ts                      — entry point, exposes debug globals
  data/
    DataProvider.ts            — simulation + API bridge (subscriber pattern)
    cities.ts                  — 40 hub cities across 6 continents
  engine/
    Dashboard.ts               — orchestrator (data ↔ Three.js sync)
    CameraDemo.ts              — cinematic camera controller
    arcs/
      ArcGenerator.ts          — great-circle + Catmull-Rom splines
      PacketSystem.ts          — pool-based animated packet flow
    globe/
      TerminatorMaterial.ts    — Earth shader (terminator, relief, glitter)
      Atmosphere.ts            — atmospheric scattering shell
  textures/
    TextureLoader.ts           — CDN texture loading w/ retry + caching
```

## ⌨️ Camera Controls

| Action | Effect |
|---|---|
| **Mouse drag** | Orbit / pan |
| **Scroll** | Zoom |
| **No input (12s)** | Cinematic auto-demo activates |
| **Any input** | Returns control from cinematic mode |

## 🔧 TypeScript Verification

```bash
npx tsc --noEmit   # 0 errors
npx vite build      # succeeds
```

## 📄 License

MIT