import { test, expect } from '@playwright/test';
import {
  MISSION_TRANSITIONS,
  canTransition,
  nextStage,
  transitionPath,
} from '@/lib/missions/state';
import { MissionTransitionError } from '@/lib/missions/errors';
import { MISSION_STAGES, STAGE_DESCRIPTION, STAGE_LABEL, stageIndex, stageReached } from '@/lib/types';
import type { MissionStage, MissionState } from '@/lib/types';

/**
 * THE MISSION STATE MACHINE — forward-only, no holes, no skipped stages.
 *
 * Pure: this file never touches the database. The database half — that each
 * step actually writes its event — lives in tests/integration/mission-state.
 */

const STAGES = MISSION_STAGES as readonly MissionStage[];

test('stages: there are exactly nine, in the declared order, each with a label and a description', () => {
  expect(STAGES).toEqual([
    'MISSION_CONFIRMED',
    'SATELLITE_TASKED',
    'CAPTURE_WINDOW',
    'IMAGE_ACQUIRED',
    'PROCESSING',
    'PRINT',
    'SHIPPED',
    'FINAL_APPROACH',
    'DELIVERED',
  ]);
  expect(STAGES.length).toBe(9);
  for (const s of STAGES) {
    expect(STAGE_LABEL[s], `${s} label`).toBeTruthy();
    expect(STAGE_DESCRIPTION[s], `${s} description`).toBeTruthy();
  }
  expect(new Set(Object.values(STAGE_LABEL)).size).toBe(9);
});

test('stageIndex / stageReached: a mission has reached every stage at or before its own', () => {
  STAGES.forEach((current, i) => {
    expect(stageIndex(current)).toBe(i);
    STAGES.forEach((other, j) => {
      expect(stageReached(current, other), `${current} reached ${other}`).toBe(j <= i);
    });
  });
});

/* ------------------------------------------------------------------ */
/* The transition graph                                                */
/* ------------------------------------------------------------------ */

test('transitions: each stage may advance only to its immediate successor, or be cancelled', () => {
  STAGES.forEach((stage, i) => {
    const next = STAGES[i + 1];
    expect(MISSION_TRANSITIONS[stage]).toEqual(next ? [next, 'CANCELLED'] : ['CANCELLED']);
  });
});

test('transitions: DELIVERED is the end of the line — cancellation is its only remaining move', () => {
  expect(MISSION_TRANSITIONS.DELIVERED).toEqual(['CANCELLED']);
  expect(nextStage('DELIVERED')).toBeNull();
});

test('transitions: CANCELLED is terminal — nothing leaves it, including itself', () => {
  expect(MISSION_TRANSITIONS.CANCELLED).toEqual([]);
  expect(canTransition('CANCELLED', 'CANCELLED')).toBe(false);
  expect(nextStage('CANCELLED')).toBeNull();
  for (const s of STAGES) {
    expect(canTransition('CANCELLED', s), `CANCELLED must not resume to ${s}`).toBe(false);
  }
});

test('canTransition: the full 10 × 10 matrix allows exactly one forward step and cancellation', () => {
  const states: MissionState[] = [...STAGES, 'CANCELLED'];
  for (const from of states) {
    for (const to of states) {
      const legal =
        from !== 'CANCELLED' &&
        (to === 'CANCELLED' ||
          stageIndex(to as MissionStage) === stageIndex(from as MissionStage) + 1);
      expect(canTransition(from, to), `${from} → ${to}`).toBe(legal);
    }
  }
});

test('canTransition: a backward step is refused from every stage', () => {
  for (let i = 1; i < STAGES.length; i++) {
    for (let j = 0; j < i; j++) {
      expect(canTransition(STAGES[i], STAGES[j]), `${STAGES[i]} → ${STAGES[j]}`).toBe(false);
    }
  }
});

test('canTransition: skipping a stage is refused even when the target is ahead', () => {
  expect(canTransition('MISSION_CONFIRMED', 'CAPTURE_WINDOW')).toBe(false);
  expect(canTransition('CAPTURE_WINDOW', 'PRINT')).toBe(false);
  expect(canTransition('MISSION_CONFIRMED', 'DELIVERED')).toBe(false);
});

test('canTransition: a stage cannot transition to itself', () => {
  for (const s of STAGES) expect(canTransition(s, s), `${s} → ${s}`).toBe(false);
});

test('nextStage: returns the immediate successor for every stage but the last', () => {
  STAGES.forEach((stage, i) => {
    expect(nextStage(stage)).toBe(STAGES[i + 1] ?? null);
  });
});

/* ------------------------------------------------------------------ */
/* transitionPath — the timeline must never contain a hole             */
/* ------------------------------------------------------------------ */

test('transitionPath: every forward pair walks every intermediate stage, contiguously and in order', () => {
  for (let i = 0; i < STAGES.length; i++) {
    for (let j = i + 1; j < STAGES.length; j++) {
      const path = transitionPath(STAGES[i], STAGES[j]);
      expect(path, `${STAGES[i]} → ${STAGES[j]}`).toEqual(STAGES.slice(i + 1, j + 1));
      expect(path.length).toBe(j - i);
      expect(path[path.length - 1]).toBe(STAGES[j]);
      // Contiguity: every consecutive pair in the path is itself legal.
      let cursor: MissionState = STAGES[i];
      for (const step of path) {
        expect(canTransition(cursor, step), `hole at ${cursor} → ${step}`).toBe(true);
        cursor = step;
      }
    }
  }
});

test('transitionPath: MISSION_CONFIRMED to DELIVERED is all eight remaining stages, none skipped', () => {
  expect(transitionPath('MISSION_CONFIRMED', 'DELIVERED')).toEqual(STAGES.slice(1));
  expect(transitionPath('MISSION_CONFIRMED', 'DELIVERED')).toHaveLength(8);
});

test('transitionPath: a single step returns exactly one stage', () => {
  expect(transitionPath('CAPTURE_WINDOW', 'IMAGE_ACQUIRED')).toEqual(['IMAGE_ACQUIRED']);
});

test('transitionPath: going backwards throws MissionTransitionError and says so', () => {
  for (let i = 1; i < STAGES.length; i++) {
    for (let j = 0; j < i; j++) {
      let thrown: unknown;
      try {
        transitionPath(STAGES[i], STAGES[j]);
      } catch (err) {
        thrown = err;
      }
      expect(thrown, `${STAGES[i]} → ${STAGES[j]} must throw`).toBeInstanceOf(MissionTransitionError);
      expect((thrown as Error).message).toMatch(/forward-only/i);
    }
  }
});

test('transitionPath: standing still throws rather than returning an empty path', () => {
  for (const s of STAGES) {
    expect(() => transitionPath(s, s), `${s} → ${s}`).toThrow(MissionTransitionError);
  }
});

test('transitionPath: cancelling from any stage is one step, and a cancelled mission cannot be cancelled twice', () => {
  for (const s of STAGES) {
    expect(transitionPath(s, 'CANCELLED')).toEqual(['CANCELLED']);
  }
  expect(() => transitionPath('CANCELLED', 'CANCELLED')).toThrow(/already cancelled/i);
});

test('transitionPath: a cancelled mission cannot be resumed to any stage', () => {
  for (const s of STAGES) {
    let thrown: unknown;
    try {
      transitionPath('CANCELLED', s);
    } catch (err) {
      thrown = err;
    }
    expect(thrown, `CANCELLED → ${s} must throw`).toBeInstanceOf(MissionTransitionError);
    expect((thrown as Error).message).toMatch(/cannot be resumed/i);
  }
});
