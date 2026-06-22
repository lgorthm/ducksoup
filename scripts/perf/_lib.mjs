/**
 * _lib.mjs — Shared utilities for the perf measurement scripts.
 *
 * This module is the single dependency of collect-bundle.mjs,
 * collect-lighthouse.mjs, and compare.mjs. It intentionally uses only
 * Node.js built-in modules (`node:fs`, `node:zlib`, `node:child_process`,
 * `node:path`, `node:url`) so the perf pipeline stays dependency-free and
 * is not covered by tsc / eslint (which only target **//*.{ts,tsx}).
 *
 * Exposes:
 *   - Filesystem path constants (ROOT, HISTORY_PATH, …)
 *   - git()           — run a git command in the repo root
 *   - bytes() / ms()  — human-readable size / duration formatting
 *   - normalizeAssetName() — strip Vite content hashes for stable comparison
 *   - readHistory() / writeHistory() — persist measurement entries to perf/history.json
 *   - compressedSizes()      — compute gzip + brotli sizes of a Buffer
 */

import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync } from 'node:zlib';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Repo root = two levels up from this file (scripts/perf/_lib.mjs → repo root)
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// perf/history.json — the committed, append-only (with dedup) measurement log
export const HISTORY_PATH = join(ROOT, 'perf', 'history.json');

// Vite build output directory — scanned by collect-bundle.mjs for chunk sizes
export const ASSETS_DIR = join(ROOT, 'dist', 'assets');

// Lighthouse CI output directory — written by `lhci autorun`, read by collect-lighthouse.mjs
export const LHCI_DIR = join(ROOT, '.lighthouseci');

// LHCI manifest listing every Lighthouse run; used to locate the median run
export const MANIFEST_PATH = join(LHCI_DIR, 'manifest.json');

/**
 * Run a git command in the repo root and return trimmed stdout.
 * Returns null on failure (e.g. not a git repo) so callers can fall back gracefully.
 */
export function git(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

/**
 * Format a byte count as a human-readable string (B / KB / MB).
 * Returns 'n/a' for null/undefined so it can be used directly on missing metrics.
 */
export function bytes(n) {
  if (n == null) return 'n/a';
  const abs = Math.abs(n);
  if (abs < 1024) return `${n} B`;
  if (abs < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

/**
 * Format a millisecond duration as a human-readable string (ms / s).
 * Returns 'n/a' for null/undefined so it can be used directly on missing metrics.
 */
export function ms(n) {
  if (n == null) return 'n/a';
  if (n >= 1000) return `${(n / 1000).toFixed(2)} s`;
  return `${Math.round(n)} ms`;
}

/**
 * Strip the Vite/Rolldown content hash from an asset filename so the same
 * logical chunk can be matched across builds even when its hash changes.
 *
 * Example: "index-Dbb0d-Id.js"  →  "index-*.js"
 *          "markdown-renderer-kF0zdaAO.js" → "markdown-renderer-*.js"
 *
 * The hash is assumed to be a 6+ char alphanumeric run before the extension.
 * Files that don't match the pattern are returned unchanged.
 */
export function normalizeAssetName(name) {
  return name.replace(/^(.+)-[A-Za-z0-9_-]{6,}\.(js|css|woff2?|svg|wasm)$/, '$1-*.$2');
}

/**
 * Read and parse perf/history.json. Throws if the file is missing or invalid JSON.
 */
export function readHistory() {
  return JSON.parse(readFileSync(HISTORY_PATH, 'utf8'));
}

/**
 * Overwrite perf/history.json with the given array, pretty-printed (2-space indent)
 * with a trailing newline for clean git diffs.
 */
export function writeHistory(history) {
  writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2) + '\n');
}

/**
 * Compute gzip (level 9) and brotli (quality 11) compressed sizes of a Buffer.
 * These mirror the compression a production Nginx/brotli layer would apply,
 * giving a more realistic "over-the-wire" size than the raw byte length.
 *
 * @param {Buffer} buf - raw file content
 * @returns {{ gzip: number, brotli: number }} compressed byte lengths
 */
export function compressedSizes(buf) {
  const gzip = gzipSync(buf, { level: 9 }).length;
  const brotli = brotliCompressSync(buf, { quality: 11 }).length;
  return { gzip, brotli };
}
