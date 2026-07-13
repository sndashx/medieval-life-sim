// Integration: determinism across 1,000 turns.
// Two games with seed=42 must produce identical entity IDs, needs, positions,
// and conservation totals at every checkpoint. Build on _helpers patterns.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeGameWithPlayer } from './_helpers.js';

function snapshot(game) {
  const player = game.getPlayer ? game.getPlayer() : null;
  const positions = [];
  for (const ent of game.kernel.entities.values()) {
    if (ent.tombstone) continue;
    if (ent.position) positions.push([ent.id, ent.position.x | 0, ent.position.y | 0]);
  }
  positions.sort((a, b) => a[0] - b[0]);
  return {
    turn: game.kernel.turn,
    conservation: { ...game.kernel.conservationLedger },
    worldTimeTotal: game.kernel.worldTime.totalMinutes,
    population: game.kernel.alivePeople.size,
    player: player ? {
      id: player.id,
      hunger: player.needs?.hunger ?? null,
      thirst: player.needs?.thirst ?? null,
      sleep: player.needs?.sleep ?? null,
      alive: player.alive,
      pos: player.position ? { x: player.position.x | 0, y: player.position.y | 0 } : null
    } : null,
    positionsHash: positions.length + ':' + positions.slice(0, 20).map(p => p.join(',')).join('|')
  };
}

test('integration: two seed=42 games identical at turn 1000', () => {
  const a = makeGameWithPlayer(42);
  const b = makeGameWithPlayer(42);
  a.advanceTurns(1000);
  b.advanceTurns(1000);
  const sa = snapshot(a);
  const sb = snapshot(b);
  assert.deepEqual(sa, sb,
    `Determinism violated at turn 1000.\nA=${JSON.stringify(sa)}\nB=${JSON.stringify(sb)}`);
});

test('integration: determinism holds at intermediate checkpoints', () => {
  const a = makeGameWithPlayer(42);
  const b = makeGameWithPlayer(42);
  const checkpoints = [100, 250, 500, 750, 1000];
  for (const c of checkpoints) {
    a.advanceTurns(c - a.kernel.turn);
    b.advanceTurns(c - b.kernel.turn);
    assert.deepEqual(snapshot(a), snapshot(b), `Mismatch at turn ${c}`);
  }
});