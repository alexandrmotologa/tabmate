import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8093;
const BASE_URL = `http://localhost:${PORT}`;
const OUTPUT_DIR = path.resolve(__dirname, '../../docs/images');

async function waitForServer(maxRetries = 30) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.ok) {
        console.log('✓ TabMate test server is ready on port', PORT);
        return true;
      }
    } catch {
      // wait
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Server failed to start on port ${PORT}`);
}

async function capture() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Start server on PORT 8093
  console.log(`Starting TabMate server on port ${PORT}...`);
  const serverProc = spawn('node', ['server/dist/index.js'], {
    cwd: path.resolve(__dirname, '../..'),
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      DEMO_MODE: 'true',
      TELEGRAM_BOT_TOKEN: '',
    },
    stdio: 'inherit',
  });

  try {
    await waitForServer();

    console.log('Launching headless browser...');
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();
    // Mobile viewport with retina 2x density for crisp README screenshots
    await page.setViewport({ width: 420, height: 900, deviceScaleFactor: 2 });

    // 1. Capture Main Bills View
    console.log('Capturing: screenshot_bills.png...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('h1');
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'screenshot_bills.png'),
    });
    console.log('✓ Captured screenshot_bills.png');

    // 2. Capture Debts / Settlement View
    console.log('Capturing: screenshot_debts.png...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('h1');
    const tabs = await page.$$('button');
    for (const tab of tabs) {
      const text = await page.evaluate((el) => el.textContent, tab);
      if (text && text.includes('Debts')) {
        await tab.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'screenshot_debts.png'),
    });
    console.log('✓ Captured screenshot_debts.png');

    // 3. Capture Settle Debt Modal (from Debts view)
    console.log('Capturing: screenshot_settle_modal.png...');
    const settleBtns = await page.$$('button');
    for (const btn of settleBtns) {
      const text = await page.evaluate((el) => el.textContent, btn);
      if (text && text.includes('Settle or Partial Pay')) {
        await btn.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 700));
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'screenshot_settle_modal.png'),
    });
    console.log('✓ Captured screenshot_settle_modal.png');

    // 4. Capture Analytics / Insights Tab (Fresh navigation)
    console.log('Capturing: screenshot_analytics.png...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('h1');
    const tabsForInsights = await page.$$('button');
    for (const tab of tabsForInsights) {
      const text = await page.evaluate((el) => el.textContent, tab);
      if (text && text.includes('Insights')) {
        await tab.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1200)); // Allow chart SVG animation
    // Scroll down to showcase donut chart and member comparison bars
    await page.evaluate(() => window.scrollBy(0, 280));
    await new Promise((r) => setTimeout(r, 400));
    await page.screenshot({
      path: path.join(OUTPUT_DIR, 'screenshot_analytics.png'),
    });
    console.log('✓ Captured screenshot_analytics.png');

    // 5. Capture Itemized Receipt Splitter Modal (Fresh navigation)
    console.log('Capturing: screenshot_receipt_splitter.png...');
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
    await page.waitForSelector('h1');
    const calcBtn = await page.$('button[title="Itemized Receipt Splitter"]');
    if (calcBtn) {
      await calcBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      await page.screenshot({
        path: path.join(OUTPUT_DIR, 'screenshot_receipt_splitter.png'),
      });
      console.log('✓ Captured screenshot_receipt_splitter.png');
    }

    await browser.close();
    console.log('All screenshots captured successfully!');
  } finally {
    serverProc.kill();
  }
}

capture().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
