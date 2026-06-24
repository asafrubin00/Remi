import { kv } from "@vercel/kv";
import { enrichGovernanceData } from "../src/data/governanceData.js";

if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
  console.log("[dedupe-cache] Skipped: KV_REST_API_URL and KV_REST_API_TOKEN are not configured.");
  process.exit(0);
}

const patterns = ["remi:ftse:*", "remi:sp500:*"];
let scanned = 0;
let rewritten = 0;
let duplicatesRemoved = 0;

for (const pattern of patterns) {
  let cursor = 0;
  do {
    const [nextCursor, keys] = await kv.scan(cursor, { match: pattern, count: 100 });
    cursor = Number(nextCursor);

    for (const key of keys) {
      scanned += 1;
      const cached = await kv.get(key);
      if (!cached?.directors) continue;

      const before = cached.directors.length;
      const cleaned = enrichGovernanceData(cached);
      const removed = before - cleaned.directors.length;
      if (removed <= 0) continue;

      const ttl = await kv.ttl(key);
      await kv.set(key, cleaned, ttl > 0 ? { ex: ttl } : undefined);
      rewritten += 1;
      duplicatesRemoved += removed;
      console.log("[dedupe-cache] Rewrote", { key, before, after: cleaned.directors.length, removed });
    }
  } while (cursor !== 0);
}

console.log("[dedupe-cache] Complete", { scanned, rewritten, duplicatesRemoved });
