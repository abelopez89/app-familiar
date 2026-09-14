"use client";

import { useEffect } from "react";

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Degradar silenciosamente: la app funciona igual sin PWA.
      });
    }
  }, []);

  return null;
}
