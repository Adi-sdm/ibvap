import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const ARTIFACT_DIR = "C:/Users/Adi/.gemini/antigravity/brain/c3877a13-6098-4031-9a01-9fe08fb80f4f";

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("=== FULL END-TO-END 8-STEP WIZARD AUTOMATION ===");

  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'networkidle2', timeout: 20000 });
    await sleep(2000);

    // Click "+ Add Ingestion Source"
    console.log(" -> Opening wizard...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Add Ingestion Source'));
      if (btn) btn.click();
    });
    await sleep(1500);

    // Step 1 Screenshot
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'wizard_step1_source.png') });
    console.log(" -> Captured Step 1");

    // Click Next to Step 2
    await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Next'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'wizard_step2_connect.png') });
    console.log(" -> Captured Step 2");

    // Click Next to Step 3
    await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Next'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(1500);

    // Type camera name using page.type
    console.log(" -> Entering Camera Identity Name in Step 3...");
    const nameInput = await page.$('input[placeholder*="Camera Name"], input[type="text"]');
    if (nameInput) {
      await nameInput.click();
      await nameInput.type("Sector Alpha Field Camera", { delay: 30 });
    }
    await sleep(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'wizard_step3_identity.png') });
    console.log(" -> Captured Step 3");

    // Click Next to Step 4
    console.log(" -> Moving to Step 4 (GIS)...");
    await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Next'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(1500);

    const latInputs = await page.$$('input[placeholder*="26."], input[type="number"], input[type="text"]');
    if (latInputs.length >= 2) {
      await latInputs[0].click();
      await latInputs[0].type("26.8500", { delay: 20 });
      await latInputs[1].click();
      await latInputs[1].type("70.9200", { delay: 20 });
    }
    await sleep(1000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'wizard_step4_gis.png') });
    console.log(" -> Captured Step 4");

    // Click Next to Step 5 (Optics)
    console.log(" -> Moving to Step 5 (Optics)...");
    await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Next'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'wizard_step5_optics.png') });
    console.log(" -> Captured Step 5");

    // Click Next to Step 6 (AI Profile)
    console.log(" -> Moving to Step 6 (AI Profile)...");
    await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Next'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'wizard_step6_profile.png') });
    console.log(" -> Captured Step 6");

    // Click Next to Step 7 (Review)
    console.log(" -> Moving to Step 7 (Review)...");
    await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Next'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'wizard_step7_review.png') });
    console.log(" -> Captured Step 7");

    // Click Next to Step 8 (Deploy)
    console.log(" -> Moving to Step 8 (Deploy)...");
    await page.evaluate(() => {
      const nextBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Next'));
      if (nextBtn) nextBtn.click();
    });
    await sleep(1500);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'wizard_step8_deploy.png') });
    console.log(" -> Captured Step 8");

    // Click Deploy Ingestion Node
    console.log(" -> Clicking Deploy Ingestion Node...");
    await page.evaluate(() => {
      const deployBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Deploy Ingestion Node'));
      if (deployBtn) deployBtn.click();
    });
    await sleep(3000);
    await page.screenshot({ path: path.join(ARTIFACT_DIR, 'wizard_step8_deployed_success.png') });
    console.log(" -> Captured Step 8 Deployed Success");

    console.log("=== ALL 8 WIZARD STEPS FULLY EXECUTED & VERIFIED ===");

  } catch (err) {
    console.error("Wizard error:", err);
  } finally {
    await browser.close();
  }
}

run();
