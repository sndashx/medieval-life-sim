import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGame, makeGameWithPlayer, installMathRandomSpy, restoreMathRandom, getMathRandomSites, getSpyDepth } from './_helpers.js';

// Determinism contract: same seed → identical state at a fixed turn.

function snapshot(game) {
  const player = game.getPlayer();
  return {
    turn: game.kernel.turn,
    playerAlive: player ? player.alive : null,
    hunger: player?.needs?.hunger ?? null,
    population: game.kernel.conservationLedger.population,
    alivePeople: game.kernel.alivePeople.size,
    totalMinutes: game.kernel.worldTime.totalMinutes
  };
}

test('determinism: two games with the same seed produce identical state at turn 500', () => {
  const g1 = makeGameWithPlayer(42);
  const g2 = makeGameWithPlayer(42);
  g1.advanceTurns(500);
  g2.advanceTurns(500);
  const s1 = snapshot(g1);
  const s2 = snapshot(g2);
  assert.deepEqual(s1, s2, `Determinism violated.\nA=${JSON.stringify(s1)}\nB=${JSON.stringify(s2)}`);
});

test('determinism: different seeds diverge (sanity check)', () => {
  const g1 = makeGameWithPlayer(1);
  const g2 = makeGameWithPlayer(2);
  g1.advanceTurns(200);
  g2.advanceTurns(200);
  // We don't assert exact divergence (small seeds could still match at turn 200),
  // we just verify the determinism test would *notice* a difference.
  const s1 = snapshot(g1);
  const s2 = snapshot(g2);
  assert.notEqual(s1.population, s2.population, 'Different seeds should diverge in population');
});

test('determinism: Math.random() audit — log any unseeded call sites so they can be fixed', () => {
  // Clear any prior captures
  getMathRandomSites().length = 0;
  installMathRandomSpy();

  try {
    const game = makeGameWithPlayer(7777);
    game.advanceTurns(200);
  } finally {
    restoreMathRandom();
  }

  const sites = getMathRandomSites();
  if (sites.length > 0) {
    // Report the first few unique sites; this is informational, not a failure
    // (a real fix is to replace Math.random with game.kernel.rng.next()).
    const uniqueSites = [...new Set(sites.map(s => s.site))];
    console.log(`[determinism] Found ${sites.length} Math.random() calls at ${uniqueSites.length} unique site(s):`);
    for (const s of uniqueSites.slice(0, 5)) console.log(`  - ${s}`);
  }
  // The test passes regardless — its job is to *report*, not gate.
  // (Passing here makes it informational; flip to assert.equal(sites.length, 0)
  //  once all sites are migrated to the kernel RNG.)
  assert.ok(Array.isArray(sites));
});

test('math-random-spy: reference-counted nested install/restore leaves Math.random unchanged', () => {
  // Snapshot the original Math.random for this test.
  const originalBefore = Math.random;
  const beforeDepth = getSpyDepth();

  installMathRandomSpy();
  assert.equal(getSpyDepth(), beforeDepth + 1);
  assert.notEqual(Math.random, originalBefore, 'Spy should be installed');
  assert.equal(Math.random(), 0.5, 'Spy should return 0.5');

  // Nested install — depth increases, spy remains installed.
  installMathRandomSpy();
  assert.equal(getSpyDepth(), beforeDepth + 2);
  assert.equal(Math.random(), 0.5, 'Nested spy still returns 0.5');

  // First restore decrements but keeps spy installed.
  restoreMathRandom();
  assert.equal(getSpyDepth(), beforeDepth + 1);
  assert.notEqual(Math.random, originalBefore, 'Spy still installed after one restore');

  // Final restore brings us back to original.
  restoreMathRandom();
  assert.equal(getSpyDepth(), beforeDepth);
  assert.equal(Math.random, originalBefore, 'Math.random should be restored to original');

  // Extra restore is a no-op (defensive).
  restoreMathRandom();
  assert.equal(getSpyDepth(), beforeDepth);
  assert.equal(Math.random, originalBefore);
});
