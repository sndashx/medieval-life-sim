/**
 * Natural World System
 * Handles weather, seasons, natural resources, decay, flora, fauna, and natural events
 * Foundation for all crafting and economy - everything comes from nature
 */

export class NaturalWorldSystem {
  constructor(kernel, game = null) {
    this.kernel = kernel;
    this.game = game;
    
    // Natural resources on the map
    this.resources = new Map(); // tileKey -> [resources]
    this.resourceNodes = new Map(); // nodeId -> ResourceNode
    
    // Flora (plants, trees)
    this.flora = new Map(); // floraId -> Flora
    this.floraByTile = new Map(); // tileKey -> [floraIds]
    
    // Fauna (animals)
    this.fauna = new Map(); // animalId -> Animal
    this.faunaByTile = new Map(); // tileKey -> [animalIds]
    
    // Weather and climate
    this.currentWeather = null;
    this.weatherHistory = [];
    this.seasonalEffects = new Map();
    
    // Decay tracking
    this.decayableItems = new Map(); // itemId -> DecayInfo
    
    // Natural events
    this.activeEvents = [];
    this.eventHistory = [];
    
    this.lastUpdate = this.kernel?.turn ?? 0;
  }

  /**
   * Initialize natural world for a tile
   */
  initializeTile(x, y, tile) {
    const tileKey = `${x},${y}`;
    
    // Generate natural resources based on biome and terrain
    this.generateResources(x, y, tile);
    
    // Generate flora
    this.generateFlora(x, y, tile);
    
    // Generate fauna
    this.generateFauna(x, y, tile);
  }

  /**
   * Generate natural resources on a tile
   */
  generateResources(x, y, tile) {
    const tileKey = `${x},${y}`;
    const resources = [];
    
    const biome = tile.biome?.type || 'grassland';
    const elevation = tile.terrain?.elevation || 100;
    const rainfall = tile.climate?.rainfall || 5;
    
    // Forest resources
    if (biome === 'forest') {
      resources.push(
        this.createResourceNode(x, y, 'wood', 'oak', 50 + this.kernel.rng.next() * 50),
        this.createResourceNode(x, y, 'wood', 'pine', 30 + this.kernel.rng.next() * 40),
        this.createResourceNode(x, y, 'herb', 'medicinal', 10 + this.kernel.rng.next() * 20),
        this.createResourceNode(x, y, 'berry', 'wild', 15 + this.kernel.rng.next() * 25)
      );
    }
    
    // Mountain resources
    if (elevation > 200) {
      resources.push(
        this.createResourceNode(x, y, 'stone', 'granite', 100 + this.kernel.rng.next() * 100),
        this.createResourceNode(x, y, 'ore', 'iron', 20 + this.kernel.rng.next() * 30),
        this.createResourceNode(x, y, 'ore', 'copper', 15 + this.kernel.rng.next() * 25)
      );
      
      if (elevation > 300 && this.kernel.rng.next() < 0.1) {
        resources.push(
          this.createResourceNode(x, y, 'ore', 'silver', 5 + this.kernel.rng.next() * 10)
        );
      }
      
      if (elevation > 400 && this.kernel.rng.next() < 0.05) {
        resources.push(
          this.createResourceNode(x, y, 'ore', 'gold', 2 + this.kernel.rng.next() * 5)
        );
      }
    }
    
    // Plains/Grassland resources
    if (biome === 'plains' || biome === 'grassland') {
      resources.push(
        this.createResourceNode(x, y, 'grass', 'wild', 80 + this.kernel.rng.next() * 40),
        this.createResourceNode(x, y, 'herb', 'cooking', 20 + this.kernel.rng.next() * 30),
        this.createResourceNode(x, y, 'clay', 'common', 30 + this.kernel.rng.next() * 40)
      );
      
      if (rainfall > 5) {
        resources.push(
          this.createResourceNode(x, y, 'grain', 'wild', 25 + this.kernel.rng.next() * 35)
        );
      }
    }
    
    // Water resources
    if (rainfall > 8 || tile.hasWater) {
      resources.push(
        this.createResourceNode(x, y, 'water', 'fresh', 1000),
        this.createResourceNode(x, y, 'fish', 'common', 10 + this.kernel.rng.next() * 20),
        this.createResourceNode(x, y, 'reed', 'common', 30 + this.kernel.rng.next() * 40)
      );
    }
    
    // Desert resources
    if (biome === 'desert') {
      resources.push(
        this.createResourceNode(x, y, 'sand', 'common', 200),
        this.createResourceNode(x, y, 'cactus', 'prickly', 5 + this.kernel.rng.next() * 10)
      );
      
      if (this.kernel.rng.next() < 0.3) {
        resources.push(
          this.createResourceNode(x, y, 'water', 'oasis', 50 + this.kernel.rng.next() * 50)
        );
      }
    }
    
    this.resources.set(tileKey, resources);
    
    for (const resource of resources) {
      this.resourceNodes.set(resource.id, resource);
    }
  }

  /**
   * Create a resource node
   */
  createResourceNode(x, y, type, subtype, quantity) {
    const nodeId = `resource_${x}_${y}_${type}_${subtype}_${this.kernel?.turn ?? 0}_${this.kernel.rng.next()}`;
    
    return {
      id: nodeId,
      x: x,
      y: y,
      type: type,
      subtype: subtype,
      quantity: quantity,
      maxQuantity: quantity,
      regenerationRate: this.getRegenerationRate(type, subtype),
      lastHarvest: null,
      depleted: false,
      quality: 0.5 + this.kernel.rng.next() * 0.5
    };
  }

  /**
   * Get regeneration rate for resource type
   */
  getRegenerationRate(type, subtype) {
    const rates = {
      'wood': 0.1, // 10% per day
      'herb': 0.3,
      'berry': 0.5,
      'grass': 0.8,
      'grain': 0.2,
      'fish': 0.4,
      'ore': 0.01, // Very slow
      'stone': 0.02,
      'water': 1.0, // Replenishes fully
      'clay': 0.05
    };
    
    return rates[type] || 0.1;
  }

  /**
   * Generate flora (plants, trees) on a tile
   */
  generateFlora(x, y, tile) {
    const tileKey = `${x},${y}`;
    const flora = [];
    
    const biome = tile.biome?.type || 'grassland';
    const elevation = tile.terrain?.elevation || 100;
    
    // Trees
    if (biome === 'forest') {
      const treeCount = 3 + Math.floor(this.kernel.rng.next() * 5);
      for (let i = 0; i < treeCount; i++) {
        flora.push(this.createFlora(x, y, 'tree', 'oak', 'mature'));
      }
    } else if (biome === 'plains' && this.kernel.rng.next() < 0.2) {
      flora.push(this.createFlora(x, y, 'tree', 'oak', 'young'));
    }
    
    // Bushes and shrubs
    if (biome !== 'desert' && biome !== 'tundra') {
      const bushCount = Math.floor(this.kernel.rng.next() * 3);
      for (let i = 0; i < bushCount; i++) {
        flora.push(this.createFlora(x, y, 'bush', 'berry', 'mature'));
      }
    }
    
    // Flowers and herbs
    if (biome === 'grassland' || biome === 'plains') {
      const herbCount = 1 + Math.floor(this.kernel.rng.next() * 4);
      for (let i = 0; i < herbCount; i++) {
        const herbType = this.kernel.rng.next() < 0.5 ? 'medicinal' : 'cooking';
        flora.push(this.createFlora(x, y, 'herb', herbType, 'mature'));
      }
    }
    
    // Mushrooms in forests
    if (biome === 'forest' && this.kernel.rng.next() < 0.3) {
      flora.push(this.createFlora(x, y, 'mushroom', 'edible', 'mature'));
    }
    
    this.floraByTile.set(tileKey, flora.map(f => f.id));
    
    for (const plant of flora) {
      this.flora.set(plant.id, plant);
    }
  }

  /**
   * Create flora entity
   */
  createFlora(x, y, type, subtype, growthStage) {
    const floraId = `flora_${x}_${y}_${type}_${this.kernel?.turn ?? 0}_${this.kernel.rng.next()}`;
    
    const growthStages = ['seed', 'sprout', 'young', 'mature', 'old'];
    const currentStageIndex = growthStages.indexOf(growthStage);
    
    return {
      id: floraId,
      x: x,
      y: y,
      type: type,
      subtype: subtype,
      growthStage: growthStage,
      growthProgress: currentStageIndex / growthStages.length,
      health: 1.0,
      age: 0,
      maxAge: this.getFloraMaxAge(type),
      harvestable: growthStage === 'mature' || growthStage === 'old',
      yield: this.getFloraYield(type, subtype, growthStage),
      lastHarvest: null,
      seasonalState: 'active' // active, dormant, dead
    };
  }

  /**
   * Get max age for flora type
   */
  getFloraMaxAge(type) {
    const ages = {
      'tree': 100 * 365, // 100 years in days
      'bush': 20 * 365,
      'herb': 2 * 365,
      'mushroom': 30, // 30 days
      'flower': 365
    };
    
    return ages[type] || 365;
  }

  /**
   * Get yield from flora
   */
  getFloraYield(type, subtype, growthStage) {
    if (growthStage !== 'mature' && growthStage !== 'old') {
      return [];
    }
    
    const yields = {
      'tree': [
        { type: 'wood', subtype: subtype, quantity: 10 + this.kernel.rng.next() * 20 },
        { type: 'branch', subtype: 'wood', quantity: 5 + this.kernel.rng.next() * 10 }
      ],
      'bush': [
        { type: 'berry', subtype: subtype, quantity: 3 + this.kernel.rng.next() * 7 }
      ],
      'herb': [
        { type: 'herb', subtype: subtype, quantity: 1 + this.kernel.rng.next() * 3 }
      ],
      'mushroom': [
        { type: 'mushroom', subtype: subtype, quantity: 1 + this.kernel.rng.next() * 2 }
      ]
    };
    
    return yields[type] || [];
  }

  /**
   * Generate fauna (animals) on a tile
   */
  generateFauna(x, y, tile) {
    const tileKey = `${x},${y}`;
    const fauna = [];
    
    const biome = tile.biome?.type || 'grassland';
    
    // Forest animals
    if (biome === 'forest') {
      if (this.kernel.rng.next() < 0.3) {
        fauna.push(this.createAnimal(x, y, 'deer', 'common'));
      }
      if (this.kernel.rng.next() < 0.2) {
        fauna.push(this.createAnimal(x, y, 'rabbit', 'common'));
      }
      if (this.kernel.rng.next() < 0.1) {
        fauna.push(this.createAnimal(x, y, 'boar', 'wild'));
      }
      if (this.kernel.rng.next() < 0.05) {
        fauna.push(this.createAnimal(x, y, 'wolf', 'grey'));
      }
    }
    
    // Plains animals
    if (biome === 'plains' || biome === 'grassland') {
      if (this.kernel.rng.next() < 0.2) {
        fauna.push(this.createAnimal(x, y, 'rabbit', 'common'));
      }
      if (this.kernel.rng.next() < 0.15) {
        fauna.push(this.createAnimal(x, y, 'fox', 'red'));
      }
    }
    
    // Mountain animals
    if (tile.terrain?.elevation > 200) {
      if (this.kernel.rng.next() < 0.1) {
        fauna.push(this.createAnimal(x, y, 'goat', 'mountain'));
      }
      if (this.kernel.rng.next() < 0.05) {
        fauna.push(this.createAnimal(x, y, 'eagle', 'golden'));
      }
    }
    
    this.faunaByTile.set(tileKey, fauna.map(a => a.id));
    
    for (const animal of fauna) {
      this.fauna.set(animal.id, animal);
    }
  }

  /**
   * Create animal entity
   */
  createAnimal(x, y, species, variant) {
    const animalId = `animal_${x}_${y}_${species}_${this.kernel?.turn ?? 0}_${this.kernel.rng.next()}`;
    
    const stats = this.getAnimalStats(species);
    
    return {
      id: animalId,
      x: x,
      y: y,
      species: species,
      variant: variant,
      age: this.kernel.rng.next() * stats.maxAge * 0.5, // Random age up to half max
      maxAge: stats.maxAge,
      health: 1.0,
      hunger: 0.5,
      fear: 0,
      aggressive: stats.aggressive,
      speed: stats.speed,
      size: stats.size,
      meatYield: stats.meatYield,
      hideYield: stats.hideYield,
      lastMove: this.kernel?.turn ?? 0,
      behavior: 'roaming' // roaming, fleeing, hunting, resting
    };
  }

  /**
   * Get animal statistics
   */
  getAnimalStats(species) {
    const stats = {
      'deer': {
        maxAge: 15 * 365,
        aggressive: false,
        speed: 3,
        size: 'medium',
        meatYield: 20,
        hideYield: 5
      },
      'rabbit': {
        maxAge: 5 * 365,
        aggressive: false,
        speed: 4,
        size: 'small',
        meatYield: 3,
        hideYield: 1
      },
      'boar': {
        maxAge: 10 * 365,
        aggressive: true,
        speed: 2,
        size: 'medium',
        meatYield: 25,
        hideYield: 4
      },
      'wolf': {
        maxAge: 12 * 365,
        aggressive: true,
        speed: 4,
        size: 'medium',
        meatYield: 15,
        hideYield: 6
      },
      'fox': {
        maxAge: 8 * 365,
        aggressive: false,
        speed: 3,
        size: 'small',
        meatYield: 5,
        hideYield: 3
      },
      'goat': {
        maxAge: 12 * 365,
        aggressive: false,
        speed: 2,
        size: 'medium',
        meatYield: 18,
        hideYield: 4
      },
      'eagle': {
        maxAge: 20 * 365,
        aggressive: false,
        speed: 5,
        size: 'small',
        meatYield: 2,
        hideYield: 0
      }
    };
    
    return stats[species] || stats['rabbit'];
  }

  /**
   * Harvest resource from a node
   */
  harvestResource(nodeId, amount = 1) {
    const node = this.resourceNodes.get(nodeId);
    if (!node) {
      return { success: false, reason: 'Resource not found' };
    }
    
    if (node.depleted) {
      return { success: false, reason: 'Resource depleted' };
    }
    
    const harvested = Math.min(amount, node.quantity);
    node.quantity -= harvested;
    node.lastHarvest = this.kernel?.turn ?? 0;
    
    if (node.quantity <= 0) {
      node.depleted = true;
    }
    
    return {
      success: true,
      type: node.type,
      subtype: node.subtype,
      quantity: harvested,
      quality: node.quality
    };
  }

  /**
   * Harvest flora
   */
  harvestFlora(floraId) {
    const plant = this.flora.get(floraId);
    if (!plant) {
      return { success: false, reason: 'Plant not found' };
    }
    
    if (!plant.harvestable) {
      return { success: false, reason: 'Plant not ready for harvest' };
    }
    
    const harvestYield = plant.yield;
    plant.lastHarvest = this.kernel?.turn ?? 0;
    plant.harvestable = false;

    // Some plants die after harvest
    if (plant.type === 'herb' || plant.type === 'mushroom') {
      plant.health = 0;
      plant.seasonalState = 'dead';
    } else {
      // Others can be harvested again
      plant.growthStage = 'young';
      plant.harvestable = false;
    }

    return {
      success: true,
      yield: harvestYield
    };
  }

  /**
   * Hunt animal
   */
  huntAnimal(animalId, hunterSkill = 0.5) {
    const animal = this.fauna.get(animalId);
    if (!animal) {
      return { success: false, reason: 'Animal not found' };
    }
    
    // Success chance based on hunter skill and animal speed
    const baseChance = 0.3 + (hunterSkill * 0.4);
    const speedPenalty = animal.speed * 0.1;
    const successChance = Math.max(0.1, baseChance - speedPenalty);
    
    if (this.kernel.rng.next() > successChance) {
      // Animal escapes
      animal.fear = 1.0;
      animal.behavior = 'fleeing';
      return { success: false, reason: 'Animal escaped' };
    }
    
    // Successful hunt
    const killYield = [
      { type: 'meat', subtype: animal.species, quantity: animal.meatYield },
      { type: 'hide', subtype: animal.species, quantity: animal.hideYield }
    ];
    
    // Remove animal
    this.fauna.delete(animalId);
    const tileKey = `${animal.x},${animal.y}`;
    const tileAnimals = this.faunaByTile.get(tileKey) || [];
    this.faunaByTile.set(tileKey, tileAnimals.filter(id => id !== animalId));
    
    return {
      success: true,
      yield: killYield,
      species: animal.species
    };
  }

  /**
   * Register item for decay tracking
   */
  registerDecayableItem(item, decayRate = 0.01) {
    if (!item.id) return;
    
    this.decayableItems.set(item.id, {
      item: item,
      decayRate: decayRate,
      condition: 1.0,
      lastUpdate: this.kernel?.turn ?? 0,
      decayType: this.getDecayType(item.type)
    });
  }

  /**
   * Get decay type for item
   */
  getDecayType(itemType) {
    const decayTypes = {
      'food': 'rot',
      'meat': 'rot',
      'fish': 'rot',
      'berry': 'rot',
      'wood': 'weathering',
      'leather': 'weathering',
      'hide': 'weathering',
      'metal': 'rust',
      'iron': 'rust',
      'tool': 'wear',
      'weapon': 'wear'
    };
    
    return decayTypes[itemType] || 'weathering';
  }

  /**
   * Update decay for all items
   */
  updateDecay(currentTime) {
    const timeDelta = (currentTime - this.lastUpdate) / (24 * 60 * 60 * 1000); // Days
    
    for (const [itemId, decayInfo] of this.decayableItems) {
      // Apply decay
      decayInfo.condition -= decayInfo.decayRate * timeDelta;
      decayInfo.lastUpdate = currentTime;
      
      // Item destroyed
      if (decayInfo.condition <= 0) {
        this.destroyItem(itemId, decayInfo.item);
        this.decayableItems.delete(itemId);
      }
    }
  }

  /**
   * Destroy decayed item
   */
  destroyItem(itemId, item) {
    // Remove from world/inventory
    if (this.game) {
      // Remove from ground items
      if (this.game.world && this.game.world.items) {
        for (const [tileKey, items] of this.game.world.items) {
          const index = items.findIndex(i => i.id === itemId);
          if (index !== -1) {
            items.splice(index, 1);
            break;
          }
        }
      }
    }
  }

  /**
   * Update natural world
   */
  update(currentTime) {
    const timeDelta = (currentTime - this.lastUpdate) / (24 * 60 * 60 * 1000); // Days
    
    // Regenerate resources
    for (const [nodeId, node] of this.resourceNodes) {
      if (node.depleted && node.lastHarvest) {
        const daysSinceHarvest = (currentTime - node.lastHarvest) / (24 * 60 * 60 * 1000);
        
        if (daysSinceHarvest > 7) { // Week to start regenerating
          node.quantity += node.maxQuantity * node.regenerationRate * timeDelta;
          
          if (node.quantity >= node.maxQuantity * 0.3) {
            node.depleted = false;
          }
          
          node.quantity = Math.min(node.quantity, node.maxQuantity);
        }
      }
    }
    
    // Grow flora
    for (const [floraId, plant] of this.flora) {
      if (plant.seasonalState === 'active') {
        plant.age += timeDelta;
        
        // Growth progression
        if (plant.growthStage !== 'mature' && plant.growthStage !== 'old') {
          plant.growthProgress += 0.01 * timeDelta;
          
          if (plant.growthProgress >= 0.75 && plant.growthStage !== 'mature') {
            plant.growthStage = 'mature';
            plant.harvestable = true;
            plant.yield = this.getFloraYield(plant.type, plant.subtype, 'mature');
          }
        }
        
        // Aging
        if (plant.age > plant.maxAge) {
          plant.health -= 0.1 * timeDelta;
          plant.growthStage = 'old';
          
          if (plant.health <= 0) {
            plant.seasonalState = 'dead';
          }
        }
      }
    }
    
    // Update fauna
    for (const [animalId, animal] of this.fauna) {
      animal.age += timeDelta;
      
      // Aging and death
      if (animal.age > animal.maxAge) {
        animal.health -= 0.1 * timeDelta;
        
        if (animal.health <= 0) {
          this.fauna.delete(animalId);
        }
      }
      
      // Hunger
      animal.hunger += 0.1 * timeDelta;
      if (animal.hunger > 1.0) {
        animal.health -= 0.05 * timeDelta;
      }
      
      // Fear decay
      animal.fear = Math.max(0, animal.fear - 0.2 * timeDelta);
      
      // Behavior
      if (animal.fear > 0.5) {
        animal.behavior = 'fleeing';
      } else if (animal.hunger > 0.7) {
        animal.behavior = 'hunting';
      } else {
        animal.behavior = 'roaming';
      }
    }
    
    // Update decay
    this.updateDecay(currentTime);
    
    this.lastUpdate = currentTime;
  }

  toJSON() {
    return {
      resources: Array.from(this.resources.entries()),
      resourceNodes: Array.from(this.resourceNodes.entries()),
      flora: Array.from(this.flora.entries()),
      floraByTile: Array.from(this.floraByTile.entries()),
      fauna: Array.from(this.fauna.entries()),
      faunaByTile: Array.from(this.faunaByTile.entries()),
      currentWeather: this.currentWeather,
      weatherHistory: this.weatherHistory,
      seasonalEffects: Array.from(this.seasonalEffects.entries()),
      decayableItems: Array.from(this.decayableItems.entries()),
      activeEvents: this.activeEvents,
      eventHistory: this.eventHistory,
      lastUpdate: this.lastUpdate
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.resources) this.resources = new Map(data.resources);
    if (data.resourceNodes) this.resourceNodes = new Map(data.resourceNodes);
    if (data.flora) this.flora = new Map(data.flora);
    if (data.floraByTile) this.floraByTile = new Map(data.floraByTile);
    if (data.fauna) this.fauna = new Map(data.fauna);
    if (data.faunaByTile) this.faunaByTile = new Map(data.faunaByTile);
    if (data.currentWeather !== undefined) this.currentWeather = data.currentWeather;
    if (data.weatherHistory) this.weatherHistory = data.weatherHistory;
    if (data.seasonalEffects) this.seasonalEffects = new Map(data.seasonalEffects);
    if (data.decayableItems) this.decayableItems = new Map(data.decayableItems);
    if (data.activeEvents) this.activeEvents = data.activeEvents;
    if (data.eventHistory) this.eventHistory = data.eventHistory;
    if (data.lastUpdate !== undefined) this.lastUpdate = data.lastUpdate;
  }
}
