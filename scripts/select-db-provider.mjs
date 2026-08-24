// Pick the Prisma datasource provider from DATABASE_URL's scheme.
//
// The repository ships `provider = "sqlite"` so a fresh clone runs the whole
// product locally with zero setup (README / INTEGRATIONS.md). A hosted deploy
// points DATABASE_URL at Postgres — REVIEW.md calls this "the one blocking
// change" — and this script performs it from the URL alone, so nothing has to
// be hand-edited per environment. It runs before every `prisma generate`.
import { readFileSync, writeFileSync } from 'node:fs';

const url = process.env.DATABASE_URL ?? '';
const provider = /^postgres(ql)?:\/\//i.test(url) ? 'postgresql' : 'sqlite';

const path = new URL('../prisma/schema.prisma', import.meta.url);
const src = readFileSync(path, 'utf8');
// Only the datasource line carries "sqlite"/"postgresql"; the generator line is
// "prisma-client-js" and is never matched.
const out = src.replace(/provider = "(?:sqlite|postgresql)"/g, `provider = "${provider}"`);

if (out !== src) {
  writeFileSync(path, out);
  console.log(`[db] Prisma provider set to ${provider}`);
} else {
  console.log(`[db] Prisma provider already ${provider}`);
}
