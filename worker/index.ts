/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

export {};

// PWA basic events
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Cache Purge on user request
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data?.type === "KEBAPPS_PURGE_PRIVATE_CACHES") {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((k) => !k.startsWith("workbox-precache"))
            .map((k) => caches.delete(k))
        )
      )
    );
  }
});
