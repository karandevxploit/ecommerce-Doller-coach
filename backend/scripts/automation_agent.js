const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

/**
 * PRODUCTION-GRADE BOLT AUTOMATION AGENT (PUPPETEER)
 * 
 * Features:
 * - Exponential backoff retry system
 * - Self-healing form filling
 * - Live console monitoring
 * - Failure detection & automated correction
 */

// CONFIGURATION
const CONFIG = {
  ADMIN_EMAIL: process.env.ADMIN_EMAIL || "admin@example.com",
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "Admin@123",
  BASE_URL: "http://localhost:3000",
  MAX_RETRIES: 5,
  IMAGE_PATH: path.join(__dirname, 'test_image.png'),
};

// HELPERS
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const waitAndClick = async (page, selector, text = null, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      if (text) {
        const elements = await page.$$('button, span, a, label');
        for (const el of elements) {
          const content = await page.evaluate(e => e.textContent, el);
          if (content.toLowerCase().includes(text.toLowerCase())) {
            await el.click();
            return;
          }
        }
      } else {
        await page.waitForSelector(selector, { visible: true, timeout: 5000 });
        await page.click(selector);
        return;
      }
    } catch (err) {
      console.warn(`[RETRY] Click failed for ${selector || text}, retrying ${i + 1}/${retries}...`);
      await sleep(1000 * (i + 1));
    }
  }
  throw new Error(`Failed to click ${selector || text}`);
};

const fillField = async (page, labelText, value) => {
  try {
    const selector = `input[placeholder*='${labelText}'], textarea[placeholder*='${labelText}']`;
    await page.waitForSelector(selector, { timeout: 5000 });
    await page.focus(selector);
    await page.keyboard.down('Control');
    await page.keyboard.press('A');
    await page.keyboard.up('Control');
    await page.keyboard.press('Backspace');
    await page.type(selector, String(value));
  } catch (err) {
    // Try by label if placeholder fails
    const inputs = await page.$$('input, textarea');
    for (const input of inputs) {
      const prevHandle = await page.evaluateHandle(el => el.previousElementSibling, input);
      const prevText = await page.evaluate(el => el?.textContent || '', prevHandle);
      if (prevText.toLowerCase().includes(labelText.toLowerCase())) {
        await input.focus();
        await page.keyboard.down('Control');
        await page.keyboard.press('A');
        await page.keyboard.up('Control');
        await page.keyboard.press('Backspace');
        await input.type(String(value));
        return;
      }
    }
  }
};

// CORE FLOW
async function runAutomation() {
  const browser = await puppeteer.launch({
    headless: false, // Set to true for server environment
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  // MONITORING
  page.on('console', msg => console.log(`[BROWSER_LOG] ${msg.text()}`));
  page.on('pageerror', err => console.error(`[BROWSER_ERROR] ${err.message}`));

  let success = false;
  let attempt = 0;

  while (!success && attempt < CONFIG.MAX_RETRIES) {
    attempt++;
    console.log(`\n🚀 AUTOMATION ATTEMPT ${attempt}/${CONFIG.MAX_RETRIES} STARTING...`);

    try {
      // 1. LOGIN
      await page.goto(`${CONFIG.BASE_URL}/admin/login`, { waitUntil: 'networkidle2' });
      await page.waitForSelector('input[type="email"]', { timeout: 10000 });
      
      await page.type('input[type="email"]', CONFIG.ADMIN_EMAIL);
      await page.type('input[type="password"]', CONFIG.ADMIN_PASSWORD);
      await page.click('button[type="submit"]');

      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      console.log("✅ Logged in successfully");

      // 2. NAVIGATE TO PRODUCTS
      if (!page.url().includes('/admin/products')) {
        await page.goto(`${CONFIG.BASE_URL}/admin/products`, { waitUntil: 'networkidle2' });
      }
      console.log("✅ Navigated to Products Page");

      // 3. OPEN CREATE FORM
      await waitAndClick(page, null, 'Add Product');
      console.log("✅ Clicked Add Product");

      // 4. FILL GENERAL TAB
      await fillField(page, 'Title', 'Test Product AI ' + Date.now());
      await fillField(page, 'Product Type', 'Automated Test');
      
      // Select Category
      await page.select("select[value='men']", 'men'); // Fallback to raw selector if category select is simple
      
      await fillField(page, 'Pricing (MRP)', '1499');
      await fillField(page, 'Selling Price', '999');

      // Toggle a size
      await waitAndClick(page, null, 'M');
      await waitAndClick(page, null, 'L');
      
      await fillField(page, 'Description', 'This product was created automatically by the Bolt AI Browser Agent with self-healing capabilities.');

      // 5. MATRIX TAB (VARIANTS)
      await waitAndClick(page, null, 'Matrix');
      console.log("✅ Switched to Matrix Tab");

      await fillField(page, 'Color Name', 'AI Stealth Black');
      
      // Auto-generate SKU
      await waitAndClick(page, null, 'Auto-Generate');

      // Upload Image
      console.log("📤 Uploading Product Image...");
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser(),
        page.click('label input[type="file"]'), // Trigger file chooser
      ]);
      await fileChooser.accept([CONFIG.IMAGE_PATH]);

      // Wait for upload success (Toast or image preview)
      await page.waitForFunction(() => {
        const imgs = document.querySelectorAll('img');
        return Array.from(imgs).some(img => img.src.includes('cloudinary') || img.src.includes('blob:'));
      }, { timeout: 15000 });
      console.log("✅ Image Uploaded");

      // 6. FINAL SUBMISSION
      console.log("💾 Saving Product...");
      await waitAndClick(page, null, 'Launch Product');

      // 7. SUCCESS DETECTION
      const response = await page.waitForResponse(
        res => res.url().includes('/api/admin/products') && res.status() === 200,
        { timeout: 15000 }
      );

      if (response.ok()) {
        console.log("\n🎊 MISSION ACCOMPLISHED: Product Created Successfully!");
        success = true;
      }

    } catch (err) {
      console.error(`\n❌ ATTEMPT ${attempt} FAILED: ${err.message}`);
      
      // AI SELF-HEAL: Snapshot for debugging
      const errorPath = path.join(__dirname, `error_attempt_${attempt}.png`);
      await page.screenshot({ path: errorPath });
      console.log(`📸 Screenshot saved to: ${errorPath}`);

      // Exponential backoff
      const backoff = Math.pow(2, attempt) * 1000;
      console.log(`⏳ Backing off for ${backoff/1000}s...`);
      await sleep(backoff);
      
      // Refresh state
      await page.reload({ waitUntil: 'networkidle2' });
    }
  }

  if (!success) {
    console.error("\n💀 FAILURE: Maximum retries exceeded. The agent could not fulfill the objective.");
    process.exit(1);
  } else {
    await browser.close();
    process.exit(0);
  }
}

// Ensure dummy image exists
if (!fs.existsSync(CONFIG.IMAGE_PATH)) {
    console.log("Creating temporary test image...");
    fs.writeFileSync(CONFIG.IMAGE_PATH, ""); // placeholder if shell failed
}

runAutomation();
