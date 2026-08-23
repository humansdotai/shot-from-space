/**
 * Bounded LRU for rendered plates.
 *
 * Mission Control polls, the gallery renders a grid of frames, and every one of
 * those is the same deterministic composition of the same inputs. Composing a
 * 1100 px preview costs ~200 ms and a few MB of scratch; doing it per poll is
 * simply waste. 32 entries is roughly the whole catalogue plus the seeded demo
 * missions, and the values are already-encoded PNG buffers, so a full cache is
 * on the order of 20–40 MB.
 *
 * Deliberately in-process: it is a cache, not a store. Cold starts recompose.
 */

const MAX_ENTRIES = 32;
/** Total bytes held. Entry count alone is not a budget: a 4800 px plate is
 *  ~37 MB, so 32 of those would be 1.2 GB of heap. */
const MAX_BYTES = 96 * 1024 * 1024;
/** Anything this large is a one-off print proof, not something worth holding. */
const MAX_ENTRY_BYTES = 24 * 1024 * 1024;

const store = new Map<string, Buffer>();
let bytes = 0;

export function cacheGet(key: string): Buffer | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  // Refresh recency.
  store.delete(key);
  store.set(key, hit);
  return hit;
}

export function cacheSet(key: string, value: Buffer): Buffer {
  if (value.length > MAX_ENTRY_BYTES) return value;
  const existing = store.get(key);
  if (existing) {
    store.delete(key);
    bytes -= existing.length;
  }
  store.set(key, value);
  bytes += value.length;
  while (store.size > MAX_ENTRIES || bytes > MAX_BYTES) {
    const oldest = store.keys().next();
    if (oldest.done) break;
    const evicted = store.get(oldest.value);
    store.delete(oldest.value);
    bytes -= evicted?.length ?? 0;
  }
  return value;
}

export function cacheStats(): { size: number; max: number; bytes: number; maxBytes: number } {
  return { size: store.size, max: MAX_ENTRIES, bytes, maxBytes: MAX_BYTES };
}

export function cacheClear(): void {
  store.clear();
  bytes = 0;
}
