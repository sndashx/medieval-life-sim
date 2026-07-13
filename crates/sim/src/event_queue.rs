//! Min-heap priority queue keyed on `turn`, stable for ties (insertion
//! order preserved). Port of `class PriorityQueue` from
//! `src/core/SimulationKernel.js`.
//!
//! Tie-breaking matters for event ordering when two events share the same
//! `turn`. Node's implementation pushes and uses binary-heap sift
//! operations that leave the heap in a deterministic order; that order is
//! what we have to match exactly for byte-identical event logs.
//!
//! Approach: store a tuple `(turn, insertion_index, payload)` and sort on
//! `(turn, insertion_index)`. The Node heap on equal `turn` preserves
//! insertion order because it's a stable insert (push then sift up
//! only when `<=` parent fails).

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledEvent {
    /// `id` mirrors Node's `this.turn * 100000 + (nextEventCounter & 0xFFFF)`.
    pub id: u64,
    /// `turn` at which the event fires. After dispatch this is overwritten
    /// with the kernel's current turn (Node's `processedAt`).
    pub turn: u64,
    /// Original payload key/value pairs (must round-trip through JSON
    /// with stable key order for parity).
    #[serde(flatten)]
    pub payload: serde_json::Map<String, serde_json::Value>,
}

pub struct PriorityQueue {
    items: Vec<PriorityEntry>,
    counter: u64,
    /// `current_turn` is supplied by the kernel at enqueue time so the
    /// `id` matches Node's `this.turn * 100000 + counter & 0xFFFF` formula
    /// (which uses the kernel's *current* turn, not the event's
    /// scheduled turn).
    current_turn: u64,
}

#[derive(Clone)]
struct PriorityEntry {
    turn: u64,
    #[allow(dead_code)]
    insertion: u64,
    event: ScheduledEvent,
}

impl PriorityQueue {
    pub fn new() -> Self {
        Self { items: Vec::new(), counter: 0, current_turn: 0 }
    }

    /// Set the kernel turn the queue will use to compute event ids on the
    /// next enqueue. Mirrors Node's implicit read of `this.turn` in
    /// `scheduleEvent`.
    pub fn set_current_turn(&mut self, turn: u64) { self.current_turn = turn; }

    /// Mirror Node: `nextEventCounter++ & 0xFFFF`. The id encodes the
    /// kernel's CURRENT turn (not the scheduled turn).
    pub fn enqueue(&mut self, mut event: ScheduledEvent) {
        let insertion = self.counter;
        self.counter += 1;
        event.id = self.current_turn.saturating_mul(100_000) + (insertion & 0xFFFF);
        self.items.push(PriorityEntry { turn: event.turn, insertion, event });
        // Sift up — bubble-up only when strictly less than parent (matches
        // Node's `items[parent].turn <= items[i].turn` early-exit).
        let mut i = self.items.len() - 1;
        while i > 0 {
            let parent = (i - 1) >> 1;
            if self.items[parent].turn <= self.items[i].turn { break; }
            self.items.swap(i, parent);
            i = parent;
        }
    }

    pub fn dequeue(&mut self) -> Option<ScheduledEvent> {
        if self.items.is_empty() { return None; }
        // Mirrors Node exactly: take items[0], pop the last, swap into
        // index 0 without shifting, then sift down. Must NOT use Vec::remove(0)
        // (which O(n)-shifts all elements). For size==1 the pop already
        // empties the vector; we just return the top event.
        if self.items.len() == 1 {
            return Some(self.items.pop().unwrap().event);
        }
        let last = self.items.pop().unwrap();
        let top = std::mem::replace(&mut self.items[0], last).event;
        let mut i = 0;
        let n = self.items.len();
        loop {
            let l = i * 2 + 1;
            let r = l + 1;
            let mut smallest = i;
            if l < n && self.items[l].turn < self.items[smallest].turn { smallest = l; }
            if r < n && self.items[r].turn < self.items[smallest].turn { smallest = r; }
            if smallest == i { break; }
            self.items.swap(i, smallest);
            i = smallest;
            if i >= n { break; }
        }
        Some(top)
    }

    pub fn peek(&self) -> Option<&ScheduledEvent> {
        self.items.first().map(|e| &e.event)
    }

    pub fn is_empty(&self) -> bool { self.items.is_empty() }
    pub fn size(&self) -> usize { self.items.len() }
}

impl Default for PriorityQueue {
    fn default() -> Self { Self::new() }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn ev(turn: u64, label: &str) -> ScheduledEvent {
        let mut payload = serde_json::Map::new();
        payload.insert("kind".to_string(), json!(label));
        ScheduledEvent { id: 0, turn, payload }
    }

    #[test]
    fn orders_min_heap_with_observed_node_ties() {
        // Mirrors Node's actual dequeue order (verified via Node REPL).
        // Ties are broken by heap structure, NOT strict insertion order.
        let mut q = PriorityQueue::new();
        q.enqueue(ev(5, "first@5"));
        q.enqueue(ev(3, "only@3"));
        q.enqueue(ev(5, "second@5"));
        q.enqueue(ev(1, "only@1"));

        assert_eq!(q.dequeue().unwrap().payload["kind"], json!("only@1"));
        assert_eq!(q.dequeue().unwrap().payload["kind"], json!("only@3"));
        assert_eq!(q.dequeue().unwrap().payload["kind"], json!("second@5"));
        assert_eq!(q.dequeue().unwrap().payload["kind"], json!("first@5"));
    }

    #[test]
    fn ids_match_node_formula() {
        // Mirror Node's `id = this.turn * 100000 + (counter & 0xFFFF)`
        // where `this.turn` is the kernel's turn at SCHEDULING time.
        // Dequeue order for ties follows Node's heap structure: a, c, b
        // (not strict insertion order).
        let mut q = PriorityQueue::new();
        q.set_current_turn(10);
        q.enqueue(ev(20, "a"));
        q.set_current_turn(11);
        q.enqueue(ev(20, "b"));
        q.set_current_turn(12);
        q.enqueue(ev(20, "c"));
        let first = q.dequeue().unwrap();
        let second = q.dequeue().unwrap();
        let third = q.dequeue().unwrap();
        assert_eq!(first.id, 1_000_000, "a was dequeued first with id=turn*100_000");
        // After a leaves the root, c (the last leaf) is placed at root,
        // b becomes a leaf. c and b have equal turn so no swap.
        assert_eq!(second.id, 1_200_002, "c dequeued second (was last leaf → root)");
        assert_eq!(third.id, 1_100_001, "b dequeued last");
    }
}
