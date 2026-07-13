/**
 * GOAPPlanner.js
 * 
 * Implements Goal-Oriented Action Planning (GOAP) for strategic decision-making.
 * Features:
 * - A* search for action sequences
 * - Goal-based planning
 * - Precondition and effect system
 * - Cost-based optimization
 * - Dynamic replanning
 * 
 * @module GOAPPlanner
 */

export class GOAPPlanner {
  constructor(kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    this.actions = [];
    this.maxPlanDepth = 10;
    this.maxSearchNodes = 1000;
    this.planCache = new Map();
    this.cacheLifetime = 60000; // 1 minute
  }
  
  /**
   * Register an action
   * @param {GOAPAction} action - Action to register
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
   * Plan action sequence to achieve goal
   * @param {Object} currentState - Current world state
   * @param {Object} goal - Desired goal state
   * @param {Object} context - Planning context
   * @returns {Array|null} Action sequence or null if no plan found
   */
  plan(currentState, goal, context = {}) {
    // Check cache
    const cacheKey = this.getCacheKey(currentState, goal);
    const cached = this.planCache.get(cacheKey);
    
    if (cached && (this.kernel?.turn || 0) < cached.expiresAt) {
      return cached.plan;
    }
    
    // A* search for action sequence
    const plan = this.aStarSearch(currentState, goal, context);
    
    // Cache result
    if (plan) {
      this.planCache.set(cacheKey, {
        plan,
        expiresAt: (this.kernel?.turn || 0) + this.cacheLifetime
      });
    }
    
    return plan;
  }
  
  /**
   * A* search implementation
   * @param {Object} startState - Starting state
   * @param {Object} goal - Goal state
   * @param {Object} context - Planning context
   * @returns {Array|null} Action sequence or null
   */
  aStarSearch(startState, goal, context) {
    const openSet = [{
      state: { ...startState },
      actions: [],
      gCost: 0,
      fCost: this.heuristic(startState, goal)
    }];
    
    const closedSet = new Set();
    let nodesExpanded = 0;
    
    while (openSet.length > 0 && nodesExpanded < this.maxSearchNodes) {
      // Get node with lowest f-cost
      openSet.sort((a, b) => a.fCost - b.fCost);
      const current = openSet.shift();
      nodesExpanded++;
      
      // Check if goal reached
      if (this.goalSatisfied(current.state, goal)) {
        return current.actions;
      }
      
      // Prevent infinite loops
      if (current.actions.length >= this.maxPlanDepth) {
        continue;
      }
      
      // Add to closed set
      const stateKey = this.stateToKey(current.state);
      if (closedSet.has(stateKey)) {
        continue;
      }
      closedSet.add(stateKey);
      
      // Expand neighbors
      const availableActions = this.getAvailableActions(current.state, context);
      
      for (const action of availableActions) {
        const newState = this.applyAction(current.state, action);
        const newGCost = current.gCost + action.cost;
        const newFCost = newGCost + this.heuristic(newState, goal);
        
        openSet.push({
          state: newState,
          actions: [...current.actions, action],
          gCost: newGCost,
          fCost: newFCost
        });
      }
    }
    
    return null; // No plan found
  }
  
  /**
   * Get available actions for current state
   * @param {Object} state - Current state
   * @param {Object} context - Planning context
   * @returns {Array} Available actions
   */
  getAvailableActions(state, context) {
    return this.actions.filter(action => 
      action.preconditionsMet(state, context)
    );
  }
  
  /**
   * Apply action to state
   * @param {Object} state - Current state
   * @param {GOAPAction} action - Action to apply
   * @returns {Object} New state
   */
  applyAction(state, action) {
    return action.applyEffects({ ...state });
  }
  
  /**
   * Check if goal is satisfied
   * @param {Object} state - Current state
   * @param {Object} goal - Goal state
   * @returns {boolean} True if satisfied
   */
  goalSatisfied(state, goal) {
    for (const [key, value] of Object.entries(goal)) {
      if (state[key] !== value) {
        return false;
      }
    }
    return true;
  }
  
  /**
   * Heuristic function for A* (Manhattan distance)
   * @param {Object} state - Current state
   * @param {Object} goal - Goal state
   * @returns {number} Estimated cost to goal
   */
  heuristic(state, goal) {
    let distance = 0;
    
    for (const [key, value] of Object.entries(goal)) {
      if (state[key] !== value) {
        distance++;
      }
    }
    
    return distance;
  }
  
  /**
   * Convert state to cache key
   * @param {Object} state - State
   * @param {Object} goal - Goal
   * @returns {string} Cache key
   */
  getCacheKey(state, goal) {
    return JSON.stringify({ state, goal });
  }
  
  /**
   * Convert state to string key
   * @param {Object} state - State
   * @returns {string} State key
   */
  stateToKey(state) {
    return JSON.stringify(state);
  }
  
  /**
   * Clear plan cache
   */
  clearCache() {
    this.planCache.clear();
  }
  
  /**
   * Get planner statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      registeredActions: this.actions.length,
      cachedPlans: this.planCache.size,
      maxPlanDepth: this.maxPlanDepth,
      maxSearchNodes: this.maxSearchNodes
    };
  }
}

/**
 * GOAP Action class
 */
export class GOAPAction {
  constructor(config) {
    this.name = config.name;
    this.cost = config.cost || 1;
    this.preconditions = config.preconditions || {};
    this.effects = config.effects || {};
    this.contextCheck = config.contextCheck || (() => true);
    this.execute = config.execute || (() => {});
  }
  
  /**
   * Check if preconditions are met
   * @param {Object} state - Current state
   * @param {Object} context - Planning context
   * @returns {boolean} True if met
   */
  preconditionsMet(state, context) {
    // Check state preconditions
    for (const [key, value] of Object.entries(this.preconditions)) {
      if (state[key] !== value) {
        return false;
      }
    }
    
    // Check context
    return this.contextCheck(context);
  }
  
  /**
   * Apply action effects to state
   * @param {Object} state - Current state
   * @returns {Object} New state
   */
  applyEffects(state) {
    return { ...state, ...this.effects };
  }
  
  /**
   * Execute the action
   * @param {Object} context - Execution context
   * @param {Object} npc - NPC instance
   * @returns {Object} Execution results
   */
  run(context, npc) {
    return this.execute(context, npc);
  }
}

/**
 * Common GOAP actions factory
 */
export class GOAPActionFactory {
  /**
   * Create gather food action
   * @returns {GOAPAction} Gather food action
   */
  static createGatherFood() {
    return new GOAPAction({
      name: 'gather_food',
      cost: 10,
      preconditions: {
        hasEnergy: true,
        inWilderness: true
      },
      effects: {
        hasFood: true,
        hasEnergy: false
      },
      execute: (ctx, npc) => {
        // Gathering logic
        return { success: true, foodGained: 1 };
      }
    });
  }
  
  /**
   * Create eat food action
   * @returns {GOAPAction} Eat food action
   */
  static createEatFood() {
    return new GOAPAction({
      name: 'eat_food',
      cost: 5,
      preconditions: {
        hasFood: true,
        isHungry: true
      },
      effects: {
        hasFood: false,
        isHungry: false,
        hasEnergy: true
      },
      execute: (ctx, npc) => {
        // Eating logic
        return { success: true, hungerSatisfied: true };
      }
    });
  }
  
  /**
   * Create go to location action
   * @param {string} location - Target location
   * @returns {GOAPAction} Go to location action
   */
  static createGoToLocation(location) {
    return new GOAPAction({
      name: `go_to_${location}`,
      cost: 15,
      preconditions: {},
      effects: {
        [`at_${location}`]: true
      },
      execute: (ctx, npc) => {
        // Movement logic
        return { success: true, arrivedAt: location };
      }
    });
  }
  
  /**
   * Create work action
   * @returns {GOAPAction} Work action
   */
  static createWork() {
    return new GOAPAction({
      name: 'work',
      cost: 20,
      preconditions: {
        hasEnergy: true,
        atWorkplace: true
      },
      effects: {
        hasEnergy: false,
        hasMoney: true
      },
      execute: (ctx, npc) => {
        // Work logic
        return { success: true, moneyEarned: 10 };
      }
    });
  }
  
  /**
   * Create rest action
   * @returns {GOAPAction} Rest action
   */
  static createRest() {
    return new GOAPAction({
      name: 'rest',
      cost: 30,
      preconditions: {
        atHome: true
      },
      effects: {
        hasEnergy: true,
        isTired: false
      },
      execute: (ctx, npc) => {
        // Rest logic
        return { success: true, energyRestored: true };
      }
    });
  }
  
  /**
   * Create buy food action
   * @returns {GOAPAction} Buy food action
   */
  static createBuyFood() {
    return new GOAPAction({
      name: 'buy_food',
      cost: 8,
      preconditions: {
        hasMoney: true,
        atMarket: true
      },
      effects: {
        hasFood: true,
        hasMoney: false
      },
      execute: (ctx, npc) => {
        // Purchase logic
        return { success: true, foodPurchased: 1 };
      }
    });
  }
}

/**
 * Goal class for GOAP
 */
export class Goal {
  constructor(config) {
    this.name = config.name;
    this.priority = config.priority || 5;
    this.desiredState = config.desiredState || {};
    this.isValid = config.isValid || (() => true);
    this.onComplete = config.onComplete || (() => {});
  }
  
  /**
   * Check if goal is still valid
   * @param {Object} context - Current context
   * @returns {boolean} True if valid
   */
  checkValidity(context) {
    return this.isValid(context);
  }
  
  /**
   * Get desired world state for this goal
   * @returns {Object} Desired state
   */
  getDesiredState() {
    return this.desiredState;
  }
  
  /**
   * Called when goal is completed
   * @param {Object} context - Completion context
   */
  complete(context) {
    this.onComplete(context);
  }
}

/**
 * Goal manager for prioritizing and selecting goals
 */
export class GoalManager {
  constructor() {
    this.goals = [];
    this.activeGoal = null;
  }
  
  /**
   * Add a goal
   * @param {Goal} goal - Goal to add
   */
  addGoal(goal) {
    this.goals.push(goal);
    this.sortGoals();
  }
  
  /**
   * Remove a goal
   * @param {string} goalName - Goal name
   */
  removeGoal(goalName) {
    this.goals = this.goals.filter(g => g.name !== goalName);
  }
  
  /**
   * Sort goals by priority
   */
  sortGoals() {
    this.goals.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * Select highest priority valid goal
   * @param {Object} context - Current context
   * @returns {Goal|null} Selected goal
   */
  selectGoal(context) {
    for (const goal of this.goals) {
      if (goal.checkValidity(context)) {
        this.activeGoal = goal;
        return goal;
      }
    }
    return null;
  }
  
  /**
   * Get active goal
   * @returns {Goal|null} Active goal
   */
  getActiveGoal() {
    return this.activeGoal;
  }
  
  /**
   * Complete active goal
   * @param {Object} context - Completion context
   */
  completeActiveGoal(context) {
    if (this.activeGoal) {
      this.activeGoal.complete(context);
      this.removeGoal(this.activeGoal.name);
      this.activeGoal = null;
    }
  }
  
  /**
   * Clear all goals
   */
  clearGoals() {
    this.goals = [];
    this.activeGoal = null;
  }
  
  /**
   * Get goal statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      totalGoals: this.goals.length,
      activeGoal: this.activeGoal?.name || 'none',
      highestPriority: this.goals[0]?.priority || 0
    };
  }
}
