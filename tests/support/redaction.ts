/**
 * The redaction assertion helpers.
 *
 * Redaction is asserted on the returned OBJECT, never on rendered HTML: a
 * value that never reaches the DTO cannot be leaked by a component, and a
 * value that does reach it is leaked whether or not today's markup happens
 * to print it.
 */

/** Every string anywhere inside a value, with the path that reached it. */
export function collectStrings(value: unknown, path = '$'): Array<{ path: string; value: string }> {
  if (typeof value === 'string') return [{ path, value }];
  if (typeof value === 'number' || typeof value === 'boolean') {
    return [{ path, value: String(value) }];
  }
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => collectStrings(v, `${path}[${i}]`));
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => collectStrings(v, `${path}.${k}`));
  }
  return [];
}

/** Where a needle appears inside an object graph, case-insensitively. */
export function findLeaks(subject: unknown, needle: string): string[] {
  const n = needle.toLowerCase();
  return collectStrings(subject)
    .filter((s) => s.value.toLowerCase().includes(n))
    .map((s) => `${s.path} = ${JSON.stringify(s.value)}`);
}

/** Every key name anywhere in the graph. */
export function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((v) => collectKeys(v, out));
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k);
      collectKeys(v, out);
    }
  }
  return out;
}

/**
 * Any decimal number written with three or more fraction digits, excluding
 * the house date format (`21.08.2026`) and ISO timestamps, which are not
 * coordinates. Used to prove a public surface carries no doorstep-precision fix.
 */
export function findPreciseDecimals(subject: unknown): Array<{ path: string; match: string }> {
  const out: Array<{ path: string; match: string }> = [];
  for (const { path, value } of collectStrings(subject)) {
    // Strip ISO timestamps (2026-08-12T18:42:00.000Z) and telemetry dates.
    const cleaned = value
      .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, '')
      .replace(/\b\d{2}\.\d{2}\.\d{4}\b/g, '');
    for (const m of cleaned.matchAll(/-?\d{1,3}\.\d{3,}/g)) {
      out.push({ path, match: m[0] });
    }
  }
  return out;
}
