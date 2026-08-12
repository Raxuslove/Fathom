"use strict";

/*
  LOWFATHOM — Session 8D PWA update hardening
  Bump CACHE_NAME whenever the shipped app shell changes.
*/
const CACHE_NAME = "lowfathom-v0.085.0";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
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