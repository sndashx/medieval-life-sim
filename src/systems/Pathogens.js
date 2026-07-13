/**
 * Pathogens.js
 * Disease transmission, incubation, vectors, immunity
 * Models realistic epidemiology without magic
 */

export class Pathogens {
  constructor(kernel, game) {
    this.kernel = kernel || game?.kernel || null;
    this.diseases = new Map();
    this.infections = new Map();
    this.outbreaks = new Map();
    this.nextInfectionId = 1;
    this.nextOutbreakId = 1;
    this.initDiseases();
  }

  initDiseases() {
    // Bacterial diseases
    this.defineDisease('plague', {
      type: 'bacterial',
      transmission: ['flea', 'respiratory', 'contact'],
      incubationPeriod: 2, // days
      infectiousPeriod: 7,
      symptoms: ['fever', 'swelling', 'pain', 'weakness'],
      mortality: 0.6,
      immunity: 'temporary',
      immunityDuration: 365,
      vector: 'flea',
      seasonality: 'warm'
    });

    this.defineDisease('dysentery', {
      type: 'bacterial',
      transmission: ['water', 'food', 'contact'],
      incubationPeriod: 1,
      infectiousPeriod: 5,
      symptoms: ['diarrhea', 'fever', 'cramps', 'dehydration'],
      mortality: 0.1,
      immunity: 'temporary',
      immunityDuration: 180,
      vector: null,
      seasonality: 'summer'
    });

    // Viral diseases
    this.defineDisease('smallpox', {
      type: 'viral',
      transmission: ['respiratory', 'contact'],
      incubationPeriod: 12,
      infectiousPeriod: 14,
      symptoms: ['fever', 'rash', 'pustules', 'scarring'],
      mortality: 0.3,
      immunity: 'permanent',
      immunityDuration: Infinity,
      vector: null,
      seasonality: 'winter'
    });

    this.defineDisease('influenza', {
      type: 'viral',
      transmission: ['respiratory'],
      incubationPeriod: 2,
      infectiousPeriod: 7,
      symptoms: ['fever', 'cough', 'fatigue', 'aches'],
      mortality: 0.02,
      immunity: 'temporary',
      immunityDuration: 365,
      vector: null,
      seasonality: 'winter'
    });

    // Parasitic diseases
    this.defineDisease('malaria', {
      type: 'parasitic',
      transmission: ['mosquito'],
      incubationPeriod: 10,
      infectiousPeriod: 30,
      symptoms: ['fever', 'chills', 'sweating', 'weakness'],
      mortality: 0.15,
      immunity: 'partial',
      immunityDuration: 180,
      vector: 'mosquito',
      seasonality: 'warm'
    });
  }

  defineDisease(name, properties) {
    this.diseases.set(name, {
      name: name,
      ...properties,
      r0: this.calculateR0(properties),
      contagiousness: this.calculateContagiousness(properties)
    });
  }

  calculateR0(properties) {
    // Basic reproduction number
    let r0 = 1.0;
    
    if (properties.transmission.includes('respiratory')) r0 += 2;
    if (properties.transmission.includes('contact')) r0 += 1;
    if (properties.transmission.includes('water')) r0 += 1.5;
    if (properties.transmission.includes('food')) r0 += 1;
    if (properties.vector) r0 += 1;
    
    return r0;
  }

  calculateContagiousness(properties) {
    return properties.infectiousPeriod * 0.1;
  }

  expose(person, diseaseName, source, route) {
    const disease = this.diseases.get(diseaseName);
    if (!disease) return { success: false, reason: 'Unknown disease' };
    
    // Check immunity
    if (this.hasImmunity(person, diseaseName)) {
      return { success: false, reason: 'Immune' };
    }
    
    // Check transmission route
    if (!disease.transmission.includes(route)) {
      return { success: false, reason: 'Invalid transmission route' };
    }
    
    // Calculate infection probability
    const probability = this.calculateInfectionProbability(person, disease, route);
    
    if (this.kernel.random() > probability) {
      return { success: false, reason: 'Exposure did not result in infection' };
    }
    
    // Infect
    return this.infect(person, diseaseName, source);
  }

  calculateInfectionProbability(person, disease, route) {
    let probability = disease.contagiousness;
    
    // Route affects probability
    const routeModifiers = {
      respiratory: 1.0,
      contact: 0.7,
      water: 0.9,
      food: 0.8,
      flea: 0.6,
      mosquito: 0.5
    };
    
    probability *= routeModifiers[route] || 0.5;
    
    // Health affects susceptibility
    const health = person.physiology?.getHealthStatus();
    if (health) {
      probability *= (2 - health.immunity);
    }
    
    // Nutrition affects susceptibility
    if (person.needs?.hunger > 0.7) {
      probability *= 1.5;
    }
    
    // Age affects susceptibility
    if (person.age < 5 || person.age > 60) {
      probability *= 1.3;
    }
    
    return Math.min(0.95, probability);
  }

  infect(person, diseaseName, source) {
    const disease = this.diseases.get(diseaseName);
    
    const infection = {
      id: this.nextInfectionId++,
      person: person.id,
      disease: diseaseName,
      source: source?.id || null,
      exposureDate: this.kernel?.turn ?? 0,
      incubationEnd: this.kernel?.turn ?? 0 + disease.incubationPeriod * 24 * 60 * 60 * 1000,
      infectiousEnd: this.kernel?.turn ?? 0 + (disease.incubationPeriod + disease.infectiousPeriod) * 24 * 60 * 60 * 1000,
      stage: 'incubation',
      severity: this.kernel.random() * 0.5 + 0.5,
      symptomatic: false,
      recovered: false,
      fatal: false
    };
    
    this.infections.set(infection.id, infection);
    
    // Add to person
    if (!person.infections) {
      person.infections = [];
    }
    person.infections.push(infection.id);
    
    return {
      success: true,
      infection: infection
    };
  }

  updateInfection(infectionId, kernel) {
    const infection = this.infections.get(infectionId);
    if (!infection) return;
    this._lastKernel = kernel;
    
    const disease = this.diseases.get(infection.disease);
    const now = this.kernel?.turn ?? 0;
    
    // Check stage progression
    if (infection.stage === 'incubation' && now >= infection.incubationEnd) {
      infection.stage = 'infectious';
      infection.symptomatic = true;
      
      // Apply symptoms
      const person = kernel.entities.get(infection.person);
      if (person) {
        this.applySymptoms(person, disease);
      }
    }
    
    if (infection.stage === 'infectious' && now >= infection.infectiousEnd) {
      // Resolution
      const person = kernel.entities.get(infection.person);
      if (person) {
        const survived = this.resolveInfection(person, infection, disease);
        infection.recovered = survived;
        infection.fatal = !survived;
        infection.stage = 'resolved';
      }
    }
    
    // Transmission during infectious stage
    if (infection.stage === 'infectious') {
      this.attemptTransmission(infection, disease, kernel);
    }
  }

  applySymptoms(person, disease) {
    for (const symptom of disease.symptoms) {
      switch (symptom) {
        case 'fever':
          person.physiology.bodyTemperature += 2;
          break;
        case 'weakness':
          person.physiology.fatigue += 0.3;
          break;
        case 'pain':
          person.physiology.pain = Math.min(10, person.physiology.pain + 3);
          break;
        case 'diarrhea':
          person.needs.thirst += 0.2;
          break;
        case 'dehydration':
          person.physiology.hydration -= 0.3;
          break;
      }
    }
    // Disease erodes overall health. Each symptom tick reduces health by 5%
    // (stacked up to the configured mortality). For severe diseases this is
    // what eventually drives vitals into fatal territory.
    if (person.physiology && person.physiology.anatomy) {
      const health = person.physiology.getHealthStatus ? person.physiology.getHealthStatus() : null;
      const erosion = (health ? 0.05 * (1 + (1 - health.overall)) : 0.05);
      // Erode heart and brain function — these are what Physiology.checkVitals()
      // uses to decide death.
      if (person.physiology.anatomy.torso && person.physiology.anatomy.torso.heart) {
        person.physiology.anatomy.torso.heart.function *= (1 - erosion);
      }
      if (person.physiology.anatomy.head && person.physiology.anatomy.head.brain) {
        person.physiology.anatomy.head.brain.function *= (1 - erosion);
      }
    }
  }

  resolveInfection(person, infection, disease) {
    // Check mortality
    let mortalityRisk = disease.mortality * infection.severity;

    // Health affects survival
    const health = person.physiology?.getHealthStatus();
    if (health) {
      mortalityRisk *= (2 - health.immunity);
    }

    // Age affects survival
    if (person.age < 5 || person.age > 60) {
      mortalityRisk *= 1.5;
    }

    // Nutrition affects survival
    if (person.needs?.hunger > 0.7) {
      mortalityRisk *= 1.3;
    }

    const survived = this.kernel.random() > mortalityRisk;

    if (survived) {
      // Grant immunity
      this.grantImmunity(person, disease);

      // Remove symptoms
      person.physiology.bodyTemperature = 37;
      person.physiology.pain = Math.max(0, person.physiology.pain - 3);
    } else {
      // Death — drive vitals into fatal territory then call Person.die() so
      // household / kinship / indexes / event all stay in sync.
      if (person.physiology && person.physiology.anatomy) {
        if (person.physiology.anatomy.torso?.heart) {
          person.physiology.anatomy.torso.heart.function = 0.1;
        }
        if (person.physiology.anatomy.head?.brain) {
          person.physiology.anatomy.head.brain.function = 0.1;
        }
      }
      person.deathCause = infection.disease;
      person.deathDate = this.kernel?.turn ?? 0;
      const kernel = this._lastKernel || null;
      if (typeof person.die === 'function') {
        person.die(infection.disease || disease.name || 'plague', kernel);
      } else {
        person.alive = false;
        if (kernel && typeof kernel.scheduleEvent === 'function') {
          kernel.scheduleEvent({ type: 'person_died', personId: person.id, cause: infection.disease, age: person.age });
        }
      }
    }

    return survived;
  }

  grantImmunity(person, disease) {
    if (!person.immunities) {
      person.immunities = new Map();
    }
    
    const expiryDate = disease.immunity === 'permanent' 
      ? Infinity 
      : this.kernel?.turn ?? 0 + disease.immunityDuration * 24 * 60 * 60 * 1000;
    
    person.immunities.set(disease.name, {
      acquired: this.kernel?.turn ?? 0,
      expires: expiryDate,
      type: disease.immunity
    });
  }

  hasImmunity(person, diseaseName) {
    if (!person.immunities) return false;
    
    const immunity = person.immunities.get(diseaseName);
    if (!immunity) return false;
    
    if (immunity.expires === Infinity) return true;
    
    return this.kernel?.turn ?? 0 < immunity.expires;
  }

  attemptTransmission(infection, disease, kernel) {
    this._lastKernel = kernel;
    const person = kernel.entities.get(infection.person);
    if (!person) return;
    
    // Find nearby people
    const nearby = kernel.queryEntitiesNear(
      person.position.x,
      person.position.y,
      person.position.z,
      50
    );
    
    for (const entityId of nearby) {
      const target = kernel.entities.get(entityId);
      if (!target || target.id === person.id) continue;
      
      // Transmission chance
      const transmissionChance = disease.contagiousness * 0.01;
      
      if (this.kernel.random() < transmissionChance) {
        // Determine route
        const route = disease.transmission[0]; // Simplified
        this.expose(target, disease.name, person, route);
      }
    }
  }

  startOutbreak(diseaseName, location, initialCases) {
    const disease = this.diseases.get(diseaseName);
    if (!disease) return { success: false, reason: 'Unknown disease' };
    
    const outbreak = {
      id: this.nextOutbreakId++,
      disease: diseaseName,
      location: location,
      startDate: this.kernel?.turn ?? 0,
      cases: initialCases,
      deaths: 0,
      active: true,
      peakDate: null,
      endDate: null
    };
    
    this.outbreaks.set(outbreak.id, outbreak);
    
    return {
      success: true,
      outbreak: outbreak
    };
  }

  updateOutbreaks(kernel) {
    for (const [id, outbreak] of this.outbreaks) {
      if (!outbreak.active) continue;
      
      // Count active cases
      const activeCases = Array.from(this.infections.values())
        .filter(i => i.disease === outbreak.disease && i.stage === 'infectious')
        .length;
      
      outbreak.cases = activeCases;
      
      // Check if outbreak ended
      if (activeCases === 0) {
        outbreak.active = false;
        outbreak.endDate = this.kernel?.turn ?? 0;
      }
    }
  }

  getDisease(name) {
    return this.diseases.get(name);
  }

  getInfection(id) {
    return this.infections.get(id);
  }

  getActiveInfections(personId) {
    return Array.from(this.infections.values())
      .filter(i => i.person === personId && i.stage !== 'resolved');
  }

  getOutbreak(id) {
    return this.outbreaks.get(id);
  }

  getActiveOutbreaks() {
    return Array.from(this.outbreaks.values()).filter(o => o.active);
  }
}
