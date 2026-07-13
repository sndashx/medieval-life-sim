/**
 * Inventory.js
 *
 * Item container with weight tracking. Previously co-located with Combat
 * for historical reasons; split out per the T3.3 module-boundary cleanup
 * so combat and inventory can evolve independently.
 */

export class Inventory {
  constructor(capacity = 50) {
    this.items = [];
    this.capacity = capacity;
    this.weight = 0;
  }

  add(item) {
    if (this.weight + item.mass > this.capacity) {
      return { success: false, reason: 'Too heavy' };
    }
    this.items.push(item);
    this.weight += item.mass;
    return { success: true };
  }

  remove(itemType, amount = 1) {
    let removed = 0;
    for (let i = this.items.length - 1; i >= 0 && removed < amount; i--) {
      if (this.items[i].type === itemType || this.items[i].subtype === itemType) {
        this.weight -= this.items[i].mass;
        this.items.splice(i, 1);
        removed++;
      }
    }
    return removed;
  }

  count(itemType) {
    return this.items.filter(i => i.type === itemType || i.subtype === itemType).length;
  }

  find(predicate) {
    return this.items.find(predicate);
  }

  getWeight() {
    return this.weight;
  }

  /** T7-3: Recompute cached weight after save/load round-trip. */
  _recomputeWeight() {
    let w = 0;
    for (const item of this.items) {
      if (item && typeof item.mass === 'number') w += item.mass;
    }
    this.weight = w;
  }
}