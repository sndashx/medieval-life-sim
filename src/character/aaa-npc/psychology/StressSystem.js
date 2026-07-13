/**
 * StressSystem.js
 * 
 * Implements comprehensive stress and trauma tracking:
 * - Acute and chronic stress accumulation
 * - Trauma recording and PTSD symptom modeling
 * - Coping mechanisms and resilience
 * - Stress-related health impacts
 * 
 * @module StressSystem
 */

export class StressSystem {
  constructor(personality = {}, physiology = null, kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    // Current stress levels
    this.currentStress = 0.0;      // Acute stress (0-1)
    this.chronicStress = 0.0;      // Long-term stress accumulation (0-1)
    
    // Resilience factors
    this.resilience = this.calculateBaseResilience(personality);
    this.stressThreshold = 0.7;    // Threshold for stress-related issues
    
    // Trauma tracking
    this.traumas = [];             // Array of trauma objects
    this.traumaScore = 0.0;        // Overall trauma burden (0-1)
    
    // PTSD symptoms (if applicable)
    this.ptsdSymptoms = {
      intrusion: 0.0,              // Flashbacks, nightmares
      avoidance: 0.0,              // Avoiding triggers
      hyperarousal: 0.0,           // Heightened alertness, startle response
      negativeThoughts: 0.0,       // Negative beliefs about self/world
      dissociation: 0.0            // Feeling detached from reality
    };
    
    // Coping mechanisms (effectiveness 0-1)
    this.copingStrategies = {
      problemFocused: personality.conscientiousness || 0.5,
      emotionFocused: personality.agreeableness || 0.5,
      avoidant: personality.neuroticism || 0.3,
      social: personality.extraversion || 0.6,
      spiritual: personality.piety || 0.5,
      physical: 0.5  // Exercise, physical activity
    };
    
    // Stress sources tracking
    this.stressSources = new Map();  // source -> intensity
    
    // Burnout indicators
    this.burnout = {
      exhaustion: 0.0,
      cynicism: 0.0,
      inefficacy: 0.0
    };
    
    // Reference to physiology for health impacts
    this.physiology = physiology;
    
    // Recovery tracking
    this.lastRecoveryActivity = null;
    this.recoveryEffectiveness = 0.5;
  }
  
  /**
   * Calculate base resilience from personality
   * @param {Object} personality - Personality traits
   * @returns {number} Resilience 0-1
   */
  calculateBaseResilience(personality) {
    return (
      (1 - (personality.neuroticism || 0.5)) * 0.4 +
      (personality.conscientiousness || 0.5) * 0.3 +
      (personality.extraversion || 0.5) * 0.2 +
      (personality.courage || 0.5) * 0.1
    );
  }
  
  /**
   * Update stress system - called each game tick
   * @param {number} deltaTime - Time elapsed in minutes
   */
  update(deltaTime) {
    // Natural stress decay
    this.decayStress(deltaTime);
    
    // Chronic stress accumulation
    this.updateChronicStress(deltaTime);
    
    // Update PTSD symptoms
    this.updatePTSDSymptoms(deltaTime);
    
    // Update burnout
    this.updateBurnout(deltaTime);
    
    // Apply health impacts
    this.applyHealthImpacts();
  }
  
  /**
   * Add a stressor to the system
   * @param {Object} stressor - Stressor details
   * @returns {Object} Impact assessment
   */
  addStressor(stressor) {
    const {
      type,
      severity = 0.5,
      duration = 1,
      source = 'unknown',
      controllable = false,
      predictable = true
    } = stressor;
    
    // Calculate impact based on resilience and stressor characteristics
    let impact = severity * (1 - this.resilience);
    
    // Uncontrollable stressors are worse
    if (!controllable) impact *= 1.3;
    
    // Unpredictable stressors are worse
    if (!predictable) impact *= 1.2;
    
    // Apply coping mechanisms
    impact = this.applyCoping(impact, type);
    
    // Add to current stress
    this.currentStress = Math.min(1.0, this.currentStress + impact);
    
    // Track source
    this.stressSources.set(source, (this.stressSources.get(source) || 0) + impact);
    
    // Check if severe enough to cause trauma
    if (severity > 0.8 && !controllable) {
      this.addTrauma({
        type,
        severity,
        timestamp: (this.kernel?.turn || 0),
        source,
        processed: false
      });
    }
    
    return {
      impact,
      currentStress: this.currentStress,
      traumatic: severity > 0.8
    };
  }
  
  /**
   * Apply coping mechanisms to reduce stress impact
   * @param {number} impact - Raw stress impact
   * @param {string} stressorType - Type of stressor
   * @returns {number} Reduced impact
   */
  applyCoping(impact, stressorType) {
    // Choose most effective coping strategy for stressor type
    let effectiveness = 0;
    
    switch (stressorType) {
      case 'work':
      case 'financial':
        effectiveness = this.copingStrategies.problemFocused;
        break;
      case 'social':
      case 'relationship':
        effectiveness = Math.max(
          this.copingStrategies.emotionFocused,
          this.copingStrategies.social
        );
        break;
      case 'existential':
      case 'loss':
        effectiveness = Math.max(
          this.copingStrategies.spiritual,
          this.copingStrategies.emotionFocused
        );
        break;
      case 'physical_danger':
        effectiveness = this.copingStrategies.problemFocused;
        break;
      default:
        effectiveness = Object.values(this.copingStrategies)
          .reduce((a, b) => a + b, 0) / Object.keys(this.copingStrategies).length;
    }
    
    return impact * (1 - effectiveness * 0.5);
  }
  
  /**
   * Add a traumatic experience
   * @param {Object} trauma - Trauma details
   */
  addTrauma(trauma) {
    this.traumas.push({
      ...trauma,
      id: this.generateTraumaId(),
      triggers: this.identifyTriggers(trauma),
      flashbackIntensity: trauma.severity,
      processed: false
    });
    
    // Update trauma score
    this.updateTraumaScore();
    
    // Immediate PTSD symptom spike
    this.ptsdSymptoms.intrusion += trauma.severity * 0.3;
    this.ptsdSymptoms.hyperarousal += trauma.severity * 0.4;
    this.ptsdSymptoms.avoidance += trauma.severity * 0.2;
    this.ptsdSymptoms.negativeThoughts += trauma.severity * 0.3;
    
    this.clampPTSDSymptoms();
  }
  
  /**
   * Identify potential triggers for trauma
   * @param {Object} trauma - Trauma details
   * @returns {Array} List of triggers
   */
  identifyTriggers(trauma) {
    const triggers = [];
    
    if (trauma.source) triggers.push(trauma.source);
    if (trauma.location) triggers.push(trauma.location);
    if (trauma.type) triggers.push(trauma.type);
    
    return triggers;
  }
  
  /**
   * Check if situation triggers trauma response
   * @param {Object} situation - Current situation
   * @returns {Object} Trigger response
   */
  checkTriggers(situation) {
    let triggered = false;
    let intensity = 0;
    const triggeredTraumas = [];
    
    for (const trauma of this.traumas) {
      if (!trauma.processed) {
        for (const trigger of trauma.triggers) {
          if (this.situationMatchesTrigger(situation, trigger)) {
            triggered = true;
            intensity = Math.max(intensity, trauma.flashbackIntensity);
            triggeredTraumas.push(trauma);
          }
        }
      }
    }
    
    if (triggered) {
      // Trigger response
      this.ptsdSymptoms.intrusion += intensity * 0.2;
      this.ptsdSymptoms.hyperarousal += intensity * 0.3;
      this.currentStress += intensity * 0.4;
      
      this.clampPTSDSymptoms();
    }
    
    return {
      triggered,
      intensity,
      traumas: triggeredTraumas
    };
  }
  
  /**
   * Check if situation matches a trigger
   * @param {Object} situation - Current situation
   * @param {string} trigger - Trigger to check
   * @returns {boolean} True if matches
   */
  situationMatchesTrigger(situation, trigger) {
    return (
      situation.location === trigger ||
      situation.type === trigger ||
      situation.source === trigger ||
      (situation.participants && situation.participants.includes(trigger))
    );
  }
  
  /**
   * Process trauma through therapy or time
   * @param {string} traumaId - ID of trauma to process
   * @param {number} effectiveness - Processing effectiveness (0-1)
   */
  processTrauma(traumaId, effectiveness = 0.5) {
    const trauma = this.traumas.find(t => t.id === traumaId);
    if (!trauma) return;
    
    // Reduce flashback intensity
    trauma.flashbackIntensity *= (1 - effectiveness * 0.3);
    
    // Mark as processed if intensity is low enough
    if (trauma.flashbackIntensity < 0.2) {
      trauma.processed = true;
    }
    
    // Reduce PTSD symptoms
    for (const symptom in this.ptsdSymptoms) {
      this.ptsdSymptoms[symptom] *= (1 - effectiveness * 0.1);
    }
    
    this.updateTraumaScore();
  }
  
  /**
   * Update overall trauma score
   */
  updateTraumaScore() {
    if (this.traumas.length === 0) {
      this.traumaScore = 0;
      return;
    }
    
    const unprocessedTraumas = this.traumas.filter(t => !t.processed);
    const totalIntensity = unprocessedTraumas.reduce((sum, t) => sum + t.flashbackIntensity, 0);
    
    this.traumaScore = Math.min(1.0, totalIntensity / 3);
  }
  
  /**
   * Natural stress decay over time
   * @param {number} deltaTime - Time in minutes
   */
  decayStress(deltaTime) {
    const decayRate = 0.01 * deltaTime * (1 + this.resilience);
    this.currentStress *= (1 - decayRate);
    this.currentStress = Math.max(0, this.currentStress);
  }
  
  /**
   * Update chronic stress accumulation
   * @param {number} deltaTime - Time in minutes
   */
  updateChronicStress(deltaTime) {
    // High current stress contributes to chronic stress
    if (this.currentStress > this.stressThreshold) {
      const accumulation = 0.001 * deltaTime * (this.currentStress - this.stressThreshold);
      this.chronicStress = Math.min(1.0, this.chronicStress + accumulation);
    } else {
      // Chronic stress slowly decreases when current stress is low
      const recovery = 0.0005 * deltaTime * this.resilience;
      this.chronicStress = Math.max(0, this.chronicStress - recovery);
    }
  }
  
  /**
   * Update PTSD symptoms over time
   * @param {number} deltaTime - Time in minutes
   */
  updatePTSDSymptoms(deltaTime) {
    // Symptoms naturally decrease slowly
    const decayRate = 0.001 * deltaTime * this.resilience;
    
    for (const symptom in this.ptsdSymptoms) {
      this.ptsdSymptoms[symptom] *= (1 - decayRate);
    }
    
    // Chronic stress can maintain PTSD symptoms
    if (this.chronicStress > 0.6) {
      for (const symptom in this.ptsdSymptoms) {
        this.ptsdSymptoms[symptom] += 0.0001 * deltaTime * this.chronicStress;
      }
    }
    
    this.clampPTSDSymptoms();
  }
  
  /**
   * Update burnout indicators
   * @param {number} deltaTime - Time in minutes
   */
  updateBurnout(deltaTime) {
    // Chronic stress leads to burnout
    if (this.chronicStress > 0.7) {
      const burnoutRate = 0.001 * deltaTime * (this.chronicStress - 0.7);
      
      this.burnout.exhaustion += burnoutRate;
      this.burnout.cynicism += burnoutRate * 0.8;
      this.burnout.inefficacy += burnoutRate * 0.6;
    } else {
      // Recovery from burnout
      const recoveryRate = 0.0005 * deltaTime * this.resilience;
      
      this.burnout.exhaustion = Math.max(0, this.burnout.exhaustion - recoveryRate);
      this.burnout.cynicism = Math.max(0, this.burnout.cynicism - recoveryRate * 0.8);
      this.burnout.inefficacy = Math.max(0, this.burnout.inefficacy - recoveryRate * 0.6);
    }
    
    // Clamp burnout values
    for (const key in this.burnout) {
      this.burnout[key] = Math.min(1.0, this.burnout[key]);
    }
  }
  
  /**
   * Apply health impacts from stress
   */
  applyHealthImpacts() {
    if (!this.physiology) return;
    
    // Chronic stress impacts health
    if (this.chronicStress > 0.6) {
      // Immune system suppression
      if (this.physiology.immuneSystem) {
        this.physiology.immuneSystem.effectiveness *= (1 - this.chronicStress * 0.01);
      }
      
      // Cardiovascular stress
      if (this.physiology.cardiovascular) {
        this.physiology.cardiovascular.stress += this.chronicStress * 0.001;
      }
      
      // Sleep disruption
      if (this.physiology.fatigue !== undefined) {
        this.physiology.fatigue += this.chronicStress * 0.01;
      }
    }
    
    // Acute stress impacts
    if (this.currentStress > 0.8) {
      // Increased heart rate and blood pressure
      if (this.physiology.cardiovascular) {
        this.physiology.cardiovascular.heartRate *= (1 + this.currentStress * 0.1);
      }
    }
  }
  
  /**
   * Perform recovery activity
   * @param {Object} activity - Recovery activity details
   * @returns {Object} Recovery results
   */
  performRecovery(activity) {
    const {
      type,
      duration = 60,
      quality = 0.7
    } = activity;
    
    let effectiveness = 0;
    
    switch (type) {
      case 'rest':
        effectiveness = quality * 0.6;
        this.currentStress *= (1 - effectiveness * 0.3);
        break;
        
      case 'social':
        effectiveness = this.copingStrategies.social * quality;
        this.currentStress *= (1 - effectiveness * 0.4);
        this.ptsdSymptoms.avoidance *= 0.95;
        break;
        
      case 'physical':
        effectiveness = quality * 0.7;
        this.currentStress *= (1 - effectiveness * 0.5);
        this.burnout.exhaustion *= 0.9;
        break;
        
      case 'spiritual':
        effectiveness = this.copingStrategies.spiritual * quality;
        this.currentStress *= (1 - effectiveness * 0.3);
        this.ptsdSymptoms.negativeThoughts *= 0.9;
        break;
        
      case 'therapy':
        effectiveness = quality * 0.9;
        this.currentStress *= (1 - effectiveness * 0.4);
        // Process random trauma
        if (this.traumas.length > 0) {
          const unprocessed = this.traumas.filter(t => !t.processed);
          if (unprocessed.length > 0) {
            const trauma = unprocessed[Math.floor(this.rng.next() * unprocessed.length)];
            this.processTrauma(trauma.id, effectiveness);
          }
        }
        break;
    }
    
    this.lastRecoveryActivity = {
      type,
      timestamp: (this.kernel?.turn || 0),
      effectiveness
    };
    
    this.recoveryEffectiveness = effectiveness;
    
    return {
      effectiveness,
      stressReduction: effectiveness * 0.3,
      currentStress: this.currentStress
    };
  }
  
  /**
   * Get stress level category
   * @returns {string} Stress level
   */
  getStressLevel() {
    if (this.currentStress < 0.3) return 'low';
    if (this.currentStress < 0.6) return 'moderate';
    if (this.currentStress < 0.8) return 'high';
    return 'severe';
  }
  
  /**
   * Check if has PTSD
   * @returns {boolean} True if PTSD symptoms are significant
   */
  hasPTSD() {
    const symptomCount = Object.values(this.ptsdSymptoms)
      .filter(v => v > 0.4).length;
    return symptomCount >= 3 && this.traumaScore > 0.3;
  }
  
  /**
   * Check if burned out
   * @returns {boolean} True if burned out
   */
  isBurnedOut() {
    return (
      this.burnout.exhaustion > 0.7 &&
      this.burnout.cynicism > 0.6 &&
      this.burnout.inefficacy > 0.5
    );
  }
  
  /**
   * Get stress summary
   * @returns {Object} Summary of stress state
   */
  getSummary() {
    return {
      currentStress: this.currentStress,
      stressLevel: this.getStressLevel(),
      chronicStress: this.chronicStress,
      traumaScore: this.traumaScore,
      traumaCount: this.traumas.length,
      hasPTSD: this.hasPTSD(),
      isBurnedOut: this.isBurnedOut(),
      resilience: this.resilience,
      topStressors: this.getTopStressors(3)
    };
  }
  
  /**
   * Get top stress sources
   * @param {number} count - Number of top sources to return
   * @returns {Array} Top stressors
   */
  getTopStressors(count = 5) {
    return Array.from(this.stressSources.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([source, intensity]) => ({ source, intensity }));
  }
  
  /**
   * Clamp PTSD symptoms to 0-1
   */
  clampPTSDSymptoms() {
    for (const symptom in this.ptsdSymptoms) {
      this.ptsdSymptoms[symptom] = Math.max(0, Math.min(1, this.ptsdSymptoms[symptom]));
    }
  }
  
  /**
   * Generate unique trauma ID
   * @returns {string} Trauma ID
   */
  generateTraumaId() {
    return `trauma_${(this.kernel?.turn || 0)}_${this.rng.next().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Serialize stress system state
   * @returns {Object} Serialized state
   */
  serialize() {
    return {
      currentStress: this.currentStress,
      chronicStress: this.chronicStress,
      resilience: this.resilience,
      traumas: this.traumas,
      traumaScore: this.traumaScore,
      ptsdSymptoms: this.ptsdSymptoms,
      copingStrategies: this.copingStrategies,
      burnout: this.burnout,
      stressSources: Array.from(this.stressSources.entries())
    };
  }
  
  /**
   * Deserialize stress system state
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    this.currentStress = data.currentStress || 0;
    this.chronicStress = data.chronicStress || 0;
    this.resilience = data.resilience || 0.7;
    this.traumas = data.traumas || [];
    this.traumaScore = data.traumaScore || 0;
    this.ptsdSymptoms = data.ptsdSymptoms || {};
    this.copingStrategies = data.copingStrategies || {};
    this.burnout = data.burnout || {};
    
    if (data.stressSources) {
      this.stressSources = new Map(data.stressSources);
    }
  }
}
