export class WorldGenerator {
  constructor(seed, config = null) {
    this.seed = seed;
    this.rng = new SeededRNG(seed);
    
    // Use provided config or defaults
    this.config = config || {
      worldSize: { width: 100, height: 100 },
      settlements: 5,
      resources: 50,
      rivers: 5,
      populationMin: 50,
      populationMax: 500
    };
    
    this.size = this.config.worldSize;
    this.terrain = null;
    this.climate = null;
    this.biomes = null;
    this.settlements = [];
    this.resources = new Map();
  }

  generate(naturalWorld = null) {
    console.log('  → Generating terrain...');
    this.generateTerrain();
    console.log('  → Generating climate...');
    this.generateClimate();
    console.log('  → Generating biomes...');
    this.generateBiomes();
    console.log('  → Placing resources...');
    this.generateResources();
    console.log('  → Creating settlements...');
    this.generateSettlements();
    console.log('  → Adding rivers...');
    this.generateRivers();
    
    // Initialize natural world for each tile
    if (naturalWorld) {
      console.log('  → Populating natural world...');
      for (let y = 0; y < this.size.height; y++) {
        for (let x = 0; x < this.size.width; x++) {
          const tile = {
            terrain: this.terrain[y][x],
            climate: this.climate[y][x],
            biome: this.biomes[y][x],
            hasWater: this.biomes[y][x].type === 'water'
          };
          naturalWorld.initializeTile(x, y, tile);
        }
      }
    }
    
    return this.createWorldData();
  }

  generateTerrain() {
    this.terrain = new Array(this.size.height);
    for (let y = 0; y < this.size.height; y++) {
      this.terrain[y] = new Array(this.size.width);
      for (let x = 0; x < this.size.width; x++) {
        const elevation = this.perlinNoise(x / 20, y / 20, 0) * 500;
        const roughness = this.perlinNoise(x / 5, y / 5, 100) * 50;
        this.terrain[y][x] = {
          elevation: elevation + roughness,
          slope: 0,
          soilDepth: Math.max(0, 2 - elevation / 200),
          rockType: this.selectRockType(elevation),
          vegetation: 0
        };
      }
    }
    this.calculateSlopes();
  }

  generateClimate() {
    this.climate = new Array(this.size.height);
    for (let y = 0; y < this.size.height; y++) {
      this.climate[y] = new Array(this.size.width);
      const latitude = (y / this.size.height) * 180 - 90;
      for (let x = 0; x < this.size.width; x++) {
        const elevation = this.terrain[y][x].elevation;
        const baseTemp = 30 - Math.abs(latitude) * 0.5 - elevation * 0.006;
        const rainfall = this.perlinNoise(x / 30, y / 30, 200) * 2000 + 500;
        this.climate[y][x] = {
          temperature: baseTemp,
          rainfall: rainfall,
          seasonalVariation: Math.abs(latitude) * 0.3,
          windSpeed: this.perlinNoise(x / 40, y / 40, 300) * 20 + 5
        };
      }
    }
  }

  generateBiomes() {
    this.biomes = new Array(this.size.height);
    for (let y = 0; y < this.size.height; y++) {
      this.biomes[y] = new Array(this.size.width);
      for (let x = 0; x < this.size.width; x++) {
        const temp = this.climate[y][x].temperature;
        const rain = this.climate[y][x].rainfall;
        const elev = this.terrain[y][x].elevation;
        
        let biome = 'grassland';
        if (elev > 300) biome = 'mountain';
        else if (elev < 10) biome = 'water';
        else if (temp < 0) biome = 'tundra';
        else if (rain < 250) biome = 'desert';
        else if (rain > 1500 && temp > 20) biome = 'rainforest';
        else if (rain > 1000) biome = 'forest';
        else if (rain < 500) biome = 'savanna';
        
        this.biomes[y][x] = {
          type: biome,
          fertility: this.calculateFertility(temp, rain, this.terrain[y][x].soilDepth),
          density: rain / 1000
        };
        
        this.terrain[y][x].vegetation = this.biomes[y][x].density;
      }
    }
  }

  generateResources() {
    const resourceTypes = ['iron', 'copper', 'tin', 'gold', 'silver', 'coal', 'clay', 'stone', 'timber'];
    for (let i = 0; i < this.config.resources; i++) {
      const x = this.rng.nextInt(0, this.size.width - 1);
      const y = this.rng.nextInt(0, this.size.height - 1);
      const type = resourceTypes[this.rng.nextInt(0, resourceTypes.length - 1)];
      const amount = this.rng.nextInt(100, 10000);
      
      const key = `${x},${y}`;
      if (!this.resources.has(key)) {
        this.resources.set(key, []);
      }
      this.resources.get(key).push({ type, amount, extracted: 0 });
    }
  }

  generateSettlements() {
    const maxAttempts = this.config.settlements * 10;
    let attempts = 0;
    
    while (this.settlements.length < this.config.settlements && attempts < maxAttempts) {
      attempts++;
      const x = this.rng.nextInt(10, this.size.width - 10);
      const y = this.rng.nextInt(10, this.size.height - 10);
      
      if (this.isGoodSettlementLocation(x, y)) {
        const population = this.rng.nextInt(this.config.populationMin, this.config.populationMax);
        this.settlements.push({
          x, y,
          name: this.generateSettlementName(),
          population: population,
          buildings: this.generateBuildings(population),
          economy: { wealth: population * 100, trade: [] },
          government: { type: 'feudal', ruler: null },
          culture: this.generateCulture()
        });
      }
    }
    
    // If we couldn't find enough good locations, create settlements anyway
    while (this.settlements.length < this.config.settlements) {
      const x = this.rng.nextInt(10, this.size.width - 10);
      const y = this.rng.nextInt(10, this.size.height - 10);
      const population = this.rng.nextInt(this.config.populationMin, this.config.populationMax);
      
      this.settlements.push({
        x, y,
        name: this.generateSettlementName(),
        population: population,
        buildings: this.generateBuildings(population),
        economy: { wealth: population * 100, trade: [] },
        government: { type: 'feudal', ruler: null },
        culture: this.generateCulture()
      });
    }
  }

  generateRivers() {
    for (let i = 0; i < this.config.rivers; i++) {
      let x = this.rng.nextInt(0, this.size.width - 1);
      let y = this.rng.nextInt(0, this.size.height - 1);
      
      if (this.terrain[y][x].elevation > 200) {
        const path = [];
        for (let step = 0; step < 100; step++) {
          path.push({ x, y });
          const neighbors = this.getNeighbors(x, y);
          let lowest = null;
          let lowestElev = this.terrain[y][x].elevation;
          
          for (const n of neighbors) {
            if (this.terrain[n.y][n.x].elevation < lowestElev) {
              lowest = n;
              lowestElev = this.terrain[n.y][n.x].elevation;
            }
          }
          
          if (!lowest) break;
          x = lowest.x;
          y = lowest.y;
          this.terrain[y][x].hasWater = true;
        }
      }
    }
  }

  isGoodSettlementLocation(x, y) {
    const elev = this.terrain[y][x].elevation;
    const biome = this.biomes[y][x].type;
    const hasWater = this.hasNearbyWater(x, y, 5);
    return elev > 10 && elev < 200 && biome !== 'desert' && biome !== 'mountain' && hasWater;
  }

  hasNearbyWater(x, y, radius) {
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < this.size.width && ny >= 0 && ny < this.size.height) {
          if (this.terrain[ny][nx].hasWater || this.terrain[ny][nx].elevation < 10) {
            return true;
          }
        }
      }
    }
    return false;
  }

  calculateSlopes() {
    for (let y = 1; y < this.size.height - 1; y++) {
      for (let x = 1; x < this.size.width - 1; x++) {
        const e = this.terrain[y][x].elevation;
        const dx = this.terrain[y][x + 1].elevation - this.terrain[y][x - 1].elevation;
        const dy = this.terrain[y + 1][x].elevation - this.terrain[y - 1][x].elevation;
        this.terrain[y][x].slope = Math.sqrt(dx * dx + dy * dy) / 2;
      }
    }
  }

  calculateFertility(temp, rain, soilDepth) {
    if (temp < 5 || temp > 35) return 0.1;
    if (rain < 200 || rain > 2000) return 0.2;
    const tempFactor = 1 - Math.abs(temp - 20) / 20;
    const rainFactor = Math.min(rain / 800, 1);
    return tempFactor * rainFactor * soilDepth;
  }

  selectRockType(elevation) {
    if (elevation < 50) return 'sedimentary';
    if (elevation < 200) return 'limestone';
    if (elevation < 400) return 'granite';
    return 'basalt';
  }

  generateSettlementName() {
    const prefixes = ['North', 'South', 'East', 'West', 'New', 'Old', 'High', 'Low'];
    const roots = ['ford', 'bridge', 'ton', 'ham', 'bury', 'field', 'wood', 'vale'];
    return this.rng.choice(prefixes) + this.rng.choice(roots);
  }

  generateBuildings(population) {
    return {
      houses: Math.floor(population / 5),
      workshops: Math.floor(population / 50),
      market: population > 200 ? 1 : 0,
      church: population > 100 ? 1 : 0,
      inn: population > 300 ? 1 : 0,
      forge: population > 150 ? 1 : 0
    };
  }

  generateCulture() {
    return {
      language: 'Common',
      religion: this.rng.choice(['Monotheist', 'Polytheist', 'Animist']),
      values: this.rng.choice(['Honor', 'Wealth', 'Knowledge', 'Tradition']),
      customs: []
    };
  }

  getNeighbors(x, y) {
    const neighbors = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && nx < this.size.width && ny >= 0 && ny < this.size.height) {
          neighbors.push({ x: nx, y: ny });
        }
      }
    }
    return neighbors;
  }

  perlinNoise(x, y, seed) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    x -= Math.floor(x);
    y -= Math.floor(y);
    const u = this.fade(x);
    const v = this.fade(y);
    const p = this.permutation(seed);
    const A = p[X] + Y;
    const B = p[X + 1] + Y;
    return this.lerp(v,
      this.lerp(u, this.grad(p[A], x, y), this.grad(p[B], x - 1, y)),
      this.lerp(u, this.grad(p[A + 1], x, y - 1), this.grad(p[B + 1], x - 1, y - 1))
    );
  }

  fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  lerp(t, a, b) { return a + t * (b - a); }
  grad(hash, x, y) {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  permutation(seed) {
    const p = [];
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(((seed + i) * 16807) % 256);
      [p[i], p[j]] = [p[j], p[i]];
    }
    return p.concat(p);
  }

  createWorldData() {
    const self = this;
    return {
      seed: this.seed,
      size: this.size,
      terrain: this.terrain,
      climate: this.climate,
      biomes: this.biomes,
      settlements: this.settlements,
      resources: this.resources,
      getTile(x, y) {
        if (x < 0 || x >= self.size.width || y < 0 || y >= self.size.height) return null;
        return {
          terrain: self.terrain[y][x],
          climate: self.climate[y][x],
          biome: self.biomes[y][x],
          resources: self.resources.get(`${x},${y}`) || []
        };
      }
    };
  }
}

class SeededRNG {
  constructor(seed) {
    this.seed = seed;
    this.state = seed;
  }
  next() {
    this.state = (this.state * 1664525 + 1013904223) % 4294967296;
    return this.state / 4294967296;
  }
  nextInt(min, max) {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
  choice(array) {
    return array[this.nextInt(0, array.length - 1)];
  }
}
