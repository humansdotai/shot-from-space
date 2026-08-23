import { test, expect } from '@playwright/test';
import {
  MISSION_CODE_PATTERN,
  generateMissionCode,
  isMissionCode,
  missionPath,
  missionSharePath,
  missionShortLink,
  normalizeMissionCode,
} from '@/lib/codes';
import { getExampleMission, listExampleMissions } from '@/lib/gallery';

/**
 * MISSION CODES — pattern, normalisation, and the archive collision guard.
 *
 * `/m/{code}` (a customer's file) and `/missions/{code}` (a Landsat reference
 * sheet) share one code space, so a minted code that matches an archive code
 * would make a paid mission resolve to a reference frame.
 */

/** The alphabet a code may use: I and O are excluded, they read as 1 and 0. */
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

test('code pattern: accepts two digits followed by two letters from the reduced alphabet', () => {
  expect(MISSION_CODE_PATTERN.test('32BF')).toBe(true);
  expect(MISSION_CODE_PATTERN.test('00AA')).toBe(true);
  expect(MISSION_CODE_PATTERN.test('99ZZ')).toBe(true);
  expect(MISSION_CODE_PATTERN.test('18QD')).toBe(true);
});

test('code pattern: rejects the ambiguous letters I and O in either position', () => {
  expect(MISSION_CODE_PATTERN.test('12IA')).toBe(false);
  expect(MISSION_CODE_PATTERN.test('12AI')).toBe(false);
  expect(MISSION_CODE_PATTERN.test('12OA')).toBe(false);
  expect(MISSION_CODE_PATTERN.test('12AO')).toBe(false);
});

test('code pattern: rejects wrong lengths, wrong order and lowercase', () => {
  for (const bad of ['3BF', '322BF', '32B', 'BF32', '3B2F', '32bf', '', '    ', 'M32BF', '32-BF']) {
    expect(MISSION_CODE_PATTERN.test(bad), `${JSON.stringify(bad)} must not match`).toBe(false);
  }
});

test('isMissionCode: case-insensitive, so a code typed in lowercase is still a code', () => {
  expect(isMissionCode('32bf')).toBe(true);
  expect(isMissionCode('32BF')).toBe(true);
  expect(isMissionCode('32bi')).toBe(false);
});

test('normalizeMissionCode: uppercases, trims, and strips the short-link M prefix', () => {
  expect(normalizeMissionCode('32bf')).toBe('32BF');
  expect(normalizeMissionCode('  32bf  ')).toBe('32BF');
  expect(normalizeMissionCode('M32BF')).toBe('32BF');
  expect(normalizeMissionCode('m32bf')).toBe('32BF');
  expect(normalizeMissionCode(' m32bf ')).toBe('32BF');
});

test('normalizeMissionCode: returns null for anything that is not a code, rather than a partial value', () => {
  for (const bad of ['', 'ABCD', '3BF', '32BI', '32BO', '32B', 'MMM', '../32BF', '32BF; DROP']) {
    expect(normalizeMissionCode(bad), `${JSON.stringify(bad)} must normalise to null`).toBeNull();
  }
});

test('missionShortLink / missionPath / missionSharePath render the canonical forms', () => {
  expect(missionShortLink('32bf')).toBe('shot.space/M32BF');
  expect(missionPath('32bf')).toBe('/m/32BF');
  expect(missionSharePath('32bf', 'tok_1')).toBe('/s/32BF?k=tok_1');
});

test('generateMissionCode: every minted code matches the pattern and uses only the reduced alphabet', () => {
  for (let i = 0; i < 2000; i++) {
    const code = generateMissionCode();
    expect(MISSION_CODE_PATTERN.test(code), `minted ${code}`).toBe(true);
    expect(LETTERS).toContain(code[2]);
    expect(LETTERS).toContain(code[3]);
  }
});

test('generateMissionCode: draws across the whole code space rather than repeating one value', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) seen.add(generateMissionCode());
  // 57,600 possible codes; 500 draws collide rarely. Anything under 400
  // distinct means the generator is not really random.
  expect(seen.size).toBeGreaterThan(400);
});

test('archive codes live inside the minted code space, which is why the mint has to exclude them', () => {
  const archive = listExampleMissions();
  expect(archive.length).toBeGreaterThan(0);
  for (const m of archive) {
    expect(MISSION_CODE_PATTERN.test(m.code), `archive code ${m.code}`).toBe(true);
    expect(getExampleMission(m.code)?.slug).toBe(m.slug);
  }
});

test('archive codes are unique and never collide with the four seeded demo mission codes', () => {
  const archive = listExampleMissions().map((m) => m.code);
  expect(new Set(archive).size).toBe(archive.length);
  for (const reserved of ['32BF', '74KL', '18QD', '55RA']) {
    expect(archive, `archive must not mint the demo code ${reserved}`).not.toContain(reserved);
    expect(getExampleMission(reserved)).toBeUndefined();
  }
});

test('getExampleMission: tolerates lowercase, whitespace and the M prefix like the real router does', () => {
  const first = listExampleMissions()[0];
  expect(getExampleMission(first.code.toLowerCase())?.code).toBe(first.code);
  expect(getExampleMission(` m${first.code} `)?.code).toBe(first.code);
  expect(getExampleMission('ZZZZ')).toBeUndefined();
});
