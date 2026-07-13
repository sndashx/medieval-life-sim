/**
 * ProceduralPipeline.js
 * Full procedural generation: geology → climate → ecology → culture
 * Models complete world generation pipeline with dependencies
 */

export class ProceduralPipeline {
  constructor() {
    this.stages = new Map();
    this.dependencies = new Map();
    this.outputs = new Map();
    this.seed = this.kernel?.turn ?? 0;
  }

  setSeed(seed) {
    this.seed = seed;
  }

  generate(config) {
    const world = {
      seed: this.seed,
      config: config,
      stages: {},
      generated: this.kernel?.turn ?? 0
    };
    
    // Stage 1: Geology
    world.stages.geology = this.generateGeology(config.size, this.seed);
    
    // Stage 2: Climate (depends on geology)
    world.stages.climate = this.generateClimate(world.stages.geology, this.seed + 1);
    
    // Stage 3: Hydrology (depends on geology and climate)
    world.stages.hydrology = this.generateHydrology(
      world.stages.geology,
      world.stages.climate,
      this.seed + 2
    );
    
    // Stage 4: Ecology (depends on climate and hydrology)
    world.stages.ecology = this.generateEcology(
      world.stages.climate,
      world.stages.hydrology,
      this.seed + 3
    );
    
    // Stage 5: Resources (depends on geology and ecology)
    world.stages.resources = this.generateResources(
      world.stages.geology,
      world.stages.ecology,
      this.seed + 4
    );
    
    // Stage 6: Settlements (depends on resources, hydrology, ecology)
    world.stages.settlements = this.generateSettlements(
      world.stages.resources,
      world.stages.hydrology,
      world.stages.ecology,
      this.seed + 5
    );
    
    // Stage 7: Culture (depends on settlements, ecology, climate)
    world.stages.culture = this.generateCulture(
      world.stages.settlements,
      world.stages.ecology,
      world.stages.climate,
      this.seed + 6
    );
    
    // Stage 8: History (depends on culture, settlements)
    world.stages.history = this.generateHistory(
      world.stages.culture,
      world.stages.settlements,
      this.seed + 7
    );
    
    return world;
  }

  generateGeology(size, seed) {
    const rng = this.seededRandom(seed);
    
    const geology = {
      size: size,
      elevation: this.generateElevationMap(size, rng),
      tectonics: this.generateTectonics(rng),
      minerals: this.generateMineralDeposits(size, rng),
      soilTypes: this.generateSoilTypes(size, rng)
    };
    
    return geology;
  }

  generateElevationMap(size, rng) {
    const map = [];
    
    // Simplified noise-based elevation
    for (let x = 0; x < size.width; x++) {
      map[x] = [];
      for (let y = 0; y < size.height; y++) {
        // Multi-octave noise
        let elevation = 0;
        let amplitude = 1;
        let frequency = 1;
        
        for (let octave = 0; octave < 4; octave++) {
          elevation += this.noise2D(x * frequency, y * frequency, rng) * amplitude;
          amplitude *= 0.5;
          frequency *= 2;
        }
        
        map[x][y] = Math.max(0, Math.min(1, elevation));
      }
    }
    
    return map;
  }

  noise2D(x, y, rng) {
    // Simplified Perlin-like noise
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    
    const hash = (xi * 374761393 + yi * 668265263) ^ this.seed;
    const value = Math.sin(hash) * 0.5 + 0.5;
    
    return value;
  }

  generateTectonics(rng) {
    return {
      plates: Math.floor(rng() * 5) + 3,
      activity: rng(),
      faultLines: Math.floor(rng() * 10) + 5,
      volcanicActivity: rng() > 0.7
    };
  }

  generateMineralDeposits(size, rng) {
    const deposits = [];
    const count = Math.floor(rng() * 20) + 10;
    
    for (let i = 0; i < count; i++) {
      deposits.push({
        x: Math.floor(rng() * size.width),
        y: Math.floor(rng() * size.height),
        type: this.selectMineralType(rng),
        richness: rng()
      });
    }
    
    return deposits;
  }

  selectMineralType(rng) {
    const types = ['iron', 'copper', 'gold', 'silver', 'coal', 'stone', 'clay'];
    return types[Math.floor(rng() * types.length)];
  }

  generateSoilTypes(size, rng) {
    const soils = [];
    
    for (let x = 0; x < size.width; x++) {
      soils[x] = [];
      for (let y = 0; y < size.height; y++) {
        soils[x][y] = this.selectSoilType(rng);
      }
    }
    
    return soils;
  }

  selectSoilType(rng) {
    const types = ['clay', 'sand', 'loam', 'silt', 'peat', 'chalk'];
    return types[Math.floor(rng() * types.length)];
  }

  generateClimate(geology, seed) {
    const rng = this.seededRandom(seed);
    
    const climate = {
      zones: this.generateClimateZones(geology, rng),
      temperature: this.generateTemperatureMap(geology, rng),
      precipitation: this.generatePrecipitationMap(geology, rng),
      seasons: this.generateSeasons(rng),
      winds: this.generateWindPatterns(rng)
    };
    
    return climate;
  }

  generateClimateZones(geology, rng) {
    const zones = [];
    
    // Climate zones based on latitude and elevation
    for (let y = 0; y < geology.size.height; y++) {
      const latitude = y / geology.size.height;
      
      let zone;
      if (latitude < 0.2 || latitude > 0.8) {
        zone = 'polar';
      } else if (latitude < 0.4 || latitude > 0.6) {
        zone = 'temperate';
      } else {
        zone = 'tropical';
      }
      
      zones.push(zone);
    }
    
    return zones;
  }

  generateTemperatureMap(geology, rng) {
    const map = [];
    
    for (let x = 0; x < geology.size.width; x++) {
      map[x] = [];
      for (let y = 0; y < geology.size.height; y++) {
        const latitude = y / geology.size.height;
        const elevation = geology.elevation[x][y];
        
        // Base temperature from latitude
        let temp = 30 - Math.abs(latitude - 0.5) * 60;
        
        // Elevation reduces temperature
        temp -= elevation * 20;
        
        map[x][y] = temp;
      }
    }
    
    return map;
  }

  generatePrecipitationMap(geology, rng) {
    const map = [];
    
    for (let x = 0; x < geology.size.width; x++) {
      map[x] = [];
      for (let y = 0; y < geology.size.height; y++) {
        const elevation = geology.elevation[x][y];
        
        // Mountains get more precipitation
        let precipitation = 500 + elevation * 1000;
        
        // Add noise
        precipitation += (rng() - 0.5) * 300;
        
        map[x][y] = Math.max(0, precipitation);
      }
    }
    
    return map;
  }

  generateSeasons(rng) {
    return {
      count: 4,
      names: ['spring', 'summer', 'autumn', 'winter'],
      temperatureVariation: 10 + rng() * 20,
      precipitationVariation: 0.3 + rng() * 0.4
    };
  }

  generateWindPatterns(rng) {
    return {
      prevailing: rng() > 0.5 ? 'westerly' : 'easterly',
      strength: rng(),
      seasonal: rng() > 0.6
    };
  }

  generateHydrology(geology, climate, seed) {
    const rng = this.seededRandom(seed);
    
    return {
      rivers: this.generateRivers(geology, climate, rng),
      lakes: this.generateLakes(geology, climate, rng),
      groundwater: this.generateGroundwater(geology, climate, rng),
      watersheds: this.generateWatersheds(geology, rng)
    };
  }

  generateRivers(geology, climate, rng) {
    const rivers = [];
    const count = Math.floor(rng() * 10) + 5;
    
    for (let i = 0; i < count; i++) {
      const source = {
        x: Math.floor(rng() * geology.size.width),
        y: Math.floor(rng() * geology.size.height)
      };
      
      rivers.push({
        source: source,
        path: this.traceRiverPath(source, geology, rng),
        flow: rng() * 1000
      });
    }
    
    return rivers;
  }

  traceRiverPath(source, geology, rng) {
    const path = [source];
    let current = source;
    
    // Flow downhill
    for (let i = 0; i < 50; i++) {
      const neighbors = this.getNeighbors(current, geology.size);
      let lowest = null;
      let lowestElevation = Infinity;
      
      for (const neighbor of neighbors) {
        const elevation = geology.elevation[neighbor.x][neighbor.y];
        if (elevation < lowestElevation) {
          lowestElevation = elevation;
          lowest = neighbor;
        }
      }
      
      if (!lowest || lowestElevation >= geology.elevation[current.x][current.y]) {
        break; // Reached local minimum
      }
      
      path.push(lowest);
      current = lowest;
    }
    
    return path;
  }

  getNeighbors(pos, size) {
    const neighbors = [];
    const directions = [[-1,0], [1,0], [0,-1], [0,1]];
    
    for (const [dx, dy] of directions) {
      const x = pos.x + dx;
      const y = pos.y + dy;
      
      if (x >= 0 && x < size.width && y >= 0 && y < size.height) {
        neighbors.push({ x, y });
      }
    }
    
    return neighbors;
  }

  generateLakes(geology, climate, rng) {
    const lakes = [];
    const count = Math.floor(rng() * 15) + 5;
    
    for (let i = 0; i < count; i++) {
      lakes.push({
        x: Math.floor(rng() * geology.size.width),
        y: Math.floor(rng() * geology.size.height),
        size: rng() * 100,
        depth: rng() * 50
      });
    }
    
    return lakes;
  }

  generateGroundwater(geology, climate, rng) {
    return {
      depth: 5 + rng() * 20,
      quality: 0.7 + rng() * 0.3,
      rechargeRate: rng()
    };
  }

  generateWatersheds(geology, rng) {
    const count = Math.floor(rng() * 8) + 3;
    const watersheds = [];
    
    for (let i = 0; i < count; i++) {
      watersheds.push({
        id: i,
        area: rng() * 1000,
        drainagePattern: rng() > 0.5 ? 'dendritic' : 'radial'
      });
    }
    
    return watersheds;
  }

  generateEcology(climate, hydrology, seed) {
    const rng = this.seededRandom(seed);
    
    return {
      biomes: this.generateBiomes(climate, hydrology, rng),
      flora: this.generateFlora(climate, rng),
      fauna: this.generateFauna(climate, rng),
      foodWeb: this.generateFoodWeb(rng)
    };
  }

  generateBiomes(climate, hydrology, rng) {
    const biomes = [];
    
    const types = ['forest', 'grassland', 'desert', 'tundra', 'wetland', 'savanna'];
    
    for (const type of types) {
      if (rng() > 0.5) {
        biomes.push({
          type: type,
          coverage: rng(),
          biodiversity: rng()
        });
      }
    }
    
    return biomes;
  }

  generateFlora(climate, rng) {
    const species = [];
    const count = Math.floor(rng() * 50) + 20;
    
    for (let i = 0; i < count; i++) {
      species.push({
        id: i,
        type: rng() > 0.7 ? 'tree' : rng() > 0.4 ? 'shrub' : 'herb',
        edible: rng() > 0.7,
        medicinal: rng() > 0.8
      });
    }
    
    return species;
  }

  generateFauna(climate, rng) {
    const species = [];
    const count = Math.floor(rng() * 30) + 10;
    
    for (let i = 0; i < count; i++) {
      species.push({
        id: i,
        type: rng() > 0.6 ? 'mammal' : rng() > 0.3 ? 'bird' : 'reptile',
        domesticable: rng() > 0.9,
        dangerous: rng() > 0.8
      });
    }
    
    return species;
  }

  generateFoodWeb(rng) {
    return {
      trophicLevels: 4,
      complexity: rng(),
      stability: 0.6 + rng() * 0.3
    };
  }

  generateResources(geology, ecology, seed) {
    const rng = this.seededRandom(seed);
    
    return {
      minerals: geology.minerals,
      timber: this.calculateTimberResources(ecology, rng),
      game: this.calculateGameResources(ecology, rng),
      fish: this.calculateFishResources(ecology, rng),
      agriculture: this.calculateAgriculturePotential(geology, ecology, rng)
    };
  }

  calculateTimberResources(ecology, rng) {
    const forests = ecology.biomes.filter(b => b.type === 'forest');
    return forests.reduce((sum, f) => sum + f.coverage, 0) * 1000;
  }

  calculateGameResources(ecology, rng) {
    return ecology.fauna.filter(f => !f.dangerous).length * 100;
  }

  calculateFishResources(ecology, rng) {
    return rng() * 500;
  }

  calculateAgriculturePotential(geology, ecology, rng) {
    return {
      arableLand: rng() * 0.3,
      fertility: 0.5 + rng() * 0.5,
      growingSeason: 120 + rng() * 120
    };
  }

  generateSettlements(resources, hydrology, ecology, seed) {
    const rng = this.seededRandom(seed);
    
    const settlements = [];
    const count = Math.floor(rng() * 20) + 5;
    
    for (let i = 0; i < count; i++) {
      // Settlements near water and resources
      const nearWater = rng() > 0.3;
      const location = nearWater && hydrology.rivers.length > 0
        ? this.selectRiverLocation(hydrology.rivers, rng)
        : { x: rng() * 100, y: rng() * 100 };
      
      settlements.push({
        id: i,
        location: location,
        size: this.selectSettlementSize(rng),
        founded: -1000 + rng() * 1000, // Years ago
        population: Math.floor(rng() * 5000) + 100
      });
    }
    
    return settlements;
  }

  selectRiverLocation(rivers, rng) {
    const river = rivers[Math.floor(rng() * rivers.length)];
    const point = river.path[Math.floor(rng() * river.path.length)];
    return point;
  }

  selectSettlementSize(rng) {
    const val = rng();
    if (val < 0.6) return 'village';
    if (val < 0.9) return 'town';
    return 'city';
  }

  generateCulture(settlements, ecology, climate, seed) {
    const rng = this.seededRandom(seed);
    
    return {
      languages: this.generateLanguages(settlements, rng),
      religions: this.generateReligions(ecology, climate, rng),
      customs: this.generateCustoms(ecology, climate, rng),
      technology: this.generateTechnologyLevel(rng),
      art: this.generateArtStyles(rng)
    };
  }

  generateLanguages(settlements, rng) {
    const count = Math.floor(settlements.length / 5) + 1;
    const languages = [];
    
    for (let i = 0; i < count; i++) {
      languages.push({
        id: i,
        name: `Language ${i + 1}`,
        speakers: Math.floor(rng() * 10000) + 1000,
        writingSystem: rng() > 0.5
      });
    }
    
    return languages;
  }

  generateReligions(ecology, climate, rng) {
    const count = Math.floor(rng() * 5) + 1;
    const religions = [];
    
    for (let i = 0; i < count; i++) {
      religions.push({
        id: i,
        type: rng() > 0.5 ? 'polytheistic' : 'monotheistic',
        followers: Math.floor(rng() * 20000) + 1000,
        practices: Math.floor(rng() * 10) + 3
      });
    }
    
    return religions;
  }

  generateCustoms(ecology, climate, rng) {
    return {
      greetings: Math.floor(rng() * 5) + 1,
      festivals: Math.floor(rng() * 12) + 4,
      taboos: Math.floor(rng() * 8) + 2,
      rituals: Math.floor(rng() * 15) + 5
    };
  }

  generateTechnologyLevel(rng) {
    const levels = ['stone_age', 'bronze_age', 'iron_age', 'medieval'];
    return levels[Math.floor(rng() * levels.length)];
  }

  generateArtStyles(rng) {
    return {
      visual: rng() > 0.5 ? 'realistic' : 'abstract',
      music: rng() > 0.5 ? 'melodic' : 'rhythmic',
      literature: rng() > 0.5 ? 'oral' : 'written'
    };
  }

  generateHistory(culture, settlements, seed) {
    const rng = this.seededRandom(seed);
    
    return {
      events: this.generateHistoricalEvents(settlements, rng),
      dynasties: this.generateDynasties(settlements, rng),
      conflicts: this.generateConflicts(settlements, rng),
      migrations: this.generateMigrations(settlements, rng)
    };
  }

  generateHistoricalEvents(settlements, rng) {
    const events = [];
    const count = Math.floor(rng() * 50) + 20;
    
    for (let i = 0; i < count; i++) {
      events.push({
        year: -1000 + i * 20,
        type: this.selectEventType(rng),
        significance: rng()
      });
    }
    
    return events;
  }

  selectEventType(rng) {
    const types = ['founding', 'war', 'plague', 'discovery', 'alliance', 'rebellion'];
    return types[Math.floor(rng() * types.length)];
  }

  generateDynasties(settlements, rng) {
    const dynasties = [];
    const count = Math.floor(settlements.length / 3) + 1;
    
    for (let i = 0; i < count; i++) {
      dynasties.push({
        id: i,
        founded: -800 + rng() * 800,
        duration: Math.floor(rng() * 300) + 50,
        rulers: Math.floor(rng() * 10) + 3
      });
    }
    
    return dynasties;
  }

  generateConflicts(settlements, rng) {
    const conflicts = [];
    const count = Math.floor(rng() * 15) + 5;
    
    for (let i = 0; i < count; i++) {
      conflicts.push({
        year: -500 + rng() * 500,
        participants: Math.floor(rng() * 4) + 2,
        duration: Math.floor(rng() * 10) + 1,
        outcome: rng() > 0.5 ? 'decisive' : 'stalemate'
      });
    }
    
    return conflicts;
  }

  generateMigrations(settlements, rng) {
    const migrations = [];
    const count = Math.floor(rng() * 10) + 3;
    
    for (let i = 0; i < count; i++) {
      migrations.push({
        year: -600 + rng() * 600,
        people: Math.floor(rng() * 5000) + 500,
        distance: rng() * 1000,
        reason: rng() > 0.5 ? 'resources' : 'conflict'
      });
    }
    
    return migrations;
  }

  seededRandom(seed) {
    let state = seed;
    return function() {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }
}
