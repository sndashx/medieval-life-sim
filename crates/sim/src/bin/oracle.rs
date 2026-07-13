//! `oracle` — runs the parity scenario and emits JSON on stdout.
//! Used by the Node-side cross-check to compare against the Node oracle.
//!
//! Usage:
//!   cargo run --quiet --bin oracle -- [seed=12345] [entities=8] [ticks=200] [heartbeat_every=5] > out.json

use sim::parity::{run, ParityInput};
use std::env;
use std::process;

fn main() {
    let seed: u32 = env::args().nth(1).and_then(|s| s.parse().ok()).unwrap_or(12345);
    let entities: u32 = env::args().nth(2).and_then(|s| s.parse().ok()).unwrap_or(8);
    let ticks: u64 = env::args().nth(3).and_then(|s| s.parse().ok()).unwrap_or(200);
    let hb: u64 = env::args().nth(4).and_then(|s| s.parse().ok()).unwrap_or(5);

    let snap = run(ParityInput { seed, entities, ticks, heartbeat_every: hb });
    match serde_json::to_string_pretty(&snap) {
        Ok(s) => {
            println!("{s}");
            process::exit(0);
        }
        Err(e) => {
            eprintln!("oracle: failed to serialize: {e}");
            process::exit(1);
        }
    }
}
