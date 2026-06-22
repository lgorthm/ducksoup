/**
 * compare.mjs — Diff the last two perf history entries and report regressions.
 *
 * Final step of the `pnpm perf` pipeline. Reads perf/history.json and:
 *   - If 0 entries: prints a hint and exits 0 (nothing to compare yet).
 *   - If 1 entry:  writes a baseline report (no diff) and exits 0.
 *   - If 2+ entries: diffs the last two entries, writes perf/report.md,
 *     prints a colored terminal summary, and exits 1 if any metric crossed
 *     a regression threshold (so this can gate CI in the future).
 *
 * Outputs:
 *   - perf/report.md  — committed, human-readable Markdown comparison table
 *   - terminal stdout — colored diff (green = improvement, red = regression,
 *     dim = unchanged). ANSI codes are stripped when writing to report.md
 *     and when stdout is not a TTY (or NO_COLOR is set).
 *
 * Regression thresholds live in the TH object below — tune them there.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROOT,
  readHistory,
  bytes,
  ms,
} from './_lib.mjs';

// Committed Markdown report path (written on every run).
const REPORT_PATH = join(ROOT, 'perf', 'report.md');

/**
 * Regression thresholds — a run is flagged when the "current" value is worse
 * than "previous" by more than the configured amount. Edit these to tighten or
 * loosen the gate. All comparisons are previous → current (lower is better for
 * timings/CLS/sizes, higher is better for the performance score).
 */
const TH = {
  gzipPct: 2, // gzip total increase (%) beyond which we flag a regression
  lcpMs: 200, // LCP increase (ms)
  cls: 0.02, // CLS increase
  inpMs: 50, // INP increase (ms)
  perfScore: 3, // performance score decrease (points)
};

// ANSI color helpers — disabled when not a TTY or when NO_COLOR is set,
// so the same code path works in CI logs without escape sequences.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const paint = (code, s) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = (s) => paint(32, s);
const red = (s) => paint(31, s);
const dim = (s) => paint(2, s);
const bold = (s) => paint(1, s);
const yellow = (s) => paint(33, s); // reserved for warnings (currently unused)

/** Format a signed integer with an explicit "+" for positive values. */
function sign(n) {
  if (n > 0) return `+${n}`;
  return `${n}`;
}

/** Percentage delta from prev to cur. Returns null when prev is 0/missing. */
function pctDelta(prev, cur) {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

/**
 * Group files by their normalized (hash-stripped) name and sum sizes per group.
 * This lets us compare "index-*.js" across builds even though the content
 * hash changes on every build. Returns an array sorted by raw size (desc).
 */
function groupByNormalized(files) {
  const map = new Map();
  for (const f of files) {
    const key = f.normalized || f.name;
    const cur = map.get(key) || { name: key, ext: f.ext, raw: 0, gzip: 0, brotli: 0, count: 0 };
    cur.raw += f.raw;
    cur.gzip += f.gzip;
    cur.brotli += f.brotli;
    cur.count++;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.raw - a.raw);
}

/**
 * Format a bundle-size delta (bytes). Lower is better → green ▼, higher → red ▲.
 * Includes the percentage change when computable. Returns dim "0" when unchanged.
 */
function fmtBundleDelta(prev, cur) {
  const d = cur - prev;
  const p = pctDelta(prev, cur);
  const dp = p != null ? `(${p >= 0 ? '+' : ''}${p.toFixed(1)}%) ` : '';
  if (d === 0) return dim(`0`);
  const arrow = d < 0 ? green(`▼ ${bytes(Math.abs(d))} ${dp}`) : red(`▲ ${bytes(Math.abs(d))} ${dp}`);
  return arrow;
}

/**
 * Format a timing/metric delta (ms or unitless). Lower is better → green ▼.
 * The unitMs flag picks between ms() formatting (for timings) and 3-decimal
 * formatting (for CLS). Returns dim "n/a" when either side is missing.
 */
function fmtTimingDelta(prev, cur, unitMs = true) {
  if (prev == null || cur == null) return dim('n/a');
  const d = cur - prev; // lower is better
  if (Math.abs(d) < 1) return dim('0');
  const v = unitMs ? ms(Math.abs(d)) : Math.abs(d).toFixed(3);
  return d < 0 ? green(`▼ ${v}`) : red(`▲ ${v}`);
}

/**
 * Format the Lighthouse performance score delta (0–100). Higher is better → green ▲.
 * Returns dim "n/a" when either side is missing.
 */
function fmtScoreDelta(prev, cur) {
  if (prev == null || cur == null) return dim('n/a');
  const d = cur - prev; // higher is better
  if (d === 0) return dim('0');
  return d > 0 ? green(`▲ ${sign(d)}`) : red(`▼ ${sign(Math.abs(d))}`);
}

// --- Load history and branch on how many entries exist ---

const history = readHistory();

if (history.length === 0) {
  console.log('No history yet — nothing to compare. Run `pnpm perf` first.');
  process.exit(0);
}

// Single entry: this is the first measurement — record a baseline, no diff.
if (history.length === 1) {
  const e = history[0];
  const b = e.bundle.total;
  const md = [
    `# Performance baseline`,
    '',
    `Recorded ${e.timestamp} · commit \`${e.commit}\` · branch \`${e.branch}\``,
    '',
    `## Bundle`,
    '',
    `| metric | value |`,
    `| --- | --- |`,
    `| files | ${b.fileCount} |`,
    `| raw | ${bytes(b.raw)} |`,
    `| gzip | ${bytes(b.gzip)} |`,
    `| brotli | ${bytes(b.brotli)} |`,
    '',
  ];
  if (e.lighthouse) {
    const l = e.lighthouse;
    md.push(
      `## Lighthouse (median/${l.runs})`,
      '',
      `| metric | value |`,
      `| --- | --- |`,
      `| performance | ${l.performance} |`,
      `| FCP | ${ms(l.fcp)} |`,
      `| LCP | ${ms(l.lcp)} |`,
      `| TBT | ${ms(l.tbt)} |`,
      `| CLS | ${l.cls?.toFixed(3)} |`,
      `| INP | ${ms(l.inp)} |`,
      `| TTFB | ${ms(l.ttfb)} |`,
      '',
    );
  } else {
    md.push(`_No Lighthouse data for this run._`, '');
  }
  writeFileSync(REPORT_PATH, md.join('\n'));
  console.log(`${bold('Baseline recorded')} (${e.commit})`);
  console.log(`  bundle: raw ${bytes(b.raw)} / gzip ${bytes(b.gzip)} / brotli ${bytes(b.brotli)}`);
  if (e.lighthouse) {
    console.log(`  lighthouse: perf ${e.lighthouse.performance} · LCP ${ms(e.lighthouse.lcp)} · CLS ${e.lighthouse.cls?.toFixed(3)} · INP ${ms(e.lighthouse.inp)}`);
  }
  console.log(dim(`  → ${REPORT_PATH}`));
  process.exit(0);
}

// Two or more entries: diff the last two.
const prev = history[history.length - 2];
const cur = history[history.length - 1];

let regressions = 0;
const md = [];
md.push(`# Performance comparison`, '');
md.push(
  `**previous** ${prev.timestamp} · \`${prev.commit}\` · \`${prev.branch}\`  `,
  `**current**  ${cur.timestamp} · \`${cur.commit}\` · \`${cur.branch}\``,
  '',
);

// --- Bundle comparison ---
// Build a union of chunk keys (normalized names) present in either run, then
// diff raw + gzip sizes per chunk. Brotli is shown in the terminal summary only.
const prevGroups = new Map(groupByNormalized(prev.bundle.files).map((g) => [g.name, g]));
const curGroups = groupByNormalized(cur.bundle.files);
const allKeys = [...new Set([...prevGroups.keys(), ...curGroups.map((g) => g.name)])];

const bundleRows = allKeys
  .map((key) => {
    const p = prevGroups.get(key);
    const c = curGroups.find((g) => g.name === key);
    return { key, p, c };
  })
  .sort((a, b) => (b.c?.raw ?? 0) - (a.c?.raw ?? 0));

// Markdown bundle table — ANSI codes stripped via regex so report.md stays plain.
md.push(`## Bundle`, '');
md.push(`| chunk | prev raw | cur raw | Δ raw | prev gzip | cur gzip | Δ gzip |`);
md.push(`| --- | ---: | ---: | ---: | ---: | ---: | ---: |`);
for (const r of bundleRows) {
  const pRaw = r.p?.raw ?? 0;
  const cRaw = r.c?.raw ?? 0;
  const pGz = r.p?.gzip ?? 0;
  const cGz = r.c?.gzip ?? 0;
  md.push(
    `| ${r.key} | ${bytes(pRaw)} | ${bytes(cRaw)} | ${fmtBundleDelta(pRaw, cRaw).replace(/\x1b\[[0-9;]*m/g, '')} | ${bytes(pGz)} | ${bytes(cGz)} | ${fmtBundleDelta(pGz, cGz).replace(/\x1b\[[0-9;]*m/g, '')} |`,
  );
}
const pTot = prev.bundle.total;
const cTot = cur.bundle.total;
md.push(
  `| **TOTAL** | **${bytes(pTot.raw)}** | **${bytes(cTot.raw)}** | ${fmtBundleDelta(pTot.raw, cTot.raw).replace(/\x1b\[[0-9;]*m/g, '')} | **${bytes(pTot.gzip)}** | **${bytes(cTot.gzip)}** | ${fmtBundleDelta(pTot.gzip, cTot.gzip).replace(/\x1b\[[0-9;]*m/g, '')} |`,
);
md.push('');

// Threshold check: gzip total percentage increase.
const gzipPct = pctDelta(pTot.gzip, cTot.gzip);
if (gzipPct != null && gzipPct > TH.gzipPct) {
  regressions++;
  console.log(red(`✗ Bundle gzip total grew ${gzipPct.toFixed(1)}% (> ${TH.gzipPct}%)`));
}

// Terminal bundle summary — totals + top changed chunks (max 6, unchanged ones skipped).
const out = [];
out.push(bold(`Bundle (${prev.commit} → ${cur.commit})`));
out.push(`  TOTAL  raw ${bytes(pTot.raw)} → ${bytes(cTot.raw)}  ${fmtBundleDelta(pTot.raw, cTot.raw)}`);
out.push(`  TOTAL  gzip ${bytes(pTot.gzip)} → ${bytes(cTot.gzip)}  ${fmtBundleDelta(pTot.gzip, cTot.gzip)}`);
out.push(`  TOTAL  brotli ${bytes(pTot.brotli)} → ${bytes(cTot.brotli)}  ${fmtBundleDelta(pTot.brotli, cTot.brotli)}`);
for (const r of bundleRows.slice(0, 6)) {
  if (!r.p || !r.c) continue;
  if (r.p.raw === r.c.raw && r.p.gzip === r.c.gzip) continue;
  out.push(
    `  ${r.key.padEnd(28)} ${bytes(r.p.raw)} → ${bytes(r.c.raw)}  ${fmtBundleDelta(r.p.raw, r.c.raw)}`,
  );
}

// --- Lighthouse comparison ---
// Only diff Lighthouse metrics when both runs have them. If the user ran
// `pnpm perf:bundle` (no Lighthouse) on one side, this section is skipped.
if (prev.lighthouse && cur.lighthouse) {
  const pl = prev.lighthouse;
  const cl = cur.lighthouse;
  md.push(`## Lighthouse (median/${cl.runs ?? '?'} runs)`, '');
  md.push(`| metric | prev | cur | Δ |`);
  md.push(`| --- | ---: | ---: | ---: |`);
  // [label, prevVal, curVal, formattedDelta, isMsUnit]
  const rows = [
    ['performance', pl.performance, cl.performance, fmtScoreDelta(pl.performance, cl.performance), false],
    ['FCP', pl.fcp, cl.fcp, fmtTimingDelta(pl.fcp, cl.fcp), true],
    ['LCP', pl.lcp, cl.lcp, fmtTimingDelta(pl.lcp, cl.lcp), true],
    ['TBT', pl.tbt, cl.tbt, fmtTimingDelta(pl.tbt, cl.tbt), true],
    ['CLS', pl.cls, cl.cls, fmtTimingDelta(pl.cls, cl.cls, false), false],
    ['INP', pl.inp, cl.inp, fmtTimingDelta(pl.inp, cl.inp), true],
    ['TTFB', pl.ttfb, cl.ttfb, fmtTimingDelta(pl.ttfb, cl.ttfb), true],
  ];
  // Value formatters: scores are plain integers, timings use ms(), CLS uses 3 decimals.
  const fmtVal = (v, isMs) => (v == null ? 'n/a' : isMs ? ms(v) : v.toFixed(3));
  const fmtValScore = (v) => (v == null ? 'n/a' : String(v));
  for (const [label, p, c, d, isMs] of rows) {
    const pStr = label === 'performance' ? fmtValScore(p) : fmtVal(p, isMs);
    const cStr = label === 'performance' ? fmtValScore(c) : fmtVal(c, isMs);
    md.push(`| ${label} | ${pStr} | ${cStr} | ${d.replace(/\x1b\[[0-9;]*m/g, '')} |`);
  }
  md.push('');

  // Terminal Lighthouse summary (with ANSI colors preserved).
  out.push('');
  out.push(bold(`Lighthouse (${prev.commit} → ${cur.commit})`));
  for (const [label, p, c, d, isMs] of rows) {
    const pStr = label === 'performance' ? fmtValScore(p) : fmtVal(p, isMs);
    const cStr = label === 'performance' ? fmtValScore(c) : fmtVal(c, isMs);
    out.push(`  ${label.padEnd(12)} ${pStr} → ${cStr}  ${d}`);
  }

  // Threshold checks for runtime metrics. Each prints a red line on regression.
  if (cl.lcp != null && pl.lcp != null && cl.lcp - pl.lcp > TH.lcpMs) {
    regressions++;
    console.log(red(`✗ LCP regressed by ${Math.round(cl.lcp - pl.lcp)}ms (> ${TH.lcpMs}ms)`));
  }
  if (cl.cls != null && pl.cls != null && cl.cls - pl.cls > TH.cls) {
    regressions++;
    console.log(red(`✗ CLS regressed by ${(cl.cls - pl.cls).toFixed(3)} (> ${TH.cls})`));
  }
  if (cl.inp != null && pl.inp != null && cl.inp - pl.inp > TH.inpMs) {
    regressions++;
    console.log(red(`✗ INP regressed by ${Math.round(cl.inp - pl.inp)}ms (> ${TH.inpMs}ms)`));
  }
  if (cl.performance != null && pl.performance != null && pl.performance - cl.performance > TH.perfScore) {
    regressions++;
    console.log(red(`✗ Performance score dropped ${pl.performance - cl.performance} points (> ${TH.perfScore})`));
  }
} else {
  // One or both runs lack Lighthouse data (e.g. `pnpm perf:bundle` was used).
  md.push(`_Lighthouse data missing on one or both runs — skipping runtime comparison._`, '');
  out.push('');
  out.push(dim(`Lighthouse: skipped (missing on one or both runs)`));
}

// Write the committed Markdown report and print the terminal summary.
writeFileSync(REPORT_PATH, md.join('\n'));

console.log(out.join('\n'));
console.log('');
console.log(dim(`→ ${REPORT_PATH}`));

// Exit code gates CI: 1 = regression beyond threshold, 0 = clean.
if (regressions > 0) {
  console.log(red(bold(`\n✗ ${regressions} regression(s) detected (thresholds in scripts/perf/compare.mjs)`)));
  process.exit(1);
} else {
  console.log(green(bold(`\n✓ No regressions beyond thresholds`)));
  process.exit(0);
}
