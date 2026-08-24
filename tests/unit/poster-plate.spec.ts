import { test, expect } from '@playwright/test';
import { resolveFontStack } from '@/lib/poster';
import { resolveGeometry } from '@/lib/poster/layout';
import { buildPlateSvg } from '@/lib/poster/plate';
import { sheetCopy } from '@/lib/poster/sheet';
import type { ResolvedPoster } from '@/lib/poster/types';

/**
 * THE PRINTED PLATE — the two things about it that can leak or break.
 *
 *   1. WHAT THE SHEET SAYS ABOUT WHERE THE TARGET IS. The plate is the only
 *      surface in this product that publishes the fix as PIXELS, so no amount
 *      of redaction in `toMissionDTO` can reach it. `coordDp` is the whole
 *      control and it is asserted here on the copy rather than on the image.
 *   2. WHAT HAPPENS TO THE ONE STRING A CUSTOMER WROTE. The dedication is free
 *      text on its way into an XML document. If it is ever emitted unescaped
 *      the whole plate stops rendering — not one line, the entire document —
 *      so the escaping is asserted directly on the SVG.
 *
 * Neither test touches the database, the network or sharp's raster path.
 */

const BASE: ResolvedPoster = {
  missionCode: '32BF',
  capturedAt: '2026-10-02T21:34:00.000Z',
  lat: 34.101745,
  lon: -118.340637,
  locationLabel: 'LOS ANGELES / CALIFORNIA / UNITED STATES',
  orbit: {
    inclination: 'SSO 98.2°',
    track: '//ELIPSE 33°',
    altitudeKm: 505,
    gsdM: 0.5,
    sensor: 'PLEIADES NEO / AIRBUS',
    azimuthDeg: 191,
    offNadirDeg: 12,
    cloudPct: 3,
  },
  formatId: 'F50',
  sourceLabel: 'SOURCE / TASKED CAPTURE',
  watermark: true,
  degraded: false,
  dedication: null,
  coordDp: 4,
};

/**
 * A coordinate printed to three or more decimals, anywhere in a string. The
 * hemisphere letter is what keeps this off `02.10.2026` in the date.
 */
const PRECISE_FIX = /\d+\.\d{3,}[NSEW]/;

test('the sheet prints the exact fix at 4 dp — the owner’s plate and the print file', () => {
  const copy = sheetCopy(BASE);
  const values = copy.target.map(([, value]) => value);

  expect(copy.target).toHaveLength(2);
  expect(values[0]).toBe('34.1017N 118.3406W');
  expect(values[1]).toMatch(PRECISE_FIX);
  // The two lines are the point of the block: a commanded point and where the
  // spacecraft actually arrived. At full precision they differ.
  expect(values[0]).not.toBe(values[1]);
});

test('the sheet reduces the fix to 2 dp everywhere else, and prints one row rather than two identical ones', () => {
  const copy = sheetCopy({ ...BASE, coordDp: 2 });

  expect(copy.target).toEqual([['FRAME CENTRE', '34.10N 118.34W']]);
  // Nothing anywhere else on the sheet may reintroduce the precision the row
  // just gave up — the purpose paragraph and the notes included.
  expect(JSON.stringify(copy)).not.toMatch(PRECISE_FIX);
});

test('a dedication reaches the plate escaped, uppercased and bounded', async () => {
  const fonts = await resolveFontStack();
  const g = resolveGeometry(960, '5:7');
  const awkward =
    'Für Mama & Papa <3 — "the house on the hill" 🛰️ <script>alert(1)</script> ' +
    '& everything that happened there between 1994 and 2019, which was most of it really';

  const svg = buildPlateSvg({ ...BASE, dedication: awkward }, g, fonts);

  // Markup the customer typed is TEXT on the sheet, never markup in the plate.
  expect(svg).not.toContain('<script>');
  expect(svg).toContain('&lt;SCRIPT&gt;ALERT(1)&lt;/SCRIPT&gt;');
  expect(svg).toContain('FÜR MAMA &amp; PAPA &lt;3');
  // Bounded: two lines at most, and a clip is shown rather than swallowed.
  expect(svg).toContain('…');
  // XML-safe overall: no bare `&` and no control character survived.
  expect(svg).not.toMatch(/&(?!amp;|lt;|gt;|quot;|#)/);
  expect(svg).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/);
});

test('no dedication means no line, no rule and no gap where one would have been', async () => {
  const fonts = await resolveFontStack();
  const g = resolveGeometry(960, '5:7');

  const none = buildPlateSvg({ ...BASE, dedication: null }, g, fonts);
  const blank = buildPlateSvg({ ...BASE, dedication: '   ' }, g, fonts);
  const one = buildPlateSvg({ ...BASE, dedication: 'For my mother.' }, g, fonts);

  // A dedication of nothing composes exactly the plate that has none at all.
  expect(blank).toBe(none);
  expect(one).not.toBe(none);
  expect(one).toContain('FOR MY MOTHER.');
});
