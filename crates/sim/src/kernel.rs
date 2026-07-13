//! SimulationKernel port — the turn-based engine core from
//! `src/core/SimulationKernel.js`.
//!
//! This crate covers the **structural** kernel: entity map, event log,
//! priority event queue, spatial index, RNG, world time, fidelity tiers.
//! Behavioral systems (combat, marriage, economy, ...) live in the rest of
//! `src/systems/` and are not ported yet — that's the year-by-year work.
//!
//! For now, `SimulationKernel` here is a deliberately narrow shim that
//! provides the primitives the **parity harness** uses:
//!
//!   1. `new(entities, ticks)` — spawn N entities, schedule `ticks`
//!      turns worth of `advanceHour` events on a deterministic schedule.
//!   2. The harness exercises RNG draws, world-time advance, event
//!      scheduling/dequeue, and event-log capture.
//!   3. The captured log + RNG sequence is serialized to JSON so the Node
//!      oracle and the Rust implementation can be compared byte-for-byte.

use serde::{Deserialize, Serialize};
use serde_json::json;

use crate::event_queue::{PriorityQueue, ScheduledEvent};
use crate::rng::SeededRng;
use crate::spatial::{Position, SpatialIndex};
use crate::worldtime::WorldTime;

pub const EVENT_LOG_CAP: usize = 4096;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityTemplate {
    #[serde(rename = "type")]
    pub kind: String,
    pub position: Option<Position>,
    pub mass: f64,
    #[serde(default)]
    pub is_person: bool,
    #[serde(default)]
    pub is_player: bool,
    #[serde(default)]
    pub sex: Option<String>,
    #[serde(flatten, default)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntitySnapshot {
    pub id: u32,
    pub template: EntityTemplate,
    pub mass: f64,
    pub position: Option<Position>,
    pub tombstone: Option<EntityTombstone>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EntityTombstone { pub removed_at: u64, pub reason: String }

#[derive(Debug, Clone, Default)]
pub struct KernelConfig {
    pub cellsize: f64,
}

pub struct SimulationKernel {
    pub seed: u32,
    pub rng: SeededRng,
    pub world_time: WorldTime,
    pub turn: u64,

    pub entities: Vec<EntitySnapshot>,
    pub spatial: SpatialIndex,
    pub next_entity_id: u32,

    pub event_queue: PriorityQueue,
    pub event_log: Vec<ScheduledEvent>,

    pub active_tier: Vec<u32>,
    pub regional_tier: std::collections::BTreeMap<u32, RegionalSchedule>,
    pub distant_tier: std::collections::BTreeMap<u32, ()>,

    pub by_type: std::collections::BTreeMap<String, Vec<u32>>,
    pub alive_people: Vec<u32>,
    pub conservation: ConservationLedger,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegionalSchedule {
    pub last_update: u64,
    pub next_update: u64,
    pub interval: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ConservationLedger {
    pub mass: f64,
    pub population: u64,
    pub wealth: f64,
}

impl SimulationKernel {
    pub fn new(seed: u32, cfg: KernelConfig) -> Self {
        let cellsize = if cfg.cellsize > 0.0 { cfg.cellsize } else { 16.0 };
        Self {
            seed,
            rng: SeededRng::new(seed),
            world_time: WorldTime::new(),
            turn: 0,
            entities: Vec::new(),
            spatial: SpatialIndex::new(cellsize),
            next_entity_id: 1,
            event_queue: PriorityQueue::new(),
            event_log: Vec::new(),
            active_tier: Vec::new(),
            regional_tier: std::collections::BTreeMap::new(),
            distant_tier: std::collections::BTreeMap::new(),
            by_type: std::collections::BTreeMap::new(),
            alive_people: Vec::new(),
            conservation: ConservationLedger::default(),
        }
    }

    /// Allocates a new entity id, registers it in the kernel's entity
    /// vector and tier 0 (active), indexes it spatially, and returns the
    /// id. Mirrors `kernel.createEntity(template)` for parity.
    pub fn create_entity(&mut self, template: EntityTemplate) -> u32 {
        let id = self.next_entity_id;
        self.next_entity_id += 1;

        let mass = template.mass;
        let pos = template.position;
        let is_person = template.is_person;

        let snap = EntitySnapshot {
            id,
            template: template.clone(),
            mass,
            position: pos,
            tombstone: None,
        };

        if let Some(p) = pos {
            self.spatial.add(id, p);
        }

        self.entities.push(snap);
        self.by_type
            .entry(template.kind.clone())
            .or_insert_with(Vec::new)
            .push(id);

        if is_person {
            self.alive_people.push(id);
            self.conservation.population += 1;
        }
        if mass > 0.0 {
            self.conservation.mass += mass;
        }

        self.active_tier.push(id);

        let mut payload = serde_json::Map::new();
        payload.insert("type".to_string(), json!("entity_created"));
        payload.insert("entityId".to_string(), json!(id));
        payload.insert("kind".to_string(), json!(template.kind));
        self.schedule_immediate(ScheduledEvent {
            id: 0,
            turn: 0, // events scheduled for current turn are dispatched
                     // before tick end-of-turn bookkeeping; parity with Node
                     // is enforced by harness invocations, see below.
            payload,
        });

        id
    }

    /// Mirrors `kernel.scheduleEvent(event, turnsFromNow)`. The caller
    /// supplies a `ScheduledEvent` whose `payload` already excludes `id`
    /// and `turn`; both are set here.
    pub fn schedule_in(&mut self, mut ev: ScheduledEvent, turns_from_now: u64) {
        ev.turn = self.turn + turns_from_now;
        // Mirror Node: `id = this.turn * 100000 + (counter & 0xFFFF)` uses
        // the kernel's current turn at *schedule* time, not the event's
        // scheduled turn.
        self.event_queue.set_current_turn(self.turn);
        self.event_queue.enqueue(ev);
    }

    pub fn schedule_immediate(&mut self, ev: ScheduledEvent) {
        self.schedule_in(ev, 0);
    }

    fn dispatch_one(&mut self) -> bool {
        if self.event_queue.is_empty() { return false; }
        let Some(top) = self.event_queue.peek() else { return false; };
        if top.turn > self.turn { return false; }
        let mut ev = self.event_queue.dequeue().expect("peeked");
        // Mirror Node's `processedAt: this.turn` — the entry's stored
        // `turn` is overwritten with the kernel's current turn at the
        // moment of dispatch. The scheduled turn is preserved in `event.
        // turn` (the source of truth inside the queue), but on the log
        // we record the dispatch turn.
        ev.turn = self.turn;
        self.event_log.push(ev);
        if self.event_log.len() > EVENT_LOG_CAP {
            let drop = self.event_log.len() - EVENT_LOG_CAP;
            self.event_log.drain(0..drop);
        }
        true
    }

    /// Drain every event whose `turn <= kernel.turn`. Node has a 256-event
    /// per-tick cap; we match that.
    pub fn process_scheduled(&mut self) -> u32 {
        let mut n = 0;
        for _ in 0..256 {
            if !self.dispatch_one() { break; }
            n += 1;
        }
        n
    }

    /// One in-game minute per call. Order mirrors Node's `tick()`:
    ///   1. `this.turn++`
    ///   2. `processScheduledEvents` (each event records
    ///      `processedAt = this.turn` — i.e. the NEW turn)
    ///   3. `worldTime.advance(1)`
    ///   4. (Node also calls `updateActiveTier`/`updateRegionalTier`/
    ///      `updateDistantTier` which we exercise later via the
    ///      ported systems.)
    pub fn tick(&mut self) {
        self.turn += 1;
        self.process_scheduled();
        self.world_time.advance(1);
    }

    /// Removes an entity by id. Mirrors `kernel.removeEntity(id, reason)`.
    pub fn remove_entity(&mut self, id: u32, reason: &str) {
        let Some(snap) = self.entities.iter_mut().find(|e| e.id == id) else { return; };
        if snap.tombstone.is_some() { return; }
        if snap.template.is_person {
            self.alive_people.retain(|x| *x != id);
            self.conservation.population = self.conservation.population.saturating_sub(1);
        }
        if snap.mass > 0.0 {
            self.conservation.mass -= snap.mass;
        }
        self.spatial.remove(id);
        snap.tombstone = Some(EntityTombstone { removed_at: self.turn, reason: reason.to_string() });
        self.active_tier.retain(|x| *x != id);
        self.regional_tier.remove(&id);
        self.distant_tier.remove(&id);

        if let Some(list) = self.by_type.get_mut(&snap.template.kind) {
            list.retain(|x| *x != id);
        }

        let mut payload = serde_json::Map::new();
        payload.insert("type".to_string(), json!("entity_removed"));
        payload.insert("entityId".to_string(), json!(id));
        payload.insert("reason".to_string(), json!(reason));
        self.schedule_immediate(ScheduledEvent { id: 0, turn: 0, payload });
    }

    /// Snapshot the kernel state to a JSON-friendly shape. The Node
    /// parity harness produces a comparable shape via
    /// `JSON.stringify(kernel.save())`.
    pub fn snapshot(&self) -> serde_json::Value {
        json!({
            "seed": self.seed,
            "turn": self.turn,
            "worldTime": {
                "year": self.world_time.year,
                "day": self.world_time.day,
                "hour": self.world_time.hour,
                "minute": self.world_time.minute,
                "totalMinutes": self.world_time.total_minutes,
            },
            "nextEntityId": self.next_entity_id,
            "activeTier": self.active_tier,
            "regionalTier": self.regional_tier.iter().map(|(k, v)| (k, v)).collect::<Vec<_>>(),
            "distantTier": self.distant_tier.iter().map(|(k, v)| (k, v)).collect::<Vec<_>>(),
            "byType": self.by_type.iter().map(|(k, v)| (k.clone(), v.clone())).collect::<std::collections::BTreeMap<_, _>>(),
            "alivePeople": self.alive_people,
            "conservation": {
                "mass": self.conservation.mass,
                "population": self.conservation.population,
                "wealth": self.conservation.wealth,
            },
            "entities": self.entities.iter().map(|e| json!({
                "id": e.id,
                "type": e.template.kind,
                "isPerson": e.template.is_person,
                "isPlayer": e.template.is_player,
                "sex": e.template.sex,
                "mass": e.mass,
                "position": e.position,
                "tombstone": e.tombstone,
            })).collect::<Vec<_>>(),
            "eventLogCount": self.event_log.len(),
            "eventQueueSize": self.event_queue.size(),
        })
    }

    /// Pull every `event_log` entry's `id`, `turn`, and `type` into a
    /// compact JSON array for parity diffing.
    pub fn event_log_compact(&self) -> serde_json::Value {
        let arr: Vec<serde_json::Value> = self.event_log.iter()
            .map(|e| {
                let type_str = e.payload.get("type").and_then(|v| v.as_str()).unwrap_or("").to_string();
                json!({ "id": e.id, "turn": e.turn, "type": type_str })
            })
            .collect();
        json!(arr)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entity_lifecycle_round_trip() {
        let mut k = SimulationKernel::new(42, KernelConfig::default());
        let id = k.create_entity(EntityTemplate {
            kind: "person".to_string(),
            position: Some(Position { x: 1.0, y: 2.0, z: 0.0 }),
            mass: 70.0,
            is_person: true,
            is_player: true,
            sex: Some("male".to_string()),
            extra: Default::default(),
        });
        assert_eq!(id, 1);
        assert_eq!(k.next_entity_id, 2);
        assert_eq!(k.alive_people, vec![1]);

        k.remove_entity(id, "test");
        assert!(k.entities.iter().find(|e| e.id == id).unwrap().tombstone.is_some());
        assert_eq!(k.alive_people.len(), 0);
    }

    #[test]
    fn tick_advances_clock_and_turn() {
        let mut k = SimulationKernel::new(7, KernelConfig::default());
        assert_eq!(k.turn, 0);
        k.tick();
        assert_eq!(k.turn, 1);
        // WorldTime starts at hour=6, minute=0. One tick = +1 minute.
        assert_eq!(k.world_time.hour, 6);
        assert_eq!(k.world_time.minute, 1);
        // Tick 60 times → 1 hour elapsed.
        for _ in 0..59 { k.tick(); }
        assert_eq!(k.world_time.hour, 7);
        assert_eq!(k.world_time.minute, 0);
    }

    #[test]
    fn event_log_capped_at_4096() {
        let mut k = SimulationKernel::new(7, KernelConfig::default());
        // Push a synthetic payload and call `dispatch_one` indirectly via
        // tick by scheduling and processing past the cap.
        for i in 0..(EVENT_LOG_CAP + 100) {
            let mut payload = serde_json::Map::new();
            payload.insert("type".to_string(), json!("synthetic"));
            payload.insert("n".to_string(), json!(i));
            k.event_queue.set_current_turn(k.turn);
            k.event_queue.enqueue(ScheduledEvent { id: i as u64, turn: 0, payload });
        }
        // Each tick drains events with turn <= kernel.turn. We need many
        // ticks because the dispatch loop caps at 256 per tick.
        for _ in 0..100 { k.tick(); }
        // Some synthetic events remain on the queue (capped at 256 per
        // tick), but the dispatched log must never exceed the cap.
        assert!(k.event_log.len() <= EVENT_LOG_CAP,
                "event_log grew to {}", k.event_log.len());
    }
}
