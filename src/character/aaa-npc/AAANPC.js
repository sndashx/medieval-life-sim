/**
 * AAANPC.js
 * 
 * Main AAA-quality NPC class that integrates all subsystems:
 * - Psychology (emotions, stress)
 * - Memory (episodic, semantic, procedural, working)
 * - Social (relationships, reputation, network)
 * - Economic (motivation, career, wealth)
 * - Decision-making (utility AI + GOAP)
 * - Personality (traits, values, development)
 * 
 * @module AAANPC
 */

import { EmotionalState, StressSystem } from './psychology/index.js';
import { MemorySystem } from './memory/index.js';
import { SocialSystem } from './social/index.js';
import { EconomicMotivation } from './economic/index.js';
import { HybridDecisionSystem } from './decision/index.js';
import { PersonalitySystem } from './personality/index.js';

export class AAANPC {
  constructor(config = {}, kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => Math.random(), nextInt: (min, max) => Math.floor(Math.random() * (max - min + 1)) + min };
    
    this.id = config.id || this.generateId();
    this.name = config.name || 'Unknown';
    this.age = config.age || 25;
    this.gender = config.gender || 'neutral';
    
    // Initialize personality first (other systems depend on it)
    this.personality = new PersonalitySystem(config.personality || {}, kernel);
    
    // Initialize psychological systems
    this.emotionalState = new EmotionalState(this.personality.traits, kernel);
    this.stressSystem = new StressSystem(this.personality.traits, kernel);
    
    // Initialize memory systems
    this.memory = new MemorySystem(config.memory || {}, kernel);
    
    // Initialize social systems
    this.social = new SocialSystem(this.id, kernel);
    
    // Initialize economic systems
    this.economicMotivation = new EconomicMotivation(
      this.personality.traits,
      config.initialWealth || 0,
      kernel
    );
    
    // Initialize decision-making
    this.decisionSystem = new HybridDecisionSystem(this, kernel);
    
    // Basic needs (0-1 scale, 1 = critical need)
    this.needs = {
      hunger: config.needs?.hunger || 0.0,
      thirst: config.needs?.thirst || 0.0,
      sleep: config.needs?.sleep || 0.0,
      social: config.needs?.social || 0.5,
      safety: config.needs?.safety || 0.0
    };
    
    // Physical state
    this.physiology = {
      health: 1.0,
      stamina: 1.0,
      fatigue: 0.0
    };
    
    // Current state
    this.currentAction = null;
    this.location = config.location || 'unknown';
    this.isActive = true;
    
    // Performance tracking
    this.updateCount = 0;
    this.lastUpdate = kernel?.turn || 0;
    
    // Level of Detail (for performance optimization)
    this.lod = 'high'; // 'high', 'medium', 'low', 'minimal'
  }
  
  /**
   * Main update loop - called each game tick
   * @param {number} deltaTime - Time elapsed in minutes
   * @param {Object} context - Current game context
   */
  update(deltaTime, context = {}) {
    if (!this.isActive) return;
    
    // Update based on LOD
    switch (this.lod) {
      case 'high':
        this.fullUpdate(deltaTime, context);
        break;
      case 'medium':
        this.mediumUpdate(deltaTime, context);
        break;
      case 'low':
        this.lowUpdate(deltaTime, context);
        break;
      case 'minimal':
        this.minimalUpdate(deltaTime, context);
        break;
    }
    
    this.updateCount++;
    this.lastUpdate = this.kernel?.turn || 0;
  }
  
  /**
   * Full update (high LOD) - all systems active
   * @param {number} deltaTime - Time elapsed
   * @param {Object} context - Game context
   */
  fullUpdate(deltaTime, context) {
    // Update psychological state
    this.emotionalState.update(deltaTime);
    this.stressSystem.update(deltaTime);
    
    // Update memory systems
    this.memory.update(deltaTime);
    
    // Update social systems
    this.social.update(deltaTime);
    
    // Update economic systems
    this.economicMotivation.update(deltaTime);
    
    // Update needs
    this.updateNeeds(deltaTime);
    
    // Make decisions
    if (!this.currentAction || this.currentAction.isComplete) {
      const decision = this.decisionSystem.decide(context);
      if (decision.action) {
        this.executeAction(decision.action, context);
      }
    }
  }
  
  /**
   * Medium update (medium LOD) - essential systems only
   * @param {number} deltaTime - Time elapsed
   * @param {Object} context - Game context
   */
  mediumUpdate(deltaTime, context) {
    // Update emotions and stress (simplified)
    this.emotionalState.decay(deltaTime);
    this.stressSystem.decayStress(deltaTime);
    
    // Update working memory only
    this.memory.working.update(deltaTime);
    
    // Update needs
    this.updateNeeds(deltaTime);
    
    // Simple decision making (utility AI only)
    if (!this.currentAction || this.currentAction.isComplete) {
      const action = this.decisionSystem.utilityAI.selectAction(context);
      if (action) {
        this.executeAction(action, context);
      }
    }
  }
  
  /**
   * Low update (low LOD) - minimal processing
   * @param {number} deltaTime - Time elapsed
   * @param {Object} context - Game context
   */
  lowUpdate(deltaTime, context) {
    // Update needs only
    this.updateNeeds(deltaTime);
    
    // Emotional decay
    this.emotionalState.decay(deltaTime * 2);
  }
  
  /**
   * Minimal update (minimal LOD) - state preservation only
   * @param {number} deltaTime - Time elapsed
   * @param {Object} context - Game context
   */
  minimalUpdate(deltaTime, context) {
    // Just track time passage
    this.needs.hunger = Math.min(1.0, this.needs.hunger + 0.001 * deltaTime);
    this.needs.thirst = Math.min(1.0, this.needs.thirst + 0.002 * deltaTime);
  }
  
  /**
   * Update basic needs
   * @param {number} deltaTime - Time elapsed in minutes
   */
  updateNeeds(deltaTime) {
    // Needs increase over time
    this.needs.hunger = Math.min(1.0, this.needs.hunger + 0.001 * deltaTime);
    this.needs.thirst = Math.min(1.0, this.needs.thirst + 0.002 * deltaTime);
    this.needs.sleep = Math.min(1.0, this.needs.sleep + 0.0005 * deltaTime);
    
    // Social need depends on extraversion
    const socialDecay = 0.0003 * this.personality.traits.extraversion * deltaTime;
    this.needs.social = Math.min(1.0, this.needs.social + socialDecay);
    
    // High needs cause stress
    const needStress = (this.needs.hunger + this.needs.thirst + this.needs.sleep) / 3;
    if (needStress > 0.7) {
      this.stressSystem.addStressor({
        type: 'physical',
        severity: needStress,
        source: 'unmet_needs',
        controllable: true
      });
    }
  }
  
  /**
   * Execute an action
   * @param {Action} action - Action to execute
   * @param {Object} context - Execution context
   */
  executeAction(action, context) {
    this.currentAction = {
      action,
      startTime: this.kernel?.turn || 0,
      isComplete: false
    };
    
    // Execute action
    const result = action.run(context, this);
    
    // Record in memory
    this.memory.rememberEvent({
      type: 'action',
      action: action.name,
      result,
      location: this.location,
      timestamp: this.kernel?.turn || 0,
      emotionalState: this.emotionalState.serialize(),
      importance: 0.3
    });
    
    // Mark complete
    this.currentAction.isComplete = true;
  }
  
  /**
   * React to an event
   * @param {Object} event - Event details
   */
  reactToEvent(event) {
    // Emotional reaction
    const emotionalResponse = this.emotionalState.react(event, this.personality.traits);
    
    // Stress reaction
    if (event.stressful) {
      this.stressSystem.addStressor({
        type: event.type,
        severity: event.severity || 0.5,
        source: event.source,
        controllable: event.controllable || false
      });
    }
    
    // Memory formation
    this.memory.rememberEvent({
      ...event,
      emotionalState: this.emotionalState.serialize(),
      emotionalIntensity: emotionalResponse.intensity
    });
    
    // Personality development
    if (event.developmentImpact) {
      this.personality.developPersonality({
        type: event.type,
        intensity: event.developmentImpact
      });
    }
    
    return emotionalResponse;
  }
  
  /**
   * Interact with another NPC
   * @param {string} targetId - Target NPC ID
   * @param {Object} interaction - Interaction details
   */
  interactWith(targetId, interaction) {
    return this.social.interact(targetId, interaction);
  }
  
  /**
   * Set level of detail for performance optimization
   * @param {string} lod - Level of detail ('high', 'medium', 'low', 'minimal')
   */
  setLOD(lod) {
    this.lod = lod;
  }
  
  /**
   * Get comprehensive NPC state
   * @returns {Object} Complete state
   */
  getState() {
    return {
      id: this.id,
      name: this.name,
      age: this.age,
      location: this.location,
      personality: this.personality.getSummary(),
      emotions: this.emotionalState.getSummary(),
      stress: this.stressSystem.getSummary(),
      needs: { ...this.needs },
      social: this.social.getStats(),
      economic: this.economicMotivation.getSummary(),
      memory: this.memory.getStats(),
      currentAction: this.currentAction?.action.name || 'idle',
      lod: this.lod
    };
  }
  
  /**
   * Get brief status for UI display
   * @returns {Object} Brief status
   */
  getStatus() {
    return {
      name: this.name,
      emotion: this.emotionalState.getDominantEmotion(),
      mood: this.emotionalState.mood.current,
      stress: this.stressSystem.getStressLevel(),
      action: this.currentAction?.action.name || 'idle',
      health: this.physiology.health
    };
  }
  
  /**
   * Generate unique NPC ID
   * @returns {string} NPC ID
   */
  generateId() {
    const turn = this.kernel?.turn || 0;
    const random = this.rng.next().toString(36).substr(2, 9);
    return `npc_${turn}_${random}`;
  }
  
  /**
   * Serialize NPC for saving
   * @returns {Object} Serialized data
   */
  serialize() {
    return {
      id: this.id,
      name: this.name,
      age: this.age,
      gender: this.gender,
      location: this.location,
      personality: this.personality.serialize(),
      emotionalState: this.emotionalState.serialize(),
      stressSystem: this.stressSystem.serialize(),
      memory: this.memory.serialize(),
      social: this.social.serialize(),
      economicMotivation: this.economicMotivation.serialize(),
      needs: this.needs,
      physiology: this.physiology,
      lod: this.lod,
      updateCount: this.updateCount,
      lastUpdate: this.lastUpdate
    };
  }
  
  /**
   * Deserialize NPC from saved data
   * @param {Object} data - Serialized data
   * @returns {AAANPC} Deserialized NPC
   */
  static deserialize(data) {
    const npc = new AAANPC({
      id: data.id,
      name: data.name,
      age: data.age,
      gender: data.gender,
      location: data.location
    });
    
    if (data.personality) npc.personality.deserialize(data.personality);
    if (data.emotionalState) npc.emotionalState.deserialize(data.emotionalState);
    if (data.stressSystem) npc.stressSystem.deserialize(data.stressSystem);
    if (data.memory) npc.memory.deserialize(data.memory);
    if (data.social) npc.social.deserialize(data.social);
    if (data.economicMotivation) npc.economicMotivation.deserialize(data.economicMotivation);
    
    npc.needs = data.needs || {};
    npc.physiology = data.physiology || {};
    npc.lod = data.lod || 'high';
    npc.updateCount = data.updateCount || 0;
    npc.lastUpdate = data.lastUpdate || 0;
    
    return npc;
  }
}

export default AAANPC;
