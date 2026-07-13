/**
 * Warfare.js
 * Military formations, morale, siege mechanics, logistics
 * Models realistic medieval combat, supply lines, fortifications
 */

export class Warfare {
  constructor(physics, kernel, game) {
    this.physics = physics;
    this.kernel = kernel || game?.kernel || null;
    this.armies = new Map();
    this.battles = new Map();
    this.sieges = new Map();
    this.formations = new Map();
    this.nextArmyId = 1;
    this.nextBattleId = 1;
    this.nextSiegeId = 1;
  }

  musterArmy(commander, soldiers, location) {
    const army = {
      id: this.nextArmyId++,
      commander: commander.id,
      soldiers: soldiers.map(s => s.id),
      location: location,
      mustered: this.kernel?.turn ?? 0,
      morale: 0.7,
      cohesion: 0.8,
      supplies: {
        food: soldiers.length * 7, // 7 days of food
        water: soldiers.length * 3,
        ammunition: soldiers.length * 20
      },
      casualties: 0,
      formation: null,
      status: 'ready'
    };
    
    this.armies.set(army.id, army);
    return army;
  }

  setFormation(armyId, formationType) {
    const army = this.armies.get(armyId);
    if (!army) {
      return { success: false, reason: 'Unknown army' };
    }
    
    const formation = this.createFormation(formationType, army.soldiers.length);
    
    army.formation = formation;
    
    return {
      success: true,
      formation: formation
    };
  }

  createFormation(type, soldierCount) {
    const formations = {
      shield_wall: {
        type: 'shield_wall',
        defense: 0.8,
        offense: 0.5,
        mobility: 0.3,
        cohesionRequired: 0.7
      },
      phalanx: {
        type: 'phalanx',
        defense: 0.9,
        offense: 0.6,
        mobility: 0.2,
        cohesionRequired: 0.8
      },
      cavalry_charge: {
        type: 'cavalry_charge',
        defense: 0.4,
        offense: 0.9,
        mobility: 0.9,
        cohesionRequired: 0.6
      },
      skirmish: {
        type: 'skirmish',
        defense: 0.5,
        offense: 0.6,
        mobility: 0.8,
        cohesionRequired: 0.5
      },
      wedge: {
        type: 'wedge',
        defense: 0.6,
        offense: 0.8,
        mobility: 0.7,
        cohesionRequired: 0.7
      }
    };
    
    return formations[type] || formations.shield_wall;
  }

  engageBattle(army1Id, army2Id, terrain) {
    const army1 = this.armies.get(army1Id);
    const army2 = this.armies.get(army2Id);
    
    if (!army1 || !army2) {
      return { success: false, reason: 'Unknown army' };
    }
    
    const battle = {
      id: this.nextBattleId++,
      armies: [army1Id, army2Id],
      location: army1.location,
      terrain: terrain,
      started: this.kernel?.turn ?? 0,
      rounds: [],
      status: 'ongoing',
      victor: null
    };
    
    this.battles.set(battle.id, battle);
    
    army1.status = 'engaged';
    army2.status = 'engaged';
    
    return {
      success: true,
      battle: battle
    };
  }

  simulateBattleRound(battleId) {
    const battle = this.battles.get(battleId);
    if (!battle || battle.status !== 'ongoing') {
      return { success: false, reason: 'Battle not ongoing' };
    }
    
    const army1 = this.armies.get(battle.armies[0]);
    const army2 = this.armies.get(battle.armies[1]);
    
    if (!army1 || !army2) {
      return { success: false, reason: 'Army not found' };
    }
    
    // Calculate combat effectiveness
    const effectiveness1 = this.calculateEffectiveness(army1, battle.terrain);
    const effectiveness2 = this.calculateEffectiveness(army2, battle.terrain);
    
    // Resolve combat
    const casualties1 = this.calculateCasualties(army1, army2, effectiveness2);
    const casualties2 = this.calculateCasualties(army2, army1, effectiveness1);
    
    army1.soldiers = army1.soldiers.slice(0, -casualties1);
    army2.soldiers = army2.soldiers.slice(0, -casualties2);
    
    army1.casualties += casualties1;
    army2.casualties += casualties2;
    
    // Update morale
    this.updateMorale(army1, casualties1, casualties2);
    this.updateMorale(army2, casualties2, casualties1);
    
    // Record round
    battle.rounds.push({
      round: battle.rounds.length + 1,
      casualties: {
        [army1.id]: casualties1,
        [army2.id]: casualties2
      },
      morale: {
        [army1.id]: army1.morale,
        [army2.id]: army2.morale
      }
    });
    
    // Check for battle end
    if (army1.morale <= 0.2 || army1.soldiers.length === 0) {
      battle.status = 'concluded';
      battle.victor = army2.id;
      army1.status = 'defeated';
      army2.status = 'victorious';
    } else if (army2.morale <= 0.2 || army2.soldiers.length === 0) {
      battle.status = 'concluded';
      battle.victor = army1.id;
      army2.status = 'defeated';
      army1.status = 'victorious';
    }
    
    return {
      success: true,
      round: battle.rounds[battle.rounds.length - 1],
      ongoing: battle.status === 'ongoing'
    };
  }

  calculateEffectiveness(army, terrain) {
    let effectiveness = 1.0;
    
    // Formation effectiveness
    if (army.formation) {
      effectiveness *= army.formation.offense;
    }
    
    // Morale affects effectiveness
    effectiveness *= army.morale;
    
    // Cohesion affects effectiveness
    effectiveness *= army.cohesion;
    
    // Terrain modifiers
    if (terrain === 'hills' && army.formation?.type === 'cavalry_charge') {
      effectiveness *= 0.7;
    } else if (terrain === 'forest' && army.formation?.type === 'phalanx') {
      effectiveness *= 0.6;
    } else if (terrain === 'plains' && army.formation?.type === 'cavalry_charge') {
      effectiveness *= 1.3;
    }
    
    return effectiveness;
  }

  calculateCasualties(defendingArmy, attackingArmy, attackerEffectiveness) {
    const baseRate = 0.05; // 5% per round
    
    let casualties = defendingArmy.soldiers.length * baseRate * attackerEffectiveness;
    
    // Defense reduces casualties
    if (defendingArmy.formation) {
      casualties *= (1 - defendingArmy.formation.defense * 0.5);
    }
    
    // Size advantage
    const sizeRatio = attackingArmy.soldiers.length / defendingArmy.soldiers.length;
    if (sizeRatio > 1.5) {
      casualties *= 1.3;
    }
    
    return Math.floor(casualties);
  }

  updateMorale(army, ownCasualties, enemyCasualties) {
    // Casualties reduce morale
    const casualtyRate = ownCasualties / army.soldiers.length;
    army.morale -= casualtyRate * 0.5;
    
    // Inflicting casualties boosts morale
    army.morale += (enemyCasualties / 100) * 0.1;
    
    // Commander skill affects morale
    // Would integrate with commander stats
    
    army.morale = Math.max(0, Math.min(1, army.morale));
  }

  startSiege(attackerId, defenderId, fortificationId) {
    const attacker = this.armies.get(attackerId);
    const defender = this.armies.get(defenderId);
    
    if (!attacker || !defender) {
      return { success: false, reason: 'Unknown army' };
    }
    
    const siege = {
      id: this.nextSiegeId++,
      attacker: attackerId,
      defender: defenderId,
      fortification: fortificationId,
      started: this.kernel?.turn ?? 0,
      duration: 0,
      breaches: [],
      assaults: [],
      status: 'ongoing',
      defenderSupplies: defender.supplies.food,
      attackerSupplies: attacker.supplies.food
    };
    
    this.sieges.set(siege.id, siege);
    
    attacker.status = 'besieging';
    defender.status = 'besieged';
    
    return {
      success: true,
      siege: siege
    };
  }

  updateSiege(siegeId, timeStep) {
    const siege = this.sieges.get(siegeId);
    if (!siege || siege.status !== 'ongoing') return;
    
    const attacker = this.armies.get(siege.attacker);
    const defender = this.armies.get(siege.defender);
    
    if (!attacker || !defender) return;
    
    siege.duration += timeStep;
    
    // Consume supplies
    const attackerConsumption = attacker.soldiers.length * 0.1 * timeStep;
    const defenderConsumption = defender.soldiers.length * 0.1 * timeStep;
    
    siege.attackerSupplies -= attackerConsumption;
    siege.defenderSupplies -= defenderConsumption;
    
    // Attrition from starvation
    if (siege.defenderSupplies <= 0) {
      const attrition = Math.floor(defender.soldiers.length * 0.05);
      defender.soldiers = defender.soldiers.slice(0, -attrition);
      defender.morale -= 0.1;
    }
    
    if (siege.attackerSupplies <= 0) {
      const attrition = Math.floor(attacker.soldiers.length * 0.03);
      attacker.soldiers = attacker.soldiers.slice(0, -attrition);
      attacker.morale -= 0.05;
    }
    
    // Check for siege end
    if (defender.morale <= 0.2 || defender.soldiers.length < 10) {
      siege.status = 'attacker_victory';
      siege.ended = this.kernel?.turn ?? 0;
      attacker.status = 'victorious';
      defender.status = 'defeated';
    } else if (attacker.morale <= 0.2 || attacker.soldiers.length < 50) {
      siege.status = 'defender_victory';
      siege.ended = this.kernel?.turn ?? 0;
      attacker.status = 'defeated';
      defender.status = 'ready';
    }
  }

  assault(siegeId) {
    const siege = this.sieges.get(siegeId);
    if (!siege || siege.status !== 'ongoing') {
      return { success: false, reason: 'Siege not ongoing' };
    }
    
    const attacker = this.armies.get(siege.attacker);
    const defender = this.armies.get(siege.defender);
    
    if (!attacker || !defender) {
      return { success: false, reason: 'Army not found' };
    }
    
    // Assault is costly for attacker
    const attackerCasualties = Math.floor(attacker.soldiers.length * 0.2);
    const defenderCasualties = Math.floor(defender.soldiers.length * 0.1);
    
    attacker.soldiers = attacker.soldiers.slice(0, -attackerCasualties);
    defender.soldiers = defender.soldiers.slice(0, -defenderCasualties);
    
    attacker.casualties += attackerCasualties;
    defender.casualties += defenderCasualties;
    
    // Check if assault succeeded
    const success = attacker.soldiers.length > defender.soldiers.length * 2;
    
    const assault = {
      timestamp: this.kernel?.turn ?? 0,
      attackerCasualties: attackerCasualties,
      defenderCasualties: defenderCasualties,
      success: success
    };
    
    siege.assaults.push(assault);
    
    if (success) {
      siege.status = 'attacker_victory';
      siege.ended = this.kernel?.turn ?? 0;
      attacker.status = 'victorious';
      defender.status = 'defeated';
    }
    
    return {
      success: true,
      assault: assault
    };
  }

  supplyArmy(armyId, supplies) {
    const army = this.armies.get(armyId);
    if (!army) {
      return { success: false, reason: 'Unknown army' };
    }
    
    army.supplies.food += supplies.food || 0;
    army.supplies.water += supplies.water || 0;
    army.supplies.ammunition += supplies.ammunition || 0;
    
    // Good supplies boost morale
    if (supplies.food > 0) {
      army.morale = Math.min(1, army.morale + 0.05);
    }
    
    return {
      success: true,
      supplies: army.supplies
    };
  }

  calculateSupplyNeeds(armyId, days) {
    const army = this.armies.get(armyId);
    if (!army) return null;
    
    return {
      food: army.soldiers.length * days,
      water: army.soldiers.length * days * 0.5,
      ammunition: army.soldiers.length * 2 * days
    };
  }

  march(armyId, destination, distance) {
    const army = this.armies.get(armyId);
    if (!army) {
      return { success: false, reason: 'Unknown army' };
    }
    
    // Calculate march time
    const speed = army.formation?.mobility || 0.5;
    const marchTime = distance / (speed * 20); // days
    
    // Consume supplies during march
    const foodNeeded = army.soldiers.length * marchTime;
    
    if (army.supplies.food < foodNeeded) {
      return {
        success: false,
        reason: 'Insufficient supplies for march'
      };
    }
    
    army.supplies.food -= foodNeeded;
    army.location = destination;
    
    // Marching affects morale and cohesion
    army.morale -= 0.05;
    army.cohesion -= 0.03;
    
    return {
      success: true,
      duration: marchTime,
      location: destination
    };
  }

  retreat(armyId, direction) {
    const army = this.armies.get(armyId);
    if (!army) {
      return { success: false, reason: 'Unknown army' };
    }
    
    army.status = 'retreating';
    
    // Retreating damages morale and cohesion
    army.morale -= 0.2;
    army.cohesion -= 0.3;
    
    // Casualties during retreat
    const casualties = Math.floor(army.soldiers.length * 0.1);
    army.soldiers = army.soldiers.slice(0, -casualties);
    army.casualties += casualties;
    
    return {
      success: true,
      casualties: casualties,
      morale: army.morale
    };
  }

  disband(armyId) {
    const army = this.armies.get(armyId);
    if (!army) {
      return { success: false, reason: 'Unknown army' };
    }
    
    army.status = 'disbanded';
    army.disbanded = this.kernel?.turn ?? 0;
    
    return {
      success: true,
      survivors: army.soldiers.length
    };
  }

  getArmy(id) {
    return this.armies.get(id);
  }

  getBattle(id) {
    return this.battles.get(id);
  }

  getSiege(id) {
    return this.sieges.get(id);
  }

  getActiveBattles() {
    return Array.from(this.battles.values())
      .filter(b => b.status === 'ongoing');
  }

  getActiveSieges() {
    return Array.from(this.sieges.values())
      .filter(s => s.status === 'ongoing');
  }

  getArmiesByCommander(commanderId) {
    return Array.from(this.armies.values())
      .filter(a => a.commander === commanderId);
  }

  getCasualties(armyId) {
    const army = this.armies.get(armyId);
    return army ? army.casualties : 0;
  }
}
