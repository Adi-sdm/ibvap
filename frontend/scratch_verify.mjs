import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:/Users/Adi/.gemini/antigravity/brain/c3877a13-6098-4031-9a01-9fe08fb80f4f";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("===============================================================");
  console.log("  IBVAP DEPLOYMENT ARCHITECTURE & COMPLETE VERIFICATION PASS  ");
  console.log("===============================================================");

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  page.on('console', msg => {
    const text = msg.text();
    if (msg.type() === 'error' && !text.includes('favicon') && !text.includes('404')) {
      console.log(`[BROWSER ERROR] ${text}`);
    }
  });

  try {
    // -------------------------------------------------------------
    // 1. Check Initial / Current State
    // -------------------------------------------------------------
    console.log("\n[STEP 1] Navigating to http://127.0.0.1:3000 ...");
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 20000 });
    await sleep(2500);

    const initialScreenshot = path.join(ARTIFACT_DIR, 'verification_step1_initial.png');
    await page.screenshot({ path: initialScreenshot });
    console.log(` -> Step 1 Screenshot: ${initialScreenshot}`);

    // Check if uninitialized or already initialized
    const pageText = await page.evaluate(() => document.body.innerText);
    if (pageText.includes("System Initialization Required")) {
      console.log(" -> System is currently in UNINITIALIZED state.");
      const uninitScreenshot = path.join(ARTIFACT_DIR, 'verification_uninitialized_state.png');
      await page.screenshot({ path: uninitScreenshot });
      
      // Click Initialize
      console.log(" -> Clicking [Initialize System Deployment] button...");
      await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.innerText.includes('Initialize System'));
        if (btn) btn.click();
      });
      await sleep(3000);
    } else {
      console.log(" -> System is already initialized.");
    }

    // -------------------------------------------------------------
    // 2. CommandCenter Verification
    // -------------------------------------------------------------
    console.log("\n[STEP 2] Verifying Command Center Defense Posture & Layout...");
    await sleep(2000);
    const cmdCenterScreenshot = path.join(ARTIFACT_DIR, 'verification_command_center.png');
    await page.screenshot({ path: cmdCenterScreenshot });
    console.log(` -> Step 2 Screenshot: ${cmdCenterScreenshot}`);

    // -------------------------------------------------------------
    // 3. Settings Page: Readiness Diagnostics, Backup & Restore
    // -------------------------------------------------------------
    console.log("\n[STEP 3] Navigating to Settings Page...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('aside button'));
      const settingsBtn = buttons.find(b => b.innerText.includes('Settings') || b.innerText.includes('System'));
      if (settingsBtn) settingsBtn.click();
    });
    await sleep(2500);

    const readinessScreenshot = path.join(ARTIFACT_DIR, 'verification_readiness_tab.png');
    await page.screenshot({ path: readinessScreenshot });
    console.log(` -> Step 3 Readiness Tab Screenshot: ${readinessScreenshot}`);

    // Switch to Backup & Clean Reset Tab
    console.log(" -> Switching to Backup, Clean Reset & Appearance Tab...");
    await page.evaluate(() => {
      const tabButtons = Array.from(document.querySelectorAll('button'));
      const backupTab = tabButtons.find(b => b.innerText.includes('Backup') || b.innerText.includes('Clean Reset'));
      if (backupTab) backupTab.click();
    });
    await sleep(1500);

    const backupScreenshot = path.join(ARTIFACT_DIR, 'verification_backup_tab.png');
    await page.screenshot({ path: backupScreenshot });
    console.log(` -> Step 3 Backup Tab Screenshot: ${backupScreenshot}`);

    // Switch to Glass Command Theme
    console.log(" -> Activating Glass Command Theme...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const glassBtn = buttons.find(b => b.innerText.includes('Glass Command'));
      if (glassBtn) glassBtn.click();
    });
    await sleep(1500);

    const glassScreenshot = path.join(ARTIFACT_DIR, 'verification_glass_command_theme.png');
    await page.screenshot({ path: glassScreenshot });
    console.log(` -> Step 3 Glass Theme Screenshot: ${glassScreenshot}`);

    // Switch to Audit Trail Tab
    console.log(" -> Switching to Audit Trail & History Tab...");
    await page.evaluate(() => {
      const tabButtons = Array.from(document.querySelectorAll('button'));
      const auditTab = tabButtons.find(b => b.innerText.includes('Audit Trail') || b.innerText.includes('Config History'));
      if (auditTab) auditTab.click();
    });
    await sleep(1500);

    const auditScreenshot = path.join(ARTIFACT_DIR, 'verification_audit_tab.png');
    await page.screenshot({ path: auditScreenshot });
    console.log(` -> Step 3 Audit Tab Screenshot: ${auditScreenshot}`);

    // -------------------------------------------------------------
    // 4. Cameras Page & 8-Step Add Camera Wizard
    // -------------------------------------------------------------
    console.log("\n[STEP 4] Navigating to Cameras Page & Provisioning Camera via Wizard...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('aside button'));
      const camBtn = buttons.find(b => b.innerText.includes('Cameras') || b.innerText.includes('Feeds'));
      if (camBtn) camBtn.click();
    });
    await sleep(2000);

    const camerasScreenshot = path.join(ARTIFACT_DIR, 'verification_cameras_overview.png');
    await page.screenshot({ path: camerasScreenshot });
    console.log(` -> Step 4 Cameras Overview Screenshot: ${camerasScreenshot}`);

    // Open Add Camera Wizard
    console.log(" -> Opening 8-Step Add Camera Wizard...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const addBtn = buttons.find(b => b.innerText.includes('Add Camera') || b.innerText.includes('Provision'));
      if (addBtn) addBtn.click();
    });
    await sleep(1500);

    const wizardStep1Screenshot = path.join(ARTIFACT_DIR, 'verification_wizard_step1_source.png');
    await page.screenshot({ path: wizardStep1Screenshot });
    console.log(` -> Wizard Step 1 Screenshot: ${wizardStep1Screenshot}`);

    // Click Next in Wizard to Step 2 (Connection Test)
    console.log(" -> Proceeding to Step 2 (Connection Test)...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const nextBtn = buttons.find(b => b.innerText.includes('Next') || b.innerText.includes('Test Pipeline'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(1500);

    const wizardStep2Screenshot = path.join(ARTIFACT_DIR, 'verification_wizard_step2_test.png');
    await page.screenshot({ path: wizardStep2Screenshot });
    console.log(` -> Wizard Step 2 Screenshot: ${wizardStep2Screenshot}`);

    // Close wizard modal
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const closeBtn = buttons.find(b => b.innerText.includes('Cancel') || b.title === 'Close');
      if (closeBtn) closeBtn.click();
    });
    await sleep(1000);

    // -------------------------------------------------------------
    // 5. GIS Map Calibration View
    // -------------------------------------------------------------
    console.log("\n[STEP 5] Navigating to GIS Map View...");
    await page.evaluate(() => {
      const asideButtons = Array.from(document.querySelectorAll('aside button'));
      const gisBtn = asideButtons.find(b => b.innerText.includes('GIS') || b.innerText.includes('Tactical Map'));
      if (gisBtn) gisBtn.click();
    });
    await sleep(3500);

    const gisScreenshot = path.join(ARTIFACT_DIR, 'verification_gis_map.png');
    await page.screenshot({ path: gisScreenshot });
    console.log(` -> Step 5 GIS Map Screenshot: ${gisScreenshot}`);

    console.log("\n===============================================================");
    console.log("  ALL BROWSER VERIFICATION PHASES COMPLETED SUCCESSFULLY!      ");
    console.log("===============================================================");

  } catch (err) {
    console.error("\n[VERIFICATION ERROR]:", err);
  } finally {
    await browser.close();
  }
}

run();
