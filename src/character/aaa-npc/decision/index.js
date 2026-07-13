/**
 * Decision Module
 * 
 * Exports all decision-making classes for the AAA NPC system
 * 
 * @module decision
 */

import { UtilityAI, Action, Consideration, ConsiderationFactory } from './UtilityAI.js';
import { GOAPPlanner, GOAPAction, GOAPActionFactory, Goal, GoalManager } from './GOAPPlanner.js';

// Re-export for external use
export { UtilityAI, Action, Consideration, ConsiderationFactory, GOAPPlanner, GOAPAction, GOAPActionFactory, Goal, GoalManager };

/**
 * Hybrid Decision System
 * Combines Utility AI (reactive) with GOAP (strategic)
 */
export class HybridDecisionSystem {
  constructor(npc, kernel = null) {
    this.npc = npc;
    this.kernel = kernel || npc.kernel;
    this.utilityAI = new UtilityAI(npc, this.kernel);
    this.goapPlanner = new GOAPPlanner(this.kernel);
    this.goalManager = new GoalManager();
    
    // Current plan
    this.currentPlan = null;
    this.currentPlanStep = 0;
    
    // Decision mode
    this.mode = 'reactive'; // 'reactive' or 'strategic'
    this.modeThreshold = 0.7; // Urgency threshold for reactive mode
    
    // Replanning
    this.replanInterval = 300; // Replan every 5 minutes
    this.lastPlanTime = 0;
  }
  
  /**
   * Make a decision
   * @param {Object} context - Current context
   * @returns {Object} Decision
   */
  decide(context) {
    // Calculate urgency
    const urgency = this.calculateUrgency(context);
    
    // Switch mode based on urgency
    if (urgency > this.modeThreshold) {
      this.mode = 'reactive';
      return this.reactiveDecision(context);
    } else {
      this.mode = 'strategic';
      return this.strategicDecision(context);
    }
  }
  
  /**
   * Calculate urgency level
   * @param {Object} context - Current context
   * @returns {number} Urgency (0-1)
   */
  calculateUrgency(context) {
    let urgency = 0;
    
    // Needs urgency
    if (this.npc.needs) {
      urgency = Math.max(urgency, this.npc.needs.hunger || 0);
      urgency = Math.max(urgency, this.npc.needs.thirst || 0);
      urgency = Math.max(urgency, this.npc.needs.sleep || 0);
    }
    
    // Danger urgency
    if (context.dangerLevel) {
      urgency = Math.max(urgency, context.dangerLevel);
    }
    
    // Emotional urgency
    if (this.npc.emotionalState) {
      const intensity = this.npc.emotionalState.getEmotionalIntensity();
      const dominantEmotion = this.npc.emotionalState.getDominantEmotion();
      
      if (['fear', 'anger'].includes(dominantEmotion)) {
        urgency = Math.max(urgency, intensity);
      }
    }
    
    return urgency;
  }
  
  /**
   * Make reactive decision using Utility AI
   * @param {Object} context - Current context
   * @returns {Object} Decision
   */
  reactiveDecision(context) {
    const action = this.utilityAI.selectAction(context);
    
    return {
      mode: 'reactive',
      action,
      plan: null
    };
  }
  
  /**
   * Make strategic decision using GOAP
   * @param {Object} context - Current context
   * @returns {Object} Decision
   */
  strategicDecision(context) {
    // Check if we need to replan
    const now = this.kernel?.turn || 0;
    const shouldReplan = (
      !this.currentPlan ||
      this.currentPlanStep >= this.currentPlan.length ||
      (now - this.lastPlanTime) > this.replanInterval
    );
    
    if (shouldReplan) {
      this.replan(context);
    }
    
    // Execute current plan step
    if (this.currentPlan && this.currentPlanStep < this.currentPlan.length) {
      const action = this.currentPlan[this.currentPlanStep];
      this.currentPlanStep++;
      
      return {
        mode: 'strategic',
        action,
        plan: this.currentPlan,
        planStep: this.currentPlanStep
      };
    }
    
    // Fallback to reactive if no plan
    return this.reactiveDecision(context);
  }
  
  /**
   * Replan using GOAP
   * @param {Object} context - Current context
   */
  replan(context) {
    // Select goal
    const goal = this.goalManager.selectGoal(context);
    
    if (!goal) {
      this.currentPlan = null;
      return;
    }
    
    // Get current world state
    const currentState = this.getCurrentWorldState(context);
    
    // Plan action sequence
    const plan = this.goapPlanner.plan(
      currentState,
      goal.getDesiredState(),
      context
    );
    
    if (plan) {
      this.currentPlan = plan;
      this.currentPlanStep = 0;
      this.lastPlanTime = this.kernel?.turn || 0;
    } else {
      this.currentPlan = null;
    }
  }
  
  /**
   * Get current world state for GOAP
   * @param {Object} context - Current context
   * @returns {Object} World state
   */
  getCurrentWorldState(context) {
    const state = {};
    
    // Needs state
    if (this.npc.needs) {
      state.isHungry = this.npc.needs.hunger > 0.7;
      state.isThirsty = this.npc.needs.thirst > 0.7;
      state.isTired = this.npc.needs.sleep > 0.8;
    }
    
    // Inventory state
    if (this.npc.inventory) {
      state.hasFood = this.npc.inventory.count('food') > 0;
      state.hasMoney = this.npc.inventory.count('money') > 0;
    }
    
    // Location state
    if (context.location) {
      state[`at_${context.location}`] = true;
    }
    
    // Energy state
    state.hasEnergy = !state.isTired;
    
    return state;
  }
  
  /**
   * Register utility actions
   * @param {Array} actions - Actions to register
   */
  registerUtilityActions(actions) {
    this.utilityAI.registerActions(actions);
  }
  
  /**
   * Register GOAP actions
   * @param {Array} actions - Actions to register
   */
  registerGOAPActions(actions) {
    this.goapPlanner.registerActions(actions);
  }
  
  /**
   * Add goal
   * @param {Goal} goal - Goal to add
   */
  addGoal(goal) {
    this.goalManager.addGoal(goal);
  }
  
  /**
   * Get decision statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      mode: this.mode,
      utilityAI: this.utilityAI.getStats(),
      goap: this.goapPlanner.getStats(),
      goals: this.goalManager.getStats(),
      currentPlan: this.currentPlan ? {
        length: this.currentPlan.length,
        step: this.currentPlanStep,
        remaining: this.currentPlan.length - this.currentPlanStep
      } : null
    };
  }
}
