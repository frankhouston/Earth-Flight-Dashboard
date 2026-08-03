/**
 * Captures a large animated PNG (APNG) of the Pluto globe doing two full rotations.
 *
 * 1. Starts a local HTTP server to serve pluto_continuous_demo.html
 * 2. Uses Puppeteer (headless Chrome) to load the page
 * 3. Waits for texture load, sets rotation speed to max
 * 4. Captures frames at 30fps for two full rotations (~12.5s)
 * 5. Combines into APNG via ffmpeg
 *
 * Output: pluto_two_rotations_apng.png
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import puppeteer from 'puppeteer';

const WIDTH = 960;
const HEIGHT = 540;
const FPS = 10;
const ROTATIONS = 2;

// At speed=2.0: rotation rate = speed * 0.5 = 1.0 rad/s
// One rotation = 2pi radians -> 6.283s
// Two rotations -> 12.566s
const ROTATION_RATE = 2.0 * 0.5; // 1.0 rad/s
const ONE_ROTATION_TIME = (2 * Math.PI) / ROTATION_RATE; // ~6.283s
const DURATION = ONE_ROTATION_TIME * ROTATIONS; // ~12.566s
const FRAME_COUNT = Math.ceil(FPS * DURATION); // ~377 frames

const FRAMES_DIR = '/tmp/pluto-frames';
const PROJECT_DIR = path.dirname(fileURLToPath(import.meta.url));
const HTML_FILE = 'pluto_continuous_demo.html';
const OUTPUT_APNG = path.join(PROJECT_DIR, 'pluto_two_rotations_apng.png');

// Start a simple static file server
const server = http.createServer((req, res) => {
  let filePath;
  if (req.url === '/' || req.url === '/pluto_continuous_demo.html') {
    filePath = path.join(PROJECT_DIR, HTML_FILE);
  } else {
    filePath = path.join(PROJECT_DIR, req.url);
  }
  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };
  const contentType = mime[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
});

// ── Main capture routine ──────────────────────────────────────────────
(async () => {
  // Start server
  server.listen(8399, 'localhost', () => {
    console.log(`[capture] Server listening on http://localhost:8399/`);
  });

  const browser = await puppeteer.launch({
    headless: true,
    executablePath: '/Users/frank/.cache/puppeteer/chrome/mac_arm-151.0.7922.47/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
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

  console.log(`[capture] Navigating to Pluto demo...`);
  await page.goto('http://localhost:8399/pluto_continuous_demo.html', { waitUntil: 'networkidle0', timeout: 60000 });

  // Wait for texture to load (status text should change from "Loading…")
  console.log('[capture] Waiting for textures to load...');
  await page.waitForFunction(
    () => {
      const s = document.getElementById('status');
      return s && s.textContent && s.textContent.includes('Drag to rotate');
    },
    { timeout: 60000 }
  );
  console.log('[capture] Globe fully rendered.');

  // Wait extra for first frame to draw
  await new Promise(r => setTimeout(r, 1000));

  // Set rotation speed to max (2.0) for faster capture
  const speedSlider = await page.$('#speed');
  if (speedSlider) {
    await speedSlider.evaluate(el => el.value = '2.0');
    await speedSlider.evaluate(el => {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    console.log('[capture] Set rotation speed to 2.0');
  }

  // Prepare frames directory
  if (fs.existsSync(FRAMES_DIR)) {
    fs.rmSync(FRAMES_DIR, { recursive: true });
  }
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  console.log(`[capture] Starting ${DURATION.toFixed(1)}s capture of ${ROTATIONS} rotations`);
  console.log(`[capture] ${FRAME_COUNT} frames at ${FPS}fps, ${WIDTH}x${HEIGHT}`);

  const startTime = Date.now();
  for (let i = 0; i < FRAME_COUNT; i++) {
    await page.screenshot({
      type: 'png',
      fullPage: false,
      path: path.join(FRAMES_DIR, `frame-${String(i).padStart(4, '0')}.png`),
    });

    if ((i + 1) % 30 === 0) {
      console.log(`[capture] Frame ${i + 1}/${FRAME_COUNT}`);
    }

    const elapsed = Date.now() - startTime;
    const targetTime = (i + 1) * (1000 / FPS);
    const delay = targetTime - elapsed;
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
  }

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`[capture] Done! ${FRAME_COUNT} frames in ${totalTime.toFixed(1)}s`);

  await browser.close();
  server.close();
  console.log('[capture] Browser closed, server stopped.');

  // Combine into APNG
  console.log('[capture] Combining frames into APNG with ffmpeg...');

  // ffmpeg APNG: -plays 0 means infinite loop
  execSync(
    `ffmpeg -y -framerate ${FPS} -i ${FRAMES_DIR}/frame-%04d.png ` +
    `-plays 0 -f apng -lossless 1 -pix_fmt rgba ` +
    `-vf "scale=${WIDTH}:${HEIGHT}" ` +
    `"${OUTPUT_APNG}"`,
    { stdio: 'inherit' }
  );

  const apngStats = fs.statSync(OUTPUT_APNG);
  console.log(`[capture] APNG saved: ${OUTPUT_APNG}`);
  console.log(`[capture] File size: ${(apngStats.size / 1024 / 1024).toFixed(1)} MB`);
  console.log('[capture] All done!');
})().catch(err => {
  console.error('[capture] ERROR:', err);
  process.exit(1);
});
