/**
 * Captures a 10-second animated PNG (APNG) of the Three.js Earth dashboard.
 *
 * Uses headless Chrome (via Puppeteer) to navigate to localhost:3000,
 * wait for textures and cinematic mode to activate, then captures
 * frames at 15fps for 10 seconds.
 *
 * Output: /tmp/canvas-frames/frame-*.png -> combined into APNG by ffmpeg
 */
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 15;
const DURATION = 10; // seconds
const FRAME_COUNT = FPS * DURATION;
const INTERVAL = 1000 / FPS;

const FRAMES_DIR = '/tmp/canvas-frames';

(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-web-security',
      '--enable-webgl',
      '--enable-unsafe-swiftshader',
      `--window-size=${WIDTH},${HEIGHT}`,
    ],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });

  console.log('[capture] Navigating to localhost:3000...');
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Wait for loading UI to disappear
  console.log('[capture] Waiting for textures to load...');
  try {
    await page.waitForFunction(
      () => !document.querySelector('#loading-text'),
      { timeout: 20000 }
    );
    console.log('[capture] Textures loaded.');
  } catch {
    console.log('[capture] Loading element still present, continuing after timeout.');
  }

  // Wait additional time for cinematic mode to activate
  console.log('[capture] Waiting for cinematic camera demo (12s)...');
  await new Promise(r => setTimeout(r, 12000));

  // Start recording
  console.log(`[capture] Starting ${DURATION}s recording at ${FPS}fps (${FRAME_COUNT} frames)...`);

  // Clean up old frames
  if (fs.existsSync(FRAMES_DIR)) {
    fs.rmSync(FRAMES_DIR, { recursive: true });
  }
  fs.mkdirSync(FRAMES_DIR, { recursive: true });

  const startTime = Date.now();
  for (let i = 0; i < FRAME_COUNT; i++) {
    const screenshot = await page.screenshot({
      type: 'png',
      fullPage: false,
    });
    fs.writeFileSync(
      path.join(FRAMES_DIR, `frame-${String(i).padStart(4, '0')}.png`),
      screenshot
    );
    if ((i + 1) % 15 === 0) {
      console.log(`[capture] Frame ${i + 1}/${FRAME_COUNT}`);
    }

    const elapsed = Date.now() - startTime;
    const targetTime = (i + 1) * INTERVAL;
    const delay = targetTime - elapsed;
    if (delay > 0) await new Promise(r => setTimeout(r, delay));
  }

  const totalTime = (Date.now() - startTime) / 1000;
  console.log(`[capture] Done! ${FRAME_COUNT} frames in ${totalTime.toFixed(1)}s`);
  console.log(`[capture] Frames saved to ${FRAMES_DIR}/`);

  await browser.close();
  console.log('[capture] Browser closed.');
  console.log('[capture] Run: ffmpeg -framerate ' + FPS + ' -i ' + FRAMES_DIR + '/frame-%04d.png -plays 0 -f apng animated-earth.png');
})();
