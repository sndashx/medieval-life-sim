/**
 * Kinship.js
 * Genealogy / family-tree tracker. Records parent-child links, marriages,
 * deaths, and answers "how is X related to Y" queries for UI flavour.
 */

export class Kinship {
  constructor() {
    this.genealogy = new Map();
  }

  addPerson(id, mother, father, sex) {
    this.genealogy.set(id, {
      id: id,
      mother: mother,
      father: father,
      sex: sex,
      children: [],
      spouse: null,
      birthTurn: 0
    });

    if (mother && this.genealogy.has(mother)) {
      this.genealogy.get(mother).children.push(id);
    }
    if (father && this.genealogy.has(father)) {
      this.genealogy.get(father).children.push(id);
    }
  }

  marry(person1Id, person2Id) {
    if (this.genealogy.has(person1Id)) {
      this.genealogy.get(person1Id).spouse = person2Id;
    }
    if (this.genealogy.has(person2Id)) {
      this.genealogy.get(person2Id).spouse = person1Id;
    }
  }

  getChildren(personId) {
    return this.genealogy.get(personId)?.children || [];
  }

  getParents(personId) {
    const person = this.genealogy.get(personId);
    return person ? [person.mother, person.father].filter(p => p) : [];
  }

  getSiblings(personId) {
    const parents = this.getParents(personId);
    const siblings = new Set();
    for (const parent of parents) {
      const children = this.getChildren(parent);
      for (const child of children) {
        if (child !== personId) siblings.add(child);
      }
    }
    return Array.from(siblings);
  }

  getEligibleHeirs(personId) {
    const children = this.getChildren(personId);
    const spouse = this.genealogy.get(personId)?.spouse;
    const siblings = this.getSiblings(personId);
    return [...children, spouse, ...siblings].filter(id => id);
  }

  recordDeath(personId, info = {}) {
    const entry = this.genealogy.get(personId);
    if (!entry) return;
    entry.dead = true;
    entry.deathCause = info.cause || 'unknown';
    entry.deathTurn = info.turn || null;
    entry.deathDate = this.kernel?.turn ?? 0;
    if (entry.spouse) {
      const spouseEntry = this.genealogy.get(entry.spouse);
      if (spouseEntry) spouseEntry.spouse = null;
    }
    entry.spouse = null;
  }

  getRelationship(personId, otherId) {
    const me = this.genealogy.get(personId);
    const other = this.genealogy.get(otherId);
    if (!me || !other) return null;

    if (me.mother === otherId) return 'mother';
    if (me.father === otherId) return 'father';
    if (other.mother === personId) {
      return other.sex === 'male' ? 'son' : 'daughter';
    }
    if (other.father === personId) {
      return other.sex === 'male' ? 'son' : 'daughter';
    }
    if (me.spouse === otherId) return 'spouse';
    if (me.mother && me.mother === other.mother && me.father === other.father) {
      return other.sex === 'male' ? 'brother' : 'sister';
    }
    return null;
  }
}