import { test, expect } from '@playwright/test';

// Only meaningful on the mobile projects (iPhone 14 / Pixel 7); the assertions
// target the sm:hidden bottom dock and touch/viewport behavior that don't
// exist on the desktop Chromium project.
test.describe('Mobile/PWA Shell Hardening: Scrollbars, Dock Anchoring, Zoom/Overscroll', () => {
  test.beforeEach(async ({ isMobile, page }) => {
    test.skip(!isMobile, 'Bottom dock and touch behavior only render on mobile viewports');
    await page.addInitScript(() => {
      try {
        localStorage.setItem('kebapp_onboarding_seen', 'true');
        localStorage.setItem('kebapp_pwa_dismissed_until', String(Date.now() + 86_400_000));
        localStorage.setItem(
          'kebapp_maps_consent',
          JSON.stringify({
            status: 'granted',
            policyVersion: '2.6',
            updatedAt: Date.now(),
            expiresAt: Date.now() + 180 * 24 * 60 * 60 * 1000,
          })
        );
        localStorage.setItem(
          'kebapp_gps_consent',
          JSON.stringify({
            status: 'denied',
            policyVersion: '2.6',
            updatedAt: Date.now(),
            expiresAt: Date.now() + 180 * 24 * 60 * 60 * 1000,
          })
        );
      } catch {
        // ignore
      }
    });
  });

  test('body has overscroll-behavior: none to stop the elastic frame bounce', async ({ page }) => {
    await page.goto('/');
    const overscroll = await page.evaluate(
      () => getComputedStyle(document.body).overscrollBehaviorY
    );
    expect(overscroll).toBe('none');
  });

  test('bottom dock stays anchored to the visible bottom edge on home and profile pages', async ({ page }) => {
    for (const path of ['/', '/profile']) {
      await page.goto(path);
      const dock = page.locator('nav + div.fixed').first();
      await expect(dock).toBeVisible();

      const box = await dock.boundingBox();
      const viewportHeight = page.viewportSize()?.height ?? 0;
      expect(box).not.toBeNull();
      if (box) {
        // Dock's bottom edge must sit within ~120px of the viewport's bottom
        // edge (accounts for safe-area inset + gap), never mid-screen.
        expect(viewportHeight - (box.y + box.height)).toBeLessThan(120);
      }
    }
  });

  test('dock remains anchored to the bottom after scrolling the page', async ({ page }) => {
    await page.goto('/terms');
    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(200);

    const dock = page.locator('nav + div.fixed').first();
    const box = await dock.boundingBox();
    const viewportHeight = page.viewportSize()?.height ?? 0;
    expect(box).not.toBeNull();
    if (box) {
      expect(viewportHeight - (box.y + box.height)).toBeLessThan(120);
    }
  });

  test('top navigation stays static (no scroll-driven auto-hide regression)', async ({ page }) => {
    await page.goto('/terms');
    const nav = page.locator('nav').first();

    await expect(nav).toBeVisible();
    const before = await nav.boundingBox();

    await page.mouse.wheel(0, 2000);
    await page.waitForTimeout(200);

    await expect(nav).toBeVisible();
    const after = await nav.boundingBox();
    expect(after?.y).toBe(before?.y);
  });

  test('page scrolling still works even though the scrollbar is hidden', async ({ page }) => {
    await page.goto('/terms');
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(200);

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
  });

  test('map route locks the document so it cannot scroll/bounce behind the map', async ({ page }) => {
    await page.goto('/map');
    const mapContainer = page.locator('[data-map-container]');
    await expect(mapContainer).toBeVisible({ timeout: 15000 });

    const isLocked = await page.evaluate(
      () => document.documentElement.classList.contains('route-locked')
    );
    expect(isLocked).toBe(true);

    const isScrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 1
    );
    expect(isScrollable).toBe(false);
  });

  test('dragging vertically on the map canvas pans the map without moving the container frame (regression: whole frame used to scroll)', async ({ page }) => {
    await page.goto('/map');
    const mapContainer = page.locator('[data-map-container]');
    await expect(mapContainer).toBeVisible({ timeout: 15000 });
    // Give the Google Maps SDK a moment to attach its own gesture handlers.
    await page.waitForTimeout(1000);

    const frameBefore = await mapContainer.boundingBox();
    expect(frameBefore).not.toBeNull();

    const box = frameBefore!;
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height * 0.7;
    const endY = box.y + box.height * 0.3;

    await page.touchscreen.tap(startX, startY).catch(() => {});
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX, endY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const frameAfter = await mapContainer.boundingBox();
    expect(frameAfter).not.toBeNull();
    // The container's own position on screen must not move — only the map
    // canvas content inside it pans.
    expect(frameAfter!.y).toBe(frameBefore!.y);
    expect(frameAfter!.x).toBe(frameBefore!.x);

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBe(0);
  });
});
