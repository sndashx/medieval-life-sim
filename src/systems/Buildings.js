/**
 * Buildings.js
 * Structure integrity, heating, fire risk, collapse mechanics
 * Models realistic building physics and maintenance
 */

export class Buildings {
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
    this.buildings = new Map();
    this.rooms = new Map();
    this.nextBuildingId = 1;
    this.nextRoomId = 1;
  }

  construct(location, design, materials, builders) {
    // Validate design
    const validation = this.validateDesign(design);
    if (!validation.valid) {
      return { success: false, reason: validation.reason };
    }
    
    // Check materials
    const materialCheck = this.checkMaterials(design, materials);
    if (!materialCheck.sufficient) {
      return { success: false, reason: materialCheck.reason };
    }
    
    // Calculate construction quality
    const quality = this.calculateConstructionQuality(builders, materials, design);
    
    const building = {
      id: this.nextBuildingId++,
      location: location,
      design: design,
      materials: materials,
      quality: quality,
      constructed: this.kernel?.turn ?? 0,
      integrity: 1.0,
      rooms: [],
      heating: this.initHeating(design),
      fireRisk: this.calculateFireRisk(materials, design),
      occupants: [],
      maintenance: {
        lastInspection: this.kernel?.turn ?? 0,
        repairs: [],
        condition: 1.0
      }
    };
    
    // Create rooms
    for (const roomDesign of design.rooms) {
      const room = this.createRoom(building.id, roomDesign);
      building.rooms.push(room.id);
    }
    
    this.buildings.set(building.id, building);
    
    return {
      success: true,
      building: building,
      constructionTime: this.calculateConstructionTime(design, builders.length)
    };
  }

  validateDesign(design) {
    // Check structural feasibility
    if (!design.foundation) {
      return { valid: false, reason: 'No foundation specified' };
    }
    
    if (!design.walls || design.walls.length === 0) {
      return { valid: false, reason: 'No walls specified' };
    }
    
    if (!design.roof) {
      return { valid: false, reason: 'No roof specified' };
    }
    
    // Check load bearing
    const maxHeight = this.calculateMaxHeight(design.foundation, design.walls);
    if (design.stories > maxHeight) {
      return { valid: false, reason: 'Design exceeds safe height' };
    }
    
    return { valid: true };
  }

  calculateMaxHeight(foundation, walls) {
    const foundationStrength = {
      stone: 5,
      brick: 4,
      wood: 2,
      earth: 1
    };
    
    const wallStrength = {
      stone: 4,
      brick: 3,
      timber_frame: 2,
      wattle_daub: 1
    };
    
    const fStrength = foundationStrength[foundation.material] || 1;
    const wStrength = wallStrength[walls[0].material] || 1;
    
    return Math.min(fStrength, wStrength);
  }

  checkMaterials(design, materials) {
    const required = this.calculateRequiredMaterials(design);
    
    for (const [material, amount] of Object.entries(required)) {
      if (!materials[material] || materials[material] < amount) {
        return {
          sufficient: false,
          reason: `Insufficient ${material} (need ${amount}, have ${materials[material] || 0})`
        };
      }
    }
    
    return { sufficient: true };
  }

  calculateRequiredMaterials(design) {
    const materials = {};
    
    // Foundation
    const foundationVolume = design.foundation.area * design.foundation.depth;
    materials[design.foundation.material] = foundationVolume;
    
    // Walls
    for (const wall of design.walls) {
      const wallVolume = wall.length * wall.height * wall.thickness;
      materials[wall.material] = (materials[wall.material] || 0) + wallVolume;
    }
    
    // Roof
    const roofArea = design.roof.area;
    materials[design.roof.material] = roofArea;
    
    return materials;
  }

  calculateConstructionQuality(builders, materials, design) {
    let quality = 0.5; // Base
    
    // Builder skill
    const avgSkill = builders.reduce((sum, b) => sum + (b.skills?.crafting?.construction || 0.3), 0) / builders.length;
    quality += avgSkill * 0.3;
    
    // Material quality
    const materialQuality = this.assessMaterialQuality(materials);
    quality += materialQuality * 0.2;
    
    return Math.min(1, quality);
  }

  assessMaterialQuality(materials) {
    // Simplified material quality assessment
    return 0.7;
  }

  calculateConstructionTime(design, builderCount) {
    const baseTime = design.area * 10; // hours per square meter
    const timeReduction = Math.log(builderCount + 1) * 0.3;
    return baseTime * (1 - timeReduction);
  }

  createRoom(buildingId, design) {
    const room = {
      id: this.nextRoomId++,
      building: buildingId,
      name: design.name,
      area: design.area,
      volume: design.area * design.height,
      temperature: 15, // Celsius
      ventilation: design.ventilation || 0.5,
      lighting: design.lighting || 0.3,
      occupants: [],
      furnishings: [],
      fireplace: design.fireplace || false
    };
    
    this.rooms.set(room.id, room);
    return room;
  }

  initHeating(design) {
    return {
      fireplaces: design.fireplaces || 0,
      active: false,
      fuelType: null,
      fuelRemaining: 0,
      efficiency: 0.3
    };
  }

  calculateFireRisk(materials, design) {
    let risk = 0.1; // Base risk
    
    // Material flammability
    const flammability = {
      wood: 0.8,
      thatch: 0.9,
      timber_frame: 0.7,
      wattle_daub: 0.5,
      stone: 0.1,
      brick: 0.2
    };
    
    for (const wall of design.walls) {
      risk += (flammability[wall.material] || 0.5) * 0.1;
    }
    
    risk += (flammability[design.roof.material] || 0.5) * 0.2;
    
    // Heating increases risk
    if (design.fireplaces > 0) {
      risk += design.fireplaces * 0.1;
    }
    
    return Math.min(1, risk);
  }

  heat(buildingId, roomId, fuelType, fuelAmount) {
    const building = this.buildings.get(buildingId);
    if (!building) {
      return { success: false, reason: 'Unknown building' };
    }
    
    const room = this.rooms.get(roomId);
    if (!room || room.building !== buildingId) {
      return { success: false, reason: 'Unknown or mismatched room' };
    }
    
    if (!room.fireplace) {
      return { success: false, reason: 'Room has no fireplace' };
    }
    
    // Calculate heat output
    const fuelEfficiency = {
      wood: 0.6,
      coal: 0.8,
      peat: 0.4,
      charcoal: 0.7
    };
    
    const efficiency = fuelEfficiency[fuelType] || 0.5;
    const heatOutput = fuelAmount * efficiency * 1000; // kJ
    
    // Heat room
    const temperatureIncrease = heatOutput / (room.volume * 1.2); // Simplified
    room.temperature = Math.min(25, room.temperature + temperatureIncrease);
    
    // Update heating status
    building.heating.active = true;
    building.heating.fuelType = fuelType;
    building.heating.fuelRemaining = fuelAmount;
    
    // Increase fire risk while heating
    const activeFireRisk = building.fireRisk * 2;
    
    return {
      success: true,
      temperature: room.temperature,
      fireRisk: activeFireRisk,
      fuelConsumed: fuelAmount
    };
  }

  updateTemperature(buildingId, ambientTemp, timeStep) {
    const building = this.buildings.get(buildingId);
    if (!building) return;
    
    for (const roomId of building.rooms) {
      const room = this.rooms.get(roomId);
      if (!room) continue;
      
      // Heat loss through walls and ventilation
      const insulation = this.calculateInsulation(building);
      const heatLoss = (room.temperature - ambientTemp) * (1 - insulation) * timeStep * 0.1;
      
      room.temperature = Math.max(ambientTemp, room.temperature - heatLoss);
      
      // Consume fuel if heating
      if (building.heating.active && building.heating.fuelRemaining > 0) {
        const fuelConsumption = timeStep * 0.1;
        building.heating.fuelRemaining -= fuelConsumption;
        
        if (building.heating.fuelRemaining <= 0) {
          building.heating.active = false;
        }
      }
    }
  }

  calculateInsulation(building) {
    const insulationValues = {
      stone: 0.6,
      brick: 0.5,
      timber_frame: 0.4,
      wattle_daub: 0.3,
      wood: 0.4,
      thatch: 0.5
    };
    
    let totalInsulation = 0;
    let count = 0;
    
    for (const wall of building.design.walls) {
      totalInsulation += insulationValues[wall.material] || 0.3;
      count++;
    }
    
    return count > 0 ? totalInsulation / count : 0.3;
  }

  checkFire(buildingId) {
    const building = this.buildings.get(buildingId);
    if (!building) return { fire: false };
    
    // Calculate current fire risk
    let currentRisk = building.fireRisk;
    
    if (building.heating.active) {
      currentRisk *= 2;
    }
    
    // Check for fire
    if (this.kernel.random() < currentRisk * 0.001) {
      return this.startFire(buildingId);
    }
    
    return { fire: false, risk: currentRisk };
  }

  startFire(buildingId) {
    const building = this.buildings.get(buildingId);
    if (!building) return { fire: false };
    
    const fire = {
      building: buildingId,
      started: this.kernel?.turn ?? 0,
      intensity: 0.1,
      spread: 0,
      rooms: [building.rooms[0]] // Start in first room
    };
    
    building.fire = fire;
    
    return {
      fire: true,
      location: building.location,
      intensity: fire.intensity
    };
  }

  updateFire(buildingId, timeStep) {
    const building = this.buildings.get(buildingId);
    if (!building || !building.fire) return;
    
    const fire = building.fire;
    
    // Fire grows
    fire.intensity = Math.min(1, fire.intensity + timeStep * 0.1);
    
    // Fire spreads to adjacent rooms
    if (fire.intensity > 0.5 && this.kernel.random() < 0.3) {
      for (const roomId of building.rooms) {
        if (!fire.rooms.includes(roomId)) {
          fire.rooms.push(roomId);
          break;
        }
      }
    }
    
    // Damage building
    building.integrity -= fire.intensity * timeStep * 0.05;
    
    // Check for collapse
    if (building.integrity <= 0) {
      return this.collapse(buildingId);
    }
    
    return {
      intensity: fire.intensity,
      roomsAffected: fire.rooms.length,
      integrity: building.integrity
    };
  }

  extinguishFire(buildingId, water) {
    const building = this.buildings.get(buildingId);
    if (!building || !building.fire) {
      return { success: false, reason: 'No fire' };
    }
    
    const fire = building.fire;
    
    // Water reduces fire intensity
    const reduction = water * 0.1;
    fire.intensity = Math.max(0, fire.intensity - reduction);
    
    if (fire.intensity <= 0) {
      delete building.fire;
      return {
        success: true,
        extinguished: true,
        damage: 1 - building.integrity
      };
    }
    
    return {
      success: true,
      extinguished: false,
      intensity: fire.intensity
    };
  }

  applyLoad(buildingId, load, location) {
    const building = this.buildings.get(buildingId);
    if (!building) {
      return { success: false, reason: 'Unknown building' };
    }
    
    // Calculate load capacity
    const capacity = this.calculateLoadCapacity(building);
    
    if (load > capacity) {
      // Overstressed
      const damage = (load - capacity) / capacity * 0.1;
      building.integrity -= damage;
      
      if (building.integrity <= 0) {
        return this.collapse(buildingId);
      }
      
      return {
        success: false,
        reason: 'Load exceeds capacity',
        damage: damage,
        integrity: building.integrity
      };
    }
    
    return {
      success: true,
      capacity: capacity,
      load: load
    };
  }

  calculateLoadCapacity(building) {
    const materialStrength = {
      stone: 1000,
      brick: 800,
      timber_frame: 500,
      wattle_daub: 200,
      wood: 400
    };
    
    let capacity = 0;
    
    for (const wall of building.design.walls) {
      capacity += (materialStrength[wall.material] || 300) * wall.thickness;
    }
    
    // Quality affects capacity
    capacity *= building.quality;
    
    return capacity;
  }

  collapse(buildingId) {
    const building = this.buildings.get(buildingId);
    if (!building) return { collapsed: false };
    
    building.collapsed = true;
    building.collapseDate = this.kernel?.turn ?? 0;
    building.integrity = 0;
    
    // Injure occupants
    const casualties = [];
    for (const occupantId of building.occupants) {
      casualties.push({
        person: occupantId,
        injury: 'crush',
        severity: this.kernel.random() * 0.8 + 0.2
      });
    }
    
    return {
      collapsed: true,
      casualties: casualties,
      location: building.location
    };
  }

  inspect(buildingId, inspector) {
    const building = this.buildings.get(buildingId);
    if (!building) {
      return { success: false, reason: 'Unknown building' };
    }
    
    const skill = inspector.skills?.crafting?.construction || 0.3;
    
    // Detect issues
    const issues = [];
    
    if (building.integrity < 0.9) {
      issues.push({ type: 'structural_damage', severity: 1 - building.integrity });
    }
    
    if (building.fireRisk > 0.5) {
      issues.push({ type: 'fire_hazard', severity: building.fireRisk });
    }
    
    // Skill affects detection
    const detectedIssues = issues.filter(() => this.kernel.random() < skill);
    
    building.maintenance.lastInspection = this.kernel?.turn ?? 0;
    
    return {
      success: true,
      issues: detectedIssues,
      integrity: building.integrity,
      recommendation: detectedIssues.length > 0 ? 'repair_needed' : 'good_condition'
    };
  }

  repair(buildingId, materials, workers) {
    const building = this.buildings.get(buildingId);
    if (!building) {
      return { success: false, reason: 'Unknown building' };
    }
    
    const skill = workers.reduce((sum, w) => sum + (w.skills?.crafting?.construction || 0.3), 0) / workers.length;
    
    // Calculate repair effectiveness
    const repairAmount = skill * 0.2;
    building.integrity = Math.min(1, building.integrity + repairAmount);
    
    building.maintenance.repairs.push({
      date: this.kernel?.turn ?? 0,
      amount: repairAmount,
      workers: workers.map(w => w.id)
    });
    
    return {
      success: true,
      newIntegrity: building.integrity,
      repairAmount: repairAmount
    };
  }

  getBuilding(id) {
    return this.buildings.get(id);
  }

  getRoom(id) {
    return this.rooms.get(id);
  }

  getBuildingsAt(location, radius) {
    return Array.from(this.buildings.values())
      .filter(b => {
        const dx = b.location.x - location.x;
        const dy = b.location.y - location.y;
        return Math.sqrt(dx * dx + dy * dy) <= radius;
      });
  }

  toJSON() {
    return {
      buildings: Array.from(this.buildings.entries()),
      rooms: Array.from(this.rooms.entries()),
      nextBuildingId: this.nextBuildingId,
      nextRoomId: this.nextRoomId
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.buildings) this.buildings = new Map(data.buildings);
    if (data.rooms) this.rooms = new Map(data.rooms);
    if (typeof data.nextBuildingId === 'number') this.nextBuildingId = data.nextBuildingId;
    if (typeof data.nextRoomId === 'number') this.nextRoomId = data.nextRoomId;
  }
}
