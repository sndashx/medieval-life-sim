//! sim — Rust port of medieval-life-sim's Node simulation kernel.
//!
//! Port-faithful implementation of the core simulation primitives from
//! `src/core/SimulationKernel.js`. Designed so that, given the same seed,
//! the same scripted sequence of kernel operations produces a byte-identical
//! event log and RNG sequence to the Node implementation (validated by
//! `parity/oracle.mjs` + `crates/sim/src/bin/parity_check.rs`).
//!
//! Determinism invariants (must match Node bit-for-bit):
//! - Mulberry32 RNG with `Math.imul`-equivalent 32-bit wrap-add mul
//! - Event log FIFO capped at 4096 entries
//! - PriorityQueue min-heap on `turn`, stable for ties (insertion order)
//! - Event id formula: `turn * 100_000 + (counter & 0xFFFF)`
//! - WorldTime: 1 in-game hour = 60 minutes per tick
//! - Spatial index 21-bit cell key: (cx+2^20) | ((cy+2^20) << 21) | ((cz&0x1FF) << 42)

pub mod rng;
pub mod worldtime;
pub mod event_queue;
pub mod spatial;
pub mod kernel;
pub mod parity;

pub use kernel::{SimulationKernel, KernelConfig, EntityTemplate, EntitySnapshot};
pub use rng::SeededRng;
pub use worldtime::WorldTime;
pub use event_queue::{PriorityQueue, ScheduledEvent};
pub use spatial::{SpatialIndex, Position};
