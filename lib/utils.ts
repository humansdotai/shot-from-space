import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * The design system defines its own type roles as Tailwind v4 `--text-*`
 * theme tokens. `tailwind-merge` ships a fixed table of Tailwind's built-in
 * scale, so it has no entry for `text-hero`, `text-heading`, `text-label` and
 * the rest — it classifies them as text *colours* and silently drops them the
 * moment a class list also carries a real colour. `text-heading text-paper`
 * merged down to `text-paper`, and the heading rendered at inherited size.
 *
 * Registering the roles as font sizes restores the intended behaviour: a role
 * conflicts only with another role, and never with a colour.
 *
 * Any new `--text-*` token in globals.css must be added here too.
 */
const TYPE_ROLES = [
  'hero',
  'display',
  'heading',
  'body',
  'prose',
  'label',
  'action',
  'tele',
  'tele-s',
  'tele-xs',
] as const;

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: [...TYPE_ROLES] }],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * A record that carries a date but no time of day: `2000-02-27`, `2015-10`,
 * `2023`. Archive scenes are dated to the day at best, so a clock must not be
 * printed beside one — `00:00AM` is a fabricated time, not a formatting
 * artefact. Both formatters below degrade to what the value actually holds.
 */
const DATE_ONLY = /^\d{4}(-\d{2}(-\d{2})?)?$/;

function dateOnlyLabel(value: string): string {
  const [y, m, d] = value.split('-');
  if (d) return `${d}.${m}.${y}`;
  if (m) return `${m}.${y}`;
  return y;
}

/**
 * Brand telemetry timestamp: `21:34PM 02.10.2026`
 * (24h clock with an AM/PM suffix, DD.MM.YYYY date — this is the house format,
 * it is deliberate, do not "fix" it.)
 *
 * Given a date with no time — `2000-02-27` — it prints the date alone rather
 * than inventing midnight.
 */
export function formatTelemetryTimestamp(input: string | Date): string {
  if (typeof input === 'string' && DATE_ONLY.test(input)) return dateOnlyLabel(input);
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '--:--—— --.--.----';
  const pad = (n: number) => String(n).padStart(2, '0');
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  const suffix = d.getUTCHours() < 12 ? 'AM' : 'PM';
  return `${hh}:${mm}${suffix} ${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** `02.10.2026`, or `10.2026` / `2026` when that is all the record holds. */
export function formatTelemetryDate(input: string | Date): string {
  if (typeof input === 'string' && DATE_ONLY.test(input)) return dateOnlyLabel(input);
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return '--.--.----';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** Decimal degrees, signed, 4 dp: `34.0522, -118.2437` */
export function formatCoords(lat: number, lon: number, dp = 4): string {
  return `${lat.toFixed(dp)}, ${lon.toFixed(dp)}`;
}

/** Hemispheric form for labels: `34.0522° N / 118.2437° W` */
export function formatCoordsHemisphere(lat: number, lon: number, dp = 4): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(dp)}° ${ns} / ${Math.abs(lon).toFixed(dp)}° ${ew}`;
}

/** Deterministic 0..1 pseudo-random from a string. Keeps mock data stable. */
export function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
