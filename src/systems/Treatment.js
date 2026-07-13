/**
 * Treatment.js
 * Medical treatment efficacy, medieval vs actual diagnosis
 * Models historical practices, actual mechanisms, outcomes
 */

export class Treatment {
  constructor(pathogenSystem, kernel, game) {
    this.pathogenSystem = pathogenSystem;
    this.kernel = kernel || game?.kernel || null;
    this.treatments = new Map();
    this.practitioners = new Map();
    this.initTreatments();
  }

  initTreatments() {
    // Effective treatments
    this.defineTreatment('wound_cleaning', {
      type: 'surgical',
      targets: ['wound', 'infection'],
      mechanism: 'removes_contaminants',
      effectiveness: 0.7,
      medievalUnderstanding: 'humoral_balance',
      actualMechanism: 'pathogen_removal',
      materials: ['water', 'cloth'],
      skill: 0.3,
      duration: 30 // minutes
    });

    this.defineTreatment('boiling_water', {
      type: 'preventive',
      targets: ['waterborne_disease'],
      mechanism: 'kills_pathogens',
      effectiveness: 0.95,
      medievalUnderstanding: 'purification',
      actualMechanism: 'heat_sterilization',
      materials: ['water', 'fire'],
      skill: 0.1,
      duration: 10
    });

    this.defineTreatment('willow_bark', {
      type: 'herbal',
      targets: ['pain', 'fever', 'inflammation'],
      mechanism: 'salicylic_acid',
      effectiveness: 0.6,
      medievalUnderstanding: 'cooling_herb',
      actualMechanism: 'prostaglandin_inhibition',
      materials: ['willow_bark', 'water'],
      skill: 0.2,
      duration: 60
    });

    this.defineTreatment('honey_dressing', {
      type: 'topical',
      targets: ['wound', 'burn', 'infection'],
      mechanism: 'antibacterial',
      effectiveness: 0.65,
      medievalUnderstanding: 'sweet_healing',
      actualMechanism: 'osmotic_antibacterial',
      materials: ['honey', 'cloth'],
      skill: 0.2,
      duration: 20
    });

    // Partially effective treatments
    this.defineTreatment('bloodletting', {
      type: 'humoral',
      targets: ['fever', 'inflammation', 'excess_blood'],
      mechanism: 'blood_removal',
      effectiveness: -0.2, // Actually harmful
      medievalUnderstanding: 'balance_humors',
      actualMechanism: 'blood_loss',
      materials: ['lancet', 'bowl'],
      skill: 0.4,
      duration: 30
    });

    this.defineTreatment('trepanation', {
      type: 'surgical',
      targets: ['head_injury', 'headache', 'madness'],
      mechanism: 'skull_opening',
      effectiveness: 0.1, // Rarely helpful, often harmful
      medievalUnderstanding: 'release_evil_spirits',
      actualMechanism: 'pressure_relief',
      materials: ['drill', 'knife'],
      skill: 0.8,
      duration: 120
    });

    // Ineffective but harmless
    this.defineTreatment('prayer', {
      type: 'spiritual',
      targets: ['any'],
      mechanism: 'divine_intervention',
      effectiveness: 0.05, // Placebo effect only
      medievalUnderstanding: 'divine_healing',
      actualMechanism: 'placebo',
      materials: [],
      skill: 0.1,
      duration: 15
    });

    // Effective but misunderstood
    this.defineTreatment('quarantine', {
      type: 'preventive',
      targets: ['contagious_disease'],
      mechanism: 'isolation',
      effectiveness: 0.8,
      medievalUnderstanding: 'miasma_avoidance',
      actualMechanism: 'transmission_prevention',
      materials: [],
      skill: 0.2,
      duration: 14 * 24 * 60 // 14 days
    });

    this.defineTreatment('amputation', {
      type: 'surgical',
      targets: ['gangrene', 'severe_injury'],
      mechanism: 'tissue_removal',
      effectiveness: 0.5,
      medievalUnderstanding: 'remove_corruption',
      actualMechanism: 'infection_source_removal',
      materials: ['saw', 'knife', 'cautery'],
      skill: 0.7,
      duration: 60
    });
  }

  defineTreatment(name, properties) {
    this.treatments.set(name, {
      name: name,
      ...properties,
      complications: this.generateComplications(properties),
      contraindications: this.generateContraindications(properties)
    });
  }

  generateComplications(properties) {
    const complications = [];
    
    if (properties.type === 'surgical') {
      complications.push({ type: 'infection', probability: 0.3 });
      complications.push({ type: 'bleeding', probability: 0.2 });
      complications.push({ type: 'shock', probability: 0.1 });
    }
    
    if (properties.mechanism === 'blood_removal') {
      complications.push({ type: 'anemia', probability: 0.5 });
      complications.push({ type: 'weakness', probability: 0.7 });
    }
    
    return complications;
  }

  generateContraindications(properties) {
    const contraindications = [];
    
    if (properties.mechanism === 'blood_removal') {
      contraindications.push('anemia');
      contraindications.push('pregnancy');
    }
    
    if (properties.type === 'surgical') {
      contraindications.push('bleeding_disorder');
    }
    
    return contraindications;
  }

  diagnose(practitioner, patient, symptoms) {
    const skill = practitioner.skills?.knowledge?.medicine || 0.2;
    const medievalKnowledge = practitioner.knowledge?.has('humoral_theory') || false;
    
    // Medieval diagnosis based on humoral theory
    const medievalDiagnosis = this.medievalDiagnose(symptoms, medievalKnowledge);
    
    // Actual condition (hidden from practitioner)
    const actualCondition = this.determineActualCondition(patient);
    
    // Diagnostic accuracy
    const accuracy = skill * 0.5 + (medievalKnowledge ? 0.2 : 0);
    const correct = this.kernel.random() < accuracy;
    
    return {
      medievalDiagnosis: medievalDiagnosis,
      actualCondition: actualCondition,
      correct: correct,
      confidence: skill,
      practitionerBelieves: medievalDiagnosis
    };
  }

  medievalDiagnose(symptoms, hasKnowledge) {
    // Simplified humoral diagnosis
    if (symptoms.includes('fever')) {
      return 'excess_yellow_bile';
    }
    if (symptoms.includes('weakness')) {
      return 'excess_phlegm';
    }
    if (symptoms.includes('pain')) {
      return 'excess_black_bile';
    }
    return 'humoral_imbalance';
  }

  determineActualCondition(patient) {
    // Check for infections
    if (patient.infections && patient.infections.length > 0) {
      const infection = this.pathogenSystem.getInfection(patient.infections[0]);
      return infection?.disease || 'unknown';
    }
    
    // Check for injuries
    if (patient.physiology?.injuries && patient.physiology.injuries.length > 0) {
      return 'trauma';
    }
    
    return 'healthy';
  }

  prescribe(practitioner, diagnosis, patient) {
    const skill = practitioner.skills?.knowledge?.medicine || 0.2;
    
    // Select treatment based on medieval diagnosis
    const treatment = this.selectTreatment(diagnosis, skill);
    
    if (!treatment) {
      return { success: false, reason: 'No treatment known' };
    }
    
    // Check contraindications
    const contraindicated = this.checkContraindications(treatment, patient);
    if (contraindicated.has) {
      return {
        success: false,
        reason: 'Contraindicated',
        contraindication: contraindicated.reason
      };
    }
    
    return {
      success: true,
      treatment: treatment.name,
      medievalRationale: treatment.medievalUnderstanding,
      actualMechanism: treatment.actualMechanism
    };
  }

  selectTreatment(diagnosis, skill) {
    // Simplified treatment selection
    const treatmentMap = {
      'excess_yellow_bile': 'bloodletting',
      'excess_phlegm': 'bloodletting',
      'excess_black_bile': 'bloodletting',
      'wound': 'wound_cleaning',
      'infection': 'honey_dressing',
      'fever': 'willow_bark',
      'pain': 'willow_bark'
    };
    
    const treatmentName = treatmentMap[diagnosis];
    return treatmentName ? this.treatments.get(treatmentName) : null;
  }

  checkContraindications(treatment, patient) {
    for (const contraindication of treatment.contraindications) {
      if (this.hasCondition(patient, contraindication)) {
        return { has: true, reason: contraindication };
      }
    }
    return { has: false };
  }

  hasCondition(patient, condition) {
    // Simplified condition check
    if (condition === 'anemia' && patient.physiology?.bloodVolume < 4) {
      return true;
    }
    if (condition === 'pregnancy' && patient.physiology?.pregnant) {
      return true;
    }
    return false;
  }

  administer(practitioner, patient, treatmentName, resources) {
    const treatment = this.treatments.get(treatmentName);
    if (!treatment) {
      return { success: false, reason: 'Unknown treatment' };
    }
    
    // Check skill
    const skill = practitioner.skills?.knowledge?.medicine || 0.2;
    if (skill < treatment.skill) {
      return { success: false, reason: 'Insufficient skill' };
    }
    
    // Check materials
    for (const material of treatment.materials) {
      if (!resources[material]) {
        return { success: false, reason: `Missing ${material}` };
      }
    }
    
    // Calculate actual effectiveness
    const skillModifier = skill / treatment.skill;
    const actualEffectiveness = treatment.effectiveness * skillModifier;
    
    // Apply treatment
    const outcome = this.applyTreatment(patient, treatment, actualEffectiveness);
    
    // Check for complications
    const complications = this.checkComplications(patient, treatment, skill);
    
    return {
      success: true,
      outcome: outcome,
      complications: complications,
      duration: treatment.duration,
      effectiveness: actualEffectiveness
    };
  }

  applyTreatment(patient, treatment, effectiveness) {
    const outcomes = [];
    
    for (const target of treatment.targets) {
      switch (target) {
        case 'pain':
          if (patient.physiology?.pain) {
            const reduction = effectiveness * 5;
            patient.physiology.pain = Math.max(0, patient.physiology.pain - reduction);
            outcomes.push({ target: 'pain', change: -reduction });
          }
          break;
          
        case 'fever':
          if (patient.physiology?.bodyTemperature > 37) {
            const reduction = effectiveness * 2;
            patient.physiology.bodyTemperature = Math.max(37, patient.physiology.bodyTemperature - reduction);
            outcomes.push({ target: 'fever', change: -reduction });
          }
          break;
          
        case 'wound':
          if (patient.physiology?.injuries) {
            for (const injury of patient.physiology.injuries) {
              if (injury.open) {
                injury.infected = Math.max(0, injury.infected - effectiveness);
                outcomes.push({ target: 'wound', change: -effectiveness });
              }
            }
          }
          break;
          
        case 'infection':
          if (patient.infections) {
            // Reduce infection severity (simplified)
            outcomes.push({ target: 'infection', change: -effectiveness * 0.1 });
          }
          break;
      }
    }
    
    // Harmful treatments
    if (effectiveness < 0) {
      if (treatment.mechanism === 'blood_removal') {
        patient.physiology.bloodVolume -= Math.abs(effectiveness) * 0.5;
        outcomes.push({ target: 'blood_volume', change: -Math.abs(effectiveness) * 0.5 });
      }
    }
    
    return outcomes;
  }

  checkComplications(patient, treatment, skill) {
    const complications = [];
    
    for (const complication of treatment.complications) {
      // Skill reduces complication risk
      const risk = complication.probability * (1 - skill * 0.5);
      
      if (this.kernel.random() < risk) {
        complications.push(complication.type);
        this.applyComplication(patient, complication.type);
      }
    }
    
    return complications;
  }

  applyComplication(patient, type) {
    switch (type) {
      case 'infection':
        // Simplified infection
        if (patient.physiology?.injuries) {
          for (const injury of patient.physiology.injuries) {
            injury.infected = true;
          }
        }
        break;
        
      case 'bleeding':
        if (patient.physiology) {
          patient.physiology.bloodVolume -= 0.5;
        }
        break;
        
      case 'shock':
        if (patient.physiology) {
          patient.physiology.pain += 3;
        }
        break;
        
      case 'anemia':
        if (patient.physiology) {
          patient.physiology.bloodVolume -= 1;
        }
        break;
        
      case 'weakness':
        if (patient.physiology) {
          patient.physiology.fatigue += 0.3;
        }
        break;
    }
  }

  getTreatment(name) {
    return this.treatments.get(name);
  }

  getTreatmentsForCondition(condition) {
    return Array.from(this.treatments.values())
      .filter(t => t.targets.includes(condition));
  }

  getEffectiveTreatments() {
    return Array.from(this.treatments.values())
      .filter(t => t.effectiveness > 0.5);
  }

  getHarmfulTreatments() {
    return Array.from(this.treatments.values())
      .filter(t => t.effectiveness < 0);
  }
}
