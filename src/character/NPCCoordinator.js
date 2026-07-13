/**
 * NPCCoordinator.js
 *
 * Lifts the autonomous NPC tick logic out of Game.js. The behaviour is
 * identical to the previous `_npcAutonomousTick()` method:
 *
 * 1. Urgent need satisfaction (hunger/thirst/sleep)
 * 2. Occupation-appropriate work (peasant, craftsman, merchant, soldier,
 *    priest)
 * 3. Social interaction (small chance to talk to a peer)
 * 4. Bandit ambushes (very small chance per turn)
 *
 * All calls go through `game` (the Game orchestrator) — this class is a
 * coordinator, not a system. It is owned by Game but its logic lives here.
 */

import { Combat } from '../systems/Combat.js';

export class NPCCoordinator {
  constructor(game) {
    this.game = game;
  }

  tick() {
    if (!this.game.kernel?.activeTier) return;
    const R = this.game.kernel.rng;
    for (const id of this.game.kernel.activeTier) {
      if (id === this.game.player?.id) continue;
      const npc = this.game.kernel.entities.get(id);
      if (!npc || !npc.alive || npc.age < 5) continue;

      const needs = npc.needs || {};
      const h = needs.hunger ?? 0;
      const t = needs.thirst ?? 0;
      const s = needs.sleep ?? 0;

      // 1. Urgent need satisfaction
      if (h > 0.7 || t > 0.7) {
        const inv = npc.inventory?.items || [];
        const food = inv.find(i => i.type === 'food' || i.subtype === 'food');
        if (food) {
          npc.inventory.remove(food.type, 1);
          needs.hunger = Math.max(0, h - 0.3);
          continue;
        }
        continue;
      }
      if (s > 0.85) {
        needs.sleep = Math.max(0, s - 0.5);
        continue;
      }

      // 2. Occupation-appropriate work
      const roll = R.next();
      switch (npc.occupation) {
        case 'peasant': {
          if (roll < 0.5) {
            const h2 = npc.household ? this.game.kernel.entities.get(npc.household) : null;
            if (h2) {
              const produced = R.nextInt(1, 3);
              h2.food = (h2.food || 0) + produced;
              h2.wealth = (h2.wealth || 0) + 1;
            }
          }
          break;
        }
        case 'craftsman': {
          if (roll < 0.3 && this.game.crafting && npc.skills && npc.inventory) {
            try {
              const candidates = ['bread', 'clay_pot', 'wooden_spear', 'stone_axe', 'leather_armor', 'iron_sword'];
              let chosen = null;
              for (const r of candidates) {
                try {
                  const check = this.game.crafting.canCraft(npc, r, npc.inventory);
                  if (check && check.can) { chosen = r; break; }
                } catch (e) { /* recipe check threw; skip */ }
              }
              if (chosen) {
                const res = this.game.crafting.craft(npc, chosen, npc.inventory, this.game.kernel);
                if (res && res.success && res.item) {
                  try { npc.inventory.add(res.item); } catch (e) { /* over capacity; ignore */ }
                }
              }
            } catch (e) { /* craft subsystem threw; skip */ }
          }
          break;
        }
        case 'merchant': {
          if (roll < 0.5 && this.game.trading?.shops && npc.position) {
            try {
              const shops = Array.from(this.game.trading.shops.values());
              const npcX = npc.position.x ?? 0;
              const npcY = npc.position.y ?? 0;
              const npcSid = npc.position.settlementId;
              const nearby = shops.find(s => {
                if (!s) return false;
                if (s.settlementId === npcSid) return true;
                if (s.location) return Math.abs((s.location.x ?? 0) - npcX) < 20 && Math.abs((s.location.y ?? 0) - npcY) < 20;
                return false;
              });
              if (nearby) {
                if (typeof this.game.trading.restockShop === 'function') {
                  try { this.game.trading.restockShop(nearby); } catch (e) { /* restock failed; skip */ }
                } else {
                  const items = nearby.inventory ? Array.from(nearby.inventory.values()) : [];
                  if (items.length > 0) {
                    const item = items[R.nextInt(0, items.length - 1)];
                    if (item) item.quantity = (item.quantity || 0) + R.nextInt(1, 3);
                  }
                }
              }
            } catch (e) { /* merchant subsystem threw; skip */ }
          }
          break;
        }
        case 'soldier': {
          if (roll < 0.3 && npc.position) {
            const dx = [0, 1, -1, 0][Math.floor(R.next() * 4)];
            const dy = [1, 0, 0, -1][Math.floor(R.next() * 4)];
            npc.position.x += dx;
            npc.position.y += dy;
          }
          break;
        }
        case 'priest': {
          if (roll < 0.2 && this.game.religion) {
            try {
              const pantheon = this.game.religion.pantheon;
              const deity = pantheon?.deities?.[0];
              if (deity) this.game.religion.pray(npc, deity.id, 'private');
            } catch (e) { /* religion subsystem threw; skip */ }
          }
          break;
        }
      }

      // 3. Social interaction
      if (R.next() < 0.05) {
        try {
          const nearby = this.game.kernel.queryEntitiesNear(npc.position?.x ?? 0, npc.position?.y ?? 0, 0, 10);
          const peer = nearby.map(id => this.game.kernel.entities.get(id)).find(p => p && p !== npc && p.name && p.alive && p.age >= 12);
          if (peer && this.game.relationships) {
            const bond = this.game.relationships.getBond(npc.id, peer.id);
            if (bond) this.game.relationships.modifyAffinity(npc.id, peer.id, 0.02);
            else this.game.relationships.createBond(npc.id, peer.id, 0.1);
          }
        } catch (e) {}
      }

      // 4. Bandit ambush
      if (npc.occupation === 'bandit' && npc.factionId && R.next() < 0.005) {
        try {
          const nearby = this.game.kernel.queryEntitiesNear(npc.position?.x ?? 0, npc.position?.y ?? 0, 0, 8);
          const enemy = nearby
            .map(id => this.game.kernel.entities.get(id))
            .find(p => p && p !== npc && p.alive && p.name && (p.factionId || 0) !== npc.factionId);
          if (enemy) {
            const weapon = npc.inventory?.items?.find(i => i.type === 'weapon');
            const result = Combat.resolveAttack(npc, enemy, weapon, 'torso', this.game.kernel);
            if (!this.game.combat.combatLog) this.game.combat.combatLog = [];
            this.game.combat.combatLog.push({
              turn: this.game.kernel.turn,
              attacker: npc.id,
              attackerName: npc.name,
              defender: enemy.id,
              defenderName: enemy.name,
              hit: !!(result && result.hit),
              damage: result?.damage || 0,
              location: result?.location || null,
              cause: 'bandit_ambush'
            });
            if (this.game.combat.combatLog.length > 200) this.game.combat.combatLog.shift();
          }
        } catch (e) {}
      }
    }
  }
}