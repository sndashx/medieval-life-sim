// ─────────────────────────────────────────────────────────────────────────────
// GameQuery — read-only facade for the UI layer.
//
// Marcus (alpha tester) flagged that BlessedGameUI reaches directly into
// game.kernel, game.factions, game.world, game.crafting, game.trading, etc.
// That's a wide attack surface and the UI must change whenever any sub-system
// is renamed. This module narrows the read API to a stable set of named
// queries so the UI depends on a single import instead of the whole Game.
//
// All methods take the Game instance and return a plain serializable shape.
// No method on this facade mutates game state.
// ─────────────────────────────────────────────────────────────────────────────

export class GameQuery {
  constructor(game) { this.game = game; }

  // ── player ────────────────────────────────────────────────────────────────
  getPlayer() { return this.game.getPlayer ? this.game.getPlayer() : this.game.player; }
  hasPlayer() { return !!this.getPlayer(); }
  getPlayerSummary() {
    const p = this.getPlayer();
    if (!p) return null;
    const status = p.getStatus ? p.getStatus() : {};
    const health = (p.physiology && p.physiology.getHealthStatus) ? p.physiology.getHealthStatus() : { overall: 1, pain: 0, fatigue: 0 };
    return {
      id: p.id,
      name: p.name,
      age: Math.floor(p.age || 0),
      sex: p.sex,
      occupation: p.occupation,
      alive: p.alive !== false,
      position: p.position,
      health: {
        overall: health.overall || 0,
        pain: health.pain || 0,
        fatigue: health.fatigue || 0,
      },
      needs: status.needs || {},
    };
  }
  getPlayerWealth() {
    return this.game.getPlayerWealthSummary ? this.game.getPlayerWealthSummary() : null;
  }

  // ── world ────────────────────────────────────────────────────────────────
  getTile(x, y) {
    if (!this.game.world || typeof this.game.world.getTile !== 'function') return null;
    try { return this.game.world.getTile(x, y); } catch (_) { return null; }
  }
  getWorldInfo() {
    return this.game.getWorldInfo ? this.game.getWorldInfo() : null;
  }
  getNearby(x, y, z, radius) {
    if (this.game.kernel && typeof this.game.kernel.queryEntitiesNear === 'function') {
      return this.game.kernel.queryEntitiesNear(x, y, z || 0, radius);
    }
    return [];
  }

  // ── factions ──────────────────────────────────────────────────────────────
  getTopFactions(n = 5) {
    const fs = (this.game.factions && this.game.factions.factions) || [];
    return fs
      .filter((f) => f && (f.members || f.memberIds))
      .map((f) => ({ name: f.name || '—', count: (f.members || f.memberIds || []).length, purpose: f.purpose || '' }))
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  // ── household ────────────────────────────────────────────────────────────
  getHousehold(player) {
    if (!player || !player.household) return null;
    return this.game.kernel.entities.get(player.household) || null;
  }

  // ── elapsed time ─────────────────────────────────────────────────────────
  getTurn() { return this.game.kernel ? this.game.kernel.turn : 0; }

  // ── tick / kernel ────────────────────────────────────────────────────────
  getFidelityTiers() {
    if (!this.game.kernel) return null;
    return {
      active: this.game.kernel.activeTier,
      regional: this.game.kernel.regionalTier,
      distant: this.game.kernel.distantTier,
    };
  }
}