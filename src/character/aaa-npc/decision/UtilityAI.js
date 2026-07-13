/**
 * UtilityAI.js
 * 
 * Implements utility-based AI for action selection.
 * Features:
 * - Consideration-based utility scoring
 * - Response curves for non-linear evaluation
 * - Emotional and personality modifiers
 * - Top-N selection with randomness for variety
 * - Context-aware action evaluation
 * 
 * @module UtilityAI
 */

export class UtilityAI {
  constructor(npc, kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    this.npc = npc;
    this.considerations = [];
    this.actions = [];
    this.lastSelectedAction = null;
    this.selectionHistory = [];
    this.maxHistorySize = 20;
  }
  
  /**
   * Register an action
   * @param {Action} action - Action to register
   */
  registerAction(action) {
    this.actions.push(action);
  }
  
  /**
   * Register multiple actions
   * @param {Array} actions - Actions to register
   */
  registerActions(actions) {
    this.actions.push(...actions);
  }
  
  /**
   * Select best action based on utility scores
   * @param {Object} context - Current context
   * @returns {Action|null} Selected action
   */
  selectAction(context) {
    // Score all available actions
    const scoredActions = this.actions
      .filter(action => action.isAvailable(context, this.npc))
      .map(action => ({
        action,
        score: this.scoreAction(action, context)
      }));
    
    if (scoredActions.length === 0) return null;
    
    // Sort by score
    scoredActions.sort((a, b) => b.score - a.score);
    
    // Add randomness to prevent robotic behavior
    // Select from top 3 actions with weighted probability
    const topActions = scoredActions.slice(0, Math.min(3, scoredActions.length));
    const weights = topActions.map((a, i) => Math.pow(0.7, i));
    const selected = this.weightedRandom(topActions, weights);
    
    // Record selection
    this.lastSelectedAction = selected.action;
    this.selectionHistory.push({
      action: selected.action.name,
      score: selected.score,
      timestamp: (this.kernel?.turn || 0)
    });
    
    if (this.selectionHistory.length > this.maxHistorySize) {
      this.selectionHistory.shift();
    }
    
    return selected.action;
  }
  
  /**
   * Score an action based on all considerations
   * @param {Action} action - Action to score
   * @param {Object} context - Current context
   * @returns {number} Utility score
   */
  scoreAction(action, context) {
    let score = action.baseUtility;
    
    // Apply all considerations
    for (const consideration of action.considerations) {
      const value = consideration.evaluate(context, this.npc);
      const curve = consideration.responseCurve(value);
      score *= curve;
      
      // Early exit if score drops to zero
      if (score === 0) break;
    }
    
    // Apply emotional modifiers
    if (this.npc.emotionalState) {
      score *= this.getEmotionalModifier(action);
    }
    
    // Apply personality modifiers
    if (this.npc.personality) {
      score *= this.getPersonalityModifier(action);
    }
    
    // Apply stress modifiers
    if (this.npc.stressSystem) {
      score *= this.getStressModifier(action);
    }
    
    // Bonus for variety (avoid repeating same action)
    if (this.lastSelectedAction && this.lastSelectedAction.name === action.name) {
      score *= 0.8;
    }
    
    return Math.max(0, score);
  }
  
  /**
   * Get emotional modifier for action
   * @param {Action} action - Action to modify
   * @returns {number} Modifier (0.5-1.5)
   */
  getEmotionalModifier(action) {
    const emotion = this.npc.emotionalState.getDominantEmotion();
    
    // Different emotions bias different actions
    const modifiers = {
      fear: {
        flee: 1.5,
        hide: 1.4,
        fight: 0.5,
        explore: 0.3,
        socialize: 0.6
      },
      anger: {
        fight: 1.5,
        confront: 1.4,
        flee: 0.5,
        negotiate: 0.7,
        help: 0.6
      },
      joy: {
        socialize: 1.3,
        celebrate: 1.4,
        work: 1.1,
        rest: 0.8,
        explore: 1.2
      },
      sadness: {
        socialize: 0.6,
        rest: 1.2,
        work: 0.8,
        seek_comfort: 1.4,
        isolate: 1.3
      },
      trust: {
        cooperate: 1.3,
        help: 1.2,
        share: 1.2,
        betray: 0.3
      },
      disgust: {
        avoid: 1.4,
        reject: 1.3,
        clean: 1.2,
        approach: 0.5
      },
      anticipation: {
        prepare: 1.3,
        plan: 1.2,
        explore: 1.2,
        wait: 0.7
      },
      surprise: {
        investigate: 1.4,
        pause: 1.2,
        flee: 1.1,
        routine: 0.6
      }
    };
    
    const actionType = action.type || action.name;
    return modifiers[emotion]?.[actionType] || 1.0;
  }
  
  /**
   * Get personality modifier for action
   * @param {Action} action - Action to modify
   * @returns {number} Modifier (0.5-1.5)
   */
  getPersonalityModifier(action) {
    const personality = this.npc.personality.traits;
    let modifier = 1.0;
    
    // Openness affects exploration and novelty
    if (action.requiresOpenness) {
      modifier *= (0.5 + personality.openness * 0.5);
    }
    
    // Conscientiousness affects planning and organization
    if (action.requiresPlanning) {
      modifier *= (0.5 + personality.conscientiousness * 0.5);
    }
    
    // Extraversion affects social actions
    if (action.isSocial) {
      modifier *= (0.5 + personality.extraversion * 0.5);
    }
    
    // Agreeableness affects cooperative actions
    if (action.isCooperative) {
      modifier *= (0.5 + personality.agreeableness * 0.5);
    }
    
    // Neuroticism affects risk-taking
    if (action.isRisky) {
      modifier *= (1.5 - personality.neuroticism);
    }
    
    // Courage affects dangerous actions
    if (action.requiresCourage) {
      modifier *= (0.5 + personality.courage * 0.5);
    }
    
    return modifier;
  }
  
  /**
   * Get stress modifier for action
   * @param {Action} action - Action to modify
   * @returns {number} Modifier (0.5-1.5)
   */
  getStressModifier(action) {
    const stress = this.npc.stressSystem.currentStress;
    
    // High stress reduces complex action scores
    if (action.complexity > 0.5) {
      return 1.0 - (stress * 0.3);
    }
    
    // High stress increases simple, stress-reducing actions
    if (action.reducesStress) {
      return 1.0 + (stress * 0.5);
    }
    
    return 1.0;
  }
  
  /**
   * Weighted random selection
   * @param {Array} items - Items to select from
   * @param {Array} weights - Weights for each item
   * @returns {*} Selected item
   */
  weightedRandom(items, weights) {
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = this.rng.next() * totalWeight;
    
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return items[i];
      }
    }
    
    return items[items.length - 1];
  }
  
  /**
   * Get action selection statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const actionCounts = new Map();
    
    for (const entry of this.selectionHistory) {
      actionCounts.set(entry.action, (actionCounts.get(entry.action) || 0) + 1);
    }
    
    return {
      totalSelections: this.selectionHistory.length,
      uniqueActions: actionCounts.size,
      mostCommonAction: Array.from(actionCounts.entries())
        .reduce((a, b) => a[1] > b[1] ? a : b, ['none', 0])[0],
      lastAction: this.lastSelectedAction?.name || 'none'
    };
  }
}

/**
 * Action class
 */
export class Action {
  constructor(config) {
    this.name = config.name;
    this.type = config.type || config.name;
    this.baseUtility = config.baseUtility || 0.5;
    this.considerations = config.considerations || [];
    this.preconditions = config.preconditions || [];
    this.effects = config.effects || [];
    
    // Action properties
    this.duration = config.duration || 60;
    this.cost = config.cost || 0;
    this.complexity = config.complexity || 0.5;
    
    // Personality requirements
    this.requiresOpenness = config.requiresOpenness || false;
    this.requiresPlanning = config.requiresPlanning || false;
    this.requiresCourage = config.requiresCourage || false;
    this.isSocial = config.isSocial || false;
    this.isCooperative = config.isCooperative || false;
    this.isRisky = config.isRisky || false;
    this.reducesStress = config.reducesStress || false;
    
    // Execution callback
    this.execute = config.execute || (() => {});
  }
  
  /**
   * Check if action is available
   * @param {Object} context - Current context
   * @param {Object} npc - NPC instance
   * @returns {boolean} True if available
   */
  isAvailable(context, npc) {
    for (const precondition of this.preconditions) {
      if (!precondition(context, npc)) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Execute the action
   * @param {Object} context - Current context
   * @param {Object} npc - NPC instance
   * @returns {Object} Execution results
   */
  run(context, npc) {
    return this.execute(context, npc);
  }
}

/**
 * Consideration class
 */
export class Consideration {
  constructor(name, inputFunc, responseCurve) {
    this.name = name;
    this.inputFunc = inputFunc;
    this.responseCurve = responseCurve || this.linearCurve;
  }
  
  /**
   * Evaluate consideration
   * @param {Object} context - Current context
   * @param {Object} npc - NPC instance
   * @returns {number} Input value (0-1)
   */
  evaluate(context, npc) {
    return this.inputFunc(context, npc);
  }
  
  /**
   * Linear response curve
   * @param {number} x - Input value
   * @returns {number} Output value
   */
  linearCurve(x) {
    return x;
  }
  
  /**
   * Quadratic response curve (accelerating)
   * @param {number} x - Input value
   * @returns {number} Output value
   */
  static quadraticCurve(x) {
    return x * x;
  }
  
  /**
   * Cubic response curve (strong acceleration)
   * @param {number} x - Input value
   * @returns {number} Output value
   */
  static cubicCurve(x) {
    return x * x * x;
  }
  
  /**
   * Inverse quadratic curve (diminishing returns)
   * @param {number} x - Input value
   * @returns {number} Output value
   */
  static inverseQuadraticCurve(x) {
    return 1 - Math.pow(1 - x, 2);
  }
  
  /**
   * Sigmoid curve (S-curve)
   * @param {number} x - Input value
   * @param {number} steepness - Curve steepness
   * @returns {number} Output value
   */
  static sigmoidCurve(x, steepness = 10) {
    return 1 / (1 + Math.exp(-steepness * (x - 0.5)));
  }
  
  /**
   * Boolean curve (threshold)
   * @param {number} x - Input value
   * @param {number} threshold - Threshold value
   * @returns {number} Output value (0 or 1)
   */
  static booleanCurve(x, threshold = 0.5) {
    return x >= threshold ? 1 : 0;
  }
}

/**
 * Common considerations factory
 */
export class ConsiderationFactory {
  /**
   * Create hunger consideration
   * @returns {Consideration} Hunger consideration
   */
  static createHunger() {
    return new Consideration(
      'hunger',
      (ctx, npc) => npc.needs?.hunger || 0,
      Consideration.quadraticCurve
    );
  }
  
  /**
   * Create thirst consideration
   * @returns {Consideration} Thirst consideration
   */
  static createThirst() {
    return new Consideration(
      'thirst',
      (ctx, npc) => npc.needs?.thirst || 0,
      Consideration.quadraticCurve
    );
  }
  
  /**
   * Create fatigue consideration
   * @returns {Consideration} Fatigue consideration
   */
  static createFatigue() {
    return new Consideration(
      'fatigue',
      (ctx, npc) => npc.needs?.sleep || 0,
      Consideration.cubicCurve
    );
  }
  
  /**
   * Create wealth consideration
   * @returns {Consideration} Wealth consideration
   */
  static createWealth() {
    return new Consideration(
      'wealth',
      (ctx, npc) => {
        const current = npc.economicMotivation?.wealth.liquid || 0;
        const desired = npc.economicMotivation?.wealthSatisfactionThreshold || 1000;
        return 1 - Math.min(1, current / desired);
      },
      Consideration.inverseQuadraticCurve
    );
  }
  
  /**
   * Create danger consideration
   * @returns {Consideration} Danger consideration
   */
  static createDanger() {
    return new Consideration(
      'danger',
      (ctx, npc) => ctx.dangerLevel || 0,
      Consideration.quadraticCurve
    );
  }
  
  /**
   * Create social need consideration
   * @returns {Consideration} Social need consideration
   */
  static createSocialNeed() {
    return new Consideration(
      'social_need',
      (ctx, npc) => 1 - (npc.needs?.social || 0.5),
      Consideration.linearCurve
    );
  }
}
