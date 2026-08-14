"use strict";

/*
  LOWFATHOM — app shell update hardening
  Bump CACHE_NAME whenever the shipped app shell changes.
*/
const CACHE_NAME = "lowfathom-v0.100.20";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/ui/bar-track-gold.webp",
  "./assets/ui/bar-track-steel.webp",
  "./assets/ui/divider-thin.webp",
  "./assets/ui/frame-button-red.webp",
  "./assets/ui/frame-button.webp",
  "./assets/ui/frame-chip-teal.webp",
  "./assets/ui/frame-chip.webp",
  "./assets/ui/frame-panel.webp",
  "./assets/ui/frame-square.webp",
  "./assets/ui/frame-teal-wide.webp",
  "./assets/ui/frame-teal.webp",
  "./assets/ui/glyph-abilities.webp",
  "./assets/ui/glyph-gear.webp",
  "./assets/ui/glyph-guard.webp",
  "./assets/ui/glyph-heavy.webp",
  "./assets/ui/glyph-history.webp",
  "./assets/ui/glyph-intent.webp",
  "./assets/ui/glyph-pack.webp",
  "./assets/ui/glyph-read.webp",
  "./assets/ui/glyph-recover.webp",
  "./assets/ui/glyph-run.webp",
  "./assets/ui/glyph-sand.webp",
  "./assets/ui/glyph-skull.webp",
  "./assets/ui/glyph-strike.webp",
  "./assets/ui/icon-abilities.webp",
  "./assets/ui/icon-gear.webp",
  "./assets/ui/icon-guard.webp",
  "./assets/ui/icon-heavy.webp",
  "./assets/ui/icon-history.webp",
  "./assets/ui/icon-intent.webp",
  "./assets/ui/icon-pack.webp",
  "./assets/ui/icon-read.webp",
  "./assets/ui/icon-recover.webp",
  "./assets/ui/icon-run.webp",
  "./assets/ui/icon-sand.webp",
  "./assets/ui/icon-skull.webp",
  "./assets/ui/icon-strike.webp",
  "./assets/ui/ornament-star.webp",
  "./assets/ui/pip-off.webp",
  "./assets/ui/pip-on.webp",
  "./assets/ui/portrait-ring.webp",
  "./assets/ui/tex-gold.webp",
  "./assets/ui/tex-stone-teal.webp",
  "./assets/ui/tex-stone.webp",
  "./assets/ui/bg-strata-1-500.png",
  "./assets/ui/lantern-hq.png",
  "./assets/ui/cave-mark.png",
  "./assets/ui/boss-mark.png",
  "./assets/ui/travel-merchant-mark.png",
  "./assets/ui/camp-mark.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Bypass the browser HTTP cache while installing a new app shell so a
        // newly-versioned worker cannot seed itself with an older index.html.
        const requests = APP_SHELL.map(path =>
          new Request(new URL(path, self.location).href, {cache:"reload"})
        );
        return cache.addAll(requests);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names =>
        Promise.all(
          names
            .filter(name => name.startsWith("lowfathom-") && name !== CACHE_NAME)
            .map(name => caches.delete(name))
        )
      )
      .then(() => self.clients.claim())
  );
});

function fetchFresh(request) {
  const url = new URL(request.url);
  return url.origin === self.location.origin
    ? fetch(request, {cache:"no-store"})
    : fetch(request);
}

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  // Navigation requests get the newest index while online, then fall back to
  // the cached app shell when the network is unavailable.
  if (request.mode === "navigate") {
    event.respondWith(
      fetchFresh(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("./index.html", copy));
          }
          return response;
        })
        .catch(() =>
          caches.match("./index.html")
            .then(cached => cached || caches.match("./"))
        )
    );
    return;
  }

  // For ordinary assets use network-first while developing so updates appear
  // promptly, with cache fallback for offline use.
  event.respondWith(
    fetchFresh(request)
      .then(response => {
        if (response && (response.ok || response.type === "opaque")) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true })
      )
  );
});