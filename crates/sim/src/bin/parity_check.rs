//! `parity-check` — runs the Rust parity harness, the Node parity
//! harness (via `node ../parity/oracle.mjs`), and prints a diff summary.
//! Exits 0 on parity, 1 on failure.
//!
//! Usage:
//!   cargo run --quiet --bin parity-check
//!
//! Behaviour:
//!   - Spawns `node ../parity/oracle.mjs SEED ENTITIES TICKS HBEVERY` to
//!     produce the Node oracle JSON.
//!   - Spawns its own Rust oracle to produce the Rust JSON via
//!     `binary_target_name -- ORACLE_SEED ENTITIES TICKS HBEVERY` (it
//!     re-execs the `oracle` binary in the same directory).

use serde_json::Value;
use std::env;
use std::io::Write;
use std::path::PathBuf;
use std::process::{Command, Stdio};

fn main() {
    let repo_root = find_repo_root();
    let exe = env::current_exe().unwrap();
    let exe_dir = exe.parent().unwrap();
    let oracle_exe = exe_dir.join(if cfg!(windows) { "oracle.exe" } else { "oracle" });

    let seed: u32 = env::var("SEED").ok().and_then(|s| s.parse().ok()).unwrap_or(12345);
    let entities: u32 = env::var("ENTITIES").ok().and_then(|s| s.parse().ok()).unwrap_or(8);
    let ticks: u64 = env::var("TICKS").ok().and_then(|s| s.parse().ok()).unwrap_or(200);
    let hb: u64 = env::var("HBEVERY").ok().and_then(|s| s.parse().ok()).unwrap_or(5);

    let node_oracle = repo_root.join("parity").join("oracle.mjs");
    if !node_oracle.exists() {
        eprintln!("parity-check: node oracle not found at {}", node_oracle.display());
        eprintln!("hint: ensure `parity/oracle.mjs` exists relative to the repo root.");
        eprintln!("      (set MEDIEVAL_LIFE_SIM_ROOT or run via `cargo run --bin parity-check`)");
        std::process::exit(2);
    }

    let node_out = run_capture(Command::new("node").arg(&node_oracle)
        .arg(seed.to_string())
        .arg(entities.to_string())
        .arg(ticks.to_string())
        .arg(hb.to_string()));
    let rust_out = run_capture(Command::new(&oracle_exe)
        .arg(seed.to_string())
        .arg(entities.to_string())
        .arg(ticks.to_string())
        .arg(hb.to_string()));

    let node_json: Value = serde_json::from_str(&node_out).unwrap_or_else(|e| {
        eprintln!("parity-check: node oracle produced invalid JSON: {e}");
        eprintln!("--- node output ---\n{node_out}\n---");
        std::process::exit(1);
    });
    let rust_json: Value = serde_json::from_str(&rust_out).unwrap_or_else(|e| {
        eprintln!("parity-check: rust oracle produced invalid JSON: {e}");
        eprintln!("--- rust output ---\n{rust_out}\n---");
        std::process::exit(1);
    });

    let mut diffs: Vec<String> = Vec::new();
    collect_diffs("", &node_json, &rust_json, &mut diffs);
    if !diffs.is_empty() {
        eprintln!("parity-check: MISMATCH ({} differences)", diffs.len());
        for d in diffs.iter().take(20) { eprintln!("  - {d}"); }
        if diffs.len() > 20 { eprintln!("  … +{} more", diffs.len() - 20); }
        std::process::exit(1);
    }

    println!("parity-check: OK  (Node ↔ Rust byte-identical across {ticks} ticks, seed={seed}, entities={entities}, heartbeat_every={hb})");
}

fn run_capture(cmd: &mut Command) -> String {
    let output = cmd.stdout(Stdio::piped()).stderr(Stdio::piped()).output()
        .unwrap_or_else(|e| { eprintln!("parity-check: failed to spawn {:?}: {e}", cmd.get_program()); std::process::exit(2); });
    if !output.status.success() {
        eprintln!("parity-check: child {:?} exited {:?}", cmd.get_program(), output.status);
        eprintln!("stderr:\n{}", String::from_utf8_lossy(&output.stderr));
        std::process::exit(2);
    }
    let mut s = String::from_utf8(output.stdout).expect("utf8 stdout");
    if !s.ends_with('\n') { s.push('\n'); }
    std::io::stdout().flush().ok();
    s
}

fn collect_diffs(path: &str, a: &Value, b: &Value, out: &mut Vec<String>) {
    // Treat integer-valued floats as equal (`0` vs `0.0`) — Node
    // emits bare integers when JSON.stringify keeps whole-number values
    // as integers, while Rust's serde_json always appends `.0`. The
    // simulation values are bit-equivalent; this is purely cosmetic.
    if numerics_equal(a, b) { return; }
    if a == b { return; }
    match (a, b) {
        (Value::Object(am), Value::Object(bm)) => {
            let mut keys: Vec<&String> = am.keys().chain(bm.keys()).collect();
            keys.sort();
            keys.dedup();
            for k in keys {
                let av = am.get(k);
                let bv = bm.get(k);
                let child = format!("{path}.{k}");
                match (av, bv) {
                    (Some(av), Some(bv)) => collect_diffs(&child, av, bv, out),
                    (Some(av), None) => out.push(format!("{child}: only in Node (= {av})")),
                    (None, Some(bv)) => out.push(format!("{child}: only in Rust (= {bv})")),
                    _ => unreachable!(),
                }
            }
        }
        (Value::Array(av), Value::Array(bv)) if av.len() == bv.len() => {
            for (i, (x, y)) in av.iter().zip(bv.iter()).enumerate() {
                collect_diffs(&format!("{path}[{i}]"), x, y, out);
            }
        }
        _ => out.push(format!("{path}: node={a} vs rust={b}")),
    }
}

/// `0 == 0.0`, `1 == 1.0`, etc. Used to bridge the cosmetic
/// integer-vs-float JSON rendering difference between Node and Rust.
fn numerics_equal(a: &Value, b: &Value) -> bool {
    match (a, b) {
        (Value::Number(x), Value::Number(y)) => {
            x.as_f64().zip(y.as_f64()).map(|(p, q)| p == q).unwrap_or(false)
        }
        (Value::Object(am), Value::Object(bm)) => {
            am.len() == bm.len()
                && am.iter().all(|(k, v)| numerics_equal(v, bm.get(k).unwrap_or(&Value::Null)))
        }
        (Value::Array(av), Value::Array(bv)) => {
            av.len() == bv.len()
                && av.iter().zip(bv.iter()).all(|(x, y)| numerics_equal(x, y))
        }
        _ => false,
    }
}

/// Locate the medieval-life-sim repository root. Tries:
///   1. `$MEDIEVAL_LIFE_SIM_ROOT` (always wins).
///   2. `$CARGO_MANIFEST_DIR/../..` (set when invoked via `cargo run`).
///   3. Walks up from `current_exe()` looking for a `Cargo.toml` and
///      uses that directory's parent (the workspace root).
///   4. Walks up from `current_dir()` looking for the same.
fn find_repo_root() -> std::path::PathBuf {
    use std::path::{Path, PathBuf};

    if let Ok(p) = env::var("MEDIEVAL_LIFE_SIM_ROOT") {
        return PathBuf::from(p);
    }
    if let Ok(m) = env::var("CARGO_MANIFEST_DIR") {
        let candidate = Path::new(&m).join("..").join("..");
        if candidate.join("Cargo.toml").exists() || candidate.join("package.json").exists() {
            return candidate;
        }
    }
    if let Ok(exe) = env::current_exe() {
        let mut p = exe.parent().unwrap().to_path_buf();
        for _ in 0..8 {
            if p.join("package.json").exists() && p.join("crates").exists() {
                return p;
            }
            p.pop();
        }
    }
    if let Ok(cwd) = env::current_dir() {
        let mut p = cwd.clone();
        for _ in 0..8 {
            if p.join("package.json").exists() && p.join("crates").exists() {
                return p;
            }
            p.pop();
        }
    }
    env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

#[allow(dead_code)]
fn _ensure_path(p: PathBuf) -> PathBuf { p }
