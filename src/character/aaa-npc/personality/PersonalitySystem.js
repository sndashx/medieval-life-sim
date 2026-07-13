/**
 * PersonalitySystem.js
 * 
 * Extended personality model combining Big Five with medieval-specific traits.
 * Features:
 * - Big Five personality traits
 * - Medieval-specific traits (piety, honor, courage, etc.)
 * - Value system
 * - Behavioral tendencies
 * - Personality development over time
 * - Decision influence calculation
 * 
 * @module PersonalitySystem
 */

export class PersonalitySystem {
  constructor(config = {}, kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    // Big Five personality traits (0-1 scale)
    this.traits = {
      openness: config.openness || this.randomTrait(),
      conscientiousness: config.conscientiousness || this.randomTrait(),
      extraversion: config.extraversion || this.randomTrait(),
      agreeableness: config.agreeableness || this.randomTrait(),
      neuroticism: config.neuroticism || this.randomTrait(),
      
      // Medieval-specific traits
      piety: config.piety || this.randomTrait(),
      honor: config.honor || this.randomTrait(),
      ambition: config.ambition || this.randomTrait(),
      compassion: config.compassion || this.randomTrait(),
      courage: config.courage || this.randomTrait(),
      loyalty: config.loyalty || this.randomTrait(),
      pragmatism: config.pragmatism || this.randomTrait(),
      traditionalism: config.traditionalism || this.randomTrait()
    };
    
    // Core values (what the person cares about, 0-1 scale)
    this.values = {
      family: config.values?.family || 0.8,
      wealth: config.values?.wealth || 0.5,
      power: config.values?.power || 0.4,
      knowledge: config.values?.knowledge || 0.5,
      faith: config.values?.faith || 0.6,
      freedom: config.values?.freedom || 0.6,
      justice: config.values?.justice || 0.5,
      beauty: config.values?.beauty || 0.4,
      tradition: config.values?.tradition || 0.5,
      innovation: config.values?.innovation || 0.4
    };
    
    // Behavioral tendencies (0-1 scale)
    this.tendencies = {
      riskTaking: 1 - this.traits.neuroticism,
      impulsivity: (1 - this.traits.conscientiousness) * 0.7 + this.traits.neuroticism * 0.3,
      assertiveness: this.traits.extraversion * 0.6 + (1 - this.traits.agreeableness) * 0.4,
      sociability: this.traits.extraversion,
      curiosity: this.traits.openness,
      stubbornness: (1 - this.traits.agreeableness) * 0.5 + this.traits.conscientiousness * 0.5,
      optimism: (1 - this.traits.neuroticism) * 0.7 + this.traits.extraversion * 0.3
    };
    
    // Personality development tracking
    this.development = {
      experiences: [],
      growthAreas: [],
      lastDevelopment: (this.kernel?.turn || 0)
    };
    
    // Personality stability (how resistant to change)
    this.stability = 0.8;
  }
  
  /**
   * Generate random trait value with normal distribution
   * @returns {number} Trait value (0-1)
   */
  randomTrait() {
    // Box-Muller transform for normal distribution
    const u1 = this.rng.next();
    const u2 = this.rng.next();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    // Convert to 0-1 range with mean 0.5, std 0.15
    const value = 0.5 + z * 0.15;
    return Math.max(0, Math.min(1, value));
  }
  
  /**
   * Influence a decision based on personality
   * @param {Object} decision - Decision details
   * @param {Object} context - Decision context
   * @returns {number} Influence modifier (0.5-1.5)
   */
  influenceDecision(decision, context = {}) {
    let modifier = 1.0;
    
    // Courage requirement
    if (decision.requiresCourage) {
      modifier *= (0.5 + this.traits.courage * 0.5);
    }
    
    // Social skill requirement
    if (decision.requiresSocialSkill) {
      modifier *= (0.5 + this.traits.extraversion * 0.5);
    }
    
    // Risk assessment
    if (decision.isRisky) {
      modifier *= (0.5 + this.tendencies.riskTaking * 0.5);
    }
    
    // Moral/ethical considerations
    if (decision.moralWeight) {
      const moralAlignment = this.calculateMoralAlignment(decision);
      modifier *= moralAlignment;
    }
    
    // Planning requirement
    if (decision.requiresPlanning) {
      modifier *= (0.5 + this.traits.conscientiousness * 0.5);
    }
    
    // Innovation vs tradition
    if (decision.isNovel) {
      modifier *= (0.5 + this.traits.openness * 0.5);
    } else if (decision.isTraditional) {
      modifier *= (0.5 + this.traits.traditionalism * 0.5);
    }
    
    // Value alignment
    const valueAlignment = this.calculateValueAlignment(decision);
    modifier *= valueAlignment;
    
    return Math.max(0.1, Math.min(2.0, modifier));
  }
  
  /**
   * Calculate moral alignment with decision
   * @param {Object} decision - Decision details
   * @returns {number} Alignment (0.5-1.5)
   */
  calculateMoralAlignment(decision) {
    let alignment = 1.0;
    
    if (decision.helpsOthers) {
      alignment += this.traits.compassion * 0.3;
    }
    
    if (decision.harmsOthers) {
      alignment -= this.traits.compassion * 0.4;
      alignment -= this.traits.honor * 0.3;
    }
    
    if (decision.isHonest) {
      alignment += this.traits.honor * 0.2;
    }
    
    if (decision.isDeceptive) {
      alignment -= this.traits.honor * 0.4;
      alignment += this.traits.pragmatism * 0.2;
    }
    
    return Math.max(0.5, Math.min(1.5, alignment));
  }
  
  /**
   * Calculate value alignment with decision
   * @param {Object} decision - Decision details
   * @returns {number} Alignment (0.5-1.5)
   */
  calculateValueAlignment(decision) {
    let alignment = 1.0;
    
    if (!decision.affectedValues) return alignment;
    
    for (const [value, weight] of Object.entries(decision.affectedValues)) {
      const personalValue = this.values[value] || 0.5;
      alignment += (personalValue - 0.5) * weight * 0.5;
    }
    
    return Math.max(0.5, Math.min(1.5, alignment));
  }
  
  /**
   * Develop personality based on experience
   * @param {Object} experience - Experience details
   */
  developPersonality(experience) {
    const {
      type,
      intensity = 0.5,
      traits = {},
      values = {}
    } = experience;
    
    // Record experience
    this.development.experiences.push({
      type,
      intensity,
      timestamp: (this.kernel?.turn || 0)
    });
    
    // Calculate development impact (reduced by stability)
    const impact = intensity * 0.01 * (1 - this.stability);
    
    // Adjust traits based on experience type
    switch (type) {
      case 'traumatic':
        this.traits.neuroticism += impact;
        this.traits.openness -= impact * 0.5;
        this.traits.courage -= impact * 0.3;
        break;
        
      case 'achievement':
        this.traits.conscientiousness += impact;
        this.traits.ambition += impact * 0.5;
        this.values.power += impact * 0.5;
        break;
        
      case 'social_success':
        this.traits.extraversion += impact;
        this.tendencies.sociability += impact;
        this.tendencies.assertiveness += impact * 0.5;
        break;
        
      case 'social_rejection':
        this.traits.neuroticism += impact;
        this.traits.extraversion -= impact * 0.5;
        this.tendencies.sociability -= impact * 0.5;
        break;
        
      case 'betrayal':
        this.traits.agreeableness -= impact;
        this.traits.loyalty -= impact * 0.5;
        this.tendencies.stubbornness += impact * 0.3;
        break;
        
      case 'act_of_kindness':
        this.traits.compassion += impact;
        this.traits.agreeableness += impact * 0.5;
        this.values.family += impact * 0.3;
        break;
        
      case 'moral_dilemma':
        if (experience.choiceHonest) {
          this.traits.honor += impact;
        } else {
          this.traits.pragmatism += impact;
        }
        break;
        
      case 'religious_experience':
        this.traits.piety += impact;
        this.values.faith += impact * 0.5;
        break;
        
      case 'combat':
        this.traits.courage += impact * 0.5;
        this.traits.neuroticism += impact * 0.3;
        break;
        
      case 'learning':
        this.traits.openness += impact;
        this.values.knowledge += impact * 0.5;
        break;
    }
    
    // Apply custom trait changes
    for (const [trait, change] of Object.entries(traits)) {
      if (this.traits[trait] !== undefined) {
        this.traits[trait] += change * impact;
      }
    }
    
    // Apply custom value changes
    for (const [value, change] of Object.entries(values)) {
      if (this.values[value] !== undefined) {
        this.values[value] += change * impact;
      }
    }
    
    // Clamp all values
    this.clampAllTraits();
    this.clampAllValues();
    this.updateTendencies();
    
    this.development.lastDevelopment = (this.kernel?.turn || 0);
  }
  
  /**
   * Update behavioral tendencies based on traits
   */
  updateTendencies() {
    this.tendencies.riskTaking = 1 - this.traits.neuroticism;
    this.tendencies.impulsivity = (1 - this.traits.conscientiousness) * 0.7 + this.traits.neuroticism * 0.3;
    this.tendencies.assertiveness = this.traits.extraversion * 0.6 + (1 - this.traits.agreeableness) * 0.4;
    this.tendencies.sociability = this.traits.extraversion;
    this.tendencies.curiosity = this.traits.openness;
    this.tendencies.stubbornness = (1 - this.traits.agreeableness) * 0.5 + this.traits.conscientiousness * 0.5;
    this.tendencies.optimism = (1 - this.traits.neuroticism) * 0.7 + this.traits.extraversion * 0.3;
  }
  
  /**
   * Get personality archetype
   * @returns {string} Archetype name
   */
  getArchetype() {
    // Simplified archetype classification
    const high = 0.6;
    const low = 0.4;
    
    if (this.traits.courage > high && this.traits.honor > high) {
      return 'noble_warrior';
    }
    if (this.traits.piety > high && this.traits.compassion > high) {
      return 'devout_healer';
    }
    if (this.traits.ambition > high && this.traits.pragmatism > high) {
      return 'cunning_merchant';
    }
    if (this.traits.openness > high && this.values.knowledge > high) {
      return 'wise_scholar';
    }
    if (this.traits.loyalty > high && this.traits.conscientiousness > high) {
      return 'faithful_servant';
    }
    if (this.traits.courage > high && this.traits.ambition > high) {
      return 'ambitious_knight';
    }
    if (this.traits.compassion > high && this.traits.agreeableness > high) {
      return 'kind_soul';
    }
    if (this.traits.pragmatism > high && this.traits.honor < low) {
      return 'pragmatic_survivor';
    }
    
    return 'common_folk';
  }
  
  /**
   * Get personality description
   * @returns {string} Description
   */
  getDescription() {
    const descriptors = [];
    
    // Big Five descriptors
    if (this.traits.openness > 0.7) descriptors.push('imaginative');
    else if (this.traits.openness < 0.3) descriptors.push('traditional');
    
    if (this.traits.conscientiousness > 0.7) descriptors.push('disciplined');
    else if (this.traits.conscientiousness < 0.3) descriptors.push('spontaneous');
    
    if (this.traits.extraversion > 0.7) descriptors.push('outgoing');
    else if (this.traits.extraversion < 0.3) descriptors.push('reserved');
    
    if (this.traits.agreeableness > 0.7) descriptors.push('compassionate');
    else if (this.traits.agreeableness < 0.3) descriptors.push('competitive');
    
    if (this.traits.neuroticism > 0.7) descriptors.push('anxious');
    else if (this.traits.neuroticism < 0.3) descriptors.push('calm');
    
    // Medieval descriptors
    if (this.traits.courage > 0.7) descriptors.push('brave');
    if (this.traits.honor > 0.7) descriptors.push('honorable');
    if (this.traits.piety > 0.7) descriptors.push('devout');
    if (this.traits.ambition > 0.7) descriptors.push('ambitious');
    
    return descriptors.slice(0, 5).join(', ');
  }
  
  /**
   * Calculate compatibility with another personality
   * @param {PersonalitySystem} other - Other personality
   * @returns {number} Compatibility (0-1)
   */
  calculateCompatibility(other) {
    let compatibility = 0.5;
    
    // Similar values increase compatibility
    for (const [value, strength] of Object.entries(this.values)) {
      const otherStrength = other.values[value] || 0.5;
      const similarity = 1 - Math.abs(strength - otherStrength);
      compatibility += (similarity - 0.5) * 0.05;
    }
    
    // Complementary traits
    // Extraversion compatibility
    const extraversionDiff = Math.abs(this.traits.extraversion - other.traits.extraversion);
    if (extraversionDiff < 0.3) compatibility += 0.1; // Similar is good
    
    // Agreeableness compatibility
    if (this.traits.agreeableness > 0.6 && other.traits.agreeableness > 0.6) {
      compatibility += 0.15; // Both agreeable is very good
    }
    
    // Neuroticism compatibility
    if (this.traits.neuroticism < 0.4 && other.traits.neuroticism > 0.6) {
      compatibility += 0.1; // Calm person can balance anxious person
    }
    
    return Math.max(0, Math.min(1, compatibility));
  }
  
  /**
   * Clamp all traits to 0-1
   */
  clampAllTraits() {
    for (const trait in this.traits) {
      this.traits[trait] = Math.max(0, Math.min(1, this.traits[trait]));
    }
  }
  
  /**
   * Clamp all values to 0-1
   */
  clampAllValues() {
    for (const value in this.values) {
      this.values[value] = Math.max(0, Math.min(1, this.values[value]));
    }
  }
  
  /**
   * Get personality summary
   * @returns {Object} Summary
   */
  getSummary() {
    return {
      archetype: this.getArchetype(),
      description: this.getDescription(),
      dominantTraits: this.getDominantTraits(3),
      coreValues: this.getCoreValues(3),
      tendencies: { ...this.tendencies }
    };
  }
  
  /**
   * Get dominant traits
   * @param {number} count - Number of traits
   * @returns {Array} Dominant traits
   */
  getDominantTraits(count = 5) {
    return Object.entries(this.traits)
      .sort((a, b) => Math.abs(b[1] - 0.5) - Math.abs(a[1] - 0.5))
      .slice(0, count)
      .map(([name, value]) => ({ name, value }));
  }
  
  /**
   * Get core values
   * @param {number} count - Number of values
   * @returns {Array} Core values
   */
  getCoreValues(count = 5) {
    return Object.entries(this.values)
      .sort((a, b) => b[1] - a[1])
      .slice(0, count)
      .map(([name, value]) => ({ name, value }));
  }
  
  /**
   * Serialize personality system
   * @returns {Object} Serialized data
   */
  serialize() {
    return {
      traits: this.traits,
      values: this.values,
      tendencies: this.tendencies,
      development: {
        experiences: this.development.experiences.slice(-50),
        lastDevelopment: this.development.lastDevelopment
      },
      stability: this.stability
    };
  }
  
  /**
   * Deserialize personality system
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    this.traits = data.traits || {};
    this.values = data.values || {};
    this.tendencies = data.tendencies || {};
    this.development = data.development || { experiences: [], lastDevelopment: (this.kernel?.turn || 0) };
    this.stability = data.stability || 0.8;
  }
}
