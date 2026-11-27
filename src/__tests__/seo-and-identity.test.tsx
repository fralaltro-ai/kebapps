import fs from "node:fs";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import { render } from "@testing-library/react";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata as layoutMetadata } from "@/app/layout";
import { metadata as homeMetadata } from "@/app/page";
import { metadata as mapMetadata } from "@/app/map/page";
import { metadata as diaryMetadata } from "@/app/diary/page";
import { metadata as wishlistMetadata } from "@/app/wishlist/page";
import { metadata as profileMetadata } from "@/app/profile/page";
import { metadata as profilePreferencesMetadata } from "@/app/profile/preferences/page";
import { metadata as profileDataMetadata } from "@/app/profile/data/page";
import { metadata as profileInfoMetadata } from "@/app/profile/info/page";
import { metadata as privacyMetadata } from "@/app/privacy-policy/page";
import { metadata as cookieMetadata } from "@/app/cookie-policy/page";
import { metadata as termsMetadata } from "@/app/terms/page";
import { metadata as offlineMetadata } from "@/app/~offline/page";
import HomePage from "@/app/page";
import ProfileInfoPage from "@/app/profile/info/page";
import PrivacyPolicyPage from "@/app/privacy-policy/page";
import AppFooter from "@/components/layout/AppFooter";
import JsonLd, { serializeJsonLd } from "@/components/seo/JsonLd";
import {
  buildSoftwareApplicationJsonLd,
  buildWebsiteJsonLd,
  getSiteUrl,
} from "@/lib/seo";

let mockFooterPathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => mockFooterPathname,
}));

vi.mock("next/font/google", () => ({
  Quicksand: () => ({
    variable: "--font-sans",
  }),
}));

const ROOT = path.resolve(import.meta.dirname, "../..");

describe("SEO, Sitemap, Robots & Public Identity", () => {
  test("robots.ts allows public pages, disallows /api/ and /~offline, and exposes sitemap", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;

    expect(rules.userAgent).toBe("*");
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toEqual(["/api/", "/~offline"]);
    expect(config.sitemap).toMatch(/^https?:\/\/.+\/sitemap\.xml$/);
  });

  test("sitemap.ts includes core public routes and excludes legal routes, /~offline, and /api/", () => {
    const siteUrl = getSiteUrl();
    const entries = sitemap();
    const urls = entries.map((e) => e.url);

    expect(urls).toEqual([
      siteUrl,
      `${siteUrl}/map`,
      `${siteUrl}/diary`,
      `${siteUrl}/wishlist`,
      `${siteUrl}/profile`,
    ]);
    expect(
      urls.some(
        (u) =>
          u.includes("/privacy-policy") ||
          u.includes("/cookie-policy") ||
          u.includes("/terms") ||
          u.includes("/~offline") ||
          u.includes("/api")
      )
    ).toBe(false);
  });

  test("core routes are indexable, legal routes set noindex/follow, and /~offline sets noindex/nofollow", () => {
    expect(layoutMetadata.robots).toMatchObject({ index: true, follow: true });
    expect(layoutMetadata.alternates?.canonical).toBe("/");

    for (const [meta, canonical] of [
      [homeMetadata, "/"],
      [mapMetadata, "/map"],
      [diaryMetadata, "/diary"],
      [wishlistMetadata, "/wishlist"],
      [profileMetadata, "/profile"],
      [profilePreferencesMetadata, "/profile/preferences"],
      [profileDataMetadata, "/profile/data"],
      [profileInfoMetadata, "/profile/info"],
    ] as const) {
      expect(meta.alternates?.canonical).toBe(canonical);
      expect(meta.robots).toBeUndefined();
    }

    for (const legalMeta of [privacyMetadata, cookieMetadata, termsMetadata]) {
      expect(legalMeta.robots).toEqual({ index: false, follow: true });
    }

    expect(offlineMetadata.robots).toEqual({ index: false, follow: false });
  });

  test("JSON-LD builders serialize safely without unescaped < and omit fake aggregateRating", () => {
    const siteUrl = "https://kebapps.app";
    const website = buildWebsiteJsonLd(siteUrl);
    const app = buildSoftwareApplicationJsonLd(siteUrl);

    expect(website["@type"]).toBe("WebSite");
    expect(app["@type"]).toBe("SoftwareApplication");
    expect(app).not.toHaveProperty("aggregateRating");

    const serialized = serializeJsonLd({ html: "<script>alert(1)</script>" });
    expect(serialized).not.toContain("<");
    expect(serialized).toContain("\\u003cscript>");

    const { container } = render(<JsonLd data={website} />);
    const script = container.querySelector('script[type="application/ld+json"]');
    expect(script).not.toBeNull();
    expect(script?.textContent).toContain("https://schema.org");
  });

  test("HomePage SSR renders JSON-LD scripts, omits redundant SEO footer/guide blocks, and links core sections", () => {
    const { container } = render(<HomePage />);

    const scripts = container.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(2);

    const scriptContents = Array.from(scripts).map((s) => s.textContent || "");
    expect(scriptContents.some((c) => c.includes("WebSite"))).toBe(true);
    expect(scriptContents.some((c) => c.includes("SoftwareApplication"))).toBe(true);
    expect(scriptContents.some((c) => c.includes("FAQPage"))).toBe(false);

    expect(container.querySelector("#seo-faq-heading")).toBeNull();
    expect(container.querySelector("#seo-overview-heading")).toBeNull();
    expect(container.querySelector("footer")).toBeNull();

    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    );
    for (const route of ["/map", "/diary", "/wishlist", "/profile"]) {
      expect(hrefs).toContain(route);
    }
  });

  test("ProfileInfoPage SSR exposes back-to-profile and legal links without plaintext support email", () => {
    const { container } = render(<ProfileInfoPage />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
      a.getAttribute("href")
    );
    for (const route of ["/profile", "/privacy-policy", "/cookie-policy", "/terms"]) {
      expect(hrefs).toContain(route);
    }
    expect(hrefs.some((h) => h?.startsWith("mailto:"))).toBe(false);
    expect(container.textContent).not.toContain("support@kebapps.app");
    expect(container.querySelector('[data-testid="support-unlock-trigger"]')).not.toBeNull();
  });

  test("personal emails and env var placeholders are excluded from public identity files and legal docs", () => {
    const checkedFiles = [
      "LICENSE",
      "package.json",
      "src/app/layout.tsx",
      "docs/PRIVACY_POLICY.md",
      "docs/TERMS_OF_SERVICE.md",
      "docs/COOKIE_POLICY.md",
      "src/lib/docs-generated.ts",
    ];

    for (const rel of checkedFiles) {
      const content = fs.readFileSync(path.join(ROOT, rel), "utf8");
      expect(content).not.toMatch(/@(?:gmail\.com|icloud\.com|hotmail\.|yahoo\.)/i);
    }

    for (const legalRel of [
      "docs/PRIVACY_POLICY.md",
      "docs/TERMS_OF_SERVICE.md",
      "docs/COOKIE_POLICY.md",
      "src/lib/docs-generated.ts",
    ]) {
      const legalContent = fs.readFileSync(path.join(ROOT, legalRel), "utf8");
      expect(legalContent).not.toContain("NEXT_PUBLIC_DATA_CONTROLLER_NAME");
      expect(legalContent).not.toContain("support@kebapps.app");
    }

    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
    expect(pkg.author).toBe("KebApps <support@kebapps.app>");

    const license = fs.readFileSync(path.join(ROOT, "LICENSE"), "utf8");
    expect(license).toContain("Copyright (c) 2026 KebApps");
  });

  test("all routes resolve title strictly to KebApps without page subtitles", () => {
    expect(layoutMetadata.title).toBe("KebApps");
    expect(layoutMetadata.applicationName).toBe("KebApps");
    expect(layoutMetadata.appleWebApp).toMatchObject({ title: "KebApps" });

    for (const meta of [
      homeMetadata,
      mapMetadata,
      diaryMetadata,
      wishlistMetadata,
      profileMetadata,
      profilePreferencesMetadata,
      profileDataMetadata,
      profileInfoMetadata,
      privacyMetadata,
      cookieMetadata,
      termsMetadata,
      offlineMetadata,
    ]) {
      expect(meta.title === undefined || meta.title === "KebApps").toBe(true);
    }
  });

  test("AppFooter exposes essential legal policy links as an in-page box without redundant tagline, controller, or email", () => {
    mockFooterPathname = "/";
    const { container, rerender } = render(<AppFooter />);
    const hrefs = Array.from(container.querySelectorAll("a")).map((a) => a.getAttribute("href"));
    expect(hrefs).toEqual(["/privacy-policy", "/cookie-policy", "/terms"]);
    expect(hrefs.some((h) => h?.startsWith("mailto:"))).toBe(false);
    expect(container.textContent).not.toContain("PWA local-first");
    expect(container.textContent).not.toContain("Titolare:");

    mockFooterPathname = "/map";
    rerender(<AppFooter />);
    expect(container.querySelector("footer")).toBeNull();
  });

  test("PrivacyPolicyPage renders ControllerIdentityNotice with configured NEXT_PUBLIC_DATA_CONTROLLER_NAME without exposing plaintext email", () => {
    const prev = process.env.NEXT_PUBLIC_DATA_CONTROLLER_NAME;
    process.env.NEXT_PUBLIC_DATA_CONTROLLER_NAME = "Mario Rossi";
    const { getByTestId, container } = render(<PrivacyPolicyPage />);
    expect(getByTestId("controller-identity-notice").textContent).toContain("Mario Rossi");
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
    expect(container.textContent).not.toContain("support@kebapps.app");
    process.env.NEXT_PUBLIC_DATA_CONTROLLER_NAME = prev;
  });
});
