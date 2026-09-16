// Service worker mínimo: solo existe para que la PWA sea instalable.
// Sin caché offline ni sincronización en background a propósito.
//
// Tampoco registra un listener de `fetch`: uno vacío no cambia nada
// funcionalmente, pero obliga al navegador a arrancar el service worker
// antes de cada navegación, que es latencia pura. Los navegadores
// actuales no lo piden para poder instalar la app.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
