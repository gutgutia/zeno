/**
 * Homepage E2E Tests
 *
 * Tests for the public landing page and basic navigation.
 */

import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should display the landing page', async ({ page }) => {
    await page.goto('/');

    // Check for main heading or brand
    await expect(page.locator('h1, [data-testid="hero-title"]')).toBeVisible();
  });

  test('should have navigation links', async ({ page }) => {
    await page.goto('/');

    // Check for sign in/login link
    const authLink = page.locator('a[href*="login"], a[href*="signin"], button:has-text("Sign")');
    await expect(authLink.first()).toBeVisible();
  });

  test('should be responsive', async ({ page }) => {
    await page.goto('/');

    // Check that page renders without horizontal scroll
    const body = page.locator('body');
    const bodyWidth = await body.evaluate((el) => el.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);

    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10); // Allow small tolerance
  });

  test('should have proper meta tags for SEO', async ({ page }) => {
    await page.goto('/');

    // Check for title
    await expect(page).toHaveTitle(/.+/);

    // Check for meta description
    const metaDescription = page.locator('meta[name="description"]');
    await expect(metaDescription).toHaveAttribute('content', /.+/);
  });
});

test.describe('Navigation', () => {
  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');

    // Find and click login/signin link
    const loginLink = page.locator('a[href*="login"], a[href*="signin"]').first();

    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/login|signin|auth/);
    }
  });
});

test.describe('Accessibility', () => {
  test('should have no major accessibility violations', async ({ page }) => {
    await page.goto('/');

    // Check for basic accessibility: images have alt text
    const images = page.locator('img');
    const imageCount = await images.count();

    for (let i = 0; i < imageCount; i++) {
      const img = images.nth(i);
      const alt = await img.getAttribute('alt');
      const decorative = await img.getAttribute('role');

      // Images should have alt text or be marked as decorative
      expect(alt !== null || decorative === 'presentation').toBeTruthy();
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');

    // Tab through the page and check focus is visible
    await page.keyboard.press('Tab');

    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
  });
});
