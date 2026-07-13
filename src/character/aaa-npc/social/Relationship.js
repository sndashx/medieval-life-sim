/**
 * Relationship.js
 * 
 * Implements multi-dimensional relationship system between NPCs.
 * Features:
 * - Multiple relationship dimensions (affection, respect, trust, etc.)
 * - Relationship type classification (friend, enemy, lover, etc.)
 * - Interaction history tracking
 * - Dynamic relationship evolution
 * - Stability and volatility modeling
 * 
 * @module Relationship
 */

export class Relationship {
  constructor(targetId, initialDimensions = {}, kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    this.targetId = targetId;
    
    // Multi-dimensional relationship model
    this.dimensions = {
      affection: initialDimensions.affection || 0.5,      // Like ←→ Dislike
      respect: initialDimensions.respect || 0.5,          // Disrespect ←→ Respect
      trust: initialDimensions.trust || 0.5,              // Distrust ←→ Trust
      familiarity: initialDimensions.familiarity || 0.0,  // Stranger ←→ Intimate
      power: initialDimensions.power || 0.5,              // Subordinate ←→ Dominant
      romantic: initialDimensions.romantic || 0.0,        // Platonic ←→ Romantic
      professional: initialDimensions.professional || 0.0  // Personal ←→ Professional
    };
    
    // Relationship history
    this.interactions = [];
    this.sharedExperiences = [];
    this.conflicts = [];
    this.favors = { given: 0, received: 0 };
    
    // Relationship metadata
    this.type = 'stranger';
    this.firstMet = (this.kernel?.turn || 0);
    this.lastInteraction = (this.kernel?.turn || 0);
    
    // Relationship dynamics
    this.stability = 0.7;      // Resistance to change (0-1)
    this.volatility = 0.3;     // How quickly it changes (0-1)
    this.momentum = 0.0;       // Current direction of change (-1 to 1)
    
    // Emotional investment
    this.investment = 0.0;     // How much they care about this relationship
    
    // Compatibility
    this.compatibility = 0.5;  // Natural compatibility (0-1)
  }
  
  /**
   * Record an interaction
   * @param {Object} interaction - Interaction details
   * @returns {Object} Impact on relationship
   */
  interact(interaction) {
    const {
      type,
      valence = 0,           // Positive or negative (-1 to 1)
      intensity = 0.5,
      context = {},
      timestamp = (this.kernel?.turn || 0)
    } = interaction;
    
    // Store interaction
    this.interactions.push({
      type,
      valence,
      intensity,
      context,
      timestamp
    });
    
    // Calculate impact on dimensions
    const impact = this.calculateImpact(interaction);
    
    // Apply changes with stability modifier
    for (const [dimension, change] of Object.entries(impact)) {
      if (this.dimensions[dimension] !== undefined) {
        const stabilityMod = 1 - this.stability;
        const volatilityMod = 1 + this.volatility;
        const effectiveChange = change * stabilityMod * volatilityMod;
        
        this.dimensions[dimension] = this.clamp(
          this.dimensions[dimension] + effectiveChange,
          0, 1
        );
      }
    }
    
    // Update familiarity with any interaction
    this.dimensions.familiarity = Math.min(1.0, 
      this.dimensions.familiarity + 0.01 * intensity
    );
    
    // Update investment
    this.investment = Math.min(1.0,
      this.investment + 0.005 * intensity
    );
    
    // Update momentum
    this.momentum = this.momentum * 0.8 + valence * 0.2;
    
    // Update relationship type
    this.updateType();
    
    // Update last interaction time
    this.lastInteraction = timestamp;
    
    // Prune old interactions
    if (this.interactions.length > 100) {
      this.interactions = this.interactions.slice(-100);
    }
    
    return {
      impact,
      newType: this.type,
      sentiment: this.getOverallSentiment()
    };
  }
  
  /**
   * Calculate impact of interaction on relationship dimensions
   * @param {Object} interaction - Interaction details
   * @returns {Object} Dimension changes
   */
  calculateImpact(interaction) {
    const impact = {};
    const { type, valence, intensity } = interaction;
    
    switch (type) {
      case 'conversation':
        impact.affection = valence * intensity * 0.1;
        impact.familiarity = intensity * 0.05;
        break;
        
      case 'help':
        impact.affection = intensity * 0.15;
        impact.trust = intensity * 0.1;
        impact.respect = intensity * 0.05;
        this.favors.given++;
        break;
        
      case 'helped_by':
        impact.affection = intensity * 0.1;
        impact.trust = intensity * 0.08;
        this.favors.received++;
        break;
        
      case 'betrayal':
        impact.trust = -intensity * 0.4;
        impact.affection = -intensity * 0.3;
        impact.respect = -intensity * 0.2;
        this.conflicts.push({ type: 'betrayal', timestamp: (this.kernel?.turn || 0) });
        break;
        
      case 'conflict':
        impact.affection = -intensity * 0.2;
        impact.trust = -intensity * 0.1;
        this.conflicts.push({ type: 'conflict', timestamp: (this.kernel?.turn || 0) });
        break;
        
      case 'cooperation':
        impact.trust = intensity * 0.1;
        impact.respect = intensity * 0.08;
        impact.professional = intensity * 0.05;
        break;
        
      case 'romantic_advance':
        impact.romantic = intensity * 0.15;
        impact.affection = valence * intensity * 0.1;
        break;
        
      case 'shared_experience':
        impact.familiarity = intensity * 0.1;
        impact.affection = valence * intensity * 0.08;
        this.sharedExperiences.push({
          type: interaction.context.experienceType,
          timestamp: (this.kernel?.turn || 0)
        });
        break;
        
      case 'gift':
        impact.affection = intensity * 0.12;
        impact.trust = intensity * 0.05;
        this.favors.given++;
        break;
        
      case 'insult':
        impact.affection = -intensity * 0.15;
        impact.respect = -intensity * 0.1;
        break;
        
      case 'praise':
        impact.affection = intensity * 0.1;
        impact.respect = intensity * 0.08;
        break;
        
      case 'compete':
        impact.respect = valence * intensity * 0.1;
        impact.professional = intensity * 0.05;
        break;
        
      default:
        // Generic interaction
        impact.affection = valence * intensity * 0.05;
        impact.familiarity = intensity * 0.02;
    }
    
    return impact;
  }
  
  /**
   * Update relationship type based on dimensions
   */
  updateType() {
    const { affection, trust, familiarity, romantic, respect, professional } = this.dimensions;
    
    // Romantic relationships
    if (romantic > 0.7 && affection > 0.7) {
      this.type = trust > 0.8 ? 'spouse' : 'lover';
      return;
    }
    
    // Negative relationships
    if (affection < 0.3 && trust < 0.3) {
      this.type = this.conflicts.length > 3 ? 'enemy' : 'rival';
      return;
    }
    
    // Positive relationships
    if (affection > 0.7 && familiarity > 0.7) {
      this.type = trust > 0.7 ? 'close_friend' : 'friend';
      return;
    }
    
    // Professional relationships
    if (professional > 0.6 && respect > 0.6) {
      this.type = 'colleague';
      return;
    }
    
    // Acquaintances
    if (familiarity > 0.3) {
      this.type = affection > 0.5 ? 'acquaintance' : 'known';
      return;
    }
    
    // Default
    this.type = 'stranger';
  }
  
  /**
   * Get overall sentiment toward target
   * @returns {number} Sentiment (-1 to 1)
   */
  getOverallSentiment() {
    return (
      this.dimensions.affection * 0.4 +
      this.dimensions.respect * 0.3 +
      this.dimensions.trust * 0.3 -
      0.5
    ) * 2;
  }
  
  /**
   * Get relationship strength
   * @returns {number} Strength (0-1)
   */
  getStrength() {
    return (
      this.dimensions.familiarity * 0.4 +
      this.investment * 0.3 +
      Math.abs(this.getOverallSentiment()) * 0.3
    );
  }
  
  /**
   * Check if relationship is positive
   * @returns {boolean} True if positive
   */
  isPositive() {
    return this.getOverallSentiment() > 0.2;
  }
  
  /**
   * Check if relationship is negative
   * @returns {boolean} True if negative
   */
  isNegative() {
    return this.getOverallSentiment() < -0.2;
  }
  
  /**
   * Get relationship quality descriptor
   * @returns {string} Quality descriptor
   */
  getQuality() {
    const sentiment = this.getOverallSentiment();
    
    if (sentiment > 0.7) return 'excellent';
    if (sentiment > 0.4) return 'good';
    if (sentiment > 0.1) return 'positive';
    if (sentiment > -0.1) return 'neutral';
    if (sentiment > -0.4) return 'negative';
    if (sentiment > -0.7) return 'poor';
    return 'hostile';
  }
  
  /**
   * Decay relationship over time without interaction
   * @param {number} deltaTime - Time since last interaction in days
   */
  decay(deltaTime) {
    const daysSinceInteraction = ((this.kernel?.turn || 0) - this.lastInteraction) / (24 * 60 * 60 * 1000);
    
    if (daysSinceInteraction > 30) {
      // Familiarity decays
      const decayRate = 0.001 * deltaTime;
      this.dimensions.familiarity *= (1 - decayRate);
      
      // Investment decays
      this.investment *= (1 - decayRate * 0.5);
      
      // Extreme emotions moderate toward neutral
      for (const dim of ['affection', 'trust', 'respect']) {
        const distance = Math.abs(this.dimensions[dim] - 0.5);
        if (distance > 0.3) {
          this.dimensions[dim] += (0.5 - this.dimensions[dim]) * decayRate * 0.5;
        }
      }
      
      // Momentum decays
      this.momentum *= (1 - decayRate);
    }
  }
  
  /**
   * Get recent interaction summary
   * @param {number} count - Number of recent interactions
   * @returns {Array} Recent interactions
   */
  getRecentInteractions(count = 10) {
    return this.interactions
      .slice(-count)
      .reverse();
  }
  
  /**
   * Get interaction statistics
   * @returns {Object} Statistics
   */
  getInteractionStats() {
    const positive = this.interactions.filter(i => i.valence > 0).length;
    const negative = this.interactions.filter(i => i.valence < 0).length;
    const neutral = this.interactions.length - positive - negative;
    
    return {
      total: this.interactions.length,
      positive,
      negative,
      neutral,
      conflicts: this.conflicts.length,
      sharedExperiences: this.sharedExperiences.length,
      favorBalance: this.favors.given - this.favors.received
    };
  }
  
  /**
   * Get relationship summary
   * @returns {Object} Summary
   */
  getSummary() {
    return {
      targetId: this.targetId,
      type: this.type,
      quality: this.getQuality(),
      sentiment: this.getOverallSentiment(),
      strength: this.getStrength(),
      dimensions: { ...this.dimensions },
      daysSinceFirstMet: ((this.kernel?.turn || 0) - this.firstMet) / (24 * 60 * 60 * 1000),
      daysSinceLastInteraction: ((this.kernel?.turn || 0) - this.lastInteraction) / (24 * 60 * 60 * 1000),
      interactionCount: this.interactions.length
    };
  }
  
  /**
   * Clamp value between 0 and 1
   * @param {number} value - Value to clamp
   * @param {number} min - Minimum
   * @param {number} max - Maximum
   * @returns {number} Clamped value
   */
  clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }
  
  /**
   * Serialize relationship
   * @returns {Object} Serialized data
   */
  serialize() {
    return {
      targetId: this.targetId,
      dimensions: this.dimensions,
      interactions: this.interactions.slice(-50), // Keep last 50
      sharedExperiences: this.sharedExperiences,
      conflicts: this.conflicts,
      favors: this.favors,
      type: this.type,
      firstMet: this.firstMet,
      lastInteraction: this.lastInteraction,
      stability: this.stability,
      volatility: this.volatility,
      momentum: this.momentum,
      investment: this.investment,
      compatibility: this.compatibility
    };
  }
  
  /**
   * Deserialize relationship
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    this.targetId = data.targetId;
    this.dimensions = data.dimensions || {};
    this.interactions = data.interactions || [];
    this.sharedExperiences = data.sharedExperiences || [];
    this.conflicts = data.conflicts || [];
    this.favors = data.favors || { given: 0, received: 0 };
    this.type = data.type || 'stranger';
    this.firstMet = data.firstMet || (this.kernel?.turn || 0);
    this.lastInteraction = data.lastInteraction || (this.kernel?.turn || 0);
    this.stability = data.stability || 0.7;
    this.volatility = data.volatility || 0.3;
    this.momentum = data.momentum || 0.0;
    this.investment = data.investment || 0.0;
    this.compatibility = data.compatibility || 0.5;
  }
}
