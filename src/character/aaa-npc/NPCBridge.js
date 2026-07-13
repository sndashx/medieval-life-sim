/**
 * NPCBridge.js
 * 
 * Bridge/adapter layer that integrates AAA NPC systems with existing Person.js
 * Provides backward compatibility while enabling gradual migration to AAA systems.
 * 
 * Features:
 * - Feature flags for gradual rollout
 * - Bidirectional data sync between Person and AAANPC
 * - Performance optimization via LOD
 * - Fallback to legacy systems when AAA disabled
 * 
 * @module NPCBridge
 */

import { AAANPC } from './AAANPC.js';

/**
 * Feature flags for AAA NPC systems
 */
export const AAA_FEATURES = {
  PERSONALITY: 'aaa_personality',
  MEMORY: 'aaa_memory',
  EMOTIONS: 'aaa_emotions',
  STRESS: 'aaa_stress',
  SOCIAL: 'aaa_social',
  ECONOMIC: 'aaa_economic',
  DECISIONS: 'aaa_decisions',
  FULL: 'aaa_full' // Enable all AAA systems
};

/**
 * NPCBridge - Integrates AAA NPC with Person.js
 */
export class NPCBridge {
  constructor(person, config = {}) {
    this.person = person;
    this.config = config;
    
    // Feature flags (default: all disabled for backward compatibility)
    this.features = new Set(config.enabledFeatures || []);
    
    // Create AAA NPC instance if any features enabled
    this.aaaNPC = null;
    if (this.features.size > 0) {
      this.aaaNPC = this.createAAA_NPC();
    }
    
    // Performance settings
    this.lodDistance = config.lodDistance || {
      high: 50,    // Within 50 tiles
      medium: 200, // Within 200 tiles
      low: 500,    // Within 500 tiles
      minimal: Infinity // Beyond 500 tiles
    };
    
    // Sync state
    this.lastSync = 0;
    this.syncInterval = config.syncInterval || 60; // Sync every 60 ticks
  }
  
  /**
   * Create AAANPC instance from Person data
   * @returns {AAANPC} New AAA NPC instance
   */
  createAAA_NPC() {
    const person = this.person;
    const kernel = person._kernel || person.kernel;
    
    // Convert Person personality to AAA format
    const personality = this.convertPersonality(person.personality);
    
    // Convert Person memory to AAA format
    const memory = this.convertMemory(person.memory);
    
    // Create AAA NPC with kernel
    const aaaNPC = new AAANPC({
      id: person.id,
      name: person.name,
      age: person.age,
      gender: person.sex,
      location: this.formatLocation(person.position),
      personality,
      memory,
      needs: {
        hunger: person.needs.hunger,
        thirst: person.needs.thirst,
        sleep: person.needs.sleep,
        social: 0.5,
        safety: 0.0
      }
    }, kernel);
    
    // Initialize social relationships
    if (this.isFeatureEnabled(AAA_FEATURES.SOCIAL)) {
      this.syncSocialRelationships(person, aaaNPC);
    }
    
    return aaaNPC;
  }
  
  /**
   * Convert Person personality to AAA format
   * @param {Object} personPersonality - Person.js personality
   * @returns {Object} AAA personality config
   */
  convertPersonality(personPersonality) {
    if (!personPersonality) return {};
    
    return {
      traits: {
        openness: personPersonality.openness || 0.5,
        conscientiousness: personPersonality.conscientiousness || 0.5,
        extraversion: personPersonality.extraversion || 0.5,
        agreeableness: personPersonality.agreeableness || 0.5,
        neuroticism: personPersonality.neuroticism || 0.5
      },
      values: {
        tradition: 1.0 - (personPersonality.openness || 0.5),
        achievement: personPersonality.ambition || 0.5,
        benevolence: personPersonality.compassion || 0.5,
        power: personPersonality.ambition || 0.5,
        security: 1.0 - (personPersonality.courage || 0.5),
        hedonism: 0.5,
        stimulation: personPersonality.openness || 0.5,
        self_direction: personPersonality.openness || 0.5,
        universalism: personPersonality.compassion || 0.5,
        conformity: personPersonality.conscientiousness || 0.5
      }
    };
  }
  
  /**
   * Convert Person memory to AAA format
   * @param {Object} personMemory - Person.js memory
   * @returns {Object} AAA memory config
   */
  convertMemory(personMemory) {
    if (!personMemory) return {};
    
    const config = {
      episodic: [],
      semantic: [],
      procedural: []
    };
    
    // Convert ring buffer events to episodic memories
    if (personMemory.events) {
      for (let i = 0; i < personMemory.size; i++) {
        const idx = (personMemory.head - 1 - i + personMemory.events.length) % personMemory.events.length;
        const event = personMemory.events[idx];
        if (event) {
          config.episodic.push({
            type: event.type,
            content: event,
            timestamp: event.remembered || 0,
            location: event.location,
            importance: 0.5
          });
        }
      }
    }
    
    // Convert knowledge to semantic memories
    if (personMemory.knowledge) {
      for (const [id, fact] of personMemory.knowledge.entries()) {
        config.semantic.push({
          concept: id,
          knowledge: fact,
          confidence: 0.8
        });
      }
    }
    
    return config;
  }
  
  /**
   * Sync social relationships from Person to AAA
   * @param {Person} person - Person instance
   * @param {AAANPC} aaaNPC - AAA NPC instance
   */
  syncSocialRelationships(person, aaaNPC) {
    if (!person.relationships) return;
    
    for (const [otherId, bond] of person.relationships.entries()) {
      aaaNPC.social.addRelationship(otherId, {
        affection: bond.affection || 0.0,
        trust: bond.affection || 0.0,
        respect: bond.affection || 0.0,
        type: bond.type || 'acquaintance'
      });
    }
  }
  
  /**
   * Format position for AAA NPC
   * @param {Object} position - Person position
   * @returns {string} Location string
   */
  formatLocation(position) {
    if (!position) return 'unknown';
    return `${position.x},${position.y},${position.z}`;
  }
  
  /**
   * Check if a feature is enabled
   * @param {string} feature - Feature flag
   * @returns {boolean} True if enabled
   */
  isFeatureEnabled(feature) {
    return this.features.has(feature) || this.features.has(AAA_FEATURES.FULL);
  }
  
  /**
   * Enable a feature
   * @param {string} feature - Feature to enable
   */
  enableFeature(feature) {
    this.features.add(feature);
    if (!this.aaaNPC) {
      this.aaaNPC = this.createAAA_NPC();
    }
  }
  
  /**
   * Disable a feature
   * @param {string} feature - Feature to disable
   */
  disableFeature(feature) {
    this.features.delete(feature);
    if (this.features.size === 0) {
      this.aaaNPC = null;
    }
  }
  
  /**
   * Update LOD based on distance from player
   * @param {Object} playerPosition - Player position
   */
  updateLOD(playerPosition) {
    if (!this.aaaNPC) return;
    
    const distance = this.calculateDistance(this.person.position, playerPosition);
    
    if (distance < this.lodDistance.high) {
      this.aaaNPC.setLOD('high');
    } else if (distance < this.lodDistance.medium) {
      this.aaaNPC.setLOD('medium');
    } else if (distance < this.lodDistance.low) {
      this.aaaNPC.setLOD('low');
    } else {
      this.aaaNPC.setLOD('minimal');
    }
  }
  
  /**
   * Calculate distance between two positions
   * @param {Object} pos1 - First position
   * @param {Object} pos2 - Second position
   * @returns {number} Distance
   */
  calculateDistance(pos1, pos2) {
    if (!pos1 || !pos2) return Infinity;
    const dx = (pos1.x || 0) - (pos2.x || 0);
    const dy = (pos1.y || 0) - (pos2.y || 0);
    const dz = (pos1.z || 0) - (pos2.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  
  /**
   * Main update - called by Person.update()
   * @param {Object} kernel - Simulation kernel
   */
  update(kernel) {
    if (!this.aaaNPC) return;
    
    // Update LOD based on player distance
    if (kernel.player && kernel.player.position) {
      this.updateLOD(kernel.player.position);
    }
    
    // Convert kernel turn to deltaTime (minutes)
    const deltaTime = 1; // 1 turn = 1 minute
    
    // Build context for AAA systems
    const context = this.buildContext(kernel);
    
    // Update AAA NPC
    this.aaaNPC.update(deltaTime, context);
    
    // Sync state back to Person
    if (kernel.turn - this.lastSync >= this.syncInterval) {
      this.syncToPerson(kernel);
      this.lastSync = kernel.turn;
    }
  }
  
  /**
   * Build context for AAA decision systems
   * @param {Object} kernel - Simulation kernel
   * @returns {Object} Context
   */
  buildContext(kernel) {
    const person = this.person;
    
    return {
      turn: kernel.turn,
      world: kernel.world,
      entities: kernel.entities,
      position: person.position,
      household: person.household ? kernel.entities.get(person.household) : null,
      nearbyPeople: this.getNearbyPeople(kernel),
      nearbyLocations: this.getNearbyLocations(kernel),
      inventory: person.inventory,
      skills: person.skills,
      occupation: person.occupation,
      game: kernel.game
    };
  }
  
  /**
   * Get nearby people
   * @param {Object} kernel - Simulation kernel
   * @returns {Array} Nearby people
   */
  getNearbyPeople(kernel) {
    const nearby = [];
    const pos = this.person.position;
    
    if (kernel.entityIndex && kernel.entityIndex.query) {
      try {
        const ids = kernel.entityIndex.query(pos.x, pos.y, pos.z, 20, 10);
        for (const id of ids) {
          if (id === this.person.id) continue;
          const entity = kernel.entities.get(id);
          if (entity && entity.alive && entity.isPerson) {
            nearby.push(entity);
          }
        }
      } catch (e) {
        // Fallback: no spatial index
      }
    }
    
    return nearby;
  }
  
  /**
   * Get nearby locations (shops, temples, etc.)
   * @param {Object} kernel - Simulation kernel
   * @returns {Object} Nearby locations
   */
  getNearbyLocations(kernel) {
    const locations = {
      shops: [],
      temples: [],
      households: []
    };
    
    const game = kernel.game;
    if (!game) return locations;
    
    const pos = this.person.position;
    const maxDist = 100;
    
    // Find nearby shops
    if (game.trading && game.trading.shops) {
      for (const shop of game.trading.shops.values()) {
        if (this.calculateDistance(pos, shop.location) < maxDist) {
          locations.shops.push(shop);
        }
      }
    }
    
    // Find nearby temples
    if (game.religion && game.religion.temples) {
      for (const temple of game.religion.temples.values()) {
        if (this.calculateDistance(pos, temple.location) < maxDist) {
          locations.temples.push(temple);
        }
      }
    }
    
    return locations;
  }
  
  /**
   * Sync AAA state back to Person
   * @param {Object} kernel - Simulation kernel
   */
  syncToPerson(kernel) {
    if (!this.aaaNPC) return;
    
    const person = this.person;
    const aaa = this.aaaNPC;
    
    // Sync needs
    person.needs.hunger = aaa.needs.hunger;
    person.needs.thirst = aaa.needs.thirst;
    person.needs.sleep = aaa.needs.sleep;
    
    // Sync personality development (if enabled)
    if (this.isFeatureEnabled(AAA_FEATURES.PERSONALITY)) {
      const traits = aaa.personality.traits;
      person.personality.openness = traits.openness;
      person.personality.conscientiousness = traits.conscientiousness;
      person.personality.extraversion = traits.extraversion;
      person.personality.agreeableness = traits.agreeableness;
      person.personality.neuroticism = traits.neuroticism;
    }
    
    // Sync social relationships (if enabled)
    if (this.isFeatureEnabled(AAA_FEATURES.SOCIAL)) {
      for (const [otherId, relationship] of aaa.social.relationships.entries()) {
        const bond = person.relationships.get(otherId);
        if (bond) {
          bond.affection = relationship.affection;
        } else {
          person.relationships.set(otherId, {
            affection: relationship.affection,
            type: relationship.type || 'acquaintance'
          });
        }
      }
    }
    
    // Sync memory (if enabled)
    if (this.isFeatureEnabled(AAA_FEATURES.MEMORY)) {
      // Sync recent episodic memories to Person's ring buffer
      const recentMemories = aaa.memory.episodic.getRecent(10);
      for (const memory of recentMemories) {
        if (memory.content && memory.content.type) {
          person.memory.remember({
            type: memory.content.type,
            ...memory.content
          });
        }
      }
    }
  }
  
  /**
   * Get enhanced personality for AAA systems
   * @returns {Object} Personality data
   */
  getPersonality() {
    if (this.isFeatureEnabled(AAA_FEATURES.PERSONALITY) && this.aaaNPC) {
      return this.aaaNPC.personality.getSummary();
    }
    return this.person.personality;
  }
  
  /**
   * Get enhanced emotional state
   * @returns {Object} Emotional state
   */
  getEmotionalState() {
    if (this.isFeatureEnabled(AAA_FEATURES.EMOTIONS) && this.aaaNPC) {
      return this.aaaNPC.emotionalState.getSummary();
    }
    return null;
  }
  
  /**
   * Get stress level
   * @returns {number} Stress level (0-1)
   */
  getStressLevel() {
    if (this.isFeatureEnabled(AAA_FEATURES.STRESS) && this.aaaNPC) {
      return this.aaaNPC.stressSystem.getStressLevel();
    }
    return 0;
  }
  
  /**
   * React to event using AAA systems
   * @param {Object} event - Event details
   * @returns {Object} Reaction
   */
  reactToEvent(event) {
    if (this.aaaNPC) {
      return this.aaaNPC.reactToEvent(event);
    }
    return null;
  }
  
  /**
   * Plan goals using AAA decision system
   * @param {Object} context - Decision context
   * @returns {Array} Goals
   */
  planGoals(context) {
    if (this.isFeatureEnabled(AAA_FEATURES.DECISIONS) && this.aaaNPC) {
      const decision = this.aaaNPC.decisionSystem.decide(context);
      return decision.goals || [];
    }
    return null;
  }
  
  /**
   * Get comprehensive status
   * @returns {Object} Status
   */
  getStatus() {
    const status = this.person.getStatus();
    
    if (this.aaaNPC) {
      const aaaStatus = this.aaaNPC.getStatus();
      status.emotion = aaaStatus.emotion;
      status.mood = aaaStatus.mood;
      status.stress = aaaStatus.stress;
      status.lod = aaaStatus.lod;
    }
    
    return status;
  }
  
  /**
   * Serialize for save/load
   * @returns {Object} Serialized data
   */
  serialize() {
    const data = {
      features: Array.from(this.features),
      config: this.config,
      lastSync: this.lastSync
    };
    
    if (this.aaaNPC) {
      data.aaaNPC = this.aaaNPC.serialize();
    }
    
    return data;
  }
  
  /**
   * Deserialize from saved data
   * @param {Object} data - Serialized data
   * @param {Person} person - Person instance
   * @returns {NPCBridge} Deserialized bridge
   */
  static deserialize(data, person) {
    const bridge = new NPCBridge(person, data.config || {});
    
    if (data.features) {
      bridge.features = new Set(data.features);
    }
    
    if (data.aaaNPC && bridge.features.size > 0) {
      bridge.aaaNPC = AAANPC.deserialize(data.aaaNPC);
    }
    
    bridge.lastSync = data.lastSync || 0;
    
    return bridge;
  }
}

export default NPCBridge;
