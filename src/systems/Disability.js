/**
 * Disability.js
 * Physical/cognitive disabilities, aids, rehabilitation, care
 * Models realistic limitations, adaptations, social support
 */

export class Disability {
  constructor(kernel, game) {
    this.kernel = kernel || game?.kernel || null;
    this.disabilities = new Map();
    this.aids = new Map();
    this.caregivers = new Map();
    this.nextDisabilityId = 1;
    this.nextAidId = 1;
  }

  acquireDisability(person, type, cause, severity) {
    const disability = {
      id: this.nextDisabilityId++,
      person: person.id,
      type: type, // mobility, vision, hearing, cognitive, chronic_pain
      cause: cause,
      severity: severity, // 0-1
      acquired: this.kernel?.turn ?? 0,
      limitations: this.calculateLimitations(type, severity),
      adaptations: [],
      aids: [],
      careNeeds: this.calculateCareNeeds(type, severity)
    };
    
    this.disabilities.set(disability.id, disability);
    
    // Add to person
    if (!person.disabilities) {
      person.disabilities = [];
    }
    person.disabilities.push(disability.id);
    
    // Apply immediate effects
    this.applyDisabilityEffects(person, disability);
    
    return {
      success: true,
      disability: disability
    };
  }

  calculateLimitations(type, severity) {
    const limitations = {
      mobility: [],
      sensory: [],
      cognitive: [],
      social: [],
      economic: []
    };
    
    switch (type) {
      case 'mobility':
        if (severity > 0.3) limitations.mobility.push('walking_difficulty');
        if (severity > 0.5) limitations.mobility.push('cannot_climb');
        if (severity > 0.7) limitations.mobility.push('cannot_stand');
        if (severity > 0.9) limitations.mobility.push('bedridden');
        limitations.economic.push('reduced_work_capacity');
        break;
        
      case 'vision':
        if (severity > 0.3) limitations.sensory.push('reduced_vision');
        if (severity > 0.5) limitations.sensory.push('cannot_read');
        if (severity > 0.7) limitations.sensory.push('navigation_difficulty');
        if (severity > 0.9) limitations.sensory.push('blind');
        limitations.economic.push('limited_occupations');
        break;
        
      case 'hearing':
        if (severity > 0.3) limitations.sensory.push('reduced_hearing');
        if (severity > 0.5) limitations.sensory.push('speech_difficulty');
        if (severity > 0.7) limitations.sensory.push('cannot_hear_speech');
        if (severity > 0.9) limitations.sensory.push('deaf');
        limitations.social.push('communication_barrier');
        break;
        
      case 'cognitive':
        if (severity > 0.3) limitations.cognitive.push('memory_issues');
        if (severity > 0.5) limitations.cognitive.push('learning_difficulty');
        if (severity > 0.7) limitations.cognitive.push('judgment_impaired');
        if (severity > 0.9) limitations.cognitive.push('requires_supervision');
        limitations.economic.push('limited_independence');
        break;
        
      case 'chronic_pain':
        if (severity > 0.3) limitations.mobility.push('reduced_activity');
        if (severity > 0.5) limitations.economic.push('work_interruptions');
        if (severity > 0.7) limitations.social.push('social_withdrawal');
        break;
    }
    
    return limitations;
  }

  calculateCareNeeds(type, severity) {
    const needs = {
      daily: [],
      medical: [],
      social: [],
      hoursPerDay: 0
    };
    
    if (severity > 0.5) {
      needs.daily.push('assistance_with_tasks');
      needs.hoursPerDay += 2;
    }
    
    if (severity > 0.7) {
      needs.daily.push('personal_care');
      needs.medical.push('regular_monitoring');
      needs.hoursPerDay += 4;
    }
    
    if (severity > 0.9) {
      needs.daily.push('constant_supervision');
      needs.medical.push('intensive_care');
      needs.hoursPerDay += 12;
    }
    
    return needs;
  }

  applyDisabilityEffects(person, disability) {
    switch (disability.type) {
      case 'mobility':
        if (person.locomotion) {
          person.locomotion.walkingSpeed *= (1 - disability.severity);
          person.locomotion.canClimb = disability.severity < 0.5;
          person.locomotion.canRun = disability.severity < 0.3;
        }
        break;
        
      case 'vision':
        if (person.perception) {
          person.perception.visionRange *= (1 - disability.severity);
          person.perception.visionAccuracy *= (1 - disability.severity);
        }
        break;
        
      case 'hearing':
        if (person.perception) {
          person.perception.hearingRange *= (1 - disability.severity);
          person.perception.hearingAccuracy *= (1 - disability.severity);
        }
        break;
        
      case 'cognitive':
        if (person.intelligence) {
          person.intelligence *= (1 - disability.severity * 0.5);
        }
        if (person.skills) {
          // Reduce learning rate
          person.learningRate = (person.learningRate || 1) * (1 - disability.severity * 0.3);
        }
        break;
        
      case 'chronic_pain':
        if (person.physiology) {
          person.physiology.basePain = disability.severity * 5;
        }
        break;
    }
  }

  createAid(name, type, effectiveness, requirements) {
    const aid = {
      id: this.nextAidId++,
      name: name,
      type: type, // mobility, vision, hearing, cognitive
      effectiveness: effectiveness, // 0-1, how much it reduces disability impact
      requirements: requirements,
      cost: this.calculateAidCost(type, effectiveness),
      maintenance: this.calculateMaintenance(type)
    };
    
    this.aids.set(aid.id, aid);
    return aid;
  }

  calculateAidCost(type, effectiveness) {
    const baseCosts = {
      mobility: 50,
      vision: 20,
      hearing: 30,
      cognitive: 10
    };
    
    return (baseCosts[type] || 20) * (1 + effectiveness);
  }

  calculateMaintenance(type) {
    const maintenance = {
      mobility: { frequency: 'monthly', cost: 5 },
      vision: { frequency: 'yearly', cost: 2 },
      hearing: { frequency: 'yearly', cost: 3 },
      cognitive: { frequency: 'none', cost: 0 }
    };
    
    return maintenance[type] || { frequency: 'none', cost: 0 };
  }

  provideAid(person, disabilityId, aidId) {
    const disability = this.disabilities.get(disabilityId);
    if (!disability) {
      return { success: false, reason: 'Unknown disability' };
    }
    
    const aid = this.aids.get(aidId);
    if (!aid) {
      return { success: false, reason: 'Unknown aid' };
    }
    
    // Check compatibility
    if (aid.type !== disability.type) {
      return { success: false, reason: 'Aid not compatible with disability' };
    }
    
    // Check requirements
    for (const [req, value] of Object.entries(aid.requirements)) {
      if (!this.meetsRequirement(person, req, value)) {
        return { success: false, reason: `Does not meet requirement: ${req}` };
      }
    }
    
    // Apply aid
    disability.aids.push(aidId);
    
    // Reduce effective severity
    const effectiveSeverity = disability.severity * (1 - aid.effectiveness);
    
    // Update person's capabilities
    this.updateCapabilities(person, disability, effectiveSeverity);
    
    return {
      success: true,
      effectiveSeverity: effectiveSeverity,
      improvement: disability.severity - effectiveSeverity
    };
  }

  meetsRequirement(person, requirement, value) {
    switch (requirement) {
      case 'strength':
        return (person.physiology?.strength || 0.5) >= value;
      case 'dexterity':
        return (person.physiology?.dexterity || 0.5) >= value;
      case 'training':
        return (person.skills?.knowledge?.aid_use || 0) >= value;
      default:
        return true;
    }
  }

  updateCapabilities(person, disability, effectiveSeverity) {
    // Recalculate effects with reduced severity
    const tempDisability = { ...disability, severity: effectiveSeverity };
    this.applyDisabilityEffects(person, tempDisability);
  }

  assignCaregiver(caregiver, patient, disabilityId) {
    const disability = this.disabilities.get(disabilityId);
    if (!disability) {
      return { success: false, reason: 'Unknown disability' };
    }
    
    // Check caregiver capacity
    const currentLoad = this.getCaregiverLoad(caregiver.id);
    const maxLoad = 16; // hours per day
    
    if (currentLoad + disability.careNeeds.hoursPerDay > maxLoad) {
      return { success: false, reason: 'Caregiver at capacity' };
    }
    
    const careRelationship = {
      caregiver: caregiver.id,
      patient: patient.id,
      disability: disabilityId,
      started: this.kernel?.turn ?? 0,
      hoursPerDay: disability.careNeeds.hoursPerDay,
      quality: this.calculateCareQuality(caregiver)
    };
    
    this.caregivers.set(`${caregiver.id}-${patient.id}`, careRelationship);
    
    return {
      success: true,
      relationship: careRelationship
    };
  }

  calculateCareQuality(caregiver) {
    let quality = 0.5; // Base
    
    // Skills improve care
    if (caregiver.skills?.knowledge?.medicine) {
      quality += caregiver.skills.knowledge.medicine * 0.3;
    }
    
    if (caregiver.skills?.social?.empathy) {
      quality += caregiver.skills.social.empathy * 0.2;
    }
    
    return Math.min(1, quality);
  }

  getCaregiverLoad(caregiverId) {
    let totalHours = 0;
    
    for (const [key, relationship] of this.caregivers) {
      if (relationship.caregiver === caregiverId) {
        totalHours += relationship.hoursPerDay;
      }
    }
    
    return totalHours;
  }

  provideCare(caregiverId, patientId, hours) {
    const relationship = this.caregivers.get(`${caregiverId}-${patientId}`);
    if (!relationship) {
      return { success: false, reason: 'No care relationship' };
    }
    
    const disability = this.disabilities.get(relationship.disability);
    if (!disability) {
      return { success: false, reason: 'Unknown disability' };
    }
    
    // Care effects
    const effects = {
      comfort: relationship.quality * 0.2,
      health: relationship.quality * 0.1,
      stress: -relationship.quality * 0.15
    };
    
    // Caregiver burden
    const caregiverEffects = {
      fatigue: hours * 0.05,
      stress: hours * 0.03,
      satisfaction: relationship.quality * 0.1
    };
    
    return {
      success: true,
      patientEffects: effects,
      caregiverEffects: caregiverEffects,
      hoursProvided: hours
    };
  }

  attemptRehabilitation(person, disabilityId, therapy, hours) {
    const disability = this.disabilities.get(disabilityId);
    if (!disability) {
      return { success: false, reason: 'Unknown disability' };
    }
    
    // Some disabilities can improve with rehabilitation
    const improvable = ['mobility', 'cognitive', 'chronic_pain'];
    if (!improvable.includes(disability.type)) {
      return { success: false, reason: 'Disability not improvable through rehabilitation' };
    }
    
    // Calculate improvement
    const therapyEffectiveness = this.getTherapyEffectiveness(therapy, disability.type);
    const improvement = hours * therapyEffectiveness * 0.001;
    
    // Apply improvement
    const newSeverity = Math.max(0, disability.severity - improvement);
    const actualImprovement = disability.severity - newSeverity;
    
    disability.severity = newSeverity;
    
    // Update person's capabilities
    this.applyDisabilityEffects(person, disability);
    
    return {
      success: true,
      improvement: actualImprovement,
      newSeverity: newSeverity,
      hoursSpent: hours
    };
  }

  getTherapyEffectiveness(therapy, disabilityType) {
    const effectiveness = {
      mobility: {
        physical_therapy: 0.8,
        exercise: 0.6,
        massage: 0.4
      },
      cognitive: {
        memory_exercises: 0.7,
        routine_practice: 0.5,
        social_interaction: 0.6
      },
      chronic_pain: {
        physical_therapy: 0.6,
        meditation: 0.5,
        heat_therapy: 0.4
      }
    };
    
    return effectiveness[disabilityType]?.[therapy] || 0.3;
  }

  adaptEnvironment(person, disabilityId, adaptation) {
    const disability = this.disabilities.get(disabilityId);
    if (!disability) {
      return { success: false, reason: 'Unknown disability' };
    }
    
    // Environmental adaptations
    const adaptations = {
      mobility: ['ramps', 'handrails', 'wider_doors', 'ground_floor_living'],
      vision: ['high_contrast', 'tactile_markers', 'organized_layout'],
      hearing: ['visual_signals', 'quiet_spaces'],
      cognitive: ['simple_layout', 'reminders', 'routine_structure']
    };
    
    if (!adaptations[disability.type]?.includes(adaptation)) {
      return { success: false, reason: 'Adaptation not applicable' };
    }
    
    disability.adaptations.push(adaptation);
    
    // Calculate benefit
    const benefit = 0.1; // Each adaptation reduces effective severity by 10%
    const effectiveSeverity = disability.severity * (1 - benefit * disability.adaptations.length);
    
    return {
      success: true,
      adaptation: adaptation,
      effectiveSeverity: effectiveSeverity,
      benefit: benefit
    };
  }

  getSocialSupport(person, disabilityId) {
    const disability = this.disabilities.get(disabilityId);
    if (!disability) return null;
    
    // Calculate available support
    const support = {
      caregivers: this.getCaregiversFor(person.id),
      community: this.getCommunitySupport(person),
      family: this.getFamilySupport(person),
      economic: this.getEconomicSupport(person, disability)
    };
    
    return support;
  }

  getCaregiversFor(patientId) {
    const caregivers = [];
    
    for (const [key, relationship] of this.caregivers) {
      if (relationship.patient === patientId) {
        caregivers.push(relationship);
      }
    }
    
    return caregivers;
  }

  getCommunitySupport(person) {
    // Simplified - would integrate with social network
    return {
      available: true,
      level: 0.5
    };
  }

  getFamilySupport(person) {
    // Simplified - would integrate with family system
    return {
      available: true,
      level: 0.7
    };
  }

  getEconomicSupport(person, disability) {
    // Medieval period had limited formal support
    return {
      charity: disability.severity > 0.7,
      alms: disability.severity > 0.5,
      guild_support: person.guild && disability.severity > 0.6
    };
  }

  getDisability(id) {
    return this.disabilities.get(id);
  }

  getAid(id) {
    return this.aids.get(id);
  }

  getDisabilitiesByPerson(personId) {
    return Array.from(this.disabilities.values())
      .filter(d => d.person === personId);
  }

  getCareRelationship(caregiverId, patientId) {
    return this.caregivers.get(`${caregiverId}-${patientId}`);
  }
}
