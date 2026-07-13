#!/usr/bin/env node
// parity/oracle.mjs — Node-side parity harness.
//
// Runs the same deterministic scenario as `crates/sim/src/parity.rs` and
// emits a JSON snapshot for `cargo run --bin parity-check` to compare.
//
// Usage:
//   node parity/oracle.mjs SEED ENTITIES TICKS HBEVERY > oracle.json

import { SimulationKernel } from '../src/core/SimulationKernel.js';

const [, , seedStr = '12345', entitiesStr = '8', ticksStr = '200', hbStr = '5'] = process.argv;
const seed = Number(seedStr);
const entities = Number(entitiesStr);
const ticks = Number(ticksStr);
const heartbeatEvery = Number(hbStr);

const k = new SimulationKernel(seed);

// Spawn entities at deterministic positions (matches parity.rs exactly).
for (let i = 0; i < entities; i++) {
  const template = {
    type: i % 2 === 0 ? 'marker' : 'person',
    position: { x: i * 1.5, y: i % 7, z: 0 },
    mass: i % 3 === 0 ? 1.0 : 0.0,
    isPerson: i % 2 === 1,
  };
  k.createEntity(template);
}

const rngFirst5 = [];
const rngLast5 = [];
const eventLogSample = [];
let rngCount = 0;

for (let i = 0; i < ticks; i++) {
  const r = k.random();
  rngCount++;
  if (rngFirst5.length < 5) rngFirst5.push(r);

  k.scheduleEvent({ type: 'parity_heartbeat', rng: r }, heartbeatEvery);
  k.tick();

  if (rngLast5.length === 5) rngLast5.shift();
  rngLast5.push(r);
}

const snapshot = {
  kind: 'parity',
  version: 1,
  seed,
  entities,
  ticks,
  heartbeatEvery,
  rngFirst5,
  rngLast5,
  rngCount,
  worldTime: {
    year: k.worldTime.year,
    day: k.worldTime.day,
    hour: k.worldTime.hour,
    minute: k.worldTime.minute,
  },
  turn: k.turn,
  alivePeople: k.alivePeople.size,
  conservation: k.conservationLedger,
  firstEntityIds: Array.from(k.entities.keys()).slice(0, 8),
  firstEntityPositions: Array.from(k.entities.values()).slice(0, 8).map(
    (e) => e.position ? { x: e.position.x, y: e.position.y, z: e.position.z ?? 0 } : null
  ),
  eventLogSample: k.eventLog.slice(0, 16).map((e) => ({
    id: e.id, turn: e.processedAt ?? e.turn ?? 0, type: e.type,
  })),
};

process.stdout.write(JSON.stringify(snapshot, null, 2) + '\n');
