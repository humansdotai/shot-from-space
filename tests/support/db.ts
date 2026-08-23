/**
 * Integration-test database access and cleanup.
 *
 * RULES OF ENGAGEMENT — the seeded demo dossier (32BF, 74KL, 18QD, 55RA and
 * operator@shotfromspace.com) is production data as far as this suite is
 * concerned. Tests READ it and never write it. Anything a test needs to
 * mutate, it creates first and deletes afterwards. Nothing here truncates a
 * table, and nothing here reseeds.
 */
import { PrismaClient } from '@prisma/client';

export const SEEDED_CODES = ['32BF', '74KL', '18QD', '55RA'] as const;
export const SEEDED_OWNER_EMAIL = 'operator@shotfromspace.com';

/** One client for the whole integration project (which runs single-worker). */
export const db: PrismaClient =
  (globalThis as { __sfsTestPrisma?: PrismaClient }).__sfsTestPrisma ??
  new PrismaClient({ log: ['error'] });
(globalThis as { __sfsTestPrisma?: PrismaClient }).__sfsTestPrisma = db;

/**
 * The database is SQLite in rollback-journal mode, so the dev server and the
 * test workers are genuine competing writers. Every database call this suite
 * makes goes through here: a lock or a dropped engine response is retried,
 * anything else is rethrown immediately.
 */
export async function retryDb<T>(op: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await op();
    } catch (err) {
      const message = String((err as Error)?.message ?? err);
      const contended =
        /database is locked|SQLITE_BUSY|Response from the Engine was empty|Timed out during query execution/i.test(
          message,
        );
      if (!contended) throw err;
      last = err;
      await new Promise((r) => setTimeout(r, 120 * (i + 1)));
    }
  }
  throw last;
}

/** The mission row behind a code, with contention handled. */
export function missionRow(code: string) {
  return retryDb(() => db.mission.findUniqueOrThrow({ where: { code: code.toUpperCase() } }));
}

/** A collision-proof email for a throwaway account created by one test. */
export function testEmail(tag: string): string {
  const nonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `sfs-qa+${tag}-${nonce}@example.test`;
}

/**
 * Deletes exactly the records a test created: the named missions (events and
 * comms cascade), their email logs, and the throwaway users plus their
 * sessions and magic-link tokens.
 *
 * Refuses to touch a seeded demo mission or the demo owner, so a copy-paste
 * mistake in a future test cannot repeat the damage a previous agent did.
 */
export async function cleanup(opts: { codes?: string[]; emails?: string[] }): Promise<void> {
  const codes = (opts.codes ?? []).map((c) => c.toUpperCase());
  const emails = (opts.emails ?? []).map((e) => e.trim().toLowerCase());

  for (const code of codes) {
    if ((SEEDED_CODES as readonly string[]).includes(code)) {
      throw new Error(`Refusing to delete seeded demo mission ${code}.`);
    }
  }
  for (const email of emails) {
    if (email === SEEDED_OWNER_EMAIL) {
      throw new Error(`Refusing to delete the seeded demo owner ${email}.`);
    }
  }

  if (codes.length) {
    const missions = await retryDb(() =>
      db.mission.findMany({ where: { code: { in: codes } }, select: { id: true } }),
    );
    const ids = missions.map((m) => m.id);
    if (ids.length) {
      // EmailLog.missionId is SetNull on delete, so it is cleared explicitly
      // rather than left as an orphan row.
      await retryDb(() => db.emailLog.deleteMany({ where: { missionId: { in: ids } } }));
      await retryDb(() => db.mission.deleteMany({ where: { id: { in: ids } } }));
    }
  }

  if (emails.length) {
    const users = await retryDb(() =>
      db.user.findMany({ where: { email: { in: emails } }, select: { id: true } }),
    );
    const ids = users.map((u) => u.id);
    if (ids.length) {
      // Sessions cascade, but magic-link tokens are SetNull; clear both so no
      // orphan rows are left behind.
      await retryDb(() => db.magicLinkToken.deleteMany({ where: { userId: { in: ids } } }));
      await retryDb(() => db.session.deleteMany({ where: { userId: { in: ids } } }));
    }
    await retryDb(() => db.magicLinkToken.deleteMany({ where: { email: { in: emails } } }));
    await retryDb(() => db.emailLog.deleteMany({ where: { to: { in: emails } } }));
    await retryDb(() => db.user.deleteMany({ where: { email: { in: emails } } }));
  }
}

/** A snapshot of the seeded dossier, used to prove a test left it untouched. */
export async function seededFingerprint() {
  const missions = await retryDb(() => db.mission.findMany({
    where: { code: { in: [...SEEDED_CODES] } },
    select: {
      code: true,
      state: true,
      email: true,
      addressLine1: true,
      lat: true,
      lon: true,
      amountMinor: true,
      shareToken: true,
      _count: { select: { events: true } },
    },
    orderBy: { code: 'asc' },
  }));
  return JSON.stringify(missions);
}
