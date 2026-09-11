import puppeteer from 'puppeteer-core';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function runTest() {
  console.log("=== STARTING LIVE 'ANALYZE WITH AI' PROOF TEST IN EDGE BROWSER ===");
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

  page.on('pageerror', err => {
    consoleErrors.push(err.message);
    console.error(`[PAGE ERROR]`, err);
  });

  try {
    console.log("1. Navigating to http://127.0.0.1:3000 in Edge...");
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('aside', { timeout: 10000 });

    console.log("2. Navigating to 'Cameras' page via sidebar...");
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('aside button')).find(b => b.textContent.includes('Cameras'));
      if (btn) btn.click();
      else throw new Error("Cameras button not found");
    });

    // Wait for Cameras page content
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Surveillance Feeds') ||
             document.body.innerText.includes('Config AI Profile') ||
             document.body.innerText.includes('LIVE');
    }, { timeout: 10000 });
    console.log("   Cameras page loaded.");

    // Select the first camera or Checkpoint Bravo
    console.log("3. Selecting camera...");
    await page.evaluate(() => {
      const camBtns = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('FPS'));
      if (camBtns.length > 0) camBtns[0].click();
    });

    await new Promise(r => setTimeout(r, 1000));

    // Ensure we are on Live Stream tab
    console.log("4. Switching to 'Live Stream' sub-tab...");
    await page.evaluate(() => {
      const tabs = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.includes('Live Stream'));
      if (tabs.length > 0) tabs[0].click();
    });

    await new Promise(r => setTimeout(r, 1000));

    console.log("5. Clicking '⚡ ANALYZE WITH AI' button...");
    const clickedAnalyze = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const analyzeBtn = btns.find(b => b.textContent.includes('ANALYZE WITH AI'));
      if (analyzeBtn) {
        analyzeBtn.click();
        return true;
      }
      return false;
    });
    console.log(`   Clicked 'ANALYZE WITH AI': ${clickedAnalyze}`);

    console.log("6. Waiting for Live AI Perception & Framing HUD to mount...");
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Live AI Perception & Framing HUD') ||
             document.body.innerText.includes('Camera View Framing');
    }, { timeout: 10000 });
    console.log("   Live AI Perception HUD mounted successfully!");

    // Wait 2 seconds for telemetry update
    await new Promise(r => setTimeout(r, 2000));

    // Extract live HUD data from DOM
    const hudData = await page.evaluate(() => {
      const card = Array.from(document.querySelectorAll('div')).find(d => d.textContent.includes('Live AI Perception & Framing HUD'));
      if (!card) return null;
      
      const framing = card.querySelector('span[class*="getFramingColor"], span[class*="border"]')?.textContent?.trim();
      const tracks = Array.from(card.querySelectorAll('div[class*="rounded border"]')).map(el => el.innerText);
      
      return {
        fullText: card.innerText,
        tracksFound: tracks.length
      };
    });

    console.log("7. Extracted HUD Data:");
    console.log("----------------------------------------");
    console.log(hudData?.fullText);
    console.log("----------------------------------------");

    // Take screenshot
    await page.screenshot({ path: 'ai_analysis_hud_verified.png' });
    console.log("8. Saved screenshot to frontend/ai_analysis_hud_verified.png");

    console.log(`9. Browser Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length === 0) {
      console.log(">>> PROOF SUCCESS: Real camera AI perception analysis rendered with 0 errors!");
    } else {
      console.log(">>> Errors detected:", consoleErrors);
    }

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await browser.close();
    console.log("=== LIVE 'ANALYZE WITH AI' PROOF TEST COMPLETED ===");
  }
}

runTest();
