/**
 * Physiology.js
 * Complete human anatomy and physiological simulation
 * Models organs, tissues, metabolism, homeostasis, injury, disease
 */

export class Physiology {
  constructor(age, sex, genetics, kernel = null) {
    this.kernel = kernel;
    this.age = age; // years
    this.sex = sex; // 'male' or 'female'
    this.genetics = genetics;
    
    // Anatomical systems
    this.anatomy = this.initAnatomy();
    this.bloodVolume = this.calculateBloodVolume(); // liters
    this.bodyTemperature = 37.0; // celsius
    
    // Metabolic state
    this.metabolism = {
      basalRate: this.calculateBMR(), // kcal/day
      currentRate: 0,
      energyStores: 80000, // kcal in fat/glycogen
      proteinReserve: 15000 // kcal equivalent
    };
    
    // Homeostasis
    this.hydration = 1.0; // 0-1 scale
    this.bloodSugar = 90; // mg/dL
    this.electrolytes = { sodium: 140, potassium: 4.0, calcium: 9.5 }; // mEq/L
    this.oxygenSaturation = 0.98; // 0-1
    
    // Vital signs
    this.heartRate = 70; // bpm
    this.respiratoryRate = 16; // breaths/min
    this.bloodPressure = { systolic: 120, diastolic: 80 }; // mmHg
    
    // Conditions
    this.injuries = [];
    this.diseases = [];
    this.disabilities = [];
    this.pain = 0; // 0-10 scale
    this.fatigue = 0; // 0-1 scale
    this.stress = 0; // 0-1 scale
    
    // Reproductive state
    this.fertility = this.calculateFertility();
    this.pregnant = false;
    this.gestationDay = 0;
    this.lactating = false;
    
    // Immune system
    this.immunity = new Map(); // pathogen -> immunity level
    this.immuneStrength = 1.0;
    
    // Developmental stage
    this.developmentStage = this.getDevelopmentStage();
    this.growthComplete = age >= 18;
  }

  initAnatomy() {
    return {
      head: {
        skull: { integrity: 1.0, fractured: false },
        brain: { function: 1.0, swelling: 0, bleeding: 0 },
        eyes: { left: 1.0, right: 1.0 },
        ears: { left: 1.0, right: 1.0 },
        jaw: { integrity: 1.0, fractured: false },
        teeth: Array(32).fill(1.0)
      },
      torso: {
        spine: { integrity: 1.0, damaged: [] },
        ribs: Array(24).fill(1.0),
        heart: { function: 1.0, damaged: false },
        lungs: { left: 1.0, right: 1.0 },
        liver: { function: 1.0, damaged: false },
        stomach: { function: 1.0, contents: [] },
        intestines: { function: 1.0, contents: [] },
        kidneys: { left: 1.0, right: 1.0 },
        spleen: { function: 1.0 },
        pancreas: { function: 1.0 }
      },
      limbs: {
        leftArm: { integrity: 1.0, fractured: false, nerves: 1.0, arteries: 1.0 },
        rightArm: { integrity: 1.0, fractured: false, nerves: 1.0, arteries: 1.0 },
        leftLeg: { integrity: 1.0, fractured: false, nerves: 1.0, arteries: 1.0 },
        rightLeg: { integrity: 1.0, fractured: false, nerves: 1.0, arteries: 1.0 }
      },
      skin: {
        coverage: 1.0,
        burns: [],
        lacerations: [],
        infections: []
      }
    };
  }

  calculateBloodVolume() {
    // ~70 mL/kg body weight
    const bodyWeight = this.genetics.baseWeight;
    return (bodyWeight * 0.07);
  }

  calculateBMR() {
    // Mifflin-St Jeor equation
    const weight = this.genetics.baseWeight;
    const height = this.genetics.height;
    const age = this.age;
    
    if (this.sex === 'male') {
      return 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
      return 10 * weight + 6.25 * height - 5 * age - 161;
    }
  }

  calculateFertility() {
    if (this.sex === 'male') {
      if (this.age < 14) return 0;
      if (this.age < 18) return 0.5;
      if (this.age < 50) return 1.0;
      if (this.age < 70) return 0.5;
      return 0.1;
    } else {
      if (this.age < 12) return 0;
      if (this.age < 16) return 0.3;
      if (this.age < 35) return 1.0;
      if (this.age < 45) return 0.5;
      if (this.age < 50) return 0.1;
      return 0;
    }
  }

  getDevelopmentStage() {
    if (this.age < 1) return 'infant';
    if (this.age < 3) return 'toddler';
    if (this.age < 12) return 'child';
    if (this.age < 18) return 'adolescent';
    if (this.age < 65) return 'adult';
    return 'elderly';
  }

  update(kernel) {
    const minutesPerTurn = 1;

    // Infants (age < 2) are completely protected from all physiological
    // degradation. The simulation doesn't model the real-world care that
    // keeps infants alive (feeding, warmth, protection). Without this
    // exemption, all newborns die immediately.
    const isInfant = this.age < 2;
    
    if (!isInfant) {
      this.updateMetabolism(minutesPerTurn);
      this.updateHomeostasis(minutesPerTurn, kernel);
      this.updateInjuries(minutesPerTurn, kernel);
      this.updateDiseases(minutesPerTurn, kernel);
    }

    if (this.pregnant) this.updatePregnancy(minutesPerTurn, kernel);

    this.updateAging(minutesPerTurn);

    return this.checkVitals();
  }

  updateMetabolism(minutes) {
    const hours = minutes / 60;
    
    // Calculate energy expenditure
    const activityMultiplier = 1.2; // sedentary to very active
    const energyExpended = (this.metabolism.basalRate / 24) * hours * activityMultiplier;
    
    // Deplete energy stores
    this.metabolism.energyStores -= energyExpended;
    
    // Starvation effects
    if (this.metabolism.energyStores < 20000) {
      this.fatigue += 0.01;
      this.immuneStrength *= 0.99;
    }
    
    if (this.metabolism.energyStores < 5000) {
      // Severe starvation - organ damage
      this.anatomy.torso.heart.function *= 0.999;
      this.anatomy.torso.liver.function *= 0.999;
    }
    
    // Protein catabolism in starvation
    if (this.metabolism.energyStores < 10000) {
      this.metabolism.proteinReserve -= energyExpended * 0.3;
      if (this.metabolism.proteinReserve < 5000) {
        // Muscle wasting, organ failure
        this.anatomy.torso.heart.function *= 0.998;
      }
    }
  }

  updateHomeostasis(minutes, kernel) {
    // Dehydration
    const waterLoss = 0.001 * (minutes / 60); // ~2L per day
    this.hydration -= waterLoss;
    
    if (this.hydration < 0.7) {
      this.bloodPressure.systolic -= 1;
      this.heartRate += 1;
      this.fatigue += 0.01;
    }
    
    if (this.hydration < 0.5) {
      // Severe dehydration
      this.anatomy.torso.kidneys.left *= 0.99;
      this.anatomy.torso.kidneys.right *= 0.99;
      // Infants are protected from blood volume loss
      if (this.age >= 2) {
        this.bloodVolume *= 0.99;
      }
    }
    
    // Thermoregulation — infants (age < 2) maintain perfect homeostasis.
    // For others, use ambient temperature from world tile if available,
    // otherwise maintain current body temperature.
    if (this.age >= 2) {
      let ambientTemp = this.bodyTemperature;
      try {
        const owner = this._owner;
        const world = kernel && kernel.world;
        if (world && owner && owner.position && typeof world.getTile === 'function') {
          const tile = world.getTile(owner.position.x, owner.position.y);
          if (tile && tile.climate && typeof tile.climate.temperature === 'number') {
            ambientTemp = tile.climate.temperature;
          }
        }
      } catch (_) {
        // If world lookup fails, maintain current body temperature.
      }
      const tempDiff = ambientTemp - this.bodyTemperature;
      this.bodyTemperature += tempDiff * 0.01;
    }
    
    if (this.bodyTemperature < 35) {
      // Hypothermia
      this.heartRate -= 1;
      this.fatigue += 0.02;
    }
    
    if (this.bodyTemperature > 40) {
      // Hyperthermia
      this.heartRate += 2;
      this.anatomy.head.brain.function *= 0.99;
    }
    
    // Blood sugar regulation
    this.bloodSugar -= 0.5 * (minutes / 60);
    if (this.bloodSugar < 70) {
      this.fatigue += 0.01;
      this.anatomy.head.brain.function *= 0.999;
    }
  }

  updateInjuries(minutes, kernel) {
    for (let i = this.injuries.length - 1; i >= 0; i--) {
      const injury = this.injuries[i];
      
      // Bleeding
      if (injury.bleeding > 0) {
        const bloodLoss = injury.bleeding * (minutes / 60);
        this.bloodVolume -= bloodLoss;
        injury.bleeding *= 0.95; // clotting
      }
      
      // Infection risk
      if (injury.open && this.kernel.rng.next() < 0.001 * minutes) {
        injury.infected = true;
        this.addDisease({
          type: 'wound_infection',
          severity: 0.3,
          location: injury.location
        });
      }
      
      // Healing
      if (!injury.infected) {
        injury.severity *= 0.999; // slow healing
        if (injury.severity < 0.1) {
          // swap-pop — O(1) removal
          const last = this.injuries.pop();
          if (i < this.injuries.length) this.injuries[i] = last;
        }
      }
    }
    
    // Blood loss effects
    if (this.bloodVolume < 4.0) {
      this.bloodPressure.systolic -= 2;
      this.heartRate += 2;
      this.oxygenSaturation -= 0.01;
    }
    
    if (this.bloodVolume < 3.0) {
      // Severe hemorrhage
      this.anatomy.head.brain.function *= 0.99;
      this.anatomy.torso.heart.function *= 0.99;
    }
  }

  updateDiseases(minutes, kernel) {
    // Iterate backwards so swap-pop removal doesn't skip elements
    for (let i = this.diseases.length - 1; i >= 0; i--) {
      const disease = this.diseases[i];

      disease.progression += 0.001 * minutes;

      const immuneEffect = this.immuneStrength * (this.immunity.get(disease.type) || 0);
      disease.severity -= immuneEffect * 0.001 * minutes;

      if (disease.type === 'fever') {
        this.bodyTemperature = 38 + disease.severity * 3;
        this.metabolism.basalRate *= 1.1;
      } else if (disease.type === 'pneumonia') {
        this.anatomy.torso.lungs.left *= 0.999;
        this.anatomy.torso.lungs.right *= 0.999;
        this.oxygenSaturation -= 0.001;
      } else if (disease.type === 'dysentery') {
        this.hydration -= 0.002 * minutes;
        this.electrolytes.sodium -= 0.1;
      }

      if (!this.immunity.has(disease.type)) this.immunity.set(disease.type, 0);
      this.immunity.set(disease.type, this.immunity.get(disease.type) + 0.001 * minutes);

      // Recovery — swap-pop removal
      if (disease.severity < 0.1) {
        const last = this.diseases.pop();
        if (i < this.diseases.length) this.diseases[i] = last;
      }
    }
  }

  updatePregnancy(minutes, kernel) {
    this.gestationDay += minutes / 1440; // minutes to days

    // Nutritional demands
    this.metabolism.basalRate *= 1.15;

    // Complications
    if (this.metabolism.energyStores < 30000) {
      const r = this.kernel ? this.kernel.rng : null;
      if (r.next() < 0.0001 * minutes) {
        this.miscarriage(r);
      }
    }

    // Birth
    if (this.gestationDay >= 280) {
      return this.giveBirth(r);
    }

    return null;
  }

  updateAging(minutes) {
    // T1-7: 1 game year = 2000 turns. The kernel advances 1 minute per turn
    // (see SimulationKernel.tick calling worldTime.advance(1)), so minutes
    // grows linearly with turn. Scale the per-minute aging rate so a year
    // passes in ~2000 turns instead of 525600.
    // Seed from owning Person.age if it was bumped externally (test rigs
    // routinely overwrite Person.age without touching Physiology.age).
    if (this._owner && this._owner.age > this.age) this.age = this._owner.age;
    const delta = (minutes / 1440) / 365 * (525600 / 2000);
    this.age += delta;
    // Sync with the owning Person if any (kernel doesn't auto-sync age back
    // to Person; Person.update only mutates Person-side state).
    if (this._owner) this._owner.age = this.age;

    // Developmental growth
    if (!this.growthComplete && this.age >= 18) {
      this.growthComplete = true;
    }
    
    // Senescence
    if (this.age > 50) {
      const agingRate = (this.age - 50) / 1000;
      this.anatomy.torso.heart.function -= agingRate * minutes;
      this.anatomy.torso.lungs.left -= agingRate * minutes;
      this.anatomy.torso.lungs.right -= agingRate * minutes;
      this.anatomy.torso.kidneys.left -= agingRate * minutes;
      this.anatomy.torso.kidneys.right -= agingRate * minutes;
    }
    
    // Update fertility
    this.fertility = this.calculateFertility();
    this.developmentStage = this.getDevelopmentStage();
  }

  checkVitals() {
    // Round-3 fix: infants (age < 2) are completely exempt from all
    // physiology-based death causes. The simulation doesn't model blankets,
    // maternal body heat, hearth proximity, lactation, or other real-world
    // protections that keep newborns alive. Without this exemption, every
    // newly-spawned character dies as a newborn before the player can act.
    // Flagged by Maya, Dale, Priya, Lena, Kai (round-3 alpha testers).
    const isInfant = this.age < 2;
    if (isInfant) {
      // Infants are immune to all physiological death - return alive immediately
      return { alive: true };
    }

    // Death conditions
    if (this.bloodVolume < 2.0) {
      return { alive: false, cause: 'exsanguination' };
    }

    if (this.anatomy.torso.heart.function < 0.2) {
      return { alive: false, cause: 'heart_failure' };
    }

    if (this.anatomy.head.brain.function < 0.3) {
      return { alive: false, cause: 'brain_death' };
    }

    if (this.oxygenSaturation < 0.5) {
      return { alive: false, cause: 'hypoxia' };
    }

    if (this.bodyTemperature < 28 || this.bodyTemperature > 43) {
      return { alive: false, cause: 'temperature_extremes' };
    }

    if (this.metabolism.energyStores < 0 && this.metabolism.proteinReserve < 0) {
      return { alive: false, cause: 'starvation' };
    }
    
    return { alive: true };
  }

  applyInjury(injury) {
    this.injuries.push(injury);
    
    // Immediate effects
    if (injury.bleeding > 0) {
      this.pain += injury.severity * 3;
    }
    
    // Organ damage
    if (injury.location.includes('torso')) {
      const organ = injury.organ;
      if (organ && this.anatomy.torso[organ]) {
        this.anatomy.torso[organ].function -= injury.severity;
        this.anatomy.torso[organ].damaged = true;
      }
    }
    
    // Fractures
    if (injury.fractured) {
      const limb = injury.location;
      if (this.anatomy.limbs[limb]) {
        this.anatomy.limbs[limb].fractured = true;
        this.anatomy.limbs[limb].integrity -= injury.severity;
      }
    }
    
    // Nerve damage
    if (injury.nervesDamaged) {
      const limb = injury.location;
      if (this.anatomy.limbs[limb]) {
        this.anatomy.limbs[limb].nerves -= injury.severity;
      }
    }
  }

  addDisease(disease) {
    this.diseases.push(disease);
  }

  consume(food, rng) {
    const energy = food.calories || 0;
    const protein = food.protein || 0;
    const water = food.water || 0;

    this.metabolism.energyStores += energy;
    this.metabolism.proteinReserve += protein * 4;
    this.hydration = Math.min(1.0, this.hydration + water);
    this.bloodSugar += food.carbohydrates || 0;

    if (food.contaminated) {
      if (this.kernel.rng.next() < 0.5) {
        this.addDisease({ type: 'food_poisoning', severity: 0.5, progression: 0 });
      }
    }
  }

  drink(liquid, rng) {
    this.hydration = Math.min(1.0, this.hydration + liquid.volume);

    if (liquid.contaminated) {
      if (this.kernel.rng.next() < 0.3) {
        this.addDisease({ type: 'dysentery', severity: 0.6, progression: 0 });
      }
    }
  }

  conceive(partner, rng) {
    if (!this.canConceive() || !partner.canConceive()) return false;

    const fertilityChance = (this.fertility + partner.fertility) / 2;
    if (this.kernel.rng.next() < fertilityChance * 0.25) {
      this.pregnant = true;
      this.gestationDay = 0;
      return true;
    }
    return false;
  }

  canConceive() {
    return this.sex === 'female' && 
           this.fertility > 0 && 
           !this.pregnant && 
           this.metabolism.energyStores > 40000;
  }

  giveBirth(rng) {
    this.pregnant = false;
    this.lactating = true;
    this.gestationDay = 0;

    const complicationRisk = 0.05;
    if (this.kernel.rng.next() < complicationRisk) {
      this.applyInjury({ location: 'torso', severity: 0.3, bleeding: 0.1, open: true, infected: false });
    }

    return {
      type: 'birth',
      sex: this.kernel.rng.next() < 0.5 ? 'male' : 'female',
      genetics: this.genetics
    };
  }

  miscarriage(rng) {
    this.pregnant = false;
    this.gestationDay = 0;
    this.applyInjury({ location: 'torso', severity: 0.2, bleeding: 0.05, open: true, infected: false });
  }

  getCapabilities() {
    const stage = this.developmentStage;
    const health = this.getHealthStatus();
    
    return {
      canWalk: stage !== 'infant' && health.mobility > 0.3,
      canRun: stage !== 'infant' && stage !== 'toddler' && health.mobility > 0.6,
      canManipulate: stage !== 'infant' && health.dexterity > 0.3,
      canSpeak: stage !== 'infant',
      canRead: stage !== 'infant' && stage !== 'toddler',
      canWork: stage === 'adolescent' || stage === 'adult',
      canFight: stage === 'adolescent' || stage === 'adult' && health.strength > 0.4,
      needsCare: stage === 'infant' || stage === 'toddler' || health.overall < 0.3
    };
  }

  getHealthStatus() {
    const limbFunction = (
      this.anatomy.limbs.leftArm.integrity +
      this.anatomy.limbs.rightArm.integrity +
      this.anatomy.limbs.leftLeg.integrity +
      this.anatomy.limbs.rightLeg.integrity
    ) / 4;
    
    const organFunction = (
      this.anatomy.torso.heart.function +
      this.anatomy.torso.lungs.left +
      this.anatomy.torso.lungs.right +
      this.anatomy.torso.liver.function +
      this.anatomy.torso.kidneys.left +
      this.anatomy.torso.kidneys.right
    ) / 6;
    
    return {
      overall: (limbFunction + organFunction + this.anatomy.head.brain.function) / 3,
      mobility: limbFunction,
      strength: limbFunction * (1 - this.fatigue),
      dexterity: this.anatomy.limbs.rightArm.nerves * (1 - this.fatigue),
      cognition: this.anatomy.head.brain.function,
      pain: this.pain,
      fatigue: this.fatigue
    };
  }
}
