/**
 * collect-lighthouse.mjs — Extract Web Vitals from Lighthouse CI runs.
 *
 * Step 3 of the `pnpm perf` pipeline (after `lhci autorun`).
 * Reads .lighthouseci/manifest.json to locate the representative (median) run,
 * parses its Lighthouse Result JSON (lhr), and merges the extracted metrics
 * into the most recent perf/history.json entry (which was created by
 * collect-bundle.mjs in step 1).
 *
 * Metrics extracted:
 *   - performance  (0–100 Lighthouse performance score)
 *   - FCP  (first-contentful-paint, ms)
 *   - LCP  (largest-contentful-paint, ms)
 *   - TBT  (total-blocking-time, ms)
 *   - CLS  (cumulative-layout-shift, unitless)
 *   - INP  (interaction-to-next-paint, ms — often n/a for automated loads)
 *   - TTFB (server-response-time, ms)
 *
 * This script mutates the last history entry in place by adding a
 * `lighthouse` sub-object, then rewrites perf/history.json.
 */

import { existsSync, readFileSync } from 'node:fs';
import {
  MANIFEST_PATH,
  readHistory,
  writeHistory,
  ms,
} from './_lib.mjs';

// Guard: LHCI must have run first. If manifest.json is missing, the user likely
// skipped the Lighthouse step (e.g. ran `pnpm perf:bundle` instead of `pnpm perf`).
if (!existsSync(MANIFEST_PATH)) {
  console.error('✗ .lighthouseci/manifest.json not found — did `lhci autorun` succeed?');
  process.exit(1);
}

// manifest.json is an array of run descriptors; each has a jsonPath pointing
// to the full Lighthouse Result (lhr) JSON for that run.
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
if (!Array.isArray(manifest) || manifest.length === 0) {
  console.error('✗ Lighthouse manifest is empty');
  process.exit(1);
}

// LHCI marks one run as "representative" (the median across numberOfRuns).
// Fall back to the last run if the flag is missing for some reason.
const median =
  manifest.find((r) => r.isRepresentativeRun) ?? manifest[manifest.length - 1];

// The lhr contains all audits and category scores for the median run.
const lhr = JSON.parse(readFileSync(median.jsonPath, 'utf8'));

/**
 * Read a numeric audit value from the lhr by audit id.
 * Returns null if the audit is missing or has no numericValue (e.g. INP
 * when no interaction occurred during the automated load).
 */
function audit(id) {
  const a = lhr.audits?.[id];
  return a && typeof a.numericValue === 'number' ? a.numericValue : null;
}

// Lighthouse category scores are 0–1; convert to the 0–100 integer shown in the UI.
const perfScore = lhr.categories?.performance?.score;
const metrics = {
  performance: perfScore != null ? Math.round(perfScore * 100) : null,
  fcp: audit('first-contentful-paint'),
  lcp: audit('largest-contentful-paint'),
  tbt: audit('total-blocking-time'),
  cls: audit('cumulative-layout-shift'),
  inp: audit('interaction-to-next-paint'),
  ttfb: audit('server-response-time'),
};

// Attach the Lighthouse metrics to the most recent history entry.
// collect-bundle.mjs must have run first to create that entry.
const history = readHistory();
const last = history[history.length - 1];
if (!last) {
  console.error('✗ perf/history.json empty — run collect-bundle.mjs first');
  process.exit(1);
}

last.lighthouse = {
  ...metrics,
  url: median.url, // the URL that was measured (http://localhost:4173)
  runs: manifest.length, // how many Lighthouse runs were performed
};
writeHistory(history);

// Console summary of the median run.
console.log(
  `✓ Lighthouse (median/${manifest.length}): perf ${metrics.performance} | ` +
    `FCP ${ms(metrics.fcp)} | LCP ${ms(metrics.lcp)} | ` +
    `CLS ${metrics.cls?.toFixed(3)} | INP ${ms(metrics.inp)} | TTFB ${ms(metrics.ttfb)}`,
);
