//! The parity harness. Runs a minimal deterministic scenario and emits a
//! JSON snapshot that the Node oracle should produce the same shape of.
//! See `parity/oracle.mjs` for the Node counterpart.
//!
//! Scenario:
//!   1. Create N entities at deterministic positions.
//!   2. For each tick:
//!        a. Draw one RNG float.
//!        b. Schedule a `parity_heartbeat` event `H` turns in the future.
//!        c. Tick the kernel by 1 in-game hour.
//!   3. Emit a compact JSON summary capturing RNG, world time, events,
//!      and conservation state.
//!
//! The Node oracle runs the same scenario in `parity/oracle.mjs`. The
//! cross-checker script `parity/runner.mjs` diffs the two outputs.

use serde_json::json;

use crate::event_queue::ScheduledEvent;
use crate::kernel::{EntityTemplate, KernelConfig, SimulationKernel};
use crate::spatial::Position;

pub struct ParityInput {
    pub seed: u32,
    pub entities: u32,
    pub ticks: u64,
    pub heartbeat_every: u64,
}

pub fn run(input: ParityInput) -> serde_json::Value {
    let mut k = SimulationKernel::new(input.seed, KernelConfig::default());

    let mut rng_seq: Vec<f64> = Vec::with_capacity(input.ticks as usize);

    // Spawn entities at deterministic positions.
    for i in 0..input.entities {
        let pos = Position {
            x: (i as f64) * 1.5,
            y: ((i as i32) % 7) as f64,
            z: 0.0,
        };
        k.create_entity(EntityTemplate {
            kind: if i % 2 == 0 { "marker".to_string() } else { "person".to_string() },
            position: Some(pos),
            mass: if i % 3 == 0 { 1.0 } else { 0.0 },
            is_person: i % 2 == 1,
            is_player: false,
            sex: None,
            extra: Default::default(),
        });
    }

    for _ in 0..input.ticks {
        // Draw RNG BEFORE the tick so the order matches the Node loop.
        let r = k.rng.next();
        rng_seq.push(r);

        let mut payload = serde_json::Map::new();
        payload.insert("type".to_string(), json!("parity_heartbeat"));
        payload.insert("rng".to_string(), json!(r));
        k.schedule_in(
            ScheduledEvent { id: 0, turn: 0, payload },
            input.heartbeat_every,
        );

        k.tick();
    }

    json!({
        "kind": "parity",
        "version": 1,
        "seed": input.seed,
        "entities": input.entities,
        "ticks": input.ticks,
        "heartbeatEvery": input.heartbeat_every,
        "rngFirst5": rng_seq.iter().take(5).copied().collect::<Vec<_>>(),
        "rngLast5": rng_seq.iter().rev().take(5).copied().collect::<Vec<_>>().into_iter().rev().collect::<Vec<_>>(),
        "rngCount": rng_seq.len(),
        "worldTime": {
            "year": k.world_time.year,
            "day": k.world_time.day,
            "hour": k.world_time.hour,
            "minute": k.world_time.minute,
        },
        "turn": k.turn,
        "alivePeople": k.alive_people.len(),
        "conservation": k.conservation,
        "firstEntityIds": k.entities.iter().take(8).map(|e| e.id).collect::<Vec<_>>(),
        "firstEntityPositions": k.entities.iter().take(8).map(|e| e.position).collect::<Vec<_>>(),
        "eventLogSample": k.event_log.iter().take(16).map(|e| json!({
            "id": e.id, "turn": e.turn, "type": e.payload["type"]
        })).collect::<Vec<_>>(),
    })
}
