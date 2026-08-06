/**
 * Captures animated PNGs (APNG) of the Earth Flight Dashboard cinematic tour.
 *
 * 1. Serves dist/ via a static HTTP server
 * 2. Launches headless Chrome via Puppeteer
 * 3. Waits for cinematic mode to start
 * 4. Captures frames at 15fps for 60 seconds (covers full tour cycle)
 * 5. Generates:
 *    - apng/full-tour.png
 *    - apng/earth-tour-northern-hemisphere.png (first 30s of tour)
 *    - apng/earth-tour-south-hemisphere.png (second 30s of tour)
 *
 * Usage: node capture-apng.js
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const puppeteer = require("puppeteer");

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 15;
const CAPTURE_SECONDS = 150; // Cover one full cinematic tour cycle (~148s)
const FRAME_COUNT = FPS * CAPTURE_SECONDS;
const PORT = 8400;
const FRAMES_DIR = '/tmp/earth-frames';
const OUTPUT_DIR = path.join(process.cwd(), 'apng');
const CHROME_PATH = '/Users/frank/.cache/puppeteer/chrome/mac_arm-151.0.7922.71/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing';

const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

const server = http.createServer((req, res) => {
  const url = req.url === '/' ? '/index.html' : req.url;
  let filePath = path.join(process.cwd(), 'dist', url || '/index.html');
  const ext = path.extname(filePath);
  res.setHeader('Content-Type', MIME[ext] || 'application/octet-stream');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + url);
    } else {
      res.writeHead(200);
      res.end(data);
    }
  });
});

async function main() {
  console.log('[capture] Preparing output directories...');
  if (fs.existsSync(OUTPUT_DIR)) fs.rmSync(OUTPUT_DIR, { recursive: true });
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (fs.existsSync(FRAMES_DIR)) fs.rmSync(FRAMES_DIR, { recursive: true });
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  console.log('[capture] Starting static server on port ' + PORT + '...');
  server.listen(PORT);
  await new Promise(r => setTimeout(r, 500));

  console.log('[capture] Launching headless Chrome...');
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: CHROME_PATH,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--enable-webgl',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      `--window-size=${WIDTH},${HEIGHT}`,
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

  console.log('[capture] Loading Earth Flight Dashboard...');
  const response = await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2', timeout: 30000 });
  if (response && !response.ok()) {
    console.error('[capture] Failed to load page:', response.status());
    process.exit(1);
  }

  // Wait for canvas
  console.log('[capture] Waiting for globe canvas...');
  await page.waitForFunction(
    () => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      const gl = canvas.getContext?.('webgl2') || canvas.getContext?.('webgl');
      return !!gl;
    },
    { timeout: 30000, polling: 100 }
  );
  console.log('[capture] Globe canvas ready.');

  // Hide UI overlays for clean capture
  console.log('[capture] Hiding UI elements...');
  await page.evaluate(() => {
    const toHide = [
      '.stat-cards',
      '.route-ticker',
      '.hud-overlay',
      '.latlon-readout',
      '.airport-popup',
      '#loading',
      '.loading-overlay',
    ];
    toHide.forEach(sel => {
      const el = document.querySelector(sel);
      if (el) el.style.display = 'none';
    });
  });

  // Give a moment for the first render frame
  await new Promise(r => setTimeout(r, 2000));

  // Start cinematic tour (forced — not relying on idle timer)
  console.log('[capture] Starting cinematic tour...');
  await page.evaluate(() => {
    if (window.cameraDemo) {
      window.cameraDemo.startCinematic();
    }
  });

  // Capture frames for the full tour
  console.log(`[capture] Capturing ${FRAME_COUNT} frames (${CAPTURE_SECONDS}s at ${FPS}fps)...`);

  const startTime = Date.now();
  const regionLabels = ['Overview', 'N. America', 'North Pole', 'Europe/Africa', 'Asia-Pacific',
                        'Pacific', 'Americas', 'Antarctica', 'Cape Hope', 'Cape Horn', 'NZ', 'Sydney',
                        'Chicago', 'London', 'Low Orbit', 'Wide', 'Spin', 'Loop'];

  for (let i = 0; i < FRAME_COUNT; i++) {
    const frameNum = String(i).padStart(4, '0');
    await page.screenshot({
      type: 'png',
      fullPage: false,
      path: path.join(FRAMES_DIR, `frame-${frameNum}.png`),
    });

    if ((i + 1) % 30 === 0) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const regionIdx = Math.min(Math.floor(i / (FRAME_COUNT / regionLabels.length)), regionLabels.length - 1);
      console.log(`[capture] Frame ${i + 1}/${FRAME_COUNT} (${elapsed}s) — ${regionLabels[regionIdx]}`);
    }
  }

  const captureElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[capture] Capture done in ${captureElapsed}s`);

  await browser.close();
  server.close();

  // --- Generate APNGs with ffmpeg ---
  // Use 480x270 resolution with every 10th frame for web-friendly sizes
  const CAPTURE_W = 480;
  const CAPTURE_H = 270;
  const MIDPOINT = FRAME_COUNT / 2;

  // Northern Hemisphere segment: frames 0-449, every 10th frame
  console.log('[capture] Building northern-hemisphere APNG...');
  execSync(
    `ffmpeg -y -framerate ${FPS} -i ${FRAMES_DIR}/frame-%04d.png ` +
    `-vf "select='between(n\\,0\\,449)*not(mod(n\\,10))', setpts=N/FRAME_RATE/TB, scale=${CAPTURE_W}:${CAPTURE_H}:flags=lanczos" ` +
    `-vsync 0 -plays 0 -f apng -lossless 1 -pix_fmt rgb565 ` +
    `-metadata title="Earth Tour - Northern Hemisphere" ` +
    `"${OUTPUT_DIR}/earth-tour-northern-hemisphere.png"`,
    { stdio: 'inherit' }
  );

  // Southern Hemisphere segment: frames 450-899, every 10th frame
  console.log('[capture] Building southern-hemisphere APNG...');
  execSync(
    `ffmpeg -y -framerate ${FPS} -i ${FRAMES_DIR}/frame-%04d.png ` +
    `-vf "select='gte(n\\,450)*not(mod(n\\,10))', setpts=N/FRAME_RATE/TB, scale=${CAPTURE_W}:${CAPTURE_H}:flags=lanczos" ` +
    `-vsync 0 -plays 0 -f apng -lossless 1 -pix_fmt rgb565 ` +
    `-metadata title="Earth Tour - Southern Hemisphere" ` +
    `"${OUTPUT_DIR}/earth-tour-south-hemisphere.png"`,
    { stdio: 'inherit' }
  );

  // Get sizes
  const northStat = fs.statSync(path.join(OUTPUT_DIR, 'earth-tour-northern-hemisphere.png'));
  const southStat = fs.statSync(path.join(OUTPUT_DIR, 'earth-tour-south-hemisphere.png'));

  console.log('\n[capture] Results:');
  console.log(`  earth-tour-northern-hemisphere.png: ${(northStat.size / 1024 / 1024).toFixed(1)} MB`);
  console.log(`  earth-tour-south-hemisphere.png:   ${(southStat.size / 1024 / 1024).toFixed(1)} MB`);
  console.log('\n[capture] Done!');
}

main().catch(err => {
  console.error('[capture] ERROR:', err);
  process.exit(1);
});
