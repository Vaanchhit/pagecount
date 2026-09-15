// Minimal service worker: exists only to satisfy install-to-home-screen
// criteria. No caching of pages or API responses — this app's data comes
// live from Supabase and stale reads would be worse than a network request.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
