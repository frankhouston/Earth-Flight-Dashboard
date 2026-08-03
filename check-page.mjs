import puppeteer from 'puppeteer';

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox','--disable-web-security','--enable-webgl','--enable-unsafe-swiftshader'],
});

const page = await browser.newPage();
const errors = [];
const resourceErrors = [];
page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', err => errors.push(err.message));
page.on('requestfailed', req => {
  if (req.resourceType() === 'image' || req.resourceType() === 'xhr' || req.resourceType() === 'fetch') {
    resourceErrors.push(`${req.resourceType()}: ${req.url()}`);
  }
});

await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 });
await new Promise(r => setTimeout(r, 8000));

const canvasExists = await page.evaluate(() => document.querySelector('canvas') !== null);
const loadingExists = await page.evaluate(() => document.querySelector('#loading-text') !== null);
const statCardsExist = await page.evaluate(() => document.querySelector('.stat-cards') !== null);
const tickerExists = await page.evaluate(() => document.querySelector('.route-ticker') !== null);
const hudExists = await page.evaluate(() => document.querySelector('.hud-overlay') !== null);

console.log('Canvas exists:', canvasExists);
console.log('Loading text still visible:', loadingExists);
console.log('Stat cards visible:', statCardsExist);
console.log('Route ticker visible:', tickerExists);
console.log('HUD overlay visible:', hudExists);
console.log('Console errors:', errors.length > 0 ? errors.join('\n') : 'none');
console.log('Resource errors (textures/images):', resourceErrors.length > 0 ? resourceErrors.join('\n') : 'none');

await browser.close();
