/**
 * Perception.js
 * Bounded perception system - vision, hearing, smell, attention
 * Characters only know what they can perceive, not world truth
 */

export class Perception {
  constructor(character) {
    this.character = character;
    this.vision = new Vision(character);
    this.hearing = new Hearing(character);
    this.smell = new Smell(character);
    this.attention = new Attention(character);
    this.recentObservations = [];
    this.maxObservations = 100;
  }

  perceive(kernel, world) {
    const observations = [];
    
    // Visual perception
    const visible = this.vision.perceive(kernel, world);
    observations.push(...visible);
    
    // Auditory perception
    const audible = this.hearing.perceive(kernel, world);
    observations.push(...audible);
    
    // Olfactory perception
    const smells = this.smell.perceive(kernel, world);
    observations.push(...smells);
    
    // Filter by attention
    const attended = this.attention.filter(observations);
    
    // Store recent observations
    this.recentObservations.push(...attended);
    if (this.recentObservations.length > this.maxObservations) {
      this.recentObservations = this.recentObservations.slice(-this.maxObservations);
    }
    
    return attended;
  }

  canSee(target, kernel, world) {
    return this.vision.canSee(target, kernel, world);
  }

  canHear(source, kernel) {
    return this.hearing.canHear(source, kernel);
  }

  getRecentObservations(type = null, maxAge = 60) {
    const now = kernel.turn;
    return this.recentObservations.filter(obs => {
      const ageMatch = (now - obs.turn) <= maxAge;
      const typeMatch = !type || obs.type === type;
      return ageMatch && typeMatch;
    });
  }
}

export class Vision {
  constructor(character) {
    this.character = character;
    this.acuity = 1.0; // 0-1, affected by age, injury, disease
    this.fieldOfView = 180; // degrees
    this.maxRange = 1000; // meters in ideal conditions
    this.colorVision = true;
    this.nightVision = 0.1; // reduced capability at night
  }

  perceive(kernel, world) {
    const observations = [];
    const pos = this.character.position;
    const health = this.character.physiology.getHealthStatus();
    
    // Adjust acuity based on health
    const effectiveAcuity = this.acuity * health.cognition;
    
    // Get lighting conditions
    const timeOfDay = kernel.worldTime.getTimeOfDay();
    const lighting = this.getLightingFactor(timeOfDay, world, pos);
    
    // Get weather conditions
    const tile = world.getTile(pos.x, pos.y);
    const weather = tile?.climate?.rainfall > 5 ? 'rain' : 'clear';
    const visibility = this.getVisibilityRange(lighting, weather);
    
    // Query nearby entities
    const nearby = kernel.queryEntitiesNear(pos.x, pos.y, pos.z, visibility);
    
    for (const entityId of nearby) {
      const entity = kernel.entities.get(entityId);
      if (!entity || entity.id === this.character.id) continue;
      
      const distance = this.calculateDistance(pos, entity.position);
      const isVisible = this.canSee(entity, kernel, world);
      
      if (isVisible) {
        const detail = this.getDetailLevel(distance, effectiveAcuity, lighting);
        observations.push({
          type: 'visual',
          entity: entity,
          distance: distance,
          detail: detail,
          turn: kernel.turn,
          certainty: this.calculateCertainty(distance, lighting, effectiveAcuity)
        });
      }
    }
    
    return observations;
  }

  canSee(target, kernel, world) {
    const pos = this.character.position;
    const targetPos = target.position;
    const distance = this.calculateDistance(pos, targetPos);
    
    // Check range
    const timeOfDay = kernel.worldTime.getTimeOfDay();
    const lighting = this.getLightingFactor(timeOfDay, world, pos);
    const visibility = this.getVisibilityRange(lighting, 'clear');
    
    if (distance > visibility) return false;
    
    // Check occlusion (simplified - check terrain elevation)
    const occluded = this.checkOcclusion(pos, targetPos, world);
    if (occluded) return false;
    
    // Check field of view (simplified - assume looking forward)
    return true;
  }

  getLightingFactor(timeOfDay, world, pos) {
    if (timeOfDay === 'night') return this.nightVision;
    if (timeOfDay === 'evening' || timeOfDay === 'morning') return 0.5;
    return 1.0;
  }

  getVisibilityRange(lighting, weather) {
    let range = this.maxRange * lighting;
    
    if (weather === 'fog') range = Math.min(range, 50);
    else if (weather === 'rain') range = Math.min(range, 200);
    else if (weather === 'snow') range = Math.min(range, 100);
    
    return range;
  }

  checkOcclusion(from, to, world) {
    // Simplified line-of-sight check using terrain elevation
    const steps = 10;
    const dx = (to.x - from.x) / steps;
    const dy = (to.y - from.y) / steps;
    
    for (let i = 1; i < steps; i++) {
      const x = Math.floor(from.x + dx * i);
      const y = Math.floor(from.y + dy * i);
      const tile = world.getTile(x, y);
      
      if (tile && tile.terrain.elevation > Math.max(from.z, to.z) + 2) {
        return true; // Occluded by terrain
      }
    }
    
    return false;
  }

  getDetailLevel(distance, acuity, lighting) {
    const effectiveDistance = distance / (acuity * lighting);
    
    if (effectiveDistance < 10) return 'high'; // Can see facial features
    if (effectiveDistance < 50) return 'medium'; // Can identify person
    if (effectiveDistance < 200) return 'low'; // Can see movement
    return 'minimal'; // Just a shape
  }

  calculateDistance(pos1, pos2) {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
      Math.pow(pos1.y - pos2.y, 2) +
      Math.pow(pos1.z - pos2.z, 2)
    );
  }

  calculateCertainty(distance, lighting, acuity) {
    const baseCertainty = 1.0;
    const distancePenalty = Math.min(0.5, distance / 100);
    const lightingPenalty = (1 - lighting) * 0.3;
    const acuityPenalty = (1 - acuity) * 0.2;
    
    return Math.max(0.1, baseCertainty - distancePenalty - lightingPenalty - acuityPenalty);
  }
}

export class Hearing {
  constructor(character) {
    this.character = character;
    this.acuity = 1.0; // 0-1, affected by age, injury
    this.maxRange = 100; // meters for normal conversation
    this.frequencyRange = { min: 20, max: 20000 }; // Hz
  }

  perceive(kernel, world) {
    const observations = [];
    const pos = this.character.position;
    
    // Query nearby entities that might make sound
    const nearby = kernel.queryEntitiesNear(pos.x, pos.y, pos.z, this.maxRange * 2);
    
    for (const entityId of nearby) {
      const entity = kernel.entities.get(entityId);
      if (!entity || entity.id === this.character.id) continue;
      
      // Check if entity is making sound
      const sounds = this.getEntitySounds(entity);
      
      for (const sound of sounds) {
        const distance = this.calculateDistance(pos, entity.position);
        const audible = this.canHear(sound, distance);
        
        if (audible) {
          observations.push({
            type: 'auditory',
            source: entity,
            sound: sound,
            distance: distance,
            direction: this.getDirection(pos, entity.position),
            turn: kernel.turn,
            certainty: this.calculateCertainty(distance, sound.volume)
          });
        }
      }
    }
    
    return observations;
  }

  canHear(sound, distance) {
    // Sound attenuation with distance
    const attenuatedVolume = sound.volume - 20 * Math.log10(distance);
    const threshold = 0; // dB SPL hearing threshold
    
    return attenuatedVolume > threshold;
  }

  getEntitySounds(entity) {
    const sounds = [];
    
    // Movement sounds
    if (entity.currentAction?.type === 'move') {
      sounds.push({ type: 'footsteps', volume: 40, frequency: 500 });
    }
    
    // Combat sounds
    if (entity.currentAction?.type === 'attack') {
      sounds.push({ type: 'combat', volume: 70, frequency: 1000 });
    }
    
    // Speech
    if (entity.currentAction?.type === 'talk') {
      sounds.push({ type: 'speech', volume: 60, frequency: 500 });
    }
    
    // Pain/injury sounds
    if (entity.physiology?.pain > 5) {
      sounds.push({ type: 'pain', volume: 50, frequency: 800 });
    }
    
    return sounds;
  }

  getDirection(from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;
    
    if (angle > -45 && angle <= 45) return 'east';
    if (angle > 45 && angle <= 135) return 'south';
    if (angle > 135 || angle <= -135) return 'west';
    return 'north';
  }

  calculateDistance(pos1, pos2) {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
      Math.pow(pos1.y - pos2.y, 2)
    );
  }

  calculateCertainty(distance, volume) {
    const signalToNoise = volume - 20 * Math.log10(distance);
    return Math.max(0.1, Math.min(1.0, signalToNoise / 60));
  }
}

export class Smell {
  constructor(character) {
    this.character = character;
    this.acuity = 1.0;
    this.maxRange = 50; // meters for strong smells
  }

  perceive(kernel, world) {
    const observations = [];
    const pos = this.character.position;
    
    // Check for nearby smell sources
    const nearby = kernel.queryEntitiesNear(pos.x, pos.y, pos.z, this.maxRange);
    
    for (const entityId of nearby) {
      const entity = kernel.entities.get(entityId);
      if (!entity) continue;
      
      const smells = this.getEntitySmells(entity);
      
      for (const smell of smells) {
        const distance = this.calculateDistance(pos, entity.position);
        const detectable = distance <= this.maxRange * smell.strength;
        
        if (detectable) {
          observations.push({
            type: 'olfactory',
            source: entity,
            smell: smell.type,
            intensity: smell.strength * (1 - distance / this.maxRange),
            turn: kernel.turn
          });
        }
      }
    }
    
    return observations;
  }

  getEntitySmells(entity) {
    const smells = [];
    
    // Fire/smoke
    if (entity.type === 'fire') {
      smells.push({ type: 'smoke', strength: 1.0 });
    }
    
    // Food
    if (entity.type === 'food') {
      smells.push({ type: 'food', strength: 0.5 });
    }
    
    // Decay
    if (entity.alive === false && entity.deathTurn) {
      const daysSinceDeath = (this.kernel?.turn ?? 0 - entity.deathTurn) / 1440;
      if (daysSinceDeath > 1) {
        smells.push({ type: 'decay', strength: Math.min(1.0, daysSinceDeath / 7) });
      }
    }
    
    // Blood
    if (entity.physiology?.injuries?.length > 0) {
      const bleeding = entity.physiology.injuries.some(i => i.bleeding > 0);
      if (bleeding) {
        smells.push({ type: 'blood', strength: 0.3 });
      }
    }
    
    return smells;
  }

  calculateDistance(pos1, pos2) {
    return Math.sqrt(
      Math.pow(pos1.x - pos2.x, 2) +
      Math.pow(pos1.y - pos2.y, 2)
    );
  }
}

export class Attention {
  constructor(character) {
    this.character = character;
    this.capacity = 7; // Miller's law: 7±2 items
    this.priorities = {
      threat: 10,
      pain: 9,
      hunger: 7,
      social: 6,
      novelty: 5,
      routine: 2
    };
  }

  filter(observations) {
    // Sort by priority
    const prioritized = observations.map(obs => ({
      ...obs,
      priority: this.calculatePriority(obs)
    })).sort((a, b) => b.priority - a.priority);
    
    // Return top items within attention capacity
    return prioritized.slice(0, this.capacity);
  }

  calculatePriority(observation) {
    let priority = 0;
    
    // Type-based priority
    if (observation.type === 'visual') {
      if (observation.entity?.currentAction?.type === 'attack') {
        priority += this.priorities.threat;
      }
    }
    
    if (observation.type === 'auditory') {
      if (observation.sound?.type === 'combat') {
        priority += this.priorities.threat;
      }
    }
    
    // Distance affects priority (closer = higher)
    if (observation.distance) {
      priority += Math.max(0, 10 - observation.distance / 10);
    }
    
    // Novelty (haven't seen recently)
    const recent = this.character.memory?.recall({ entity: observation.entity?.id });
    if (!recent || recent.length === 0) {
      priority += this.priorities.novelty;
    }
    
    return priority;
  }
}
