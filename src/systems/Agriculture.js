/**
 * Agriculture.js
 * Soil fertility, crop management, pests, irrigation, rotation
 * Models realistic farming challenges and yields
 */

export class Agriculture {
  constructor(world) {
    this.world = world;
    this.fields = new Map(); // location -> field data
    this.crops = this.initCrops();
    this.pests = new Map();
    this.diseases = new Map();
  }

  initCrops() {
    return {
      wheat: {
        growthDuration: 120, // days
        waterNeed: 450, // mm total
        tempRange: [10, 25],
        soilNutrients: { nitrogen: 0.6, phosphorus: 0.4, potassium: 0.3 },
        yieldPerHectare: 3000, // kg
        plantingSeasons: ['spring'],
        harvestSeasons: ['summer'],
        pestSusceptibility: 0.5,
        diseaseSusceptibility: 0.4
      },
      barley: {
        growthDuration: 90,
        waterNeed: 400,
        tempRange: [8, 22],
        soilNutrients: { nitrogen: 0.5, phosphorus: 0.3, potassium: 0.3 },
        yieldPerHectare: 2500,
        plantingSeasons: ['spring', 'autumn'],
        harvestSeasons: ['summer', 'winter'],
        pestSusceptibility: 0.4,
        diseaseSusceptibility: 0.3
      },
      rye: {
        growthDuration: 150,
        waterNeed: 350,
        tempRange: [5, 20],
        soilNutrients: { nitrogen: 0.4, phosphorus: 0.3, potassium: 0.2 },
        yieldPerHectare: 2000,
        plantingSeasons: ['autumn'],
        harvestSeasons: ['summer'],
        pestSusceptibility: 0.3,
        diseaseSusceptibility: 0.2
      },
      vegetables: {
        growthDuration: 60,
        waterNeed: 300,
        tempRange: [15, 28],
        soilNutrients: { nitrogen: 0.7, phosphorus: 0.5, potassium: 0.4 },
        yieldPerHectare: 15000,
        plantingSeasons: ['spring', 'summer'],
        harvestSeasons: ['summer', 'autumn'],
        pestSusceptibility: 0.7,
        diseaseSusceptibility: 0.6
      },
      legumes: {
        growthDuration: 90,
        waterNeed: 400,
        tempRange: [12, 25],
        soilNutrients: { nitrogen: -0.3, phosphorus: 0.3, potassium: 0.3 }, // Fixes nitrogen
        yieldPerHectare: 1500,
        plantingSeasons: ['spring'],
        harvestSeasons: ['summer'],
        pestSusceptibility: 0.4,
        diseaseSusceptibility: 0.3
      }
    };
  }

  update(kernel) {
    const season = kernel.worldTime.getSeason();
    const month = kernel.worldTime.getMonth();
    
    // Update all fields
    for (const [location, field] of this.fields) {
      this.updateField(field, season, kernel);
    }
    
    // Update pests and diseases
    this.updatePests(season, kernel);
    this.updateDiseases(season, kernel);
  }

  updateField(field, season, kernel) {
    if (!field.planted) return;
    
    const crop = this.crops[field.cropType];
    if (!crop) return;
    
    const tile = this.world.getTile(field.x, field.y);
    if (!tile) return;
    
    // Growth progress
    field.daysGrown += 1 / 1440; // per minute to days
    
    // Check growing conditions
    const conditions = this.checkGrowingConditions(field, crop, tile);
    
    // Apply growth
    if (conditions.suitable) {
      field.health = Math.min(1, field.health + 0.01);
      field.growth = Math.min(1, field.daysGrown / crop.growthDuration);
    } else {
      field.health = Math.max(0, field.health - 0.02);
    }
    
    // Water consumption
    const dailyWater = crop.waterNeed / crop.growthDuration;
    field.waterReceived += tile.climate.rainfall / 30; // monthly to daily
    
    if (field.irrigation) {
      field.waterReceived += dailyWater * 0.5;
    }
    
    // Nutrient depletion
    tile.terrain.soilQuality -= 0.0001;
    tile.terrain.nitrogen = Math.max(0, tile.terrain.nitrogen - crop.soilNutrients.nitrogen / crop.growthDuration);
    tile.terrain.phosphorus = Math.max(0, tile.terrain.phosphorus - crop.soilNutrients.phosphorus / crop.growthDuration);
    tile.terrain.potassium = Math.max(0, tile.terrain.potassium - crop.soilNutrients.potassium / crop.growthDuration);
    
    // Pest damage
    if (this.pests.has(`${field.x},${field.y}`)) {
      const pestLevel = this.pests.get(`${field.x},${field.y}`);
      field.health -= pestLevel * crop.pestSusceptibility * 0.01;
    }
    
    // Disease damage
    if (this.diseases.has(`${field.x},${field.y}`)) {
      const diseaseLevel = this.diseases.get(`${field.x},${field.y}`);
      field.health -= diseaseLevel * crop.diseaseSusceptibility * 0.01;
    }
    
    // Weed competition
    if (!field.weeded) {
      field.weedLevel = Math.min(1, field.weedLevel + 0.01);
      field.health -= field.weedLevel * 0.005;
    }
  }

  checkGrowingConditions(field, crop, tile) {
    const temp = tile.climate.temperature;
    const water = field.waterReceived;
    const nutrients = Math.min(
      tile.terrain.nitrogen / crop.soilNutrients.nitrogen,
      tile.terrain.phosphorus / crop.soilNutrients.phosphorus,
      tile.terrain.potassium / crop.soilNutrients.potassium
    );
    
    const tempSuitable = temp >= crop.tempRange[0] && temp <= crop.tempRange[1];
    const waterSuitable = water >= crop.waterNeed / crop.growthDuration * 0.8;
    const nutrientsSuitable = nutrients > 0.3;
    
    return {
      suitable: tempSuitable && waterSuitable && nutrientsSuitable,
      temperature: tempSuitable,
      water: waterSuitable,
      nutrients: nutrientsSuitable
    };
  }

  plantField(x, y, cropType, size = 1) {
    const crop = this.crops[cropType];
    if (!crop) return { success: false, reason: 'Unknown crop type' };
    
    const tile = this.world.getTile(x, y);
    if (!tile) return { success: false, reason: 'Invalid location' };
    
    const season = this.world.kernel.worldTime.getSeason();
    if (!crop.plantingSeasons.includes(season)) {
      return { success: false, reason: 'Wrong season for planting' };
    }
    
    const field = {
      x: x,
      y: y,
      cropType: cropType,
      size: size,
      planted: true,
      daysGrown: 0,
      growth: 0,
      health: 1.0,
      waterReceived: 0,
      irrigation: false,
      weeded: false,
      weedLevel: 0
    };
    
    this.fields.set(`${x},${y}`, field);
    return { success: true, field: field };
  }

  harvest(x, y) {
    const field = this.fields.get(`${x},${y}`);
    if (!field) return { success: false, reason: 'No field here' };
    
    if (!field.planted) return { success: false, reason: 'Field not planted' };
    
    const crop = this.crops[field.cropType];
    if (field.growth < 0.9) {
      return { success: false, reason: 'Crop not ready for harvest' };
    }
    
    // Calculate yield
    const baseYield = crop.yieldPerHectare * field.size;
    const healthModifier = field.health;
    const growthModifier = field.growth;
    const actualYield = baseYield * healthModifier * growthModifier;
    
    // Clear field
    field.planted = false;
    field.daysGrown = 0;
    field.growth = 0;
    field.health = 1.0;
    field.waterReceived = 0;
    
    return {
      success: true,
      yield: actualYield,
      quality: field.health,
      cropType: field.cropType
    };
  }

  irrigate(x, y) {
    const field = this.fields.get(`${x},${y}`);
    if (!field) return { success: false, reason: 'No field here' };
    
    field.irrigation = true;
    return { success: true };
  }

  weed(x, y) {
    const field = this.fields.get(`${x},${y}`);
    if (!field) return { success: false, reason: 'No field here' };
    
    field.weeded = true;
    field.weedLevel = 0;
    return { success: true };
  }

  fertilize(x, y, type = 'manure') {
    const field = this.fields.get(`${x},${y}`);
    if (!field) return { success: false, reason: 'No field here' };
    
    const tile = this.world.getTile(x, y);
    if (!tile) return { success: false };
    
    const fertilizers = {
      manure: { nitrogen: 0.1, phosphorus: 0.05, potassium: 0.05 },
      compost: { nitrogen: 0.08, phosphorus: 0.04, potassium: 0.04 },
      ash: { nitrogen: 0, phosphorus: 0.02, potassium: 0.1 }
    };
    
    const fert = fertilizers[type];
    if (fert) {
      tile.terrain.nitrogen = Math.min(1, tile.terrain.nitrogen + fert.nitrogen);
      tile.terrain.phosphorus = Math.min(1, tile.terrain.phosphorus + fert.phosphorus);
      tile.terrain.potassium = Math.min(1, tile.terrain.potassium + fert.potassium);
      tile.terrain.soilQuality = Math.min(1, tile.terrain.soilQuality + 0.05);
    }
    
    return { success: true };
  }

  rotate(x, y, newCropType) {
    const field = this.fields.get(`${x},${y}`);
    if (!field) return { success: false, reason: 'No field here' };
    
    const newCrop = this.crops[newCropType];
    if (!newCrop) return { success: false, reason: 'Unknown crop type' };
    
    // Crop rotation benefits
    const tile = this.world.getTile(x, y);
    if (tile && newCropType === 'legumes') {
      // Legumes fix nitrogen
      tile.terrain.nitrogen = Math.min(1, tile.terrain.nitrogen + 0.2);
    }
    
    field.cropType = newCropType;
    field.daysGrown = 0;
    field.growth = 0;
    field.health = 1.0;
    
    return { success: true };
  }

  updatePests(season, kernel) {
    // Pest populations increase in warm seasons
    const pestGrowthRate = season === 'summer' ? 0.1 : season === 'spring' ? 0.05 : -0.05;
    
    for (const [location, field] of this.fields) {
      if (!field.planted) continue;
      
      let pestLevel = this.pests.get(location) || 0;
      pestLevel = Math.max(0, Math.min(1, pestLevel + pestGrowthRate));
      
      if (pestLevel > 0) {
        this.pests.set(location, pestLevel);
      } else {
        this.pests.delete(location);
      }
    }
  }

  updateDiseases(season, kernel) {
    // Diseases spread in wet conditions
    for (const [location, field] of this.fields) {
      if (!field.planted) continue;
      
      const tile = this.world.getTile(field.x, field.y);
      if (!tile) continue;
      
      let diseaseLevel = this.diseases.get(location) || 0;
      
      // High rainfall increases disease
      if (tile.climate.rainfall > 100) {
        diseaseLevel = Math.min(1, diseaseLevel + 0.05);
      } else {
        diseaseLevel = Math.max(0, diseaseLevel - 0.02);
      }
      
      // Disease spreads to nearby fields
      if (diseaseLevel > 0.5) {
        this.spreadDisease(field.x, field.y, diseaseLevel);
      }
      
      if (diseaseLevel > 0) {
        this.diseases.set(location, diseaseLevel);
      } else {
        this.diseases.delete(location);
      }
    }
  }

  spreadDisease(x, y, level) {
    const neighbors = [
      [x-1, y], [x+1, y], [x, y-1], [x, y+1]
    ];
    
    for (const [nx, ny] of neighbors) {
      const neighborField = this.fields.get(`${nx},${ny}`);
      if (!neighborField || !neighborField.planted) continue;
      
      const currentLevel = this.diseases.get(`${nx},${ny}`) || 0;
      const newLevel = Math.min(1, currentLevel + level * 0.1);
      this.diseases.set(`${nx},${ny}`, newLevel);
    }
  }

  treatPests(x, y, method = 'manual') {
    const pestLevel = this.pests.get(`${x},${y}`) || 0;
    if (pestLevel === 0) return { success: false, reason: 'No pests' };
    
    const effectiveness = {
      manual: 0.3,
      smoke: 0.5,
      companion: 0.4 // Companion planting
    };
    
    const reduction = effectiveness[method] || 0.3;
    const newLevel = Math.max(0, pestLevel - reduction);
    
    if (newLevel > 0) {
      this.pests.set(`${x},${y}`, newLevel);
    } else {
      this.pests.delete(`${x},${y}`);
    }
    
    return { success: true, reduction: pestLevel - newLevel };
  }

  getFieldStatus(x, y) {
    const field = this.fields.get(`${x},${y}`);
    if (!field) return null;

    const crop = this.crops[field.cropType];
    const pestLevel = this.pests.get(`${x},${y}`) || 0;
    const diseaseLevel = this.diseases.get(`${x},${y}`) || 0;

    return {
      cropType: field.cropType,
      growth: field.growth,
      health: field.health,
      daysGrown: field.daysGrown,
      daysRemaining: crop.growthDuration - field.daysGrown,
      readyToHarvest: field.growth >= 0.9,
      pests: pestLevel,
      disease: diseaseLevel,
      weeds: field.weedLevel,
      irrigation: field.irrigation
    };
  }

  toJSON() {
    return {
      fields: Array.from(this.fields.entries()),
      pests: Array.from(this.pests.entries()),
      diseases: Array.from(this.diseases.entries())
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.fields) this.fields = new Map(data.fields);
    if (data.pests) this.pests = new Map(data.pests);
    if (data.diseases) this.diseases = new Map(data.diseases);
  }
}
