"use strict";

/*
  LOWFATHOM — app shell update hardening
  Bump CACHE_NAME whenever the shipped app shell changes.
*/
const CACHE_NAME = "lowfathom-v0.100.21";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./assets/ui/bar-track-gold.png",
  "./assets/ui/bar-track-steel.png",
  "./assets/ui/divider-thin.png",
  "./assets/ui/frame-button-red.png",
  "./assets/ui/frame-button.png",
  "./assets/ui/frame-intent.png",
  "./assets/ui/frame-run.png",
  "./assets/ui/frame-chip-teal.png",
  "./assets/ui/frame-chip.png",
  "./assets/ui/frame-panel.png",
  "./assets/ui/frame-square.png",
  "./assets/ui/frame-teal-wide.png",
  "./assets/ui/frame-teal.png",
  "./assets/ui/glyph-abilities.png",
  "./assets/ui/glyph-gear.png",
  "./assets/ui/glyph-guard.png",
  "./assets/ui/glyph-heavy.png",
  "./assets/ui/glyph-history.png",
  "./assets/ui/glyph-intent.png",
  "./assets/ui/glyph-pack.png",
  "./assets/ui/glyph-read.png",
  "./assets/ui/glyph-recover.png",
  "./assets/ui/glyph-run.png",
  "./assets/ui/glyph-sand.png",
  "./assets/ui/glyph-skull.png",
  "./assets/ui/glyph-strike.png",
  "./assets/ui/icon-abilities.png",
  "./assets/ui/icon-gear.png",
  "./assets/ui/icon-guard.png",
  "./assets/ui/icon-heavy.png",
  "./assets/ui/icon-history.png",
  "./assets/ui/icon-intent.png",
  "./assets/ui/icon-pack.png",
  "./assets/ui/icon-read.png",
  "./assets/ui/icon-recover.png",
  "./assets/ui/icon-run.png",
  "./assets/ui/icon-sand.png",
  "./assets/ui/icon-skull.png",
  "./assets/ui/icon-strike.png",
  "./assets/ui/ornament-star.png",
  "./assets/ui/pip-off.png",
  "./assets/ui/pip-on.png",
  "./assets/ui/portrait-ring.png",
  "./assets/ui/tex-gold.png",
  "./assets/ui/tex-stone-teal.png",
  "./assets/ui/tex-stone.png",
  "./assets/ui/bg-strata-1-500.png",
  "./assets/ui/lantern-hq.png",
  "./assets/ui/cave-mark.png",
  "./assets/ui/boss-mark.png",
  "./assets/ui/travel-merchant-mark.png",
  "./assets/ui/camp-mark.png",
  "./assets/fathom-die/obsidian/theme.config.json",
  "./assets/fathom-die/obsidian/diffuse-dark.png",
  "./assets/fathom-die/obsidian/diffuse-light.png",
  "./assets/fathom-die/obsidian/specular-black.jpg"
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