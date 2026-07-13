// Lightweight reactive store — wraps the Game object in a React hook so
// panels re-render when state changes (turn advance, log line, player change).
//
// Polling is intentional and cheap: we tick every `tickMs` ms (default 250ms)
// and shallow-diff a snapshot. The Game itself is the source of truth.

import { useEffect, useState, useRef, useCallback } from 'react';

export class Store {
  constructor(game, tickMs = 250) {
    this.game = game;
    this.tickMs = tickMs;
    this._subs = new Set();
    this._log = [];
    this._logMax = 250;
    this._unsub = null;

    // Listen to game-driven notifications (death events, taxes, etc.)
    this._unsub = game.registerUIListener((msg, type) => {
      this._pushLog(msg, type || 'system');
      this._emit();
    });
  }

  _pushLog(message, type) {
    if (typeof message !== 'string') message = String(message);
    const lines = message.split('\n');
    for (const l of lines) {
      this._log.push({ msg: l, type, t: this.game?.kernel?.turn ?? 0 });
      if (this._log.length > this._logMax) this._log.shift();
    }
  }

  log(msg, type = 'info') { this._pushLog(msg, type); this._emit(); }

  _emit() {
    for (const fn of this._subs) {
      try { fn(); } catch (e) { /* swallow */ }
    }
  }

  subscribe(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }

  destroy() {
    if (this._unsub) this._unsub();
    this._subs.clear();
  }
}

// Hook — re-renders when the store ticks or external action triggers.
export function useStore(store) {
  const [, force] = useState(0);
  const ref = useRef(null);
  if (!ref.current) {
    ref.current = {
      inc: () => force(x => x + 1),
    };
  }
  useEffect(() => {
    const unsub = store.subscribe(() => ref.current.inc());
    return unsub;
  }, [store]);
  return ref.current;
}

// Build a snapshot of the player's "interesting" state.
// Cheap to read on every render; cached on the store between ticks.
export function snapshot(store) {
  const game = store.game;
  const player = game.player;
  const info = game.getWorldInfo ? game.getWorldInfo() : {};
  const snap = {
    info,
    player: null,
    alive: !!player && player.alive,
    log: store._log,
    raw: { game, player },
  };

  if (player && player.alive) {
    const needs = player.needs || {};
    const phys = player.physiology || {};
    const meta = phys.metabolism || {};
    snap.player = {
      id: player.id,
      name: player.name,
      age: player.age,
      sex: player.sex,
      alive: player.alive,
      occupation: player.occupation || 'peasant',
      householdId: player.household,
      position: player.position,
      isPlayer: player.isPlayer,
      needs: {
        hunger: needs.hunger ?? 0,
        thirst: needs.thirst ?? 0,
        sleep: needs.sleep ?? 0,
        warmth: needs.warmth ?? 1,
        shelter: needs.shelter ?? 1,
        social: needs.social ?? 0.5,
        safety: needs.safety ?? 1,
      },
      health: phys.bloodVolume != null && phys.initialBloodVolume
        ? phys.bloodVolume / phys.initialBloodVolume
        : 1,
      energy: meta.energyStores != null && meta.maxEnergyStores
        ? meta.energyStores / meta.maxEnergyStores
        : 1,
      temp: phys.coreTemperature != null && phys.basalTemperature
        ? phys.coreTemperature / phys.basalTemperature
        : 1,
      inventory: player.inventory?.items?.length
        ? player.inventory.items.map((it, i) => ({
            i, name: it.name || it.type || 'item', qty: it.quantity || 1,
            nutrition: it.nutrition, type: it.type, subtype: it.subtype,
          }))
        : [],
      inventoryCount: player.inventory?.items?.length || 0,
      marriage: player.marriage || null,
      spouse: player.marriage?.spouse ?? null,
      traits: player.personality || null,
      skills: player.skills || null,
      title: player.titles?.current || null,
    };

    // Spouse name lookup
    if (snap.player.spouse != null) {
      const sp = game.kernel.entities.get(snap.player.spouse);
      snap.player.spouseName = sp?.name || '—';
    } else {
      snap.player.spouseName = null;
    }

    // Household name + members
    if (player.household) {
      const hh = game.kernel.entities.get(player.household);
      snap.player.householdName = hh?.name || 'Household';
      snap.player.householdFood = hh?.food ?? null;
      snap.player.householdMembers = (hh?.members || []).map(id => {
        const m = game.kernel.entities.get(id);
        return m ? { id, name: m.name, age: Math.floor(m.age), occupation: m.occupation } : null;
      }).filter(Boolean);
    } else {
      snap.player.householdName = null;
    }

    // Parents
    if (player.kinship) {
      const mom = player.kinship.mother != null ? game.kernel.entities.get(player.kinship.mother) : null;
      const dad = player.kinship.father != null ? game.kernel.entities.get(player.kinship.father) : null;
      snap.player.mother = mom?.name || null;
      snap.player.father = dad?.name || null;
      const children = (player.kinship.children || [])
        .map(id => game.kernel.entities.get(id))
        .filter(p => p && p.alive);
      snap.player.children = children.map(c => ({ id: c.id, name: c.name, age: Math.floor(c.age), sex: c.sex }));
    }

    // Reputation
    if (game.reputation?.reputations) {
      const rep = game.reputation.reputations.get(player.id);
      snap.player.reputation = rep ? { honor: rep.honor || 0, fame: rep.fame || 0, infamy: rep.infamy || 0 } : null;
    }
  }

  return snap;
}

// React hook: tick at a fixed cadence to force re-render. The store's
// subscribe also nudges us. Returns the snapshot.
export function useSnapshot(store, tickMs = 250) {
  const trigger = useStore(store);
  const [snap, setSnap] = useState(() => snapshot(store));
  const tickRef = useRef(null);

  const refresh = useCallback(() => {
    setSnap(snapshot(store));
  }, [store]);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(refresh, tickMs);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [refresh, tickMs]);

  useEffect(() => { refresh(); }, [refresh, store]);

  return snap;
}