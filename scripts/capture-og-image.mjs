#!/usr/bin/env node
/**
 * Capture OG image from HTML using Playwright
 * Usage: npx playwright install chromium && node scripts/capture-og-image.mjs
 */

import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const OG_WIDTH = 1200;
const OG_HEIGHT = 630;

async function captureOGImage() {
  console.log('Launching browser...');
  
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: OG_WIDTH, height: OG_HEIGHT },
    deviceScaleFactor: 3, // 3x for high-res output (3600x1890)
  });
  
  const page = await context.newPage();
  
  const htmlPath = join(projectRoot, 'public/social/og-image.html');
  console.log(`Loading: ${htmlPath}`);
  
  await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle' });
  
  // Wait for fonts to load
  await page.waitForTimeout(1000);
  
  const outputPath = join(projectRoot, 'public/social/og-image-extracted.png');
  
  await page.screenshot({
    path: outputPath,
    clip: { x: 0, y: 0, width: OG_WIDTH, height: OG_HEIGHT },
  });
  
  console.log(`✓ Saved: ${outputPath}`);
  console.log(`  Dimensions: ${OG_WIDTH * 3}x${OG_HEIGHT * 3} (3x scale)`);
  
  await browser.close();
}

captureOGImage().catch(console.error);

