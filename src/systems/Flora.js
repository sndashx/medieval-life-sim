/**
 * Flora.js
 * Plant growth, succession, seed dispersal, seasonality
 * Models photosynthesis, water/nutrient uptake, reproduction
 */

export class Flora {
  constructor(kernel, game = null) {
    this.kernel = kernel;
    this.game = game;
    this.world = (game && game.world) || null;
    this.plants = new Map(); // location -> plant data
    this.species = this.initSpecies();
  }

  initSpecies() {
    return {
      oak: {
        type: 'tree',
        growthRate: 0.01, // m/year
        maxHeight: 25,
        maxAge: 500,
        waterNeed: 50, // mm/month
        tempRange: [5, 30],
        soilQuality: 0.6,
        seedProduction: 1000,
        seedDispersalRange: 50, // meters
        biomass: 5000 // kg when mature
      },
      wheat: {
        type: 'crop',
        growthRate: 0.1,
        maxHeight: 1.2,
        maxAge: 1, // annual
        waterNeed: 40,
        tempRange: [10, 25],
        soilQuality: 0.7,
        seedProduction: 50,
        seedDispersalRange: 2,
        biomass: 2
      },
      grass: {
        type: 'groundcover',
        growthRate: 0.5,
        maxHeight: 0.3,
        maxAge: 5,
        waterNeed: 30,
        tempRange: [0, 35],
        soilQuality: 0.3,
        seedProduction: 100,
        seedDispersalRange: 10,
        biomass: 0.5
      },
      berry: {
        type: 'shrub',
        growthRate: 0.05,
        maxHeight: 2,
        maxAge: 20,
        waterNeed: 45,
        tempRange: [5, 28],
        soilQuality: 0.5,
        seedProduction: 200,
        seedDispersalRange: 20,
        biomass: 10
      }
    };
  }

  update(kernel) {
    const season = kernel.worldTime.getSeason();
    const month = kernel.worldTime.getMonth();
    
    // Update all plants
    for (const [location, plant] of this.plants) {
      this.updatePlant(plant, season, month, kernel);
    }
    
    // Seed dispersal in spring
    if (season === 'spring' && month === 3) {
      this.disperseSeeds(kernel);
    }
    
    // Natural succession
    this.updateSuccession(kernel);
  }

  updatePlant(plant, season, month, kernel) {
    const species = this.species[plant.species];
    if (!species) return;
    
    const tile = this.world.getTile(plant.x, plant.y);
    if (!tile) return;
    
    // Check survival conditions
    const canSurvive = this.checkSurvival(plant, species, tile);
    if (!canSurvive) {
      plant.health -= 0.1;
      if (plant.health <= 0) {
        this.plants.delete(`${plant.x},${plant.y}`);
        return;
      }
    }
    
    // Growth (seasonal)
    const growthFactor = this.getSeasonalGrowthFactor(season, species);
    if (growthFactor > 0 && plant.age < species.maxAge) {
      const growth = species.growthRate * growthFactor;
      plant.height = Math.min(species.maxHeight, plant.height + growth);
      plant.biomass = Math.min(species.biomass, plant.biomass + growth * 100);
    }
    
    // Aging
    plant.age += 1 / 365; // Daily update
    
    // Senescence
    if (plant.age > species.maxAge * 0.8) {
      plant.health -= 0.01;
    }
    
    // Reproduction
    if (plant.age > species.maxAge * 0.2 && season === 'spring') {
      plant.seeds = species.seedProduction;
    }
  }

  checkSurvival(plant, species, tile) {
    // Temperature check
    const temp = tile.climate.temperature;
    if (temp < species.tempRange[0] || temp > species.tempRange[1]) {
      return false;
    }
    
    // Water check
    if (tile.climate.rainfall < species.waterNeed) {
      return false;
    }
    
    // Soil quality check
    if (tile.terrain.soilQuality < species.soilQuality) {
      return false;
    }
    
    return true;
  }

  getSeasonalGrowthFactor(season, species) {
    const factors = {
      spring: 1.0,
      summer: 0.8,
      autumn: 0.3,
      winter: 0.0
    };
    
    // Evergreens grow year-round in suitable temps
    if (species.type === 'tree' && species.evergreen) {
      return factors[season] * 0.5 + 0.5;
    }
    
    return factors[season] || 0;
  }

  disperseSeeds(kernel) {
    const newPlants = [];
    
    for (const [location, plant] of this.plants) {
      if (!plant.seeds || plant.seeds <= 0) continue;
      
      const species = this.species[plant.species];
      if (!species) continue;
      
      // Disperse seeds
      for (let i = 0; i < plant.seeds; i++) {
        // Random dispersal within range
        const angle = kernel.random() * 2 * Math.PI;
        const distance = kernel.random() * species.seedDispersalRange;
        
        const newX = Math.floor(plant.x + Math.cos(angle) * distance);
        const newY = Math.floor(plant.y + Math.sin(angle) * distance);
        
        // Check if location is valid
        const tile = this.world.getTile(newX, newY);
        if (!tile) continue;
        
        // Check if already occupied
        if (this.plants.has(`${newX},${newY}`)) continue;
        
        // Germination chance
        const germinationChance = this.calculateGerminationChance(species, tile);
        if (kernel.random() < germinationChance) {
          newPlants.push({
            x: newX,
            y: newY,
            species: plant.species,
            age: 0,
            height: 0.1,
            biomass: 0.1,
            health: 1.0,
            seeds: 0
          });
        }
      }
      
      // Reset seed count
      plant.seeds = 0;
    }
    
    // Add new plants
    for (const newPlant of newPlants) {
      this.plants.set(`${newPlant.x},${newPlant.y}`, newPlant);
    }
  }

  calculateGerminationChance(species, tile) {
    let chance = 0.1; // Base 10%
    
    // Soil quality
    if (tile.terrain.soilQuality >= species.soilQuality) {
      chance *= 2;
    }
    
    // Water availability
    if (tile.climate.rainfall >= species.waterNeed) {
      chance *= 1.5;
    }
    
    // Temperature
    const temp = tile.climate.temperature;
    if (temp >= species.tempRange[0] && temp <= species.tempRange[1]) {
      chance *= 1.5;
    }
    
    return Math.min(0.8, chance);
  }

  updateSuccession(kernel) {
    // Ecological succession: grass -> shrubs -> trees
    for (const [location, plant] of this.plants) {
      const tile = this.world.getTile(plant.x, plant.y);
      if (!tile) continue;
      
      // If grass is mature and conditions are good, chance for shrub
      if (plant.species === 'grass' && plant.age > 2) {
        if (kernel.random() < 0.01 && tile.terrain.soilQuality > 0.5) {
          plant.species = 'berry';
          plant.age = 0;
          plant.height = 0.1;
        }
      }
      
      // If shrub is mature and conditions are good, chance for tree
      if (plant.species === 'berry' && plant.age > 10) {
        if (kernel.random() < 0.005 && tile.terrain.soilQuality > 0.7) {
          plant.species = 'oak';
          plant.age = 0;
          plant.height = 0.5;
        }
      }
    }
  }

  plantSeed(x, y, species) {
    const spec = this.species[species];
    if (!spec) return { success: false, reason: 'Unknown species' };
    
    const tile = this.world.getTile(x, y);
    if (!tile) return { success: false, reason: 'Invalid location' };
    
    if (this.plants.has(`${x},${y}`)) {
      return { success: false, reason: 'Location occupied' };
    }
    
    const plant = {
      x: x,
      y: y,
      species: species,
      age: 0,
      height: 0.1,
      biomass: 0.1,
      health: 1.0,
      seeds: 0
    };
    
    this.plants.set(`${x},${y}`, plant);
    return { success: true, plant: plant };
  }

  harvest(x, y) {
    const plant = this.plants.get(`${x},${y}`);
    if (!plant) return { success: false, reason: 'No plant here' };
    
    const species = this.species[plant.species];
    if (!species) return { success: false, reason: 'Unknown species' };
    
    // Calculate yield
    const maturityFactor = Math.min(1, plant.age / (species.maxAge * 0.5));
    const healthFactor = plant.health;
    const harvestYield = plant.biomass * maturityFactor * healthFactor;

    // Remove plant
    this.plants.delete(`${x},${y}`);

    return {
      success: true,
      yield: harvestYield,
      species: plant.species
    };
  }

  getPlantAt(x, y) {
    return this.plants.get(`${x},${y}`);
  }

  getPlantDensity(x, y, radius) {
    let count = 0;
    
    for (const [location, plant] of this.plants) {
      const distance = Math.sqrt(
        Math.pow(plant.x - x, 2) +
        Math.pow(plant.y - y, 2)
      );
      
      if (distance <= radius) count++;
    }
    
    return count;
  }

  getBiomassInArea(x, y, radius) {
    let totalBiomass = 0;

    for (const [location, plant] of this.plants) {
      const distance = Math.sqrt(
        Math.pow(plant.x - x, 2) +
        Math.pow(plant.y - y, 2)
      );

      if (distance <= radius) {
        totalBiomass += plant.biomass;
      }
    }

    return totalBiomass;
  }

  toJSON() {
    return {
      plants: Array.from(this.plants.entries())
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.plants) this.plants = new Map(data.plants);
  }
}
