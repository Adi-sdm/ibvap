import puppeteer from 'puppeteer-core';
import fs from 'fs';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function runTest() {
  console.log("=== STARTING LIVE BROWSER VERIFICATION: GIS MAP + DEFENSE STATUS + CAMERAS ===");
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`[BROWSER ERROR] ${msg.text()}`);
    }
  });

  try {
    console.log("1. Navigating to http://127.0.0.1:3000 in Edge...");
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 20000 });
    await page.waitForSelector('aside', { timeout: 10000 });

    // Read header Defense Status
    const defenseStatusText = await page.evaluate(() => {
      const el = document.body.innerText;
      const match = el.match(/DEFENSE STATUS:\s*([A-Z]+)/);
      return match ? match[0] : 'NOT FOUND';
    });
    console.log(`   Header Defense Status: ${defenseStatusText}`);

    // Navigate to GIS Map
    console.log("2. Navigating to 'GIS Map' via sidebar...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('aside button'));
      const gisBtn = btns.find(b => b.textContent.includes('GIS Map') || b.textContent.includes('GIS Tactical') || b.textContent.includes('Map'));
      if (gisBtn) gisBtn.click();
      else throw new Error("GIS Map button not found in sidebar");
    });

    await new Promise(r => setTimeout(r, 3000));

    // Verify Leaflet Container
    const hasLeaflet = await page.evaluate(() => {
      return document.querySelector('.leaflet-container') !== null;
    });
    console.log(`   Leaflet Map Initialized: ${hasLeaflet}`);

    // Check for camera nodes rendered in sidebar and on map
    const gisInfo = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.custom-camera-node')).length;
      const sidebarItems = document.body.innerText.includes('SURVEILLANCE NODES');
      return { nodesOnMap: nodes, sidebarPresent: sidebarItems };
    });
    console.log(`   GIS Map Info:`, gisInfo);

    // Capture GIS Map Screenshot
    const gisScreenshotPath = "C:/Users/Adi/.gemini/antigravity/brain/c3877a13-6098-4031-9a01-9fe08fb80f4f/gis_leaflet_verified.png";
    await page.screenshot({ path: gisScreenshotPath, fullPage: false });
    console.log(`   Saved GIS Map screenshot to: ${gisScreenshotPath}`);

    // Navigate to Cameras Page
    console.log("3. Navigating to 'Cameras' page via sidebar...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('aside button'));
      const camBtn = btns.find(b => b.textContent.includes('Cameras'));
      if (camBtn) camBtn.click();
    });

    await new Promise(r => setTimeout(r, 2500));

    // Capture Cameras Screenshot
    const camScreenshotPath = "C:/Users/Adi/.gemini/antigravity/brain/c3877a13-6098-4031-9a01-9fe08fb80f4f/cameras_live_verified.png";
    await page.screenshot({ path: camScreenshotPath, fullPage: false });
    console.log(`   Saved Cameras screenshot to: ${camScreenshotPath}`);

    console.log(`4. Total Console Errors Observed: ${consoleErrors.length}`);
    console.log("=== BROWSER VERIFICATION COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Browser verification error:", err);
  } finally {
    await browser.close();
  }
}

runTest();
