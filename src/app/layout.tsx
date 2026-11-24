import type { Metadata } from "next";
import "./globals.css";
import { Quicksand } from "next/font/google";
import { cn } from "@/lib/utils";

const quicksand = Quicksand({ subsets: ['latin'], variable: '--font-sans' });

import type { Viewport } from "next";
import Navigation from "@/components/layout/Navigation";
import AppFooter from "@/components/layout/AppFooter";
import PwaPrompt from "@/components/ui/PwaPrompt";
import OnboardingModal from "@/components/ui/OnboardingModal";
import OfflineListener from "@/components/ui/OfflineListener";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ToastProvider } from "@/context/ToastContext";
import SplashScreen from "@/components/SplashScreen";
import Script from "next/script";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getSiteUrl } from "@/lib/seo";

const siteUrl = getSiteUrl();
const googleSiteVerification = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "KebApps",
  title: "KebApps",
  description:
    "Trova i migliori locali che vendono kebab vicino a te sulla mappa interattiva, salva le tue valutazioni su carne, pane e salse nel diario personale e gestisci la wishlist kebab offline senza account.",
  keywords: [
    "kebab",
    "locali che vendono kebab",
    "kebab vicino a me",
    "mappa kebab",
    "miglior kebab",
    "kebabbari",
    "diario degustazione kebab",
    "wishlist kebab",
    "PWA local-first",
  ],
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.svg",
    apple: "/apple-touch-icon.png",
  },
  authors: [{ name: "KebApps", url: siteUrl }],
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "KebApps",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    copyright: "Copyright (c) 2026 KebApps - MIT License",
  },
  openGraph: {
    title: "KebApps",
    description:
      "Scopri i locali che vendono kebab vicino a te sulla mappa, annota voti nel diario personale delle degustazioni e organizza la tua wishlist kebab offline.",
    url: "/",
    siteName: "KebApps",
    images: [
      {
        url: "/opengraph-image.png",
        width: 512,
        height: 512,
        alt: "KebApps",
      },
    ],
    locale: "it_IT",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "KebApps",
    description:
      "Trova locali che vendono kebab sulla mappa, salva voti nel diario personale e gestisci la tua wishlist kebab local-first.",
    images: ["/opengraph-image.png"],
  },
  ...(googleSiteVerification
    ? { verification: { google: googleSiteVerification } }
    : {}),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ea580c" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1310" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it" className={cn("font-sans", quicksand.variable)} suppressHydrationWarning={true}>
<head>
  {/* Wrangler/OpenNext esbuild keepNames emits __name(...) inside next-themes's inline theme script. */}
  <script
    dangerouslySetInnerHTML={{
      __html: "window.__name=window.__name||function(t){return t};",
    }}
  />
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2048-2732.jpg" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2732-2048.jpg" media="(device-width: 1024px) and (device-height: 1366px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1668-2388.jpg" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2388-1668.jpg" media="(device-width: 834px) and (device-height: 1194px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1536-2048.jpg" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2048-1536.jpg" media="(device-width: 768px) and (device-height: 1024px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1640-2360.jpg" media="(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2360-1640.jpg" media="(device-width: 820px) and (device-height: 1180px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1668-2224.jpg" media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2224-1668.jpg" media="(device-width: 834px) and (device-height: 1112px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1620-2160.jpg" media="(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2160-1620.jpg" media="(device-width: 810px) and (device-height: 1080px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1488-2266.jpg" media="(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2266-1488.jpg" media="(device-width: 744px) and (device-height: 1133px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1320-2868.jpg" media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2868-1320.jpg" media="(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1206-2622.jpg" media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2622-1206.jpg" media="(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1260-2736.jpg" media="(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2736-1260.jpg" media="(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1290-2796.jpg" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2796-1290.jpg" media="(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1179-2556.jpg" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2556-1179.jpg" media="(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1170-2532.jpg" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2532-1170.jpg" media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1284-2778.jpg" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2778-1284.jpg" media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1125-2436.jpg" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2436-1125.jpg" media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1242-2688.jpg" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2688-1242.jpg" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-828-1792.jpg" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1792-828.jpg" media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1242-2208.jpg" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-2208-1242.jpg" media="(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-750-1334.jpg" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1334-750.jpg" media="(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-640-1136.jpg" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)"/>
  <link rel="apple-touch-startup-image" href="/icons/apple-splash-1136-640.jpg" media="(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: landscape)"/>
</head>
      <body
        className="antialiased bg-background flex flex-col min-h-[100svh] overscroll-none"
        suppressHydrationWarning={true}
      >
        {/* Captures beforeinstallprompt/appinstalled before React hydrates so the
            event is never lost to the PwaPrompt mount-timing race condition. */}
        <Script
          id="kebapp-install-capture"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "window.__kebappDeferredPrompt=null;" +
              "addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__kebappDeferredPrompt=e;dispatchEvent(new Event('kebapp:installready'))});" +
              "addEventListener('appinstalled',function(){window.__kebappDeferredPrompt=null;dispatchEvent(new Event('kebapp:installed'))});" +
              "(function(){try{var s=(window.matchMedia&&window.matchMedia('(display-mode: standalone)').matches)||window.navigator.standalone===true||document.referrer.indexOf('android-app://')===0||/(?:^|[?&])(?:mode=twa|utm_source=playstore)(?:&|$)/.test(location.search);if(s)document.documentElement.classList.add('pwa-standalone');}catch(e){}})();",
          }}
        />
        <SplashScreen />
        <ThemeProvider>
          <ToastProvider>
            <Navigation />
            <div id="app-shell-scroll" className="app-shell-scroll flex-1 flex flex-col">
              <main className="flex-1 pt-14 sm:pt-16">
                <ErrorBoundary>
                  {children}
                </ErrorBoundary>
                <AppFooter />
              </main>
            </div>
            <PwaPrompt />
            <OnboardingModal />
            <OfflineListener />
          </ToastProvider>
        </ThemeProvider>
        {/* COMP-AUDIT-D2: the Turnstile script used to load here unconditionally on every
            route, including static legal pages that never render a widget. It is now
            injected on demand by useTurnstile.ts, on the first mount of an actual widget,
            so a visitor who never reaches a form never loads this third-party script. */}
      </body>
    </html>
  );
}

