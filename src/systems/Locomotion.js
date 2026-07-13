/**
 * Locomotion.js
 * Movement, posture, balance, climbing, swimming, carrying
 * Couples to terrain, load, fatigue, injury, skill
 */

export class Locomotion {
  constructor(character) {
    this.character = character;
    this.posture = 'standing'; // standing, sitting, crouching, prone, climbing
    this.balance = 1.0;
    this.gait = 'walk'; // walk, run, sprint, crawl
    this.carrying = [];
    this.maxCarryWeight = this.calculateMaxCarry();
  }

  calculateMaxCarry() {
    const strength = this.character.physiology.getHealthStatus().strength;
    const baseWeight = this.character.genetics.baseWeight;
    return baseWeight * strength * 0.5; // Can carry ~50% body weight
  }

  move(direction, distance, terrain, kernel) {
    const health = this.character.physiology.getHealthStatus();
    
    // Check if can move
    if (health.mobility < 0.3) {
      return { success: false, reason: 'Too injured to move' };
    }
    
    if (this.character.physiology.fatigue > 0.9) {
      return { success: false, reason: 'Too exhausted to move' };
    }
    
    // Calculate movement speed
    const baseSpeed = this.getBaseSpeed();
    const terrainModifier = this.getTerrainModifier(terrain);
    const loadModifier = this.getLoadModifier();
    const healthModifier = health.mobility;
    
    const effectiveSpeed = baseSpeed * terrainModifier * loadModifier * healthModifier;
    const timeRequired = distance / effectiveSpeed; // minutes
    
    // Calculate energy cost
    const energyCost = this.calculateEnergyCost(distance, terrain, this.gait);
    
    // Apply effects
    this.character.physiology.metabolism.energyStores -= energyCost;
    this.character.physiology.fatigue += timeRequired * 0.001;
    
    // Check for falls on difficult terrain
    if (terrain.slope > 30 && kernel.random() < 0.1) {
      return this.fall(terrain.slope, kernel);
    }
    
    return {
      success: true,
      timeRequired: timeRequired,
      energyCost: energyCost,
      position: this.calculateNewPosition(direction, distance)
    };
  }

  getBaseSpeed() {
    const speeds = {
      crawl: 0.5, // m/s
      walk: 1.4,
      run: 4.0,
      sprint: 6.0
    };
    return speeds[this.gait] || 1.4;
  }

  getTerrainModifier(terrain) {
    const modifiers = {
      road: 1.0,
      grass: 0.9,
      forest: 0.6,
      marsh: 0.4,
      mountain: 0.3,
      water: 0.2
    };
    
    let modifier = modifiers[terrain.type] || 0.8;
    
    // Slope penalty
    if (terrain.slope > 10) {
      modifier *= Math.max(0.3, 1 - terrain.slope / 100);
    }
    
    return modifier;
  }

  getLoadModifier() {
    const currentLoad = this.carrying.reduce((sum, item) => sum + item.mass, 0);
    const ratio = currentLoad / this.maxCarryWeight;
    
    if (ratio < 0.5) return 1.0;
    if (ratio < 0.8) return 0.8;
    if (ratio < 1.0) return 0.6;
    return 0.4; // Overloaded
  }

  calculateEnergyCost(distance, terrain, gait) {
    const baseCost = {
      crawl: 3, // kcal per km
      walk: 50,
      run: 100,
      sprint: 150
    };
    
    const cost = baseCost[gait] || 50;
    const terrainMultiplier = terrain.slope > 10 ? 1 + terrain.slope / 50 : 1;
    const loadMultiplier = 1 + this.getLoadModifier();
    
    return (cost * distance / 1000) * terrainMultiplier * loadMultiplier;
  }

  climb(height, surface) {
    const health = this.character.physiology.getHealthStatus();
    const skill = this.character.skills.physical.agility;
    
    // Check if can climb
    if (health.strength < 0.4) {
      return { success: false, reason: 'Too weak to climb' };
    }
    
    // Calculate success chance
    const difficulty = this.getClimbDifficulty(surface);
    const successChance = skill * health.strength * (1 - difficulty);
    
    if (kernel.random() > successChance) {
      return this.fall(height, kernel);
    }
    
    // Calculate time and energy
    const climbSpeed = 0.3 * skill * health.strength; // m/s
    const timeRequired = height / climbSpeed / 60; // minutes
    const energyCost = height * 10; // kcal per meter
    
    this.character.physiology.metabolism.energyStores -= energyCost;
    this.character.physiology.fatigue += timeRequired * 0.01;
    this.posture = 'climbing';
    
    return {
      success: true,
      timeRequired: timeRequired,
      energyCost: energyCost
    };
  }

  getClimbDifficulty(surface) {
    const difficulties = {
      ladder: 0.1,
      rope: 0.3,
      tree: 0.4,
      rock: 0.6,
      wall: 0.7,
      cliff: 0.9
    };
    return difficulties[surface] || 0.5;
  }

  swim(distance, waterConditions) {
    const health = this.character.physiology.getHealthStatus();
    const skill = this.character.skills.survival.swimming || 0.1;
    
    // Check if can swim
    if (skill < 0.1) {
      return { success: false, reason: 'Cannot swim', drowning: true };
    }
    
    // Calculate swim speed
    const baseSpeed = 0.5 * skill * health.strength; // m/s
    const currentModifier = waterConditions.current || 0;
    const effectiveSpeed = baseSpeed - currentModifier;
    
    if (effectiveSpeed <= 0) {
      return { success: false, reason: 'Current too strong', drowning: true };
    }
    
    const timeRequired = distance / effectiveSpeed / 60; // minutes
    const energyCost = distance * 20; // kcal per meter (swimming is exhausting)
    
    // Check for drowning
    if (this.character.physiology.fatigue > 0.8) {
      return { success: false, reason: 'Too exhausted', drowning: true };
    }
    
    this.character.physiology.metabolism.energyStores -= energyCost;
    this.character.physiology.fatigue += timeRequired * 0.02;
    this.character.physiology.bodyTemperature -= waterConditions.temperature < 20 ? 0.5 : 0;
    
    return {
      success: true,
      timeRequired: timeRequired,
      energyCost: energyCost
    };
  }

  fall(height, kernel = null) {
    const velocity = Math.sqrt(2 * 9.81 * height);
    const impactEnergy = 0.5 * this.character.genetics.baseWeight * velocity * velocity;
    const rng = kernel?.random?.() ? kernel.random.bind(kernel) : Math.random;
    
    // Determine injury location
    const locations = ['leftLeg', 'rightLeg', 'torso', 'head'];
    const location = locations[Math.floor(rng() * locations.length)];
    
    // Calculate injury severity
    const severity = Math.min(1, impactEnergy / 5000);
    
    const injury = {
      location: location,
      severity: severity,
      bleeding: severity > 0.5 ? severity * 0.1 : 0,
      fractured: severity > 0.3 && rng() < 0.5,
      open: severity > 0.6,
      infected: false
    };
    
    this.character.physiology.applyInjury(injury);
    this.posture = 'prone';
    
    return {
      success: false,
      reason: 'Fell',
      height: height,
      injury: injury
    };
  }

  changePosture(newPosture) {
    const validTransitions = {
      standing: ['sitting', 'crouching', 'prone'],
      sitting: ['standing', 'prone'],
      crouching: ['standing', 'prone'],
      prone: ['sitting', 'crouching'],
      climbing: ['standing', 'prone']
    };
    
    if (!validTransitions[this.posture]?.includes(newPosture)) {
      return { success: false, reason: 'Invalid posture transition' };
    }
    
    this.posture = newPosture;
    return { success: true };
  }

  changeGait(newGait) {
    const validGaits = ['walk', 'run', 'sprint', 'crawl'];
    
    if (!validGaits.includes(newGait)) {
      return { success: false, reason: 'Invalid gait' };
    }
    
    // Check if can run/sprint
    if ((newGait === 'run' || newGait === 'sprint') && this.posture !== 'standing') {
      return { success: false, reason: 'Must be standing to run' };
    }
    
    const health = this.character.physiology.getHealthStatus();
    if (newGait === 'sprint' && health.strength < 0.5) {
      return { success: false, reason: 'Too weak to sprint' };
    }
    
    this.gait = newGait;
    return { success: true };
  }

  pickUp(item) {
    const currentLoad = this.carrying.reduce((sum, i) => sum + i.mass, 0);
    
    if (currentLoad + item.mass > this.maxCarryWeight) {
      return { success: false, reason: 'Too heavy to carry' };
    }
    
    if (this.posture !== 'standing' && this.posture !== 'crouching') {
      return { success: false, reason: 'Cannot pick up from this posture' };
    }
    
    this.carrying.push(item);
    return { success: true };
  }

  drop(item) {
    const index = this.carrying.indexOf(item);
    if (index === -1) {
      return { success: false, reason: 'Not carrying this item' };
    }
    
    this.carrying.splice(index, 1);
    return { success: true };
  }

  calculateNewPosition(direction, distance) {
    const pos = this.character.position;
    const directions = {
      north: { x: 0, y: -1 },
      south: { x: 0, y: 1 },
      east: { x: 1, y: 0 },
      west: { x: -1, y: 0 }
    };
    
    const dir = directions[direction] || { x: 0, y: 0 };
    return {
      x: pos.x + dir.x * distance,
      y: pos.y + dir.y * distance,
      z: pos.z
    };
  }

  getMovementCapabilities() {
    const health = this.character.physiology.getHealthStatus();
    
    return {
      canWalk: health.mobility > 0.3,
      canRun: health.mobility > 0.6 && health.strength > 0.5,
      canSprint: health.mobility > 0.8 && health.strength > 0.7,
      canClimb: health.strength > 0.4,
      canSwim: this.character.skills.survival.swimming > 0.1,
      canCrawl: health.mobility > 0.1,
      maxCarryWeight: this.maxCarryWeight,
      currentLoad: this.carrying.reduce((sum, i) => sum + i.mass, 0)
    };
  }
}
