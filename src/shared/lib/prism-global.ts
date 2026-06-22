/**
 * prism-global.ts — Import prismjs core and expose it on the global scope.
 *
 * prismjs language component files (prismjs/components/prism-*.js) are IIFE /
 * plain scripts that reference a global `Prism` variable. In ESM + Vite the
 * import of prismjs core does NOT create a global, so those component files
 * would fail with a ReferenceError.
 *
 * This module is split into its own file so that, when prism.ts imports it
 * first, ESM's source-text-order execution guarantees this module's top-level
 * code (which sets globalThis.Prism) runs BEFORE any language component files.
 *
 * Execution order:
 *   1. prismjs core module executes → creates Prism object
 *   2. THIS module's top-level code → globalThis.Prism = Prism
 *   3. (back in prism.ts) language component files execute → use globalThis.Prism
 */

import * as Prism from 'prismjs';

// Expose Prism on the global scope so that prismjs component side-effect imports
// (which reference a bare `Prism` identifier) can find it at runtime.
(globalThis as unknown as { Prism: typeof Prism }).Prism = Prism;

export { Prism };
