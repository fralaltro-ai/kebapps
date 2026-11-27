import { test, expect } from "@playwright/test";

test.describe("Zero-Auth Local-First User Flow (Phase D)", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        localStorage.setItem("kebapp_onboarding_seen", "true");
        localStorage.setItem("kebapp_pwa_dismissed_until", String(Date.now() + 86_400_000));
      } catch {
        // ignore
      }
    });
  });

  test("complete local user flow: Home -> Map (paid APIs disabled) -> Wishlist -> Diary -> Profile & Subpages Export/Reset/Import", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    // 1. Home Dashboard
    await page.goto("/");
    await expect(page.getByText(/Il tuo Diario Kebab personale\./i)).toBeVisible();
    await expect(page.getByTestId("home-profile-nickname")).toHaveText("Esploratore dello Spiedo");
    await expect(page.getByTestId("stat-total-visits")).toHaveText("0");

    // Verify 4 primary views in navigation (desktop top nav or mobile bottom dock) + topbar Profilo link
    for (const label of ["Home", "Mappa", "Diario", "Wishlist"]) {
      await expect(page.getByRole("link", { name: label }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /Profilo e Dati Locali/i })).toBeVisible();

    // 2. Map route with paid APIs disabled -> Zero-Cost demonstration mode without storing map consent
    await page.goto("/map");
    await expect(page.getByTestId("zero-cost-map-view")).toBeVisible();
    await expect(page.getByText("Kebab Demo Duomo (Esempio)")).toBeVisible();

    // 3. Wishlist: add item, edit note, sort, convert 1-tap to Diary
    await page.goto("/wishlist");
    await expect(page.getByRole("heading", { name: /Wishlist Locale/i })).toBeVisible();

    await page.getByTestId("wishlist-add-btn").click();
    await page.getByTestId("wishlist-new-name-input").fill("Kebab Paradiso");
    await page.getByTestId("wishlist-new-note-input").fill("Da provare venerdì");
    await page.getByTestId("wishlist-save-new-btn").click();

    await expect(page.getByText("Kebab Paradiso")).toBeVisible();
    await expect(page.getByText("Da provare venerdì")).toBeVisible();

    // Edit note inline
    await page.getByTestId("wishlist-edit-note-btn").first().click();
    await page.getByTestId("wishlist-edit-note-input").fill("Salsa piccante top");
    await page.getByTestId("wishlist-save-note-btn").click();
    await expect(page.getByText("Salsa piccante top")).toBeVisible();

    // Sort buttons work without crashing
    await page.getByTestId("wishlist-sort-distance").click();
    await page.getByTestId("wishlist-sort-date").click();

    // 1-tap convert Wishlist -> Diary
    await page.getByTestId("wishlist-convert-btn").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("diary-shop-label-input")).toHaveValue("Kebab Paradiso");
    await page.getByTestId("diary-city-input").fill("Milano");
    await page.getByTestId("diary-country-input").fill("Italia");
    await page.getByTestId("diary-meat-5").click();
    await page.getByTestId("diary-bread-5").click();
    await page.getByTestId("diary-sauces-4").click();
    await page.getByTestId("diary-value-5").click();
    await page.getByTestId("diary-location-4").click();
    await page.getByTestId("diary-note-input").fill("Convertito da wishlist, carne top");
    await page.getByTestId("diary-submit-btn").click();

    // Item removed from wishlist after conversion
    await expect(page.getByText(/Nessun locale in Wishlist/i)).toBeVisible();

    // 4. Diary: verify converted entry, add another entry, filter, edit, delete
    await page.goto("/diary");
    await expect(page.getByRole("heading", { name: /Diario Personale/i })).toBeVisible();
    await expect(page.getByText("Kebab Paradiso")).toBeVisible();
    await expect(page.getByText(/Milano, Italia/i)).toBeVisible();

    // Create second entry manually (date prefilled automatically)
    await page.getByTestId("diary-add-btn").click();
    const dateValue = await page.getByTestId("diary-visited-date-input").inputValue();
    expect(dateValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await page.getByTestId("diary-shop-label-input").fill("Anatolia Doner");
    await page.getByTestId("diary-city-input").fill("Roma");
    await page.getByTestId("diary-note-input").fill("Pane croccante");
    await page.getByTestId("diary-submit-btn").click();
    await expect(page.getByText("Anatolia Doner")).toBeVisible();

    // Filter by search and clear button
    await page.getByTestId("diary-search-input").fill("Anatolia");
    await expect(page.getByText("Anatolia Doner")).toBeVisible();
    await expect(page.getByText("Kebab Paradiso")).not.toBeVisible();
    await page.getByTestId("diary-search-clear-btn").click();
    await expect(page.getByText("Kebab Paradiso")).toBeVisible();

    // Edit entry
    await page.getByTestId("diary-edit-btn").first().click();
    await page.getByTestId("diary-note-input").fill("Nota aggiornata dal test");
    await page.getByTestId("diary-submit-btn").click();
    await expect(page.getByText(/Nota aggiornata dal test/i)).toBeVisible();

    // Home dashboard reflects updated counters
    await page.goto("/");
    await expect(page.getByTestId("stat-total-visits")).toHaveText("2");

    // 5. Profile Hub -> Identity, then /profile/data for Export/Reset/Import
    await page.getByRole("link", { name: /Profilo e Dati Locali/i }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByTestId("profile-heading-nickname")).toHaveText("Esploratore dello Spiedo");

    await page.getByTestId("profile-nickname-input").fill("Re del Doner");
    await page.getByTestId("save-nickname-btn").click();
    await expect(page.getByTestId("profile-heading-nickname")).toHaveText("Re del Doner");

    await page.getByTestId("avatar-option-ninja_cipolla").click();
    await expect(page.getByTestId("avatar-option-ninja_cipolla")).toHaveAttribute("aria-pressed", "true");

    // Navigate to /profile/data
    await page.getByTestId("profile-nav-data").click();
    await expect(page).toHaveURL(/\/profile\/data$/);

    // Export Backup JSON
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByTestId("export-backup-btn").click(),
    ]);
    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();

    // Reset all local data with explicit confirmation
    await page.getByTestId("reset-all-data-btn").click();
    await expect(page.getByTestId("reset-confirm-box")).toBeVisible();
    await page.getByTestId("confirm-reset-all-btn").click();

    await page.getByRole("link", { name: /Torna al Profilo/i }).click();
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByTestId("profile-heading-nickname")).toHaveText("Esploratore dello Spiedo");

    // Verify Diary is empty after reset
    await page.goto("/diary");
    await expect(page.getByText(/Il tuo Diario è ancora vuoto/i)).toBeVisible();

    // Import Backup JSON with explicit confirmation on /profile/data
    await page.goto("/profile/data");
    await page.getByTestId("import-backup-input").setInputFiles(downloadPath!);
    await expect(page.getByTestId("import-confirm-box")).toBeVisible();
    await page.getByTestId("confirm-import-btn").click();

    await page.getByRole("link", { name: /Torna al Profilo/i }).click();
    await expect(page.getByTestId("profile-heading-nickname")).toHaveText("Re del Doner");

    // Verify Diary entries restored
    await page.goto("/diary");
    await expect(page.getByText("Kebab Paradiso")).toBeVisible();
    await expect(page.getByText("Anatolia Doner")).toBeVisible();

    // 6. Support/Docs in /profile/info & Legal/Offline routes zero-auth
    await page.goto("/profile");
    await page.getByTestId("profile-nav-info").click();
    await expect(page).toHaveURL(/\/profile\/info$/);

    const supportDocsSection = page.getByTestId("profile-support-docs-section");
    await expect(supportDocsSection).toBeVisible();
    await expect(page.getByTestId("support-mailto-link")).toHaveCount(0);
    await page.getByTestId("support-unlock-trigger").click();
    await expect(page.getByTestId("support-mailto-link")).toHaveAttribute("href", /^mailto:/);

    const legalRoutes = [
      { label: "Privacy Policy", path: "/privacy-policy", heading: "Privacy Policy" },
      { label: "Cookie & Storage Policy", path: "/cookie-policy", heading: "Cookie Policy" },
      { label: "Termini di Servizio", path: "/terms", heading: "Termini di Servizio" },
    ];
    for (const doc of legalRoutes) {
      await page.goto("/profile/info");
      await page.getByTestId("profile-support-docs-section").getByRole("link", { name: doc.label }).click();
      await expect(page).toHaveURL(new RegExp(`${doc.path}$`), { timeout: 10000 });
      await expect(page.getByRole("heading", { name: doc.heading, exact: true })).toBeVisible();
      await expect(page.locator("form")).toHaveCount(0);
      await page.getByRole("link", { name: /Torna al Profilo/i }).click();
      await expect(page).toHaveURL(/\/profile$/);
    }

    await page.goto("/~offline");
    await expect(page.getByRole("heading", { name: /Sei Offline/i })).toBeVisible();
    await expect(page.getByText(/Solo la Mappa Google richiede una connessione Internet/i)).toBeVisible();
    await expect(page.getByText("Kebab Paradiso")).toBeVisible();
  });
});
