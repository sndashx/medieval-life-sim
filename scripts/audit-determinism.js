#!/usr/bin/env node
/**
 * Determinism audit script.
 *
 * Scans src/ for `Math.random()` and `Date.now()` call sites that are not
 * protected by either:
 *   - a `// AUDIT-WHITELIST: <reason>` directive on the same line, OR
 *   - membership in a per-line whitelist at the bottom of this file.
 *
 * Exit code:
 *   0 = all call sites are whitelisted (determinism-clean)
 *   1 = one or more unwhitelisted sites (or parse error)
 *
 * Usage:
 *   node scripts/audit-determinism.js
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(new URL('..', import.meta.url).pathname);
const SRC = join(ROOT, 'src');

/** Lines explicitly allowed (file:line, reason). Use sparingly. */
const MANUAL_WHITELIST = new Map([
  // Date.now() in save/load filename metadata — not part of simulation state.
  // ['src/main.js:12', 'save-filename timestamp'],
]);

const PATTERNS = [
  { name: 'Math.random', regex: /\bMath\.random\s*\(\s*\)/g },
  { name: 'Date.now',    regex: /\bDate\.now\s*\(\s*\)/g }
];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      yield* walk(full);
    } else if (entry.endsWith('.js')) {
      yield full;
    }
  }
}

function isWhitelistedLine(file, lineNo, lineText) {
  if (/\/\/\s*AUDIT-WHITELIST\b/.test(lineText)) return true;
  const key = `${relative(ROOT, file)}:${lineNo}`;
  return MANUAL_WHITELIST.has(key);
}

function auditFile(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const findings = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // Skip pure comment lines and JSDoc block lines so error-message text
    // mentioning Date.now() / Math.random() doesn't trigger.
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    for (const { name, regex } of PATTERNS) {
      regex.lastIndex = 0;
      if (regex.test(line) && !isWhitelistedLine(file, i + 1, line)) {
        findings.push({ line: i + 1, kind: name, text: line.trim() });
      }
    }
  }
  return findings;
}

const allFindings = [];
for (const file of walk(SRC)) {
  const found = auditFile(file);
  for (const f of found) {
    allFindings.push({ file: relative(ROOT, file), ...f });
  }
}

const summary = { Math_random: 0, Date_now: 0 };
for (const f of allFindings) {
  if (f.kind === 'Math.random') summary.Math_random++;
  if (f.kind === 'Date.now')    summary.Date_now++;
}

console.log('Determinism audit');
console.log('=================');
console.log(`Scanned:    ${SRC}`);
console.log(`Math.random: ${summary.Math_random} unwhitelisted`);
console.log(`Date.now:    ${summary.Date_now} unwhitelisted`);
console.log(`Total:       ${allFindings.length}`);

if (allFindings.length === 0) {
  console.log('\nOK — all call sites are whitelisted.');
  process.exit(0);
}

console.log('\nFindings:');
for (const f of allFindings) {
  console.log(`  ${f.file}:${f.line}  [${f.kind}]  ${f.text}`);
}
console.log('\nFAIL — fix or whitelist these sites.');
process.exit(1);
