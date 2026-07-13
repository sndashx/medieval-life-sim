//! Calendar-aware world clock. Port of `class WorldTime` from
//! `src/core/SimulationKernel.js`.
//!
//! The Node side ticks world time by `advance(60)` once per simulated hour,
//! so `1 turn = 60 minutes`. Days wrap at 365, years at ∞. The season
//! brackets match: winter (day<91), spring (<182), summer (<274), fall
//! (rest). Time of day: night (hour<6), morning (<12), afternoon (<18),
//! evening (rest).

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorldTime {
    pub year: u32,
    pub day: u32,
    pub hour: u32,
    pub minute: u32,
    pub total_minutes: u64,
}

impl WorldTime {
    pub fn new() -> Self {
        Self { year: 1, day: 1, hour: 6, minute: 0, total_minutes: 0 }
    }

    /// Mirrors `advance(minutes)` from Node. One in-game hour per tick →
    /// called with `60` per turn from the parity harness.
    pub fn advance(&mut self, minutes: u32) {
        self.minute += minutes;
        self.total_minutes += minutes as u64;
        while self.minute >= 60 {
            self.minute -= 60;
            self.hour += 1;
        }
        while self.hour >= 24 {
            self.hour -= 24;
            self.day += 1;
        }
        while self.day > 365 {
            self.day -= 365;
            self.year += 1;
        }
    }

    pub fn season(&self) -> &'static str {
        if self.day < 91 { "winter" }
        else if self.day < 182 { "spring" }
        else if self.day < 274 { "summer" }
        else { "fall" }
    }

    pub fn time_of_day(&self) -> &'static str {
        if self.hour < 6 { "night" }
        else if self.hour < 12 { "morning" }
        else if self.hour < 18 { "afternoon" }
        else { "evening" }
    }
}

impl Default for WorldTime {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn advance_one_hour_rolls_clock() {
        let mut t = WorldTime::new();
        t.advance(60);
        assert_eq!(t.hour, 7);
        assert_eq!(t.minute, 0);
        assert_eq!(t.day, 1);
    }

    #[test]
    fn day_wraps_at_24_hours() {
        let mut t = WorldTime::new();
        for _ in 0..18 { t.advance(60); }
        assert_eq!(t.hour, 0);
        assert_eq!(t.day, 2);
    }

    #[test]
    fn year_wraps_at_365_days() {
        let mut t = WorldTime::new();
        // WorldTime starts day=1. Advance 365 days = 365*24=8760 minutes.
        // But our `advance(60)` advances by one hour per call, so to span
        // a year we need 365*24 calls. Day wraps at 366, so on the 366th
        // day-bump the year rolls over.
        // Simplest invariant: advance exactly 365*24*60 minutes, ending
        // at year=2, day=1.
        t.advance(365 * 24 * 60);
        assert_eq!(t.year, 2);
        assert_eq!(t.day, 1);
        assert_eq!(t.hour, 6);
        assert_eq!(t.minute, 0);
    }

    #[test]
    fn season_brackets_match_node() {
        let mut t = WorldTime::new();
        t.day = 91;
        assert_eq!(t.season(), "spring");
        t.day = 274;
        assert_eq!(t.season(), "fall");
    }
}
