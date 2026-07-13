// tests/parity.test.js — npm-level integration of the Node ↔ Rust
// determinism oracle. Skipped if `cargo` is not on PATH.
//
// Uses the parity harness under `parity/` to verify the Rust `sim`
// crate (under `crates/sim/`) produces byte-identical events to the
// Node kernel for a small scripted scenario.
import { spawnSync } from 'node:child_process';
import { test, skip } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const HERE = new URL('.', import.meta.url).pathname;
const REPO = resolve(HERE, '..');
const RUST_MANIFEST = resolve(REPO, 'crates/sim/Cargo.toml');

function cargoAvailable() {
  try {
    const r = spawnSync('cargo', ['--version'], { stdio: 'pipe' });
    return r.status === 0;
  } catch { return false; }
}

function parityCheck(seed, entities, ticks, hb) {
  const r = spawnSync('cargo', [
    'run', '--quiet', '--bin', 'parity-check',
    '--manifest-path', RUST_MANIFEST,
  ], {
    cwd: REPO,
    env: { ...process.env, SEED: String(seed), ENTITIES: String(entities), TICKS: String(ticks), HBEVERY: String(hb) },
    stdio: 'pipe',
  });
  return { status: r.status, stdout: r.stdout?.toString() || '', stderr: r.stderr?.toString() || '' };
}

test('cargo is available and rust workspace is in place', () => {
  if (!cargoAvailable()) {
    return skip('cargo not on PATH; skipping parity test', { skip: true });
  }
  assert.ok(existsSync(RUST_MANIFEST), `expected rust manifest at ${RUST_MANIFEST}`);
});

test('node ↔ rust determinism oracle: 200 ticks, 16 entities, heartbeat_every=5', { skip: !cargoAvailable() }, () => {
  const { status, stdout, stderr } = parityCheck(/*seed*/ 12345, /*entities*/ 16, /*ticks*/ 200, /*hb*/ 5);
  if (status !== 0) {
    console.error(`--- stderr ---\n${stderr}\n--- stdout ---\n${stdout}`);
  }
  assert.ok(stdout.includes('parity-check: OK'), 'expected parity-check to report OK');
  assert.strictEqual(status, 0);
});

test('node ↔ rust determinism oracle: 1000-tick stress, 64 entities, heartbeat_every=7', { skip: !cargoAvailable() }, () => {
  const { status, stdout, stderr } = parityCheck(/*seed*/ 99999, /*entities*/ 64, /*ticks*/ 1000, /*hb*/ 7);
  if (status !== 0) {
    console.error(`--- stderr ---\n${stderr}\n--- stdout ---\n${stdout}`);
  }
  assert.ok(stdout.includes('parity-check: OK'), 'expected parity-check to report OK under stress');
  assert.strictEqual(status, 0);
});
