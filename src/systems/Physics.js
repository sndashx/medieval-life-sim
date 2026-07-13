/**
 * Physics.js
 * Naturalistic physics simulation for objects, forces, and interactions
 * Models: gravity, momentum, friction, heat transfer, sound, light
 */

export class Physics {
  constructor(kernel = null, game = null) {
    this.kernel = kernel || game?.kernel || null;
    this.game = game || null;
    this.gravity = 9.81; // m/s²
    this.airDensity = 1.225; // kg/m³ at sea level
    this.speedOfSound = 343; // m/s at 20°C
    this.speedOfLight = 299792458; // m/s (instant for gameplay)
  }

  // Gravity and falling
  calculateFallDamage(height, mass) {
    const velocity = Math.sqrt(2 * this.gravity * height);
    const kineticEnergy = 0.5 * mass * velocity * velocity;
    const impactForce = kineticEnergy / 0.1; // assume 0.1m deceleration distance
    
    return {
      velocity: velocity,
      energy: kineticEnergy,
      force: impactForce,
      severity: Math.min(1, impactForce / 10000) // normalized damage
    };
  }

  // Projectile motion
  calculateTrajectory(initialVelocity, angle, height = 0) {
    const vx = initialVelocity * Math.cos(angle);
    const vy = initialVelocity * Math.sin(angle);
    
    const timeToGround = (vy + Math.sqrt(vy * vy + 2 * this.gravity * height)) / this.gravity;
    const range = vx * timeToGround;
    const maxHeight = height + (vy * vy) / (2 * this.gravity);
    
    return { range, maxHeight, timeToGround };
  }

  // Momentum and collision
  calculateCollision(mass1, velocity1, mass2, velocity2, restitution = 0.5) {
    const totalMomentum = mass1 * velocity1 + mass2 * velocity2;
    const relativeVelocity = velocity1 - velocity2;
    
    const v1Final = (mass1 * velocity1 + mass2 * velocity2 - mass2 * restitution * relativeVelocity) / (mass1 + mass2);
    const v2Final = (mass1 * velocity1 + mass2 * velocity2 + mass1 * restitution * relativeVelocity) / (mass1 + mass2);
    
    const energyLost = 0.5 * mass1 * velocity1 * velocity1 + 0.5 * mass2 * velocity2 * velocity2 -
                       (0.5 * mass1 * v1Final * v1Final + 0.5 * mass2 * v2Final * v2Final);
    
    return { v1Final, v2Final, energyLost };
  }

  // Friction
  calculateFriction(normalForce, coefficientOfFriction, isStatic = false) {
    return normalForce * coefficientOfFriction;
  }

  // Heat transfer
  calculateHeatTransfer(temp1, temp2, thermalConductivity, area, thickness, time) {
    const heatFlow = (thermalConductivity * area * (temp1 - temp2) * time) / thickness;
    return heatFlow; // Joules
  }

  // Combustion
  canIgnite(material, temperature, oxygenLevel) {
    const ignitionTemps = {
      wood: 300, // °C
      cloth: 250,
      paper: 233,
      oil: 210,
      coal: 400,
      straw: 200
    };
    
    const ignitionTemp = ignitionTemps[material] || 500;
    return temperature >= ignitionTemp && oxygenLevel > 0.16;
  }

  calculateBurnRate(material, oxygenLevel, windSpeed) {
    const baseBurnRates = {
      wood: 0.5, // kg/hour
      cloth: 1.0,
      paper: 2.0,
      oil: 0.8,
      coal: 0.3,
      straw: 3.0
    };
    
    const baseRate = baseBurnRates[material] || 0.5;
    const oxygenFactor = Math.min(1, oxygenLevel / 0.21);
    const windFactor = 1 + windSpeed * 0.1;
    
    return baseRate * oxygenFactor * windFactor;
  }

  // Sound propagation
  calculateSoundAttenuation(distance, frequency, temperature = 20, humidity = 50) {
    // Simplified atmospheric absorption
    const alpha = 0.1 + frequency / 1000; // dB per meter
    const attenuation = alpha * distance;
    return attenuation;
  }

  calculateSoundLevel(sourceLevel, distance) {
    // Inverse square law
    const distanceAttenuation = 20 * Math.log10(distance);
    return sourceLevel - distanceAttenuation;
  }

  // Light and visibility
  calculateVisibility(distance, weather, timeOfDay) {
    let baseVisibility = 10000; // meters in clear conditions
    
    if (weather === 'fog') baseVisibility = 100;
    else if (weather === 'rain') baseVisibility = 1000;
    else if (weather === 'snow') baseVisibility = 500;
    
    if (timeOfDay === 'night') baseVisibility *= 0.1;
    else if (timeOfDay === 'twilight') baseVisibility *= 0.5;
    
    return distance <= baseVisibility;
  }

  calculateIllumination(lightSource, distance) {
    const intensities = {
      candle: 12, // lumens
      torch: 100,
      fire: 500,
      sun: 100000
    };
    
    const intensity = intensities[lightSource] || 10;
    const illumination = intensity / (4 * Math.PI * distance * distance);
    return illumination; // lux
  }

  // Structural loads
  calculateStress(force, area) {
    return force / area; // Pascals
  }

  willStructureFail(stress, material) {
    const yieldStrengths = {
      wood: 40e6, // Pa (along grain)
      stone: 50e6,
      brick: 10e6,
      iron: 250e6,
      steel: 400e6
    };
    
    const yieldStrength = yieldStrengths[material] || 10e6;
    return stress > yieldStrength;
  }

  // Buoyancy
  calculateBuoyancy(volume, fluidDensity = 1000) {
    return volume * fluidDensity * this.gravity; // Newtons
  }

  willFloat(objectMass, objectVolume, fluidDensity = 1000) {
    const objectDensity = objectMass / objectVolume;
    return objectDensity < fluidDensity;
  }

  // Pressure
  calculatePressure(depth, fluidDensity = 1000) {
    return fluidDensity * this.gravity * depth; // Pascals
  }

  // Leverage and mechanical advantage
  calculateLeverForce(inputForce, inputDistance, outputDistance) {
    const mechanicalAdvantage = inputDistance / outputDistance;
    return inputForce * mechanicalAdvantage;
  }

  calculatePulleyAdvantage(numberOfRopes) {
    return numberOfRopes; // ideal mechanical advantage
  }
}

export class MaterialPhysics {
  constructor(kernel = null, game = null) {
    this.kernel = kernel || game?.kernel || null;
    this.game = game || null;
    this.materials = this.initMaterials();
  }

  initMaterials() {
    return {
      wood: {
        density: 600, // kg/m³
        hardness: 2.5, // Mohs scale
        tensileStrength: 100e6, // Pa
        compressiveStrength: 50e6,
        elasticity: 10e9, // Young's modulus
        thermalConductivity: 0.15, // W/(m·K)
        meltingPoint: null,
        ignitionPoint: 300 // °C
      },
      iron: {
        density: 7870,
        hardness: 4.5,
        tensileStrength: 400e6,
        compressiveStrength: 400e6,
        elasticity: 200e9,
        thermalConductivity: 80,
        meltingPoint: 1538,
        ignitionPoint: null
      },
      stone: {
        density: 2700,
        hardness: 6,
        tensileStrength: 10e6,
        compressiveStrength: 100e6,
        elasticity: 50e9,
        thermalConductivity: 2,
        meltingPoint: 1200,
        ignitionPoint: null
      },
      leather: {
        density: 900,
        hardness: 2,
        tensileStrength: 20e6,
        compressiveStrength: 5e6,
        elasticity: 0.1e9,
        thermalConductivity: 0.14,
        meltingPoint: null,
        ignitionPoint: 200
      },
      cloth: {
        density: 300,
        hardness: 1,
        tensileStrength: 50e6,
        compressiveStrength: 1e6,
        elasticity: 5e9,
        thermalConductivity: 0.04,
        meltingPoint: null,
        ignitionPoint: 250
      }
    };
  }

  calculateWear(material, force, cycles) {
    const mat = this.materials[material];
    if (!mat) return 0;
    
    const wearRate = force / mat.hardness;
    return wearRate * cycles;
  }

  calculateDeformation(material, stress, time) {
    const mat = this.materials[material];
    if (!mat) return 0;
    
    const strain = stress / mat.elasticity;
    const creep = strain * time * 0.0001; // simplified creep
    return strain + creep;
  }

  willBreak(material, stress, impactEnergy) {
    const mat = this.materials[material];
    if (!mat) return true;
    
    const stressFailure = stress > mat.tensileStrength;
    const energyThreshold = mat.tensileStrength * 0.001; // simplified
    const impactFailure = impactEnergy > energyThreshold;
    
    return stressFailure || impactFailure;
  }

  calculateSharpness(material, edgeAngle, wear) {
    const mat = this.materials[material];
    if (!mat) return 0;
    
    const baseSharpness = mat.hardness / edgeAngle;
    const wearFactor = Math.max(0, 1 - wear);
    return baseSharpness * wearFactor;
  }

  calculatePenetration(projectileMass, velocity, targetMaterial, targetThickness) {
    const target = this.materials[targetMaterial];
    if (!target) return velocity > 10;
    
    const kineticEnergy = 0.5 * projectileMass * velocity * velocity;
    const resistanceEnergy = target.compressiveStrength * targetThickness * 0.001;
    
    return kineticEnergy > resistanceEnergy;
  }
}
