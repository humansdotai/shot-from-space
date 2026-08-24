/**
 * Mission codes: 2 digits followed by 2 letters, e.g. "32BF".
 * Rendered in the UI as `MISSION / 32BF` and linked as `shot.space/M32BF`.
 */

// I and O are excluded — they read as 1 and 0 in monospace.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const DIGITS = '0123456789';

export const MISSION_CODE_PATTERN = /^[0-9]{2}[A-HJ-NP-Z]{2}$/;

export function isMissionCode(value: string): boolean {
  return MISSION_CODE_PATTERN.test(value.toUpperCase());
}

export function normalizeMissionCode(value: string): string | null {
  const v = value.trim().toUpperCase().replace(/^M/, '');
  return isMissionCode(v) ? v : null;
}

/** Cryptographically-random mission code. Uniqueness is enforced by the DB. */
export function generateMissionCode(): string {
  const bytes = new Uint8Array(4);
  globalThis.crypto.getRandomValues(bytes);
  return (
    DIGITS[bytes[0] % 10] +
    DIGITS[bytes[1] % 10] +
    LETTERS[bytes[2] % LETTERS.length] +
    LETTERS[bytes[3] % LETTERS.length]
  );
}

/** `shot.space/M32BF` — the canonical short link shown beside a mission code. */
export function missionShortLink(code: string): string {
  return `shot.space/M${code.toUpperCase()}`;
}

/** Local route for a mission control page. */
export function missionPath(code: string): string {
  return `/m/${code.toUpperCase()}`;
}

/** Local route for the read-only shared view. */
export function missionSharePath(code: string, token: string): string {
  return `/s/${code.toUpperCase()}?k=${token}`;
}
