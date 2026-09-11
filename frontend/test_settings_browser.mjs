import puppeteer from 'puppeteer-core';

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

async function runTest() {
  console.log("=== STARTING LIVE SETTINGS PROOF TEST IN EDGE BROWSER ===");
  const browser = await puppeteer.launch({
    executablePath: EDGE_PATH,
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  const page = await browser.newPage();
  
  const consoleErrors = [];
  const consoleWarnings = [];
  const consoleLogs = [];

  page.on('console', msg => {
    const text = msg.text();
    const type = msg.type();
    if (type === 'error') {
      consoleErrors.push(text);
      console.log(`[BROWSER CONSOLE ERROR] ${text}`);
    } else if (type === 'warning') {
      consoleWarnings.push(text);
    } else {
      consoleLogs.push(text);
    }
  });

  page.on('pageerror', error => {
    consoleErrors.push(error.message);
    console.error(`[BROWSER UNCAUGHT EXCEPTION]`, error);
  });

  try {
    console.log("1. Navigating to http://127.0.0.1:3000 in Edge browser...");
    await page.goto('http://127.0.0.1:3000', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('aside', { timeout: 10000 });
    console.log("   Initial application loaded successfully.");

    console.log("2. Clicking 'Settings' in sidebar...");
    const clickedSettings = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('aside button'));
      const btn = buttons.find(b => b.textContent.includes('Settings'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    });

    if (!clickedSettings) throw new Error("Settings button not found in sidebar");
    console.log("   Clicked Settings button.");

    // Wait for Settings header
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Platform Configuration & Intelligence') ||
             document.body.innerText.includes('Global Surveillance & Sensitivity Parameters');
    }, { timeout: 10000 });

    console.log("   Settings page loaded cleanly. Crash reproduced: NONE (Fixed).");

    // Check Audit Log section
    const auditLogText = await page.evaluate(() => {
      return document.body.innerText.includes('Audit Trail') ||
             document.body.innerText.includes('System Audit Log') ||
             document.body.innerText.includes('AUDIT');
    });
    console.log(`   Audit Log section rendered: ${auditLogText}`);

    // Wait 1s for initial settings data to populate from backend
    await new Promise(r => setTimeout(r, 1000));

    // Find the Alert Threshold slider
    console.log("3. Inspecting Global Incident Alert Threshold in UI...");
    const initialThreshold = await page.evaluate(() => {
      const sliders = Array.from(document.querySelectorAll('input[type="range"]'));
      const target = sliders.find(s => s.min === "30" && s.max === "90");
      return target ? target.value : null;
    });
    console.log(`   Initial UI Alert Threshold: ${initialThreshold}`);

    const newTarget = initialThreshold === "65" ? "75" : "65";
    console.log(`4. Modifying Alert Threshold slider to: ${newTarget}...`);

    await page.evaluate((val) => {
      const sliders = Array.from(document.querySelectorAll('input[type="range"]'));
      const target = sliders.find(s => s.min === "30" && s.max === "90");
      if (target) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
        nativeSetter.call(target, val);
        target.dispatchEvent(new Event('input', { bubbles: true }));
        target.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }
      return false;
    }, newTarget);

    console.log("5. Submitting 'Save Configuration' form...");
    const clickedSave = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button[type="submit"]'));
      const saveBtn = buttons.find(b => b.textContent.includes('Save Configuration'));
      if (saveBtn) {
        saveBtn.click();
        return true;
      }
      return false;
    });
    console.log(`   Clicked Save Configuration: ${clickedSave}`);

    // Wait for persistence feedback
    await page.waitForFunction(() => {
      return document.body.innerText.includes('Operational parameters persisted') ||
             document.body.innerText.includes('dynamically');
    }, { timeout: 5000 });
    console.log("   Feedback received: 'Operational parameters persisted and applied dynamically.'");

    console.log("6. Reloading browser page (hard refresh)...");
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForSelector('aside', { timeout: 10000 });

    console.log("7. Re-navigating to Settings after reload...");
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('aside button'));
      const btn = buttons.find(b => b.textContent.includes('Settings'));
      if (btn) btn.click();
    });

    await page.waitForFunction(() => {
      return document.body.innerText.includes('Platform Configuration & Intelligence');
    }, { timeout: 10000 });

    await new Promise(r => setTimeout(r, 1000));

    const persistedValue = await page.evaluate(() => {
      const sliders = Array.from(document.querySelectorAll('input[type="range"]'));
      const target = sliders.find(s => s.min === "30" && s.max === "90");
      return target ? target.value : null;
    });

    console.log(`8. Value in UI after reload: ${persistedValue}`);
    if (persistedValue === newTarget) {
      console.log(`>>> PROOF SUCCESS: Setting persisted across browser reload (${newTarget})!`);
    } else {
      console.log(`>>> Mismatch: Expected ${newTarget}, got ${persistedValue}`);
    }

    // Now query backend directly to verify SQLite persistence
    const backendRes = await fetch("http://127.0.0.1:8000/api/settings");
    const backendConfig = await backendRes.json();
    console.log(`9. Backend SQLite API verification: alert_threshold = ${backendConfig.alert_threshold}`);
    if (String(backendConfig.alert_threshold) === String(newTarget)) {
      console.log(">>> PROOF SUCCESS: Backend SQLite database verified and matches UI!");
    } else {
      console.log(">>> Backend mismatch:", backendConfig);
    }

    console.log(`10. Total Browser Console Errors: ${consoleErrors.length}`);
    if (consoleErrors.length > 0) {
      console.log("Browser errors:", consoleErrors);
    } else {
      console.log("Zero browser errors observed during entire navigation, editing, saving, and reload cycle.");
    }

  } catch (err) {
    console.error("Test execution failed:", err);
  } finally {
    await browser.close();
    console.log("=== LIVE SETTINGS PROOF TEST COMPLETE ===");
  }
}

runTest();
