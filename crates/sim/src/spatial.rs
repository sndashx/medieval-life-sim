//! Spatial index with 21-bit numeric cell keys and squared-distance
//! radius queries. Port of `class SpatialIndex` from
//! `src/core/SimulationKernel.js`.
//!
//! Cell key packing (matches Node `SpatialIndex._rawKey(cx, cy, cz)`):
//!   bits 0..20  : (cx + 1_048_576)
//!   bits 21..41 : (cy + 1_048_576) << 21
//!   bits 42..50 : (cz & 0x1FF) << 42
//!
//! Cell size defaults to 16 world units, tuned for radius-10 nearby queries.

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize)]
pub struct Position { pub x: f64, pub y: f64, pub z: f64 }

#[derive(Default)]
pub struct SpatialIndex {
    pub cell_size: f64,
    inv_cell_size: f64,
    cells: HashMap<u64, Vec<u32>>,
    locations: HashMap<u32, Position>,
}

impl SpatialIndex {
    pub fn new(cell_size: f64) -> Self {
        Self {
            cell_size,
            inv_cell_size: 1.0 / cell_size,
            cells: HashMap::new(),
            locations: HashMap::new(),
        }
    }

    pub fn add(&mut self, id: u32, pos: Position) {
        let key = self.key(pos.x, pos.y, pos.z);
        self.cells.entry(key).or_insert_with(Vec::new).push(id);
        self.locations.insert(id, pos);
    }

    pub fn remove(&mut self, id: u32) {
        let Some(loc) = self.locations.remove(&id) else { return; };
        let key = self.key(loc.x, loc.y, loc.z);
        if let Some(cell) = self.cells.get_mut(&key) {
            if let Some(idx) = cell.iter().position(|x| *x == id) {
                let last = cell.pop().unwrap();
                if idx < cell.len() { cell[idx] = last; }
                if cell.is_empty() { self.cells.remove(&key); }
            }
        }
    }

    pub fn move_to(&mut self, id: u32, new_pos: Position) {
        self.remove(id);
        self.add(id, new_pos);
    }

    pub fn location(&self, id: u32) -> Option<Position> {
        self.locations.get(&id).copied()
    }

    pub fn query_radius(&self, x: f64, y: f64, _z: f64, radius: f64) -> Vec<u32> {
        let r2 = radius * radius;
        let min_x = ((x - radius) * self.inv_cell_size).floor() as i64;
        let max_x = ((x + radius) * self.inv_cell_size).floor() as i64;
        let min_y = ((y - radius) * self.inv_cell_size).floor() as i64;
        let max_y = ((y + radius) * self.inv_cell_size).floor() as i64;
        let mut out = Vec::new();
        for cx in min_x..=max_x {
            for cy in min_y..=max_y {
                let cell_key = self.raw_key(cx, cy, 0);
                let Some(cell) = self.cells.get(&cell_key) else { continue; };
                for &id in cell {
                    let Some(loc) = self.locations.get(&id) else { continue; };
                    let dx = loc.x - x; let dy = loc.y - y;
                    if dx * dx + dy * dy <= r2 { out.push(id); }
                }
            }
        }
        out
    }

    pub fn distance(&self, a: u32, b: u32) -> f64 {
        let (Some(la), Some(lb)) = (self.locations.get(&a), self.locations.get(&b)) else { return f64::INFINITY; };
        let dx = la.x - lb.x; let dy = la.y - lb.y; let dz = la.z - lb.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }

    fn raw_key(&self, cx: i64, cy: i64, cz: i64) -> u64 {
        // Faithfully port the Node implementation, which uses JS's `<<`
        // (32-bit signed-int truncation) and `|` (ToInt32) operators.
        // This means the high bits of `cy` (>2^11) get truncated; the
        // key in practice is only `(cx_low|cy_low_shifted|cz) & u32`.
        //
        // We reproduce the exact result by computing the i32 value of
        // each component in JS-style, then `wrapping_shl`-equivalent OR.
        //
        // JS computes:
        //   cx' = ToInt32(cx + 1_048_576)        (the + happens first,
        //                                         then ToInt32 on the
        //                                         result of the shift on
        //                                         bits >21: cy loses them)
        //   cy' = ToInt32((cy + 1_048_576) << 21)
        //   cz' = ToInt32((cz & 0x1FF) << 42)
        //   result = Number(cx' | cy' | cz')
        //
        // The `cz` part uses `<< 42`, which on a 32-bit signed int
        // gives `(cz & 0x1FF) * 2^42 mod 2^32` interpreted as signed.
        // Effectively the cz contribution goes through ToInt32 the same
        // way as cx/cy.
        //
        // Implemented by wrapping the shift explicitly.
        let cx_i32 = ((cx + 1_048_576) as i64 & 0xFFFF_FFFF) as i32;
        // `<< 21` on 32-bit signed truncates the top bits.
        let cy_raw = ((cy + 1_048_576) as u32).wrapping_shl(21);
        let cy_i32 = cy_raw as i32;
        let cz_raw = ((cz as u64) & 0x1FF) << 42;
        let cz_i32 = cz_raw as i32;
        let result = (cx_i32 as i32 | cy_i32 | cz_i32) as i64;
        result as u64
    }

    fn key(&self, x: f64, y: f64, z: f64) -> u64 {
        let cx = (x * self.inv_cell_size).floor() as i64;
        let cy = (y * self.inv_cell_size).floor() as i64;
        let cz = z as i64;
        self.raw_key(cx, cy, cz)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn approx_eq(a: f64, b: f64) -> bool { (a - b).abs() < 1e-9 }

    #[test]
    fn raw_key_matches_node_truncated_shifts() {
        // Node uses JS `<<` which is defined on int32; high bits wrap.
        // Verified empirically against `node -e "import(...).then(m =>
        //   { const k = new m.SimulationKernel(12345);
        //     console.log(k.entityIndex._rawKey(0,0,0).toString(16)); })"`.
        let idx = SpatialIndex::new(16.0);

        assert_eq!(idx.raw_key(0, 0, 0), 0x100000u64);
        assert_eq!(idx.raw_key(0, 1, 0), 0x300000u64);
        // (0, -1, 0) gave -1_048_576 in Node due to int32 wrap — we
        // store that as a u64 two's complement value.
        assert_eq!(idx.raw_key(0, -1, 0) as i64, -1_048_576);
        assert_eq!(idx.raw_key(1, 0, 0), 0x100001u64);
    }

    #[test]
    fn add_remove_query_round_trip() {
        let mut idx = SpatialIndex::new(16.0);
        idx.add(7, Position { x: 5.0, y: 5.0, z: 0.0 });
        idx.add(8, Position { x: 7.0, y: 9.0, z: 0.0 });
        assert_eq!(idx.query_radius(6.0, 6.0, 0.0, 4.0), vec![7, 8]);
        idx.remove(7);
        assert_eq!(idx.query_radius(6.0, 6.0, 0.0, 4.0), vec![8]);
    }

    #[test]
    fn distance_returns_euclidean() {
        let mut idx = SpatialIndex::new(16.0);
        idx.add(1, Position { x: 0.0, y: 0.0, z: 0.0 });
        idx.add(2, Position { x: 3.0, y: 4.0, z: 0.0 });
        assert!(approx_eq(idx.distance(1, 2), 5.0));
    }
}
