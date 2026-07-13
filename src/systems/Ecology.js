/**
 * Ecology.js
 * Energy flows, carrying capacity, population dynamics, food webs
 * Models trophic levels, biomass, resource competition
 */

export class Ecology {
  constructor(world, kernel = null) {
    this.world = world || null;
    this.kernel = kernel;
    this.game = (kernel && typeof kernel.turn !== 'undefined' && kernel.rng) ? null : (kernel || null);
    this.trophicLevels = this.initTrophicLevels();
    this.energyEfficiency = 0.1; // 10% energy transfer between levels
    this.carryingCapacities = new Map();
  }

  setWorld(world) {
    this.world = world;
  }

  initTrophicLevels() {
    return {
      producers: [], // Plants, algae
      primaryConsumers: [], // Herbivores
      secondaryConsumers: [], // Carnivores
      tertiaryConsumers: [], // Apex predators
      decomposers: [] // Fungi, bacteria
    };
  }

  update(kernel) {
    if (!this.world) return;
    // Update energy flows
    this.updateEnergyFlows(kernel);
    
    // Update carrying capacities
    this.updateCarryingCapacities(kernel);
    
    // Check population pressures
    this.checkPopulationPressures(kernel);
    
    // Update decomposition
    this.updateDecomposition(kernel);
  }

  updateEnergyFlows(kernel) {
    // Solar energy input (primary production)
    const solarEnergy = this.calculateSolarEnergy(kernel);
    
    // Distribute to producers
    for (const producer of this.trophicLevels.producers) {
      const tile = this.world.getTile(producer.x, producer.y);
      if (!tile) continue;
      
      const photosynthesis = this.calculatePhotosynthesis(
        solarEnergy,
        tile.climate.temperature,
        tile.climate.rainfall,
        tile.terrain.soilQuality
      );
      
      producer.biomass += photosynthesis * this.energyEfficiency;
    }
    
    // Energy transfer through trophic levels
    this.transferEnergy('primaryConsumers', 'producers', kernel);
    this.transferEnergy('secondaryConsumers', 'primaryConsumers', kernel);
    this.transferEnergy('tertiaryConsumers', 'secondaryConsumers', kernel);
  }

  calculateSolarEnergy(kernel) {
    const timeOfDay = kernel.worldTime.getTimeOfDay();
    const season = kernel.worldTime.getSeason();
    
    let energy = 1000; // W/m² base
    
    if (timeOfDay === 'night') energy = 0;
    else if (timeOfDay === 'morning' || timeOfDay === 'evening') energy *= 0.5;
    
    if (season === 'winter') energy *= 0.6;
    else if (season === 'summer') energy *= 1.2;
    
    return energy;
  }

  calculatePhotosynthesis(light, temperature, water, soilQuality) {
    // Simplified photosynthesis model
    let rate = 1.0;
    
    // Light response curve
    const lightFactor = Math.min(1, light / 1000);
    
    // Temperature response (optimal 20-30°C)
    let tempFactor = 0;
    if (temperature >= 5 && temperature <= 40) {
      tempFactor = 1 - Math.abs(temperature - 25) / 25;
    }
    
    // Water availability
    const waterFactor = Math.min(1, water / 100);
    
    // Soil quality
    const soilFactor = soilQuality;
    
    rate = lightFactor * tempFactor * waterFactor * soilFactor;
    return rate * 10; // g biomass per m² per day
  }

  transferEnergy(consumerLevel, preyLevel, kernel) {
    const consumers = this.trophicLevels[consumerLevel];
    const prey = this.trophicLevels[preyLevel];
    
    for (const consumer of consumers) {
      // Find nearby prey
      const nearbyPrey = prey.filter(p => {
        const distance = Math.sqrt(
          Math.pow(consumer.x - p.x, 2) +
          Math.pow(consumer.y - p.y, 2)
        );
        return distance < consumer.huntingRange;
      });
      
      if (nearbyPrey.length === 0) continue;
      
      // Consume prey
      const target = nearbyPrey[Math.floor(kernel.random() * nearbyPrey.length)];
      const energyGained = target.biomass * this.energyEfficiency;
      
      consumer.biomass += energyGained;
      target.biomass -= target.biomass * 0.1; // Predation loss
      
      if (target.biomass <= 0) {
        // Remove dead organism
        const index = prey.indexOf(target);
        if (index > -1) prey.splice(index, 1);
      }
    }
  }

  updateCarryingCapacities(kernel) {
    // Calculate carrying capacity for each tile
    for (let x = 0; x < this.world.width; x++) {
      for (let y = 0; y < this.world.height; y++) {
        const tile = this.world.getTile(x, y);
        if (!tile) continue;
        
        const capacity = this.calculateCarryingCapacity(tile);
        this.carryingCapacities.set(`${x},${y}`, capacity);
      }
    }
  }

  calculateCarryingCapacity(tile) {
    const biome = tile.biome;
    const baseCapacity = {
      forest: 100,
      grassland: 80,
      desert: 10,
      tundra: 20,
      wetland: 120,
      mountain: 30
    };
    
    let capacity = baseCapacity[biome] || 50;
    
    // Adjust for resources
    capacity *= tile.terrain.soilQuality;
    capacity *= Math.min(1, tile.climate.rainfall / 100);
    
    // Adjust for temperature
    if (tile.climate.temperature < 0 || tile.climate.temperature > 40) {
      capacity *= 0.5;
    }
    
    return capacity;
  }

  checkPopulationPressures(kernel) {
    for (const [location, capacity] of this.carryingCapacities) {
      const [x, y] = location.split(',').map(Number);
      
      // Count organisms at this location
      const organisms = this.countOrganismsAt(x, y);
      
      if (organisms > capacity) {
        // Overpopulation - trigger die-off
        this.triggerDieOff(x, y, organisms - capacity, kernel);
      }
    }
  }

  countOrganismsAt(x, y) {
    let count = 0;
    
    for (const level of Object.values(this.trophicLevels)) {
      count += level.filter(org => org.x === x && org.y === y).length;
    }
    
    return count;
  }

  triggerDieOff(x, y, excess, kernel) {
    // Remove excess organisms (starvation, disease)
    const allOrganisms = [];
    
    for (const level of Object.values(this.trophicLevels)) {
      allOrganisms.push(...level.filter(org => org.x === x && org.y === y));
    }
    
    // Sort by weakest (lowest biomass)
    allOrganisms.sort((a, b) => a.biomass - b.biomass);
    
    // Remove weakest
    for (let i = 0; i < Math.min(excess, allOrganisms.length); i++) {
      const organism = allOrganisms[i];
      
      // Find and remove from trophic level
      for (const level of Object.values(this.trophicLevels)) {
        const index = level.indexOf(organism);
        if (index > -1) {
          level.splice(index, 1);
          break;
        }
      }
      
      // Add to decomposers
      this.trophicLevels.decomposers.push({
        x: organism.x,
        y: organism.y,
        biomass: organism.biomass,
        type: 'carcass'
      });
    }
  }

  updateDecomposition(kernel) {
    for (let i = this.trophicLevels.decomposers.length - 1; i >= 0; i--) {
      const decomposer = this.trophicLevels.decomposers[i];
      
      // Decompose biomass
      const decompositionRate = 0.1; // 10% per day
      decomposer.biomass *= (1 - decompositionRate);
      
      // Return nutrients to soil
      const tile = this.world.getTile(decomposer.x, decomposer.y);
      if (tile) {
        tile.terrain.soilQuality += decompositionRate * 0.01;
        tile.terrain.soilQuality = Math.min(1, tile.terrain.soilQuality);
      }
      
      // Remove when fully decomposed
      if (decomposer.biomass < 0.1) {
        this.trophicLevels.decomposers.splice(i, 1);
      }
    }
  }

  addOrganism(organism, trophicLevel) {
    if (!this.trophicLevels[trophicLevel]) {
      console.error(`Invalid trophic level: ${trophicLevel}`);
      return;
    }
    
    this.trophicLevels[trophicLevel].push(organism);
  }

  removeOrganism(organism) {
    for (const level of Object.values(this.trophicLevels)) {
      const index = level.indexOf(organism);
      if (index > -1) {
        level.splice(index, 1);
        return true;
      }
    }
    return false;
  }

  getCarryingCapacity(x, y) {
    return this.carryingCapacities.get(`${x},${y}`) || 0;
  }

  getPopulationDensity(x, y) {
    const organisms = this.countOrganismsAt(x, y);
    const capacity = this.getCarryingCapacity(x, y);
    return capacity > 0 ? organisms / capacity : 0;
  }

  getBiomassAt(x, y) {
    let totalBiomass = 0;
    
    for (const level of Object.values(this.trophicLevels)) {
      for (const org of level) {
        if (org.x === x && org.y === y) {
          totalBiomass += org.biomass;
        }
      }
    }
    
    return totalBiomass;
  }

  getEcosystemHealth(x, y) {
    const density = this.getPopulationDensity(x, y);
    const biomass = this.getBiomassAt(x, y);
    const capacity = this.getCarryingCapacity(x, y);

    // Healthy ecosystem: 50-80% of carrying capacity
    let health = 1.0;

    if (density < 0.3) health = 0.5; // Underpopulated
    else if (density > 1.0) health = 0.3; // Overpopulated
    else if (density >= 0.5 && density <= 0.8) health = 1.0; // Optimal
    else health = 0.7;

    return {
      health: health,
      density: density,
      biomass: biomass,
      capacity: capacity,
      status: density > 1.0 ? 'overpopulated' : density < 0.3 ? 'depleted' : 'healthy'
    };
  }

  toJSON() {
    return {
      trophicLevels: JSON.parse(JSON.stringify(this.trophicLevels)),
      energyEfficiency: this.energyEfficiency,
      carryingCapacities: Array.from(this.carryingCapacities.entries())
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.trophicLevels) this.trophicLevels = data.trophicLevels;
    if (typeof data.energyEfficiency === 'number') this.energyEfficiency = data.energyEfficiency;
    if (data.carryingCapacities) this.carryingCapacities = new Map(data.carryingCapacities);
  }
}

export class FoodWeb {
  constructor() {
    this.relationships = new Map(); // predator -> [prey]
    this.energyFlows = new Map(); // relationship -> energy transfer rate
  }

  addRelationship(predator, prey, energyTransferRate = 0.1) {
    if (!this.relationships.has(predator)) {
      this.relationships.set(predator, []);
    }
    
    this.relationships.get(predator).push(prey);
    this.energyFlows.set(`${predator}->${prey}`, energyTransferRate);
  }

  getPrey(predator) {
    return this.relationships.get(predator) || [];
  }

  getPredators(prey) {
    const predators = [];
    
    for (const [predator, preyList] of this.relationships) {
      if (preyList.includes(prey)) {
        predators.push(predator);
      }
    }
    
    return predators;
  }

  getEnergyTransferRate(predator, prey) {
    return this.energyFlows.get(`${predator}->${prey}`) || 0.1;
  }

  simulateExtinction(species) {
    // Remove species from food web
    this.relationships.delete(species);

    // Remove as prey
    for (const [predator, preyList] of this.relationships) {
      const index = preyList.indexOf(species);
      if (index > -1) {
        preyList.splice(index, 1);
      }
    }

    // Return affected species
    const affected = new Set();

    // Predators lose food source
    for (const [predator, preyList] of this.relationships) {
      if (preyList.length === 0) {
        affected.add(predator);
      }
    }

    return Array.from(affected);
  }

  toJSON() {
    return {
      relationships: Array.from(this.relationships.entries()),
      energyFlows: Array.from(this.energyFlows.entries())
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.relationships) this.relationships = new Map(data.relationships);
    if (data.energyFlows) this.energyFlows = new Map(data.energyFlows);
  }
}
