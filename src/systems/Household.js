/**
 * Household.js
 * Family unit entity: members, head, wealth, food stockpile, property, debts.
 * Includes fidelity-tier (regional/distant) aggregation hooks.
 */

export class Household {
  constructor(id, location) {
    this.id = id;
    this.location = location;
    this.members = [];
    this.head = null;
    this.wealth = 0;
    this.food = 100;
    this.resources = new Map();
    this.property = [];
    this.debts = [];
  }

  addMember(personId, role) {
    this.members.push({ id: personId, role: role });
    if (role === 'head') this.head = personId;
  }

  removeMember(personId) {
    this.members = this.members.filter(m => m.id !== personId);
    if (this.head === personId) {
      this.head = this.members.length > 0 ? this.members[0].id : null;
    }
  }

  consumeFood(amount) {
    this.food -= amount;
    return this.food >= 0;
  }

  addWealth(amount) {
    this.wealth += amount;
  }

  payDebt(amount) {
    if (this.debts.length === 0) return 0;
    const debt = this.debts[0];
    const payment = Math.min(amount, debt.amount);
    debt.amount -= payment;
    this.wealth -= payment;
    if (debt.amount <= 0) this.debts.shift();
    return payment;
  }

  aggregateToRegional() {
    return {
      interval: 20,
      snapshot: {
        wealth: this.wealth,
        food: this.food,
        memberCount: this.members.length
      }
    };
  }

  restoreFromRegional(snapshot) {
    this.wealth = snapshot.wealth;
    this.food = snapshot.food;
  }

  aggregateToDistant() {
    return {
      wealth: this.wealth,
      memberCount: this.members.length
    };
  }

  restoreFromDistant(snapshot) {
    this.wealth = snapshot.wealth;
  }
}