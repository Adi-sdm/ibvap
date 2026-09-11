import puppeteer from 'puppeteer-core';
import path from 'path';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:/Users/Adi/.gemini/antigravity/brain/c3877a13-6098-4031-9a01-9fe08fb80f4f";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 20000 });
  await sleep(2000);

  // Navigate to GIS Map
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('aside button'));
    const gisBtn = buttons.find(b => b.innerText.includes('GIS') || b.innerText.includes('Tactical Map'));
    if (gisBtn) gisBtn.click();
  });
  await sleep(4000);

  const gisScreenshot = path.join(ARTIFACT_DIR, 'gis_calibrated_cone_verified.png');
  await page.screenshot({ path: gisScreenshot });
  console.log("Captured GIS map screenshot:", gisScreenshot);

  await browser.close();
}

run();
