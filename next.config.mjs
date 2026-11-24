import withPWAInit, { runtimeCaching as defaultCache } from "@ducanh2912/next-pwa";

const isDev = process.env.NODE_ENV === "development";
const enablePwaDev =
    process.env.ENABLE_PWA_DEV === "true" || process.env.ENABLE_PWA_DEV === "1";

const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "'wasm-unsafe-eval'",
    ...(isDev ? ["'unsafe-eval'"] : []),
    "https://challenges.cloudflare.com",
    "https://maps.googleapis.com",
    "https://*.googleapis.com",
    "https://maps.gstatic.com",
    "https://*.gstatic.com",
    "blob:",
].join(" ");

/** @type {import('next').NextConfig} */
const nextConfig = {
    poweredByHeader: false,
    headers: async () => [
        {
            source: '/(.*)',
            headers: [
                { key: 'X-Frame-Options', value: 'DENY' },
                { key: 'X-Content-Type-Options', value: 'nosniff' },
                { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
                { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self)' },
                { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
                {
                    key: 'Content-Security-Policy',
                    value: `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.googleapis.com https://*.gstatic.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https://maps.gstatic.com https://*.gstatic.com https://maps.googleapis.com https://*.googleapis.com https://*.google.com https://*.ggpht.com https://*.googleusercontent.com; connect-src 'self' data: blob: https://challenges.cloudflare.com https://places.googleapis.com https://maps.googleapis.com https://*.googleapis.com https://*.google.com https://*.gstatic.com; frame-src 'self' https://challenges.cloudflare.com; worker-src 'self' blob: https://*.googleapis.com https://*.gstatic.com; child-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none';`,
                },
            ],
        },
        {
            source: '/api/:path*',
            headers: [
                { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
            ],
        },
        {
            source: '/~offline',
            headers: [
                { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
            ],
        },
    ],
    allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS
        ? process.env.ALLOWED_DEV_ORIGINS.split(',').map((o) => o.trim())
        : ['127.0.0.1', 'localhost'],
};

const withPWA = withPWAInit({
    dest: "public",
    disable: isDev && !enablePwaDev,
    register: true,
    skipWaiting: true,
    cacheStartUrl: false,
    dynamicStartUrl: false,
    customWorkerDir: "worker",
    fallbacks: {
        document: "/~offline",
    },
    workboxOptions: {
        exclude: [/\.map$/, /^sitemap\.xml$/, /^robots\.txt$/],
        runtimeCaching: [
            {
                urlPattern: ({ sameOrigin }) => !sameOrigin,
                handler: "NetworkOnly",
            },
            {
                urlPattern: ({ url, sameOrigin }) =>
                    sameOrigin && (url.pathname === "/sitemap.xml" || url.pathname === "/robots.txt"),
                handler: "NetworkOnly",
            },
            {
                urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
                handler: "NetworkOnly",
            },
            {
                urlPattern: ({ url, sameOrigin }) => sameOrigin && /^\/map(\/|$)/.test(url.pathname),
                handler: "NetworkOnly",
            },
            // COMP-AUDIT-D2: google-fonts-stylesheets/webfonts dropped too — fonts are
            // self-hosted via next/font (no runtime request to fonts.g*.com ever happens),
            // so caching those origins is dead configuration that only widens the
            // pre-consent third-party footprint the Service Worker declares.
            ...defaultCache.filter((e) => !["apis", "pages", "pages-rsc", "pages-rsc-prefetch", "start-url", "next-data", "google-fonts-stylesheets", "google-fonts-webfonts", "cross-origin"].includes(e.options?.cacheName)),
        ],
    },
});

export default withPWA(nextConfig);
