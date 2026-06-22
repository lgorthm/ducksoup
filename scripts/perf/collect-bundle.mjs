/**
 * collect-bundle.mjs — Measure production bundle sizes and append to history.
 *
 * Step 1 of the `pnpm perf` pipeline (after `PERF=1 pnpm build`).
 * Scans dist/assets/ for every emitted file, records raw / gzip / brotli sizes
 * per chunk and in aggregate, then appends a new entry to perf/history.json.
 *
 * Deduplication: any prior entry for the same git commit is removed before
 * appending, so re-running `pnpm perf` on the same commit replaces the old
 * measurement instead of creating a duplicate. A hard cap of MAX_ENTRIES
 * (100) drops the oldest entries to bound file growth.
 *
 * Output shape (one history entry):
 *   {
 *     timestamp, commit, branch,
 *     bundle: { total: {raw,gzip,brotli,fileCount}, byExt: {...}, files: [...] }
 *   }
 */

import { readdirSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import {
  ROOT,
  ASSETS_DIR,
  git,
  readHistory,
  writeHistory,
  normalizeAssetName,
  compressedSizes,
  bytes,
} from './_lib.mjs';

// Identify the current commit + branch so each measurement is attributable.
const commit = git('git rev-parse --short HEAD') || 'unknown';
const branch = git('git rev-parse --abbrev-ref HEAD') || 'unknown';
const timestamp = new Date().toISOString();

// Walk every file in dist/assets/ and record its sizes.
// Vite emits JS, CSS, fonts (woff2), and SVGs here; all are measured.
const files = [];
for (const entry of readdirSync(ASSETS_DIR, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const buf = readFileSync(`${ASSETS_DIR}/${entry.name}`);
  const ext = extname(entry.name).slice(1).toLowerCase();
  const { gzip, brotli } = compressedSizes(buf);
  files.push({
    name: entry.name, // original hashed filename, e.g. "index-Dbb0d-Id.js"
    normalized: normalizeAssetName(entry.name), // hash-stripped, for stable cross-build comparison
    ext,
    raw: buf.length,
    gzip,
    brotli,
  });
}

// Aggregate totals across all files — the primary bundle-size metrics.
const total = files.reduce(
  (acc, f) => {
    acc.raw += f.raw;
    acc.gzip += f.gzip;
    acc.brotli += f.brotli;
    return acc;
  },
  { raw: 0, gzip: 0, brotli: 0 },
);

// Breakdown by file extension (js / css / woff2 / svg …) for a quick summary.
const byExt = {};
for (const f of files) {
  byExt[f.ext] = byExt[f.ext] || { raw: 0, gzip: 0, brotli: 0, count: 0 };
  byExt[f.ext].raw += f.raw;
  byExt[f.ext].gzip += f.gzip;
  byExt[f.ext].brotli += f.brotli;
  byExt[f.ext].count++;
}

// The entry that will be appended to perf/history.json.
const entry = {
  timestamp,
  commit,
  branch,
  bundle: {
    total: { ...total, fileCount: files.length },
    byExt,
    files,
  },
};

// Hard cap on history length to prevent unbounded growth over time.
// Tune by editing this constant; 100 entries × ~4KB ≈ 400KB worst case.
const MAX_ENTRIES = 100;

// Dedup by commit: drop any prior entries for the current commit so re-running
// `pnpm perf` on the same commit replaces the old measurement rather than
// stacking duplicates. Then append the new entry and trim to the cap.
const history = readHistory().filter((e) => e.commit !== commit);
history.push(entry);
while (history.length > MAX_ENTRIES) {
  history.shift();
}
writeHistory(history);

// Console summary — total sizes + per-extension breakdown (largest first).
console.log(
  `✓ Bundle: ${files.length} files | raw ${bytes(total.raw)} | gzip ${bytes(total.gzip)} | brotli ${bytes(total.brotli)}`,
);
const breakdown = Object.entries(byExt)
  .sort((a, b) => b[1].raw - a[1].raw)
  .map(([ext, s]) => `${ext}(${s.count}): ${bytes(s.raw)}/gz${bytes(s.gzip)}`)
  .join('  ');
console.log(`  ${breakdown}`);
