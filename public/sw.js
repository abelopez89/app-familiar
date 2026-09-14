// Service worker mínimo: solo existe para que la PWA sea instalable.
// Sin caché offline ni sincronización en background a propósito.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // No-op: dejamos que todas las requests vayan a la red normalmente.
});
