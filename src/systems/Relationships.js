/**
 * Relationships.js
 * Pair-bond + acquaintance affinity tracker. Tracks affection, trust,
 * respect, fear, attraction, familiarity between people.
 */

export class Relationships {
  constructor() {
    this.bonds = new Map();
  }

  addRelationship(person1Id, person2Id, type) {
    const key = this.getKey(person1Id, person2Id);
    if (!this.bonds.has(key)) {
      this.bonds.set(key, {
        affection: 0.5,
        trust: 0.5,
        respect: 0.5,
        fear: 0,
        attraction: 0,
        familiarity: 0,
        type: type,
        history: []
      });
    }
    return this.bonds.get(key);
  }

  getRelationship(person1Id, person2Id) {
    return this.bonds.get(this.getKey(person1Id, person2Id));
  }

  updateRelationship(person1Id, person2Id, changes) {
    const rel = this.getRelationship(person1Id, person2Id);
    if (!rel) return;

    for (const [key, value] of Object.entries(changes)) {
      if (rel[key] !== undefined) {
        rel[key] = Math.max(0, Math.min(1, rel[key] + value));
      }
    }

    rel.history.push({ turn: this.kernel?.turn ?? 0, changes });
  }

  // Aliases used by the UI layer (EnhancedGameUI expects these names).
  getBond(person1Id, person2Id) {
    return this.getRelationship(person1Id, person2Id);
  }

  createBond(person1Id, person2Id, initialAffinity = 0.1, type = 'acquaintance') {
    const existing = this.getRelationship(person1Id, person2Id);
    if (existing) return existing;
    const rel = this.addRelationship(person1Id, person2Id, type);
    rel.affection = initialAffinity;
    rel.familiarity = initialAffinity;
    return rel;
  }

  modifyAffinity(person1Id, person2Id, delta) {
    const rel = this.getRelationship(person1Id, person2Id);
    if (!rel) return null;
    rel.affinity = Math.max(-1, Math.min(1, (rel.affinity || 0) + delta));
    rel.history.push({ turn: this.kernel?.turn ?? 0, changes: { affinity: delta } });
    return rel;
  }

  getKey(id1, id2) {
    return id1 < id2 ? `${id1}-${id2}` : `${id2}-${id1}`;
  }
}