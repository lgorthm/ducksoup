/**
 * prism.ts — Register only the languages we need and re-export Prism.
 *
 * MUST be imported via `import { ... } from '@/shared/lib/prism'` so that
 * prism-global.ts (the first import below) executes before any component file.
 *
 * Languages are ordered by dependency:
 *   - prismjs core bundles: markup, css, clike, javascript
 *   - Level 1: depend only on core languages
 *   - Level 2: depend on Level 1 languages
 *   - Level 3: standalone (no dependencies)
 */

// Step 1: set globalThis.Prism (runs before any component import below).
import { Prism } from './prism-global';

// Step 2: Level 1 — depend on core (javascript / clike / css / markup)
import 'prismjs/components/prism-jsx'; // ← javascript
import 'prismjs/components/prism-typescript'; // ← javascript
import 'prismjs/components/prism-c'; // ← clike

// Step 3: Level 2 — depend on Level 1
import 'prismjs/components/prism-tsx'; // ← typescript + jsx
import 'prismjs/components/prism-cpp'; // ← c

// Step 4: depend on core css
import 'prismjs/components/prism-scss'; // ← css
import 'prismjs/components/prism-sass'; // ← css
import 'prismjs/components/prism-less'; // ← css

// Step 5: standalone languages (no inter-language dependencies)
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-go';
import 'prismjs/components/prism-rust';
import 'prismjs/components/prism-csharp';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-toml';
import 'prismjs/components/prism-markdown';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-powershell';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-graphql';
import 'prismjs/components/prism-kotlin';
import 'prismjs/components/prism-swift';
import 'prismjs/components/prism-ruby';
// markup-templating is a prerequisite for php (provides tokenizePlaceholders)
import 'prismjs/components/prism-markup-templating';
import 'prismjs/components/prism-php';
import 'prismjs/components/prism-lua';
import 'prismjs/components/prism-r';
import 'prismjs/components/prism-dart';
import 'prismjs/components/prism-scala';
import 'prismjs/components/prism-perl';
import 'prismjs/components/prism-haskell';
import 'prismjs/components/prism-elixir';
import 'prismjs/components/prism-clojure';
import 'prismjs/components/prism-erlang';
import 'prismjs/components/prism-diff';
import 'prismjs/components/prism-makefile';
import 'prismjs/components/prism-nginx';
import 'prismjs/components/prism-properties';
import 'prismjs/components/prism-ini';

import type { Grammar } from 'prismjs';

/**
 * Map of markdown fence labels → prismjs language identifiers.
 * Used to look up the correct grammar in Prism.languages.
 */
const PRISM_LANG_MAP: Record<string, string> = {
  javascript: 'javascript',
  js: 'javascript',
  typescript: 'typescript',
  ts: 'typescript',
  tsx: 'tsx',
  jsx: 'jsx',
  python: 'python',
  py: 'python',
  java: 'java',
  go: 'go',
  rust: 'rust',
  c: 'c',
  cpp: 'cpp',
  'c++': 'cpp',
  csharp: 'csharp',
  cs: 'csharp',
  'c#': 'csharp',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  css: 'css',
  scss: 'scss',
  sass: 'sass',
  less: 'less',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  toml: 'toml',
  markdown: 'markdown',
  md: 'markdown',
  sql: 'sql',
  shell: 'bash',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  powershell: 'powershell',
  ps1: 'powershell',
  dockerfile: 'docker',
  docker: 'docker',
  graphql: 'graphql',
  gql: 'graphql',
  kotlin: 'kotlin',
  swift: 'swift',
  ruby: 'ruby',
  rb: 'ruby',
  php: 'php',
  lua: 'lua',
  r: 'r',
  dart: 'dart',
  scala: 'scala',
  perl: 'perl',
  haskell: 'haskell',
  elixir: 'elixir',
  clojure: 'clojure',
  erlang: 'erlang',
  diff: 'diff',
  makefile: 'makefile',
  nginx: 'nginx',
  properties: 'properties',
  ini: 'ini',
  env: 'properties',
  vue: 'markup',
  svelte: 'markup',
};

/**
 * Resolve a markdown fence language label to the prismjs grammar.
 * Returns null when the language is not registered (falls back to plaintext).
 */
export function getGrammar(
  lang: string,
): { grammar: Grammar; id: string } | null {
  const id = PRISM_LANG_MAP[lang.toLowerCase()];
  if (!id) return null;
  const grammar = Prism.languages[id];
  if (!grammar) return null;
  return { grammar, id };
}

export { Prism };
