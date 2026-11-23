import { test, expect } from '@playwright/test';
import { config } from '@/middleware';
import { parseCursorBatch } from '@/lib/oh/cursor-ingest';
import {
  classify,
  cursorChannelEnabled,
  cursorIngestUrl,
  hmacHex,
  observe,
  observeNavigation,
  observerEnabled,
  safePath,
  shouldObserve,
  type Observation,
} from '@/lib/oh/edge-observer';

/**
 * LIVE SITE VIEW — what leaves the site, and what never does.
 *
 * The observer sends one signed record per page view to the 0Humans console.
 * These tests pin the three promises the privacy page makes about it: it is off
 * without its two settings, it never names a customer's mission, and the
 * middleware matcher agrees with the code's own page test.
 */

const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const ENV = { OH_OBSERVER_URL: 'https://console.example/api/glp1/observe', OH_OBSERVER_SECRET: 'test-secret' };

function headers(values: Record<string, string>) {
  const lower = Object.fromEntries(Object.entries(values).map(([k, v]) => [k.toLowerCase(), v]));
  return { get: (name: string) => lower[name.toLowerCase()] ?? null };
}

function request(pathname: string, extra: Record<string, string> = {}, search = '') {
  return {
    method: 'GET',
    headers: headers({ 'user-agent': CHROME, 'accept-language': 'en-GB,en;q=0.9', 'x-vercel-ip-country': 'GB', ...extra }),
    nextUrl: { pathname, searchParams: new URLSearchParams(search) },
  };
}

/** Runs `send` with fetch replaced, and returns the requests it made. */
async function captured(send: () => Promise<void> | null) {
  const calls: { url: string; body: string; signature: string }[] = [];
  const real = globalThis.fetch;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    const sent = new Headers(init?.headers);
    calls.push({ url: String(url), body: String(init?.body), signature: sent.get('x-oh-signature') ?? '' });
    return new Response(null, { status: 204 });
  }) as typeof fetch;
  try {
    await send();
  } finally {
    globalThis.fetch = real;
  }
  return calls;
}

test('off without both settings: nothing is sent and the layout renders no sender', () => {
  expect(observe(request('/'), {})).toBeNull();
  expect(observe(request('/'), { OH_OBSERVER_URL: ENV.OH_OBSERVER_URL })).toBeNull();
  expect(observe(request('/'), { OH_OBSERVER_SECRET: 'x' })).toBeNull();
  expect(observerEnabled({})).toBe(false);
  expect(cursorChannelEnabled({})).toBe(false);
  expect(observerEnabled(ENV)).toBe(true);
  expect(cursorChannelEnabled(ENV)).toBe(true);
  expect(cursorIngestUrl(ENV)).toBe('https://console.example/api/glp1/cursor-ingest');
});

test('a plain http observer is refused unless it is local', () => {
  expect(observerEnabled({ ...ENV, OH_OBSERVER_URL: 'http://console.example/api/glp1/observe' })).toBe(false);
  expect(observerEnabled({ ...ENV, OH_OBSERVER_URL: 'http://localhost:8029/api/glp1/observe' })).toBe(true);
});

test('a page view is sent signed, with coarse fields only', async () => {
  const calls = await captured(() =>
    observe(request('/start', { referer: 'https://www.google.com/search?q=secret', cookie: 'sid=abc' }, 'utm_source=newsletter&email=a@b.c'), ENV),
  );
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe(ENV.OH_OBSERVER_URL);
  expect(calls[0].signature).toBe(await hmacHex(ENV.OH_OBSERVER_SECRET, calls[0].body));
  const sent = JSON.parse(calls[0].body) as Observation;
  expect(sent.path).toBe('/start');
  expect(sent.actor_class).toBe('human');
  expect(sent.country).toBe('GB');
  expect(sent.referrer_host).toBe('www.google.com');
  expect(sent.utm).toEqual({ source: 'newsletter' });
  expect(sent.browser).toBe('chrome');
  expect(sent.visitor).toMatch(/^[0-9a-f]{16}$/);
  expect(calls[0].body).not.toContain('secret');
  expect(calls[0].body).not.toContain('a@b.c');
  expect(calls[0].body).not.toContain('sid=abc');
  expect(calls[0].body).not.toContain('Mozilla');
});

test("a customer's own page never leaves with its code", async () => {
  for (const path of ['/m/32BF', '/M32BF', '/s/ab12cd34', '/account/missions/32BF', '/checkout/mock/cs_test_1']) {
    expect(safePath(path), path).toBe('/(redacted)');
    const calls = await captured(() => observe(request(path), ENV));
    expect(calls, path).toHaveLength(1);
    expect(JSON.parse(calls[0].body).path, path).toBe('/(redacted)');
  }
  // Public pages keep their address, the archive sheets included.
  for (const path of ['/', '/start', '/how-it-works', '/missions', '/missions/18QD', '/legal/privacy', '/account']) {
    expect(safePath(path), path).toBe(path);
  }
});

test('a page change inside the site is reported for humans only, and redacted the same way', async () => {
  const human = headers({ 'user-agent': CHROME });
  const calls = await captured(() => observeNavigation(human, ENV, '/m/32BF', ''));
  expect(JSON.parse(calls[0].body)).toMatchObject({ path: '/(redacted)', nav: 'client' });
  expect(observeNavigation(headers({ 'user-agent': 'curl/8.4.0' }), ENV, '/start', '')).toBeNull();
  expect(observeNavigation(human, ENV, '//evil.example/x', '')).toBeNull();
  expect(observeNavigation(human, ENV, '/api/missions', '')).toBeNull();
});

test('operator pages, API routes, data routes and files are not observed', () => {
  for (const path of ['/api/missions', '/admin', '/admin/x', '/mission/fleet', '/mission/passes', '/mission/scene', '/_next/static/a.js', '/icon.svg', '/apple-icon', '/robots.txt']) {
    expect(shouldObserve(path, 'human'), path).toBe(false);
  }
  for (const path of ['/', '/mission', '/missions', '/start', '/m/32BF', '/auth/sign-in']) {
    expect(shouldObserve(path, 'human'), path).toBe(true);
  }
});

test('the middleware matcher agrees with shouldObserve', () => {
  const page = config.matcher[0];
  if (typeof page === 'string') throw new Error('the first matcher is the page matcher');
  const pattern = new RegExp(`^${page.source}$`);
  for (const path of ['/', '/start', '/mission', '/missions/18QD', '/m/32BF', '/api/missions', '/admin', '/mission/fleet', '/_next/static/a.js', '/icon.svg', '/legal/privacy', '/fonts/a.woff2']) {
    expect(pattern.test(path), path).toBe(shouldObserve(path, 'human'));
  }
});

test('agents are named, people are not', () => {
  expect(classify(headers({ 'user-agent': 'Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)' }))).toMatchObject({
    actor_class: 'ai_agent',
    agent_name: 'GPTBot',
  });
  expect(classify(headers({ 'user-agent': CHROME }))).toEqual({ actor_class: 'human', agent_name: null, device: 'desktop' });
});

test('a pointer batch is accepted only in its exact shape, and redacted like a page view', () => {
  const batch = {
    v: 1,
    path: '/m/32BF',
    vw: 1280,
    vh: 720,
    dpr: 2,
    pointer: 'fine',
    epoch: 1795000000000,
    samples: [{ t: 100, k: 'move', x: 10, y: 20, page_y: 0 }],
  };
  expect(parseCursorBatch(batch)?.path).toBe('/(redacted)');
  expect(parseCursorBatch({ ...batch, path: '/start' })?.path).toBe('/start');
  expect(parseCursorBatch({ ...batch, path: '/admin' })).toBeNull();
  expect(parseCursorBatch({ ...batch, text: 'typed' })).toBeNull();
  expect(parseCursorBatch({ ...batch, samples: [{ ...batch.samples[0], value: 'typed' }] })).toBeNull();
});
