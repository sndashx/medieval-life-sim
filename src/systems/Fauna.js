/**
 * Fauna.js
 * Animal behavior, needs, social structures, reproduction
 * Models species-appropriate perception, memory, territoriality
 */

export class Fauna {
  constructor(kernel, game = null) {
    this.kernel = kernel;
    this.game = game;
    this.world = (game && game.world) || null;
    this.animals = new Map(); // id -> animal
    this.species = this.initSpecies();
    this.nextId = 1;
  }

  initSpecies() {
    return {
      deer: {
        type: 'herbivore',
        size: 'large',
        mass: 80, // kg
        speed: 15, // m/s
        visionRange: 100,
        hearingRange: 200,
        smellRange: 50,
        socialStructure: 'herd',
        territorySize: 0,
        aggressionLevel: 0.1,
        flightDistance: 50,
        diet: ['grass', 'leaves', 'berries'],
        waterNeed: 5, // liters/day
        foodNeed: 3, // kg/day
        gestationPeriod: 200, // days
        litterSize: 1,
        maturityAge: 2, // years
        lifespan: 15
      },
      wolf: {
        type: 'carnivore',
        size: 'medium',
        mass: 40,
        speed: 18,
        visionRange: 150,
        hearingRange: 300,
        smellRange: 100,
        socialStructure: 'pack',
        territorySize: 1000, // hectares
        aggressionLevel: 0.7,
        flightDistance: 0,
        diet: ['deer', 'rabbit', 'carrion'],
        waterNeed: 3,
        foodNeed: 2,
        gestationPeriod: 63,
        litterSize: 5,
        maturityAge: 2,
        lifespan: 10
      },
      rabbit: {
        type: 'herbivore',
        size: 'small',
        mass: 2,
        speed: 10,
        visionRange: 80,
        hearingRange: 150,
        smellRange: 30,
        socialStructure: 'colony',
        territorySize: 1,
        aggressionLevel: 0.05,
        flightDistance: 30,
        diet: ['grass', 'vegetables'],
        waterNeed: 0.5,
        foodNeed: 0.3,
        gestationPeriod: 30,
        litterSize: 6,
        maturityAge: 0.5,
        lifespan: 5
      },
      chicken: {
        type: 'omnivore',
        size: 'small',
        mass: 2,
        speed: 3,
        visionRange: 50,
        hearingRange: 100,
        smellRange: 10,
        socialStructure: 'flock',
        territorySize: 0.1,
        aggressionLevel: 0.2,
        flightDistance: 10,
        diet: ['seeds', 'insects', 'grass'],
        waterNeed: 0.3,
        foodNeed: 0.1,
        gestationPeriod: 21,
        litterSize: 10,
        maturityAge: 0.5,
        lifespan: 8,
        domesticated: true
      },
      cow: {
        type: 'herbivore',
        size: 'large',
        mass: 600,
        speed: 8,
        visionRange: 100,
        hearingRange: 150,
        smellRange: 40,
        socialStructure: 'herd',
        territorySize: 0,
        aggressionLevel: 0.1,
        flightDistance: 20,
        diet: ['grass', 'hay'],
        waterNeed: 40,
        foodNeed: 20,
        gestationPeriod: 280,
        litterSize: 1,
        maturityAge: 2,
        lifespan: 20,
        domesticated: true,
        milkProduction: 20 // liters/day
      }
    };
  }

  update(kernel) {
    for (const [id, animal] of this.animals) {
      this.updateAnimal(animal, kernel);
    }
    
    // Reproduction
    this.checkReproduction(kernel);
    
    // Death from old age, starvation, predation
    this.checkMortality(kernel);
  }

  updateAnimal(animal, kernel) {
    const species = this.species[animal.species];
    if (!species) return;
    
    // Update needs
    animal.hunger += species.foodNeed / 1440; // per minute
    animal.thirst += species.waterNeed / 1440;
    animal.age += 1 / 525600; // per minute to years
    
    // Perception
    this.perceive(animal, species, kernel);
    
    // Decision making
    this.makeDecision(animal, species, kernel);
    
    // Execute current action
    this.executeAction(animal, species, kernel);
    
    // Social behavior
    this.updateSocialBehavior(animal, species, kernel);
  }

  perceive(animal, species, kernel) {
    animal.perceivedThreats = [];
    animal.perceivedFood = [];
    animal.perceivedMates = [];
    
    // Query nearby entities
    const nearby = kernel.queryEntitiesNear(
      animal.x, animal.y, animal.z,
      Math.max(species.visionRange, species.hearingRange, species.smellRange)
    );
    
    for (const entityId of nearby) {
      const entity = kernel.entities.get(entityId);
      if (!entity || entity.id === animal.id) continue;
      
      const distance = this.calculateDistance(animal, entity);
      
      // Visual detection
      if (distance <= species.visionRange) {
        if (this.isThreat(entity, species)) {
          animal.perceivedThreats.push({ entity, distance, sense: 'vision' });
        }
        if (this.isFood(entity, species)) {
          animal.perceivedFood.push({ entity, distance, sense: 'vision' });
        }
        if (this.isPotentialMate(entity, animal)) {
          animal.perceivedMates.push({ entity, distance, sense: 'vision' });
        }
      }
      
      // Auditory detection
      if (distance <= species.hearingRange) {
        if (entity.makingNoise) {
          animal.perceivedThreats.push({ entity, distance, sense: 'hearing' });
        }
      }
      
      // Olfactory detection
      if (distance <= species.smellRange) {
        if (this.isFood(entity, species)) {
          animal.perceivedFood.push({ entity, distance, sense: 'smell' });
        }
      }
    }
  }

  makeDecision(animal, species, kernel) {
    // Priority: survival > reproduction > comfort
    
    // Flee from threats
    if (animal.perceivedThreats.length > 0) {
      const closestThreat = animal.perceivedThreats.sort((a, b) => a.distance - b.distance)[0];
      if (closestThreat.distance < species.flightDistance) {
        animal.currentAction = {
          type: 'flee',
          target: closestThreat.entity,
          priority: 10
        };
        return;
      }
    }
    
    // Critical needs
    if (animal.hunger > 0.8) {
      if (animal.perceivedFood.length > 0) {
        const closestFood = animal.perceivedFood.sort((a, b) => a.distance - b.distance)[0];
        animal.currentAction = {
          type: 'eat',
          target: closestFood.entity,
          priority: 9
        };
        return;
      } else {
        animal.currentAction = {
          type: 'forage',
          priority: 9
        };
        return;
      }
    }
    
    if (animal.thirst > 0.8) {
      animal.currentAction = {
        type: 'drink',
        priority: 9
      };
      return;
    }
    
    // Reproduction
    if (animal.age >= species.maturityAge && !animal.pregnant && animal.perceivedMates.length > 0) {
      const mate = animal.perceivedMates[0];
      animal.currentAction = {
        type: 'mate',
        target: mate.entity,
        priority: 5
      };
      return;
    }
    
    // Social behavior
    if (species.socialStructure !== 'solitary') {
      animal.currentAction = {
        type: 'socialize',
        priority: 3
      };
      return;
    }
    
    // Default: wander
    animal.currentAction = {
      type: 'wander',
      priority: 1
    };
  }

  executeAction(animal, species, kernel) {
    if (!animal.currentAction) return;
    
    switch (animal.currentAction.type) {
      case 'flee':
        this.flee(animal, species, animal.currentAction.target);
        break;
      case 'eat':
        this.eat(animal, species, animal.currentAction.target, kernel);
        break;
      case 'forage':
        this.forage(animal, species, kernel);
        break;
      case 'drink':
        this.drink(animal, species, kernel);
        break;
      case 'mate':
        this.mate(animal, animal.currentAction.target, kernel);
        break;
      case 'wander':
        this.wander(animal, species);
        break;
    }
  }

  flee(animal, species, threat) {
    // Move away from threat
    const dx = animal.x - threat.position.x;
    const dy = animal.y - threat.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      animal.x += (dx / distance) * species.speed * 0.016; // per minute
      animal.y += (dy / distance) * species.speed * 0.016;
    }
    
    animal.fear = Math.min(1, animal.fear + 0.1);
  }

  eat(animal, species, food, kernel) {
    const distance = this.calculateDistance(animal, food);
    
    if (distance < 2) {
      // Consume food
      const consumed = Math.min(species.foodNeed, food.biomass || 1);
      animal.hunger = Math.max(0, animal.hunger - consumed / species.foodNeed);
      
      if (food.biomass) {
        food.biomass -= consumed;
        if (food.biomass <= 0) {
          kernel.removeEntity(food.id);
        }
      }
    } else {
      // Move toward food
      this.moveToward(animal, food, species.speed * 0.016);
    }
  }

  forage(animal, species, kernel) {
    // Look for food in environment
    const tile = this.world.getTile(Math.floor(animal.x), Math.floor(animal.y));
    if (!tile) return;
    
    // Check for vegetation
    if (species.diet.includes('grass') && tile.vegetation > 0) {
      const consumed = Math.min(species.foodNeed * 0.1, tile.vegetation);
      animal.hunger = Math.max(0, animal.hunger - consumed / species.foodNeed);
      tile.vegetation -= consumed;
    }
  }

  drink(animal, species, kernel) {
    const tile = this.world.getTile(Math.floor(animal.x), Math.floor(animal.y));
    if (!tile) return;
    
    // Check for water
    if (tile.hasWater) {
      animal.thirst = Math.max(0, animal.thirst - 0.1);
    } else {
      // Move toward water
      const waterLocation = this.findNearestWater(animal);
      if (waterLocation) {
        this.moveToward(animal, waterLocation, species.speed * 0.016);
      }
    }
  }

  mate(animal, mate, kernel) {
    const distance = this.calculateDistance(animal, mate);
    
    if (distance < 5 && !animal.pregnant && !mate.pregnant) {
      animal.pregnant = true;
      animal.gestationTimer = this.species[animal.species].gestationPeriod;
    }
  }

  wander(animal, species) {
    // Random walk
    const angle = this.kernel.random() * 2 * Math.PI;
    animal.x += Math.cos(angle) * species.speed * 0.016;
    animal.y += Math.sin(angle) * species.speed * 0.016;
  }

  updateSocialBehavior(animal, species, kernel) {
    if (species.socialStructure === 'solitary') return;
    
    // Find nearby same-species animals
    const nearby = this.findNearbyAnimals(animal, species, 50);
    
    if (species.socialStructure === 'herd' || species.socialStructure === 'flock') {
      // Cohesion: move toward group center
      if (nearby.length > 0) {
        const centerX = nearby.reduce((sum, a) => sum + a.x, 0) / nearby.length;
        const centerY = nearby.reduce((sum, a) => sum + a.y, 0) / nearby.length;
        
        const dx = centerX - animal.x;
        const dy = centerY - animal.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 10) {
          animal.x += (dx / distance) * species.speed * 0.008;
          animal.y += (dy / distance) * species.speed * 0.008;
        }
      }
    }
    
    if (species.socialStructure === 'pack') {
      // Pack hunting coordination
      if (animal.currentAction?.type === 'eat' && nearby.length > 0) {
        // Share target with pack
        for (const packMember of nearby) {
          if (!packMember.currentAction || packMember.currentAction.priority < 8) {
            packMember.currentAction = animal.currentAction;
          }
        }
      }
    }
  }

  checkReproduction(kernel) {
    for (const [id, animal] of this.animals) {
      if (!animal.pregnant) continue;
      
      animal.gestationTimer -= 1 / 1440; // per minute to days
      
      if (animal.gestationTimer <= 0) {
        const species = this.species[animal.species];
        this.giveBirth(animal, species, kernel);
      }
    }
  }

  giveBirth(animal, species, kernel) {
    for (let i = 0; i < species.litterSize; i++) {
      const offspring = {
        id: this.nextId++,
        species: animal.species,
        x: animal.x,
        y: animal.y,
        z: animal.z,
        age: 0,
        hunger: 0.5,
        thirst: 0.5,
        fear: 0,
        pregnant: false,
        currentAction: null,
        perceivedThreats: [],
        perceivedFood: [],
        perceivedMates: []
      };
      
      this.animals.set(offspring.id, offspring);
    }
    
    animal.pregnant = false;
    animal.gestationTimer = 0;
  }

  checkMortality(kernel) {
    const toRemove = [];
    
    for (const [id, animal] of this.animals) {
      const species = this.species[animal.species];
      
      // Old age
      if (animal.age > species.lifespan) {
        toRemove.push(id);
        continue;
      }
      
      // Starvation
      if (animal.hunger > 1.0) {
        toRemove.push(id);
        continue;
      }
      
      // Dehydration
      if (animal.thirst > 1.0) {
        toRemove.push(id);
        continue;
      }
    }
    
    for (const id of toRemove) {
      this.animals.delete(id);
    }
  }

  isThreat(entity, species) {
    if (!entity.species) return false;
    const entitySpecies = this.species[entity.species];
    if (!entitySpecies) return false;
    
    return entitySpecies.type === 'carnivore' && species.type === 'herbivore';
  }

  isFood(entity, species) {
    if (!entity.species) return false;
    return species.diet.includes(entity.species);
  }

  isPotentialMate(entity, animal) {
    return entity.species === animal.species && 
           entity.id !== animal.id &&
           entity.age >= this.species[entity.species].maturityAge;
  }

  calculateDistance(a, b) {
    return Math.sqrt(
      Math.pow(a.x - b.x, 2) +
      Math.pow(a.y - b.y, 2)
    );
  }

  moveToward(animal, target, speed) {
    const dx = target.x - animal.x;
    const dy = target.y - animal.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 0) {
      animal.x += (dx / distance) * speed;
      animal.y += (dy / distance) * speed;
    }
  }

  findNearbyAnimals(animal, species, radius) {
    const nearby = [];
    
    for (const [id, other] of this.animals) {
      if (other.id === animal.id) continue;
      if (other.species !== animal.species) continue;
      
      const distance = this.calculateDistance(animal, other);
      if (distance <= radius) {
        nearby.push(other);
      }
    }
    
    return nearby;
  }

  findNearestWater(animal) {
    // Simplified: check nearby tiles for water
    for (let dx = -10; dx <= 10; dx++) {
      for (let dy = -10; dy <= 10; dy++) {
        const tile = this.world.getTile(
          Math.floor(animal.x + dx),
          Math.floor(animal.y + dy)
        );
        
        if (tile?.hasWater) {
          return { x: animal.x + dx, y: animal.y + dy };
        }
      }
    }
    
    return null;
  }

  spawnAnimal(species, x, y) {
    const spec = this.species[species];
    if (!spec) return null;

    const animal = {
      id: this.nextId++,
      species: species,
      x: x,
      y: y,
      z: 0,
      age: spec.maturityAge,
      hunger: 0.5,
      thirst: 0.5,
      fear: 0,
      pregnant: false,
      currentAction: null,
      perceivedThreats: [],
      perceivedFood: [],
      perceivedMates: []
    };

    this.animals.set(animal.id, animal);
    return animal;
  }

  toJSON() {
    return {
      animals: Array.from(this.animals.entries()),
      nextId: this.nextId
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.animals) this.animals = new Map(data.animals);
    if (typeof data.nextId === 'number') this.nextId = data.nextId;
  }
}
