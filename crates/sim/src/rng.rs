//! Mulberry32 / xorshift-style PRNG — bit-identical port of
//! `SeededRNG` from `src/core/SimulationKernel.js`.
//!
//! The Node side uses `Math.imul` for 32-bit signed multiplication and the
//! unsigned right shift `>>>`. We mirror that with explicit `wrapping_*`
//! ops. To stay bit-identical to `Math.imul(a, b)`: V8 implements that with
//! `(a * b) | 0` semantics modulo 2^32, which on a 32-bit machine matches
//! `wrapping_mul(a as i32 as u32) as i32`. We keep all state in `u32` and
//! perform the XOR/MUL chain exactly as the JS does.

/// A deterministic PRNG seeded from a `u32`. Matches the Node kernel's
/// `SeededRNG.next()` output bit-for-bit for the same seed.
#[derive(Debug, Clone)]
pub struct SeededRng {
    state: u32,
    #[allow(dead_code)]
    seed: u32,
}

impl SeededRng {
    pub fn new(seed: u32) -> Self {
        let state = if seed == 0 { 1 } else { seed };
        Self { state, seed }
    }

    /// Mirrors `SeededRNG.next()`:
    ///   let t = (state = (state + 0x6D2B79F5) | 0)
    ///   t = Math.imul(t ^ (t >>> 15), t | 1)
    ///   t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    ///   return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    ///
    /// `Math.imul(a, b)` returns a signed 32-bit int. In unsigned space that
    /// is `(a as u32).wrapping_mul(b as u32)`. XOR with a signed-negative
    /// int reinterprets bits; we use `wrapping_mul` for both branches and
    /// XOR the resulting u32's, which is equivalent.
    pub fn next(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6D2B79F5);
        let mut t = self.state;
        // Math.imul(t ^ (t >>> 15), t | 1)
        let a = (t ^ (t >> 15)) as i32;
        let b = (t | 1) as i32;
        let m1 = (a as u32).wrapping_mul(b as u32);
        // The signed result of Math.imul is bit-identical to the unsigned
        // 32-bit multiplication result reinterpreted via (n as i32). We
        // don't need to flip the bit pattern; XOR works on bits.
        t = m1;
        // t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        let c = (t ^ (t >> 7)) as i32;
        let d = (t | 61) as i32;
        let m2 = (c as u32).wrapping_mul(d as u32);
        let add = t.wrapping_add(m2);
        t ^= add;
        let out = (t ^ (t >> 14)) as f64 / 4_294_967_296.0_f64;
        out
    }

    /// `Math.floor(this.next() * (max - min + 1)) + min` — matches `nextInt(min, max)`.
    pub fn next_int(&mut self, min: i32, max: i32) -> i32 {
        let range = (max - min + 1) as f64;
        (self.next() * range).floor() as i32 + min
    }

    /// `Math.floor(this.next() * array.length)` — matches `choice(array)`.
    pub fn choice_index(&mut self, len: usize) -> usize {
        (self.next() * len as f64).floor() as usize
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// First-five output values captured from the Node implementation:
    ///   `new SimulationKernel(12345).rng.next()` × 5.
    /// `0.9797282677609473, 0.3067522644996643, 0.484205421525985,
    ///  0.817934412509203, 0.5094283693470061`
    /// If the port drifts by even one bit in any intermediate register
    /// these assertions will fail.
    #[test]
    fn matches_node_seed_12345() {
        let mut rng = SeededRng::new(12345);
        let a = rng.next();
        let b = rng.next();
        let c = rng.next();
        let d = rng.next();
        let e = rng.next();
        assert!((a - 0.9797282677609473).abs() < 1e-12, "a={a}");
        assert!((b - 0.3067522644996643).abs() < 1e-12, "b={b}");
        assert!((c - 0.484205421525985).abs() < 1e-12, "c={c}");
        assert!((d - 0.817934412509203).abs() < 1e-12, "d={d}");
        assert!((e - 0.5094283693470061).abs() < 1e-12, "e={e}");
    }

    #[test]
    fn zero_seed_normalized_to_one() {
        let mut a = SeededRng::new(0);
        let mut b = SeededRng::new(1);
        // First call should match — both produce state=1 after normalization.
        assert_eq!(a.next().to_bits(), b.next().to_bits());
    }
}
