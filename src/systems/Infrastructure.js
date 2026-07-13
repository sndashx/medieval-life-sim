/**
 * Infrastructure.js
 * Roads, bridges, wells, drainage systems
 * Models construction, maintenance, degradation, usage
 */

export class Infrastructure {
  constructor(physicsOrKernel, gameOrPhysics = null) {
    if (physicsOrKernel && typeof physicsOrKernel.rng === 'object' && typeof physicsOrKernel.turn !== 'undefined') {
      this.kernel = physicsOrKernel;
      this.game = gameOrPhysics;
      this.physics = (gameOrPhysics && gameOrPhysics.physics) || null;
    } else if (gameOrPhysics && typeof gameOrPhysics.rng === 'object' && typeof gameOrPhysics.turn !== 'undefined') {
      this.physics = physicsOrKernel;
      this.kernel = gameOrPhysics;
      this.game = null;
    } else {
      this.physics = physicsOrKernel;
      this.kernel = null;
      this.game = null;
    }
    this.roads = new Map();
    this.bridges = new Map();
    this.wells = new Map();
    this.drainage = new Map();
    this.nextRoadId = 1;
    this.nextBridgeId = 1;
    this.nextWellId = 1;
    this.nextDrainageId = 1;
  }

  buildRoad(start, end, material, width) {
    const length = Math.sqrt(
      Math.pow(end.x - start.x, 2) +
      Math.pow(end.y - start.y, 2)
    );
    
    const road = {
      id: this.nextRoadId++,
      start: start,
      end: end,
      material: material, // dirt, gravel, cobblestone, paved
      width: width,
      length: length,
      condition: 1.0,
      built: this.kernel?.turn ?? 0,
      traffic: 0,
      maintenance: {
        lastRepair: this.kernel?.turn ?? 0,
        repairs: []
      },
      drainage: false
    };
    
    this.roads.set(road.id, road);
    
    return {
      success: true,
      road: road,
      cost: this.calculateRoadCost(road)
    };
  }

  calculateRoadCost(road) {
    const materialCosts = {
      dirt: 1,
      gravel: 5,
      cobblestone: 20,
      paved: 50
    };
    
    const baseCost = materialCosts[road.material] || 1;
    return baseCost * road.length * road.width;
  }

  buildBridge(location, span, material, capacity) {
    const bridge = {
      id: this.nextBridgeId++,
      location: location,
      span: span,
      material: material, // wood, stone, rope
      capacity: capacity, // max load
      condition: 1.0,
      built: this.kernel?.turn ?? 0,
      traffic: 0,
      maintenance: {
        lastInspection: this.kernel?.turn ?? 0,
        repairs: []
      }
    };
    
    this.bridges.set(bridge.id, bridge);
    
    return {
      success: true,
      bridge: bridge,
      cost: this.calculateBridgeCost(bridge)
    };
  }

  calculateBridgeCost(bridge) {
    const materialCosts = {
      wood: 100,
      stone: 500,
      rope: 50
    };
    
    const baseCost = materialCosts[bridge.material] || 100;
    return baseCost * bridge.span;
  }

  digWell(location, depth, lining) {
    const well = {
      id: this.nextWellId++,
      location: location,
      depth: depth,
      lining: lining, // none, wood, stone, brick
      waterLevel: depth * 0.7,
      waterQuality: 0.8,
      condition: 1.0,
      built: this.kernel?.turn ?? 0,
      usage: 0,
      contamination: 0,
      maintenance: {
        lastCleaning: this.kernel?.turn ?? 0,
        cleanings: []
      }
    };
    
    this.wells.set(well.id, well);
    
    return {
      success: true,
      well: well,
      cost: this.calculateWellCost(well)
    };
  }

  calculateWellCost(well) {
    const liningCosts = {
      none: 0,
      wood: 50,
      stone: 200,
      brick: 150
    };
    
    const baseCost = 100;
    const liningCost = liningCosts[well.lining] || 0;
    return baseCost * well.depth + liningCost;
  }

  buildDrainage(area, type, capacity) {
    const drainage = {
      id: this.nextDrainageId++,
      area: area,
      type: type, // ditch, culvert, sewer
      capacity: capacity, // liters per hour
      condition: 1.0,
      built: this.kernel?.turn ?? 0,
      clogged: 0,
      maintenance: {
        lastCleaning: this.kernel?.turn ?? 0,
        cleanings: []
      }
    };
    
    this.drainage.set(drainage.id, drainage);
    
    return {
      success: true,
      drainage: drainage,
      cost: this.calculateDrainageCost(drainage)
    };
  }

  calculateDrainageCost(drainage) {
    const typeCosts = {
      ditch: 10,
      culvert: 50,
      sewer: 100
    };
    
    const baseCost = typeCosts[drainage.type] || 10;
    return baseCost * drainage.area;
  }

  useRoad(roadId, traffic, weather) {
    const road = this.roads.get(roadId);
    if (!road) {
      return { success: false, reason: 'Unknown road' };
    }
    
    // Traffic causes wear
    const wear = this.calculateRoadWear(road, traffic, weather);
    road.condition = Math.max(0, road.condition - wear);
    road.traffic += traffic;
    
    // Calculate travel speed
    const speed = this.calculateTravelSpeed(road, weather);
    
    return {
      success: true,
      condition: road.condition,
      speed: speed,
      wear: wear
    };
  }

  calculateRoadWear(road, traffic, weather) {
    const materialDurability = {
      dirt: 0.1,
      gravel: 0.3,
      cobblestone: 0.7,
      paved: 0.9
    };
    
    const durability = materialDurability[road.material] || 0.5;
    let wear = traffic * 0.001 * (1 - durability);
    
    // Weather affects wear
    if (weather === 'rain') {
      wear *= 2;
    } else if (weather === 'snow') {
      wear *= 1.5;
    }
    
    // Drainage reduces wear
    if (road.drainage) {
      wear *= 0.7;
    }
    
    return wear;
  }

  calculateTravelSpeed(road, weather) {
    const materialSpeeds = {
      dirt: 3, // km/h
      gravel: 4,
      cobblestone: 5,
      paved: 6
    };
    
    let speed = materialSpeeds[road.material] || 3;
    
    // Condition affects speed
    speed *= road.condition;
    
    // Weather affects speed
    if (weather === 'rain') {
      speed *= 0.7;
    } else if (weather === 'snow') {
      speed *= 0.5;
    } else if (weather === 'ice') {
      speed *= 0.3;
    }
    
    return speed;
  }

  crossBridge(bridgeId, load) {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge) {
      return { success: false, reason: 'Unknown bridge' };
    }
    
    // Check capacity
    if (load > bridge.capacity * bridge.condition) {
      // Overload
      const damage = (load - bridge.capacity) / bridge.capacity * 0.1;
      bridge.condition = Math.max(0, bridge.condition - damage);
      
      if (bridge.condition <= 0.3) {
        return this.collapseBridge(bridgeId);
      }
      
      return {
        success: false,
        reason: 'Bridge overloaded',
        damage: damage,
        condition: bridge.condition
      };
    }
    
    // Normal wear
    const wear = load / bridge.capacity * 0.001;
    bridge.condition = Math.max(0, bridge.condition - wear);
    bridge.traffic += 1;
    
    return {
      success: true,
      condition: bridge.condition,
      safe: bridge.condition > 0.5
    };
  }

  collapseBridge(bridgeId) {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge) return { collapsed: false };
    
    bridge.collapsed = true;
    bridge.collapseDate = this.kernel?.turn ?? 0;
    bridge.condition = 0;
    
    return {
      collapsed: true,
      location: bridge.location,
      casualties: Math.floor(this.kernel.random() * 5) // Simplified
    };
  }

  drawWater(wellId, amount) {
    const well = this.wells.get(wellId);
    if (!well) {
      return { success: false, reason: 'Unknown well' };
    }
    
    // Check water availability
    if (well.waterLevel < amount) {
      return {
        success: false,
        reason: 'Insufficient water',
        available: well.waterLevel
      };
    }
    
    // Draw water
    well.waterLevel -= amount;
    well.usage += amount;
    
    // Water quality
    const quality = well.waterQuality * (1 - well.contamination);
    
    return {
      success: true,
      amount: amount,
      quality: quality,
      waterLevel: well.waterLevel
    };
  }

  rechargeWell(wellId, rainfall) {
    const well = this.wells.get(wellId);
    if (!well) return;
    
    // Groundwater recharge
    const recharge = rainfall * 0.3; // 30% infiltration
    well.waterLevel = Math.min(well.depth * 0.9, well.waterLevel + recharge);
  }

  contaminateWell(wellId, source, severity) {
    const well = this.wells.get(wellId);
    if (!well) {
      return { success: false, reason: 'Unknown well' };
    }
    
    well.contamination = Math.min(1, well.contamination + severity);
    well.waterQuality = Math.max(0, well.waterQuality - severity * 0.5);
    
    return {
      success: true,
      contamination: well.contamination,
      quality: well.waterQuality,
      source: source
    };
  }

  drainWater(drainageId, volume, rainfall) {
    const drainage = this.drainage.get(drainageId);
    if (!drainage) {
      return { success: false, reason: 'Unknown drainage' };
    }
    
    // Check capacity
    const effectiveCapacity = drainage.capacity * (1 - drainage.clogged) * drainage.condition;
    
    if (volume > effectiveCapacity) {
      // Overflow
      const overflow = volume - effectiveCapacity;
      
      return {
        success: false,
        reason: 'Drainage overflow',
        overflow: overflow,
        flooded: true
      };
    }
    
    // Drainage accumulates debris
    drainage.clogged = Math.min(1, drainage.clogged + 0.01);
    
    return {
      success: true,
      drained: volume,
      capacity: effectiveCapacity
    };
  }

  repairRoad(roadId, materials, workers) {
    const road = this.roads.get(roadId);
    if (!road) {
      return { success: false, reason: 'Unknown road' };
    }
    
    const skill = workers.reduce((sum, w) => sum + (w.skills?.crafting?.construction || 0.3), 0) / workers.length;
    
    // Repair effectiveness
    const repairAmount = skill * 0.3;
    road.condition = Math.min(1, road.condition + repairAmount);
    
    road.maintenance.repairs.push({
      date: this.kernel?.turn ?? 0,
      amount: repairAmount,
      workers: workers.map(w => w.id)
    });
    road.maintenance.lastRepair = this.kernel?.turn ?? 0;
    
    return {
      success: true,
      newCondition: road.condition,
      cost: this.calculateRoadCost(road) * (1 - road.condition)
    };
  }

  repairBridge(bridgeId, materials, workers) {
    const bridge = this.bridges.get(bridgeId);
    if (!bridge) {
      return { success: false, reason: 'Unknown bridge' };
    }
    
    const skill = workers.reduce((sum, w) => sum + (w.skills?.crafting?.construction || 0.3), 0) / workers.length;
    
    // Repair effectiveness
    const repairAmount = skill * 0.2;
    bridge.condition = Math.min(1, bridge.condition + repairAmount);
    
    bridge.maintenance.repairs.push({
      date: this.kernel?.turn ?? 0,
      amount: repairAmount,
      workers: workers.map(w => w.id)
    });
    bridge.maintenance.lastInspection = this.kernel?.turn ?? 0;
    
    return {
      success: true,
      newCondition: bridge.condition,
      cost: this.calculateBridgeCost(bridge) * (1 - bridge.condition)
    };
  }

  cleanWell(wellId, workers) {
    const well = this.wells.get(wellId);
    if (!well) {
      return { success: false, reason: 'Unknown well' };
    }
    
    // Cleaning reduces contamination
    well.contamination = Math.max(0, well.contamination - 0.5);
    well.waterQuality = Math.min(1, well.waterQuality + 0.3);
    
    well.maintenance.cleanings.push({
      date: this.kernel?.turn ?? 0,
      workers: workers.map(w => w.id)
    });
    well.maintenance.lastCleaning = this.kernel?.turn ?? 0;
    
    return {
      success: true,
      contamination: well.contamination,
      quality: well.waterQuality
    };
  }

  clearDrainage(drainageId, workers) {
    const drainage = this.drainage.get(drainageId);
    if (!drainage) {
      return { success: false, reason: 'Unknown drainage' };
    }
    
    // Clearing removes clogs
    drainage.clogged = Math.max(0, drainage.clogged - 0.7);
    
    drainage.maintenance.cleanings.push({
      date: this.kernel?.turn ?? 0,
      workers: workers.map(w => w.id)
    });
    drainage.maintenance.lastCleaning = this.kernel?.turn ?? 0;
    
    return {
      success: true,
      clogged: drainage.clogged,
      capacity: drainage.capacity * (1 - drainage.clogged)
    };
  }

  inspectInfrastructure(type, id, inspector) {
    const skill = inspector.skills?.crafting?.construction || 0.3;
    let infrastructure;
    
    switch (type) {
      case 'road':
        infrastructure = this.roads.get(id);
        break;
      case 'bridge':
        infrastructure = this.bridges.get(id);
        break;
      case 'well':
        infrastructure = this.wells.get(id);
        break;
      case 'drainage':
        infrastructure = this.drainage.get(id);
        break;
      default:
        return { success: false, reason: 'Unknown type' };
    }
    
    if (!infrastructure) {
      return { success: false, reason: 'Infrastructure not found' };
    }
    
    // Detect issues
    const issues = [];
    
    if (infrastructure.condition < 0.7) {
      issues.push({ type: 'poor_condition', severity: 1 - infrastructure.condition });
    }
    
    if (type === 'well' && infrastructure.contamination > 0.3) {
      issues.push({ type: 'contamination', severity: infrastructure.contamination });
    }
    
    if (type === 'drainage' && infrastructure.clogged > 0.5) {
      issues.push({ type: 'clogged', severity: infrastructure.clogged });
    }
    
    // Skill affects detection
    const detectedIssues = issues.filter(() => this.kernel.random() < skill);
    
    return {
      success: true,
      issues: detectedIssues,
      condition: infrastructure.condition,
      recommendation: detectedIssues.length > 0 ? 'maintenance_needed' : 'good_condition'
    };
  }

  getRoad(id) {
    return this.roads.get(id);
  }

  getBridge(id) {
    return this.bridges.get(id);
  }

  getWell(id) {
    return this.wells.get(id);
  }

  getDrainage(id) {
    return this.drainage.get(id);
  }

  getRoadsNear(location, radius) {
    return Array.from(this.roads.values())
      .filter(r => {
        const midX = (r.start.x + r.end.x) / 2;
        const midY = (r.start.y + r.end.y) / 2;
        const dx = midX - location.x;
        const dy = midY - location.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
      });
  }

  getWellsNear(location, radius) {
    return Array.from(this.wells.values())
      .filter(w => {
        const dx = w.location.x - location.x;
        const dy = w.location.y - location.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
      });
  }

  toJSON() {
    return {
      roads: Array.from(this.roads.entries()),
      bridges: Array.from(this.bridges.entries()),
      wells: Array.from(this.wells.entries()),
      drainage: Array.from(this.drainage.entries()),
      nextRoadId: this.nextRoadId,
      nextBridgeId: this.nextBridgeId,
      nextWellId: this.nextWellId,
      nextDrainageId: this.nextDrainageId
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.roads) this.roads = new Map(data.roads);
    if (data.bridges) this.bridges = new Map(data.bridges);
    if (data.wells) this.wells = new Map(data.wells);
    if (data.drainage) this.drainage = new Map(data.drainage);
    if (typeof data.nextRoadId === 'number') this.nextRoadId = data.nextRoadId;
    if (typeof data.nextBridgeId === 'number') this.nextBridgeId = data.nextBridgeId;
    if (typeof data.nextWellId === 'number') this.nextWellId = data.nextWellId;
    if (typeof data.nextDrainageId === 'number') this.nextDrainageId = data.nextDrainageId;
  }
}
