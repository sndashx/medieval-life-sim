export class Combat {
  static resolveAttack(attacker, defender, weapon, targetLocation, kernel) {
    const attackerSkill = attacker.skills.combat.melee;
    const defenderSkill = defender.skills.combat.defense;
    const attackerHealth = attacker.physiology.getHealthStatus(kernel);

    const hitChance = 0.5 + (attackerSkill - defenderSkill) * 0.3 + (attackerHealth.strength - 0.5) * 0.2;
    if (kernel.random() > hitChance) {
      return { hit: false, damage: 0, location: null };
    }

    const impact = this.calculateImpact(attacker, weapon, kernel);
    const penetration = this.calculatePenetration(weapon, defender.equipment && defender.equipment.armor);
    const injury = this.createInjury(impact, penetration, targetLocation, kernel);

    defender.physiology.applyInjury(injury);
    return { hit: true, damage: injury.severity, location: targetLocation, injury };
  }

  static calculateImpact(attacker, weapon, kernel) {
    const strength = attacker.physiology.getHealthStatus(kernel).strength;
    const weaponMass = weapon ? weapon.mass || 0.5 : 0.5;
    const velocity = 5 * strength;
    return 0.5 * weaponMass * velocity * velocity;
  }

  static calculatePenetration(weapon, armor) {
    const sharpness = weapon ? weapon.sharpness || 0.5 : 0.5;
    const armorThickness = armor ? armor.thickness || 0 : 0;
    const armorHardness = armor ? armor.hardness || 0 : 0;
    if (weapon && weapon.type === 'blunt') return Math.max(0, 1 - armorThickness * armorHardness);
    return Math.max(0, sharpness - armorThickness * armorHardness * 0.5);
  }

  static createInjury(impact, penetration, location, kernel) {
    const severity = Math.min(1, impact * penetration / 100);
    const bleeding = penetration > 0.5 ? severity * 0.1 : 0;
    const roll = kernel.random();
    return {
      location: location,
      severity: severity,
      bleeding: bleeding,
      open: penetration > 0.3,
      infected: false,
      fractured: impact > 200 && roll < 0.3,
      nervesDamaged: severity > 0.7 && roll < 0.2,
      organ: this.getOrganAtLocation(location, kernel)
    };
  }

  static getOrganAtLocation(location, kernel) {
    const roll = kernel.random();
    if (location === 'head') return 'brain';
    if (location === 'chest') return roll < 0.5 ? 'heart' : 'lungs';
    if (location === 'abdomen') {
      const r2 = kernel.random();
      return r2 < 0.3 ? 'liver' : r2 < 0.5 ? 'stomach' : 'intestines';
    }
    return null;
  }
}

export class CraftingSystem {
  constructor() {
    this.recipes = this.initRecipes();
  }

  initRecipes() {
    return {
      'wooden_spear': {
        inputs: [{ item: 'wood', amount: 1 }, { item: 'stone', amount: 1 }],
        skill: 'woodwork',
        skillRequired: 0.2,
        time: 120,
        output: { type: 'weapon', subtype: 'spear', mass: 1.5, sharpness: 0.6 }
      },
      'stone_axe': {
        inputs: [{ item: 'wood', amount: 1 }, { item: 'stone', amount: 2 }],
        skill: 'woodwork',
        skillRequired: 0.3,
        time: 180,
        output: { type: 'tool', subtype: 'axe', mass: 2, sharpness: 0.7 }
      },
      'clay_pot': {
        inputs: [{ item: 'clay', amount: 2 }],
        skill: 'pottery',
        skillRequired: 0.2,
        time: 240,
        output: { type: 'container', capacity: 5, mass: 1 }
      },
      'bread': {
        inputs: [{ item: 'flour', amount: 1 }, { item: 'water', amount: 0.5 }],
        skill: 'cooking',
        skillRequired: 0.1,
        time: 60,
        output: { type: 'food', calories: 250, protein: 8, carbohydrates: 50 }
      },
      'leather_armor': {
        inputs: [{ item: 'leather', amount: 5 }],
        skill: 'leatherwork',
        skillRequired: 0.5,
        time: 480,
        output: { type: 'armor', coverage: 0.6, thickness: 0.3, hardness: 0.4 }
      },
      'iron_sword': {
        inputs: [{ item: 'iron', amount: 2 }, { item: 'wood', amount: 1 }],
        skill: 'metalwork',
        skillRequired: 0.6,
        time: 600,
        output: { type: 'weapon', subtype: 'sword', mass: 1.2, sharpness: 0.9 }
      }
    };
  }

  canCraft(character, recipeName, inventory) {
    const recipe = this.recipes[recipeName];
    if (!recipe) return { can: false, reason: 'Unknown recipe' };
    
    const skill = character.skills.crafting[recipe.skill];
    if (skill < recipe.skillRequired) {
      return { can: false, reason: 'Insufficient skill' };
    }
    
    for (const input of recipe.inputs) {
      const available = inventory.count(input.item);
      if (available < input.amount) {
        return { can: false, reason: `Need ${input.amount} ${input.item}, have ${available}` };
      }
    }
    
    return { can: true };
  }

  craft(character, recipeName, inventory, kernel) {
    const check = this.canCraft(character, recipeName, inventory);
    if (!check.can) return check;
    
    const recipe = this.recipes[recipeName];
    
    for (const input of recipe.inputs) {
      inventory.remove(input.item, input.amount);
    }
    
    const quality = character.skills.crafting[recipe.skill];
    const output = { ...recipe.output, quality: quality };
    
    character.skills.train(recipe.skill, 'crafting', quality, recipe.time);
    
    kernel.scheduleEvent({
      type: 'craft_complete',
      character: character.id,
      item: output
    }, Math.ceil(recipe.time / 60));
    
    return { success: true, item: output, turnsRequired: Math.ceil(recipe.time / 60) };
  }
}

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

  /**
   * T7-3: Recompute cached weight from current items. Used after save/load,
   * since Inventory.weight is derived but mutated in-place by add()/remove()
   * — JSON round-trip preserves items but may leave `weight` stale.
   */
  _recomputeWeight() {
    let w = 0;
    for (const item of this.items) {
      if (item && typeof item.mass === 'number') w += item.mass;
    }
    this.weight = w;
  }
}
