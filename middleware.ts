import type { NextFetchEvent, NextRequest } from 'next/server';
import { observe } from '@/lib/oh/edge-observer';

/**
 * Edge observer for the 0Humans live site view.
 *
 * Observation only: it always returns undefined, so Next passes the request through untouched (no
 * rewrite, redirect, header, cookie or cache change; static pages stay static). The signed POST runs
 * in event.waitUntil after the response, with a 2.5 s timeout. Without both OH_OBSERVER_URL and
 * OH_OBSERVER_SECRET it does nothing.
 */
export function middleware(request: NextRequest, event: NextFetchEvent): void {
  try {
    const pending = observe(request, process.env);
    if (pending) event.waitUntil(pending);
  } catch {
    // Observation must never affect the visitor's request.
  }
}

// Matcher values must be literals (Next reads them at build time). Keep in sync with
// shouldObserve() in lib/oh/edge-observer.ts; tests/unit/oh-observer.spec.ts checks both.
export const config = {
  matcher: [
    {
      // Page requests: everything except API routes, the operator pages, the mission-control data
      // routes, framework internals, .well-known, metadata images and any path ending in a file
      // extension (static assets, sitemap.xml, robots.txt).
      source:
        '/((?!(?:api|admin|_next|_vercel|\\.well-known|mission/(?:fleet|passes|scene))(?:/|$))(?!.*\\.[^/]*$)(?!(?:.*/)?(?:opengraph-image|twitter-image|apple-icon|icon)$).*)',
      // Client-side navigations and prefetches are not page loads.
      missing: [
        { type: 'header', key: 'rsc' },
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
        { type: 'header', key: 'sec-purpose', value: '.*prefetch.*' },
      ],
    },
    '/llms.txt',
    '/llms-full.txt',
  ],
};
