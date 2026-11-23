"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Reports page changes inside the site to /api/oh/nav, so the 0Humans decision network sees a
 * visitor's whole journey. The first page load is already observed by the proxy (middleware.ts),
 * so only later pathname changes send a beacon. Sends the path and the query string only; the route
 * keeps nothing from the query but utm_* labels and a valid `oh` demo tag. Renders nothing.
 *
 */
export function OhNavBeacon() {
  const pathname = usePathname();
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      const body = JSON.stringify({ path: pathname, search: window.location.search.slice(0, 512) });
      let sent = false;
      try {
        sent = navigator.sendBeacon?.("/api/oh/nav", new Blob([body], { type: "application/json" })) ?? false;
      } catch {
        sent = false; // some engines throw on non-safelisted Blob types; fall back to fetch
      }
      if (!sent) {
        void fetch("/api/oh/nav", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
      }
    } catch {
      // Observation must never affect the visitor.
    }
  }, [pathname]);

  return null;
}
