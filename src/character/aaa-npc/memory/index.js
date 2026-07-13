/**
 * Memory Module
 * 
 * Exports all memory-related classes for the AAA NPC system
 * 
 * @module memory
 */

import { EpisodicMemory } from './EpisodicMemory.js';
import { SemanticMemory } from './SemanticMemory.js';
import { ProceduralMemory } from './ProceduralMemory.js';
import { WorkingMemory } from './WorkingMemory.js';

// Re-export for external use
export { EpisodicMemory, SemanticMemory, ProceduralMemory, WorkingMemory };

/**
 * Integrated Memory System
 * Combines all memory types into a unified system
 */
export class MemorySystem {
  constructor(config = {}, kernel = null) {
    this.kernel = kernel;
    this.episodic = new EpisodicMemory(config.episodicCapacity || 512, kernel);
    this.semantic = new SemanticMemory(kernel);
    this.procedural = new ProceduralMemory(kernel);
    this.working = new WorkingMemory(config.workingCapacity || 7, kernel);
    
    // Consolidation settings
    this.consolidationEnabled = config.consolidation !== false;
    this.consolidationInterval = config.consolidationInterval || 60; // minutes
    this.lastConsolidation = kernel?.turn || 0;
  }
  
  /**
   * Update all memory systems
   * @param {number} deltaTime - Time elapsed in minutes
   */
  update(deltaTime) {
    this.episodic.update(deltaTime);
    this.semantic.update(deltaTime);
    this.procedural.update(deltaTime);
    this.working.update(deltaTime);
    
    // Periodic consolidation from working to long-term memory
    if (this.consolidationEnabled && this.kernel) {
      const timeSinceConsolidation = this.kernel.turn - this.lastConsolidation;
      if (timeSinceConsolidation > this.consolidationInterval) {
        this.consolidate();
        this.lastConsolidation = this.kernel.turn;
      }
    }
  }
  
  /**
   * Consolidate working memory to long-term memory
   */
  consolidate() {
    const items = this.working.getAll();
    
    for (const item of items) {
      // High activation items are consolidated
      if (item.activation > 0.7) {
        this.working.consolidate(item.id, {
          episodic: this.episodic,
          semantic: this.semantic,
          procedural: this.procedural
        });
      }
    }
  }
  
  /**
   * Remember an event (episodic)
   * @param {Object} event - Event to remember
   */
  rememberEvent(event) {
    // Add to working memory first
    this.working.add({ ...event, type: 'event' }, event.importance || 0.5);
    
    // Store in episodic memory
    return this.episodic.store(event);
  }
  
  /**
   * Learn a fact (semantic)
   * @param {string} concept - Concept name
   * @param {Object} properties - Properties
   * @param {number} confidence - Confidence level
   */
  learnFact(concept, properties, confidence = 0.5) {
    // Add to working memory
    this.working.add({ type: 'fact', concept, properties }, 0.6);
    
    // Store in semantic memory
    return this.semantic.learn(concept, properties, confidence);
  }
  
  /**
   * Practice a skill (procedural)
   * @param {string} skill - Skill name
   * @param {string} category - Skill category
   * @param {number} quality - Practice quality
   * @param {number} duration - Practice duration
   */
  practiceSkill(skill, category, quality, duration) {
    // Add to working memory
    this.working.add({ type: 'skill', skill, category, quality, duration }, 0.5);
    
    // Practice in procedural memory
    return this.procedural.practice(skill, category, quality, duration);
  }
  
  /**
   * Get comprehensive memory statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      episodic: this.episodic.getStats(),
      semantic: this.semantic.getStats(),
      procedural: this.procedural.getStats(),
      working: this.working.getStats()
    };
  }
  
  /**
   * Serialize entire memory system
   * @returns {Object} Serialized data
   */
  serialize() {
    return {
      episodic: this.episodic.serialize(),
      semantic: this.semantic.serialize(),
      procedural: this.procedural.serialize(),
      working: this.working.serialize(),
      lastConsolidation: this.lastConsolidation
    };
  }
  
  /**
   * Deserialize entire memory system
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    if (data.episodic) this.episodic.deserialize(data.episodic);
    if (data.semantic) this.semantic.deserialize(data.semantic);
    if (data.procedural) this.procedural.deserialize(data.procedural);
    if (data.working) this.working.deserialize(data.working);
    this.lastConsolidation = data.lastConsolidation || (this.kernel?.turn || 0);
  }
}
