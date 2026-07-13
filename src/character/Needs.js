export class Needs {
  constructor(physiology) {
    this.physiology = physiology;
    this.hunger = 0;
    this.thirst = 0;
    this.sleep = 0;
    this.warmth = 1.0;
    this.shelter = 1.0;
    this.social = 0.5;
    this.safety = 1.0;
  }

  update(kernel) {
    const minutes = 60;
    this.hunger += 0.01 * (minutes / 60);
    this.thirst += 0.015 * (minutes / 60);
    this.sleep += 0.008 * (minutes / 60);
    this.social = Math.max(0, this.social - 0.001 * minutes);
    
    if (this.hunger > 0.8) this.physiology.metabolism.energyStores -= 100;
    if (this.thirst > 0.8) this.physiology.hydration -= 0.01;
    if (this.sleep > 0.9) this.physiology.fatigue += 0.02;
    
    return this.getUrgentNeeds();
  }

  getUrgentNeeds() {
    const urgent = [];
    if (this.hunger > 0.7) urgent.push('hunger');
    if (this.thirst > 0.7) urgent.push('thirst');
    if (this.sleep > 0.8) urgent.push('sleep');
    if (this.warmth < 0.3) urgent.push('warmth');
    return urgent;
  }

  satisfy(need, amount) {
    if (need === 'hunger') this.hunger = Math.max(0, this.hunger - amount);
    if (need === 'thirst') this.thirst = Math.max(0, this.thirst - amount);
    if (need === 'sleep') this.sleep = Math.max(0, this.sleep - amount);
    if (need === 'social') this.social = Math.min(1, this.social + amount);
  }
}

export class Skills {
  constructor() {
    this.physical = { strength: 0.5, endurance: 0.5, agility: 0.5, coordination: 0.5 };
    this.combat = { melee: 0, ranged: 0, defense: 0, tactics: 0 };
    this.crafting = { woodwork: 0, metalwork: 0, textiles: 0, pottery: 0, construction: 0 };
    this.knowledge = { reading: 0, writing: 0, mathematics: 0, medicine: 0, agriculture: 0 };
    this.social = { persuasion: 0, deception: 0, leadership: 0, teaching: 0, trading: 0 };
    this.survival = { hunting: 0, foraging: 0, tracking: 0, navigation: 0, firemaking: 0 };
    this.practice = new Map();
  }

  train(skill, category, quality, duration) {
    const current = this[category][skill];
    const learningRate = 0.001 * quality * (1 - current);
    this[category][skill] = Math.min(1, current + learningRate * duration);
    
    if (!this.practice.has(skill)) this.practice.set(skill, 0);
    this.practice.set(skill, this.practice.get(skill) + duration);
  }

  getLevel(skill, category) {
    return this[category][skill];
  }

  decay(minutes) {
    // Bucket-aware decay: caller should already gate by (turn & 63) === (id & 63)
    // but if called directly we still apply the (slow) per-call decay.
    for (const cat in this) {
      const v = this[cat];
      if (cat === 'practice' || v === null || typeof v !== 'object') continue;
      for (const skill in v) v[skill] *= 0.9999;
    }
  }
}
