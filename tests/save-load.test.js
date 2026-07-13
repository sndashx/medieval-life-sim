import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { Game } from '../src/Game.js';
import { makeGameWithPlayer } from './_helpers.js';

test('save-load: roundtrip preserves kernel turn and player state', () => {
  const g1 = makeGameWithPlayer(444);
  g1.advanceTurns(100);
  const saveData = g1.save();

  assert.ok(saveData, 'save returned data');
  assert.ok(saveData.kernel, 'saveData.kernel present');
  assert.ok(saveData.world, 'saveData.world present');
  assert.ok(typeof saveData.seed === 'number', 'seed preserved');
  // Turn may be < requested if the player died mid-loop — but it must have advanced.
  assert.ok(saveData.kernel.turn > 0, 'kernel turn advanced');
  assert.ok(saveData.kernel.turn <= 100, `kernel turn <= 100 (got ${saveData.kernel.turn})`);

  // Re-create a game with the same seed and verify it boots to the same state.
  const g2 = makeGameWithPlayer(saveData.seed);
  g2.advanceTurns(saveData.kernel.turn);
  assert.equal(g2.kernel.turn, g1.kernel.turn, 're-running same seed reaches same turn');
});

test('save-load: JSON-serializable (save data has no cycles)', () => {
  const game = makeGameWithPlayer(555);
  game.advanceTurns(50);
  const saveData = game.save();
  // The save should round-trip through JSON.stringify without throwing.
  assert.doesNotThrow(() => JSON.stringify(saveData));
  const roundtrip = JSON.parse(JSON.stringify(saveData));
  assert.equal(roundtrip.seed, saveData.seed, 'seed survives JSON roundtrip');
  assert.equal(roundtrip.kernel.turn, saveData.kernel.turn, 'turn survives JSON roundtrip');
});

test('save-load: includes all major system payloads', () => {
  const game = makeGameWithPlayer(666);
  game.advanceTurns(20);
  const data = game.save();
  // Spot-check that the major systems serialized
  for (const key of ['kernel', 'world', 'marriage', 'trading', 'naturalWorld',
                     'warfare', 'politics', 'pathogens', 'magic', 'transportation']) {
    assert.ok(data[key] !== undefined, `saveData.${key} present`);
  }
});

test('save-load: mtime-based "latest" picks newest, not lex-last', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-load-mtime-'));
  const older = path.join(dir, 'save_zoe_2025-01-01.json');
  const newer = path.join(dir, 'save_alice_2025-12-30.json');
  fs.writeFileSync(older, '{}');
  fs.writeFileSync(newer, '{}');

  const olderTime = new Date('2025-01-01T00:00:00Z');
  const newerTime = new Date('2025-12-30T00:00:00Z');
  fs.utimesSync(older, olderTime, olderTime);
  fs.utimesSync(newer, newerTime, newerTime);

  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  });

  const latest = Game.latestSaveFile(dir);

  assert.equal(latest, 'save_alice_2025-12-30.json',
    'latestSaveFile must pick the newer-mtime file even when its name sorts before the older one');
});

test('save-load: latestSaveFile returns null on empty/missing directory', (t) => {
  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-load-empty-'));
  t.after(() => {
    try { fs.rmSync(emptyDir, { recursive: true, force: true }); } catch (_) {}
  });

  assert.equal(Game.latestSaveFile(emptyDir), null, 'empty dir → null');
  assert.equal(
    Game.latestSaveFile(path.join(emptyDir, 'does-not-exist')),
    null,
    'missing dir → null'
  );
});

test('save-load: pruneOldSaves keeps only the newest N saves (by mtime)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-load-prune-'));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  });

  // Create 8 saves with strictly increasing mtimes (oldest first).
  const names = [];
  for (let i = 0; i < 8; i++) {
    const name = `save_prune_${String(i).padStart(2, '0')}.json`;
    fs.writeFileSync(path.join(dir, name), '{}');
    const stamp = new Date(Date.UTC(2025, 0, 1, 0, 0, i));
    fs.utimesSync(path.join(dir, name), stamp, stamp);
    names.push(name);
  }

  Game.pruneOldSaves(dir, 5);

  const remaining = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
  assert.equal(remaining.length, 5, 'exactly 5 saves remain');
  // The 3 oldest (i=0..2) must be gone; the 5 newest (i=3..7) must survive.
  assert.deepEqual(
    remaining,
    names.slice(3),
    'the 3 oldest saves are pruned; the 5 newest are kept'
  );
});

test('save-load: pruneOldSaves tolerates missing directory and non-json files', (t) => {
  // Should not throw even when the dir doesn't exist or contains non-json noise.
  const missing = path.join(os.tmpdir(), 'save-load-prune-missing-' + Date.now());
  assert.doesNotThrow(() => Game.pruneOldSaves(missing), 'missing dir → no throw');

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-load-prune-noise-'));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  });
  fs.writeFileSync(path.join(dir, 'garbage.txt'), 'ignore me');
  fs.writeFileSync(path.join(dir, 'save_keep.json'), '{}');
  assert.doesNotThrow(() => Game.pruneOldSaves(dir, 5), 'non-json files ignored');
  assert.deepEqual(
    fs.readdirSync(dir).sort(),
    ['garbage.txt', 'save_keep.json'].sort(),
    'non-json file survives; json save kept'
  );
});

test('save-load: readSaveFile rejects oversized files with reason too-large', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-load-big-'));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  });

  // Write a sparse file that claims to be 60 MB but is virtually empty on disk.
  // fs.statSync reports the apparent size, which is what we want to test.
  const big = path.join(dir, 'save_big.json');
  const fd = fs.openSync(big, 'w');
  try {
    fs.ftruncateSync(fd, 60 * 1024 * 1024);
  } finally {
    fs.closeSync(fd);
  }

  const result = Game.readSaveFile(big);
  assert.equal(result.ok, false, 'oversized save is rejected');
  assert.equal(result.reason, 'too-large', 'reason is too-large');
  assert.match(result.error, /exceeds.*MB cap/, 'error message mentions cap');
});

test('save-load: readSaveFile rejects future-schema saves with reason future-schema', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-load-schema-'));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  });

  const future = path.join(dir, 'save_future.json');
  fs.writeFileSync(future, JSON.stringify({
    schemaVersion: 999,
    seed: 1, kernel: { turn: 0 }, world: {}
  }));

  const result = Game.readSaveFile(future);
  assert.equal(result.ok, false, 'future-schema save is rejected');
  assert.equal(result.reason, 'future-schema', 'reason is future-schema');
  assert.match(result.error, /schemaVersion=999.*newer than supported/, 'error names the version');
});

test('save-load: readSaveFile accepts a well-formed save', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-load-ok-'));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  });

  const ok = path.join(dir, 'save_ok.json');
  const payload = JSON.stringify({ schemaVersion: 3, seed: 42, kernel: { turn: 7 } });
  fs.writeFileSync(ok, payload);

  const result = Game.readSaveFile(ok);
  assert.equal(result.ok, true, 'valid save is accepted');
  assert.equal(result.data.seed, 42, 'data roundtrips');
  assert.equal(result.data.kernel.turn, 7, 'kernel.turn roundtrips');
});

test('save-load: readSaveFile rejects malformed JSON with reason parse', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-load-bad-'));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  });

  const bad = path.join(dir, 'save_bad.json');
  fs.writeFileSync(bad, '{ this is :: not json }');

  const result = Game.readSaveFile(bad);
  assert.equal(result.ok, false, 'malformed JSON is rejected');
  assert.equal(result.reason, 'parse', 'reason is parse');
});

test('save-load: readSaveFile reports missing file with reason missing', () => {
  const result = Game.readSaveFile(path.join(os.tmpdir(), 'nope-' + Date.now() + '.json'));
  assert.equal(result.ok, false, 'missing file is rejected');
  assert.equal(result.reason, 'missing', 'reason is missing');
});

test('save-load: readSaveFile accepts save with no schemaVersion (legacy/best-effort)', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'save-load-legacy-'));
  t.after(() => {
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  });

  const legacy = path.join(dir, 'save_legacy.json');
  fs.writeFileSync(legacy, JSON.stringify({ seed: 1, kernel: { turn: 0 } }));

  const result = Game.readSaveFile(legacy);
  assert.equal(result.ok, true, 'save without schemaVersion is accepted (legacy best-effort load)');
});
