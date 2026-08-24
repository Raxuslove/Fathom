"use strict";
const CACHE_NAME="lowfathom-v0.213.0-equipment-benchmark-rebalance";
const CORE=[
  "./","./index.html","./manifest.json",
  "./js/legacy.js","./js/world-core.js","./js/world.js","./js/world-bridge.js","./js/dice.js"
];
const OPTIONAL=[
  "./icons/icon-192.png","./icons/icon-512.png",
  "./assets/ui/frame-button.png","./assets/ui/frame-button-red.png","./assets/ui/frame-panel.png","./assets/ui/frame-map.png","./assets/ui/frame-teal.png",
  "./assets/ui/glyph-gear.png","./assets/ui/glyph-abilities.png","./assets/ui/glyph-pack.png","./assets/ui/glyph-run.png",
  "./assets/ui/icon-heavy.png","./assets/ui/icon-guard.png","./assets/ui/icon-recover.png","./assets/ui/icon-strike.png",
  "./assets/ui/bag_coins.png","./assets/ui/goblin-cutter.png","./assets/ui/goblin-skitter.png","./assets/ui/goblin-shieldback.png","./assets/ui/goblin-mauler.png","./assets/ui/goblin-oldhand.png","./assets/creatures/slime1-right.png","./assets/creatures/slime2-right.png",
  "./assets/ui/town-grey-lantern.png","./assets/ui/city-lantern.png","./assets/ui/companion-torch.png",
  "./assets/player/knight-lantern-player.png","./assets/player/mage-lantern-player.png","./assets/player/rogue-lantern-player.png"
];
const fresh=path=>new Request(new URL(path,self.location).href,{cache:"reload"});
self.addEventListener("install",event=>event.waitUntil((async()=>{const c=await caches.open(CACHE_NAME);await c.addAll(CORE.map(fresh));await Promise.allSettled(OPTIONAL.map(x=>c.add(fresh(x))));await self.skipWaiting();})()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{for(const name of await caches.keys()){if(name.startsWith("lowfathom-")&&name!==CACHE_NAME)await caches.delete(name);}await self.clients.claim();})()));
self.addEventListener("fetch",event=>{const req=event.request;if(req.method!=="GET")return;const url=new URL(req.url);const same=url.origin===self.location.origin;const network=()=>same?fetch(req,{cache:"no-store"}):fetch(req);if(req.mode==="navigate"){event.respondWith(network().then(async res=>{if(res&&res.ok)(await caches.open(CACHE_NAME)).put("./index.html",res.clone());return res;}).catch(async()=>await caches.match("./index.html")||await caches.match("./")));return;}event.respondWith(network().then(async res=>{if(res&&(res.ok||res.type==="opaque")&&same)(await caches.open(CACHE_NAME)).put(req,res.clone());return res;}).catch(()=>caches.match(req,{ignoreSearch:true})));});
