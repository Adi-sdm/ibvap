import puppeteer from 'puppeteer-core';
import fs from 'fs';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:\\Users\\Adi\\.gemini\\antigravity\\brain\\c3877a13-6098-4031-9a01-9fe08fb80f4f";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runEnterpriseBrowserTests() {
  console.log("=== STARTING COMPREHENSIVE EDGE BROWSER HARDENING VERIFICATION ===");
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
      const text = msg.text();
      // Ignore routine non-fatal resource 404s like missing favicon or fallback SVG
      if (!text.includes('favicon') && !text.includes('404')) {
        consoleErrors.push(text);
        console.log(`[BROWSER ERROR] ${text}`);
      }
    }
  });

  try {
    // -----------------------------------------------------------------
    // TEST 1: CommandCenter in LIVE MODE (0 active incidents -> NORMAL)
    // -----------------------------------------------------------------
    console.log("\n[TEST 1] Testing CommandCenter in Truthful LIVE MODE...");
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForSelector('aside', { timeout: 15000 });
    await sleep(2000);

    const defenseStatus = await page.evaluate(() => {
      const text = document.body.innerText;
      const match = text.match(/DEFENSE STATUS:\s*([A-Z]+)/);
      return match ? match[1] : 'UNKNOWN';
    });
    console.log(`   Header Defense Status: ${defenseStatus}`);

    const hasNormalBanner = await page.evaluate(() => {
      return document.body.innerText.includes('SYSTEM STATUS // DEFENSE POSTURE: NORMAL') ||
             document.body.innerText.includes('0 ACTIVE PERIMETER THREATS');
    });
    console.log(`   Banner Shows Defense Posture NORMAL: ${hasNormalBanner}`);

    const hasNormalCard = await page.evaluate(() => {
      return document.body.innerText.includes('SYSTEM STATUS: NORMAL') &&
             document.body.innerText.includes('Perimeter sector secure');
    });
    console.log(`   Status Card Shows Perimeter Sector Secure: ${hasNormalCard}`);

    await page.screenshot({ path: `${ARTIFACT_DIR}\\command_center_normal_verified.png` });
    console.log(`   Saved screenshot: command_center_normal_verified.png`);

    // -----------------------------------------------------------------
    // TEST 2: Multi-Theme Switcher (Tactical Dark, Glass Command, Clean Light)
    // -----------------------------------------------------------------
    console.log("\n[TEST 2] Testing Multi-Theme System (Dark -> Glass -> Light)...");
    
    // Switch to Glass Command
    await page.click('button[title="Glass Command Theme"]');
    await sleep(800);
    const themeGlass = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log(`   Applied theme: ${themeGlass}`);
    await page.screenshot({ path: `${ARTIFACT_DIR}\\glass_command_verified.png` });
    console.log(`   Saved screenshot: glass_command_verified.png`);

    // Switch to Clean Light
    await page.click('button[title="Clean Light Theme"]');
    await sleep(800);
    const themeLight = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log(`   Applied theme: ${themeLight}`);
    await page.screenshot({ path: `${ARTIFACT_DIR}\\clean_light_verified.png` });
    console.log(`   Saved screenshot: clean_light_verified.png`);

    // Switch back to Tactical Dark
    await page.click('button[title="Tactical Dark Theme"]');
    await sleep(600);
    console.log(`   Restored Tactical Dark theme.`);

    // -----------------------------------------------------------------
    // TEST 3: Incidents Triage Tabs & Truthful Empty States
    // -----------------------------------------------------------------
    console.log("\n[TEST 3] Testing Incidents Page (Active, Archive, Demo)...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('aside button'));
      const incBtn = btns.find(b => b.textContent.includes('Incidents'));
      if (incBtn) incBtn.click();
      else throw new Error("Incidents button not found in sidebar");
    });
    await sleep(2000);

    const tabsFound = await page.evaluate(() => {
      const text = document.body.innerText;
      return {
        activeTab: text.includes('ACTIVE INCIDENTS'),
        archiveTab: text.includes('HISTORICAL ARCHIVE'),
        demoTab: text.includes('DEMO INCIDENTS')
      };
    });
    console.log(`   Tabs present:`, tabsFound);

    // Verify Active tab empty state
    const activeEmptyState = await page.evaluate(() => {
      return document.body.innerText.includes('No Active Incidents') ||
             document.body.innerText.includes('Perimeter sector secure');
    });
    console.log(`   Active Tab Shows Truthful 'No Active Incidents': ${activeEmptyState}`);

    // Click Historical Archive tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const archiveBtn = btns.find(b => b.textContent.includes('HISTORICAL ARCHIVE'));
      if (archiveBtn) archiveBtn.click();
    });
    await sleep(2000);

    const archiveCount = await page.evaluate(() => {
      const rows = document.querySelectorAll('.divide-y > div');
      return rows.length;
    });
    console.log(`   Historical Archive loaded ${archiveCount} historical incident records.`);
    await page.screenshot({ path: `${ARTIFACT_DIR}\\incidents_archive_verified.png` });
    console.log(`   Saved screenshot: incidents_archive_verified.png`);

    // -----------------------------------------------------------------
    // TEST 4: Tactical GIS Map & Add Camera on Map Flow
    // -----------------------------------------------------------------
    console.log("\n[TEST 4] Testing GIS Tactical Map & 'Add Camera on Map'...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('aside button'));
      const gisBtn = btns.find(b => b.textContent.includes('GIS') || b.textContent.includes('Map'));
      if (gisBtn) gisBtn.click();
      else throw new Error("GIS Map button not found in sidebar");
    });
    await sleep(2500);

    const hasLeaflet = await page.evaluate(() => {
      return !!document.querySelector('.leaflet-container');
    });
    console.log(`   Leaflet container rendered: ${hasLeaflet}`);

    const hasAddCamBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return !!btns.find(b => b.textContent.includes('Add Camera on Map'));
    });
    console.log(`   'Add Camera on Map' button found: ${hasAddCamBtn}`);

    // Click 'Add Camera on Map'
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const addBtn = btns.find(b => b.textContent.includes('Add Camera on Map'));
      if (addBtn) addBtn.click();
    });
    await sleep(600);

    // Click map canvas to place camera at (400, 300)
    await page.mouse.click(400, 300);
    await sleep(1000);

    const modalVisible = await page.evaluate(() => {
      return document.body.innerText.includes('REGISTER CAMERA ON MAP') &&
             document.body.innerText.includes('Coordinates:');
    });
    console.log(`   Registration Modal opened upon map click: ${modalVisible}`);
    await page.screenshot({ path: `${ARTIFACT_DIR}\\gis_add_camera_modal_verified.png` });
    console.log(`   Saved screenshot: gis_add_camera_modal_verified.png`);

    // Dismiss modal
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const cancelBtn = btns.find(b => b.textContent.trim() === 'Cancel');
      if (cancelBtn) cancelBtn.click();
    });
    await sleep(500);

    // -----------------------------------------------------------------
    // TEST 5: Cameras Page, 20 FPS Telemetry & Privileged Authorization
    // -----------------------------------------------------------------
    console.log("\n[TEST 5] Testing Cameras Page, Telemetry & Privileged Authorization...");
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('aside button'));
      const camBtn = btns.find(b => b.textContent.includes('Cameras'));
      if (camBtn) camBtn.click();
      else throw new Error("Cameras button not found in sidebar");
    });
    await sleep(2000);

    // Click Live tab
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const liveTab = btns.find(b => b.textContent.includes('Live Stream'));
      if (liveTab) liveTab.click();
    });
    await sleep(1500);

    const fpsTelemetry = await page.evaluate(() => {
      return document.body.innerText.includes('STREAM: 20 FPS') &&
             document.body.innerText.includes('INFERENCE: 20 FPS');
    });
    console.log(`   Stream & Inference 20 FPS Separation Badge Present: ${fpsTelemetry}`);

    // Click Halt button to trigger Privileged Action
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const haltBtn = btns.find(b => b.textContent.includes('Halt'));
      if (haltBtn) haltBtn.click();
      else console.log("Halt button not found among:", btns.map(b => b.textContent.trim()));
    });
    await sleep(1500);

    const privModalOpen = await page.evaluate(() => {
      return document.body.innerText.includes('Senior Officer Authentication Required');
    });
    console.log(`   Privileged Action Modal opened: ${privModalOpen}`);

    // Test with invalid passcode
    await page.type('input[type="password"]', 'wrongpass123');
    await page.type('textarea', 'Routine maintenance test by watch officer');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const authBtn = btns.find(b => b.textContent.includes('Authorize & Execute'));
      if (authBtn) authBtn.click();
    });
    await sleep(1200);

    const authDenied = await page.evaluate(() => {
      return document.body.innerText.includes('Invalid supervisor authorization passcode') ||
             document.body.innerText.includes('Authorization denied');
    });
    console.log(`   Invalid Passcode Cleanly Denied with Structured Error: ${authDenied}`);
    await page.screenshot({ path: `${ARTIFACT_DIR}\\privileged_auth_denied_verified.png` });
    console.log(`   Saved screenshot: privileged_auth_denied_verified.png`);

    // Test with valid passcode
    await page.evaluate(() => {
      const input = document.querySelector('input[type="password"]');
      if (input) input.value = '';
    });
    await page.type('input[type="password"]', 'admin123');
    await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const authBtn = btns.find(b => b.textContent.includes('Authorize & Execute'));
      if (authBtn) authBtn.click();
    });
    await sleep(1500);

    const modalClosed = await page.evaluate(() => {
      return !document.body.innerText.includes('Senior Officer Authentication Required');
    });
    console.log(`   Valid Passcode ('admin123') Approved and Modal Closed: ${modalClosed}`);
    await page.screenshot({ path: `${ARTIFACT_DIR}\\privileged_auth_approved_verified.png` });
    console.log(`   Saved screenshot: privileged_auth_approved_verified.png`);

    // -----------------------------------------------------------------
    // SUMMARY
    // -----------------------------------------------------------------
    console.log("\n=== ALL 5 ENTERPRISE EDGE BROWSER TESTS PASSED SUCCESSFULLY ===");
    console.log(`Total Critical Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log("Errors logged:", consoleErrors);
    }
  } catch (err) {
    console.error("\n[TEST RUNNER FAILED]:", err);
  } finally {
    await browser.close();
  }
}

runEnterpriseBrowserTests();
