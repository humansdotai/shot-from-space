/**
 * Global teardown — the safety net.
 *
 * Every test deletes what it created. This sweeps anything left behind when a
 * test dies mid-flight, and it can only ever touch records whose email is in
 * the suite's own `sfs-qa+…@example.test` namespace. It never truncates a
 * table and it can never reach the seeded demo dossier.
 */
import { db, retryDb } from './db';

const QA_PREFIX = 'sfs-qa+';

export default async function globalTeardown(): Promise<void> {
  try {
    const users = await retryDb(() =>
      db.user.findMany({ where: { email: { startsWith: QA_PREFIX } }, select: { id: true, email: true } }),
    );
    const missions = await retryDb(() =>
      db.mission.findMany({ where: { email: { startsWith: QA_PREFIX } }, select: { id: true, code: true } }),
    );

    if (missions.length) {
      const ids = missions.map((m) => m.id);
      await retryDb(() => db.emailLog.deleteMany({ where: { missionId: { in: ids } } }));
      await retryDb(() => db.mission.deleteMany({ where: { id: { in: ids } } }));
    }

    if (users.length) {
      const ids = users.map((u) => u.id);
      const emails = users.map((u) => u.email);
      await retryDb(() => db.magicLinkToken.deleteMany({ where: { userId: { in: ids } } }));
      await retryDb(() => db.magicLinkToken.deleteMany({ where: { email: { in: emails } } }));
      await retryDb(() => db.session.deleteMany({ where: { userId: { in: ids } } }));
      await retryDb(() => db.emailLog.deleteMany({ where: { to: { in: emails } } }));
      await retryDb(() => db.user.deleteMany({ where: { id: { in: ids } } }));
    }

    if (missions.length || users.length) {
      console.log(
        `[teardown] swept ${missions.length} stray mission(s) and ${users.length} stray account(s) ` +
          `left by an interrupted test.`,
      );
    }
  } finally {
    await db.$disconnect();
  }
}
