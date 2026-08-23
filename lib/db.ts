/**
 * Prisma client singleton.
 *
 * Next.js dev mode hot-reloads modules on every edit. Without a global cache
 * each reload would open a new SQLite connection pool until the process ran
 * out of handles, so the client is stashed on `globalThis` in development.
 * In production the module is evaluated once and the global is not used.
 *
 * All data access lives on the server. Client components never import this —
 * they talk to the routes under `app/api/*`.
 */
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Queries are logged in dev only; SQLite is local so this stays cheap.
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
