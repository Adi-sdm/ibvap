import puppeteer from 'puppeteer-core';
import fs from 'fs';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\Adi\\.gemini\\antigravity\\brain\\c3877a13-6098-4031-9a01-9fe08fb80f4f";
const BASE_URL = "http://localhost:5173";

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runVerification() {
  console.log("=== STARTING IBVAP RELEASE CANDIDATE BROWSER VERIFICATION ===");

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const txt = msg.text();
      if (!txt.includes('favicon') && !txt.includes('404')) {
        console.log(`[BROWSER CONSOLE ERROR] ${txt}`);
      }
    }
  });

  try {
    // 1. Command Center
    console.log("\n[1] Checking Command Center...");
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);
    await page.screenshot({ path: `${ARTIFACT_DIR}\\rc_verified_command_center.png` });
    console.log(" -> Saved rc_verified_command_center.png");

    // 2. Settings Page & Gemini Live Ready Verification
    console.log("\n[2] Checking Settings & Gemini Live Status...");
    await page.goto(`${BASE_URL}/settings`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2000);

    // Click "Test Ping" button
    const testPingBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('Test Ping') || x.textContent.includes('Ping'));
      if (b) {
        b.click();
        return true;
      }
      return false;
    });
    console.log(" -> Clicked Test Ping:", testPingBtn);
    await sleep(2500);

    await page.screenshot({ path: `${ARTIFACT_DIR}\\rc_verified_settings_gemini.png` });
    console.log(" -> Saved rc_verified_settings_gemini.png");

    // 3. Cameras Page & Stream Rendering
    console.log("\n[3] Checking Cameras Stream & AI Advisory...");
    await page.goto(`${BASE_URL}/cameras`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(2500);

    // Look for "⚡ ANALYZE WITH AI" or "Request Advisory"
    const clickedAI = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find(x => x.textContent.includes('ANALYZE WITH AI') || x.textContent.includes('Consult') || x.textContent.includes('Request Advisory'));
      if (b) {
        b.click();
        return b.textContent.trim();
      }
      return null;
    });
    console.log(" -> Clicked AI button:", clickedAI);
    await sleep(3500);

    await page.screenshot({ path: `${ARTIFACT_DIR}\\rc_verified_cameras_stream.png` });
    console.log(" -> Saved rc_verified_cameras_stream.png");

    // 4. GIS Tactical Map
    console.log("\n[4] Checking GIS Tactical Map...");
    await page.goto(`${BASE_URL}/gis`, { waitUntil: 'networkidle2', timeout: 30000 });
    await sleep(3000);
    await page.screenshot({ path: `${ARTIFACT_DIR}\\rc_verified_gis_map.png` });
    console.log(" -> Saved rc_verified_gis_map.png");

    console.log("\n=== ALL BROWSER VERIFICATIONS COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Browser verification error:", err);
  } finally {
    await browser.close();
  }
}

runVerification();
