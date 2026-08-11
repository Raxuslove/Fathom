"use strict";

/*
  LOWFATHOM — Session 8C PWA shell
  Bump CACHE_NAME whenever the shipped app shell changes.
*/
const CACHE_NAME = "lowfathom-v0.081.3";

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
      .then(cache => cache.addAll(APP_SHELL))
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

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.method !== "GET") return;

  // Navigation requests:
  // use the newest index while online,
  // fall back to the cached app when offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();

            caches.open(CACHE_NAME).then(cache => {
              cache.put("./index.html", copy);
            });
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

  // Other files:
  // network first while developing so updates appear quickly,
  // cached copy if the network is unavailable.
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && (response.ok || response.type === "opaque")) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, copy);
          });
        }

        return response;
      })
      .catch(() =>
        caches.match(request, { ignoreSearch: true })
      )
  );
});