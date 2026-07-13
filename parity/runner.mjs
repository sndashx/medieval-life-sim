#!/usr/bin/env node
// parity/runner.mjs — Node-side cross-check harness.
//
// Runs both oracles and diffs their JSON output structurally. Used by
// `tests/parity.test.js` (which expects this in PATH-style via `node`).
//
// Exits 0 on byte-identical parity, non-zero on diff.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const oracleMjs = resolve(here, 'oracle.mjs');
const rustManifest = resolve(repoRoot, 'crates/sim/Cargo.toml');

const args = process.argv.slice(2);
if (args.length < 4) {
  console.error('usage: node parity/runner.mjs SEED ENTITIES TICKS HBEVERY');
  process.exit(2);
}
const [seed, entities, ticks, hb] = args;

if (!existsSync(oracleMjs)) {
  console.error(`runner: oracle not found at ${oracleMjs}`);
  process.exit(2);
}
if (!existsSync(rustManifest)) {
  console.error(`runner: rust manifest not found at ${rustManifest}`);
  process.exit(2);
}

const env = { ...process.env };
const cargoArgs = ['run', '--quiet', '--bin', 'parity-check', '--manifest-path', rustManifest];
// We pass parameters via env so cargo passes through; the binary reads
// them itself.
env.SEED = seed;
env.ENTITIES = entities;
env.TICKS = ticks;
env.HBEVERY = hb;

const child = spawn('cargo', cargoArgs, { stdio: 'inherit', env });
child.on('exit', (code) => {
  process.exit(code ?? 1);
});
