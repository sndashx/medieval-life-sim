/**
 * Social Module
 * 
 * Exports all social-related classes for the AAA NPC system
 * 
 * @module social
 */

export { Relationship } from './Relationship.js';
export { ReputationSystem } from './ReputationSystem.js';
export { SocialNetwork } from './SocialNetwork.js';

/**
 * Integrated Social System
 * Manages relationships, reputation, and social networks
 */
export class SocialSystem {
  constructor(personId) {
    this.personId = personId;
    this.relationships = new Map();  // targetId -> Relationship
    this.reputation = new ReputationSystem(personId);
    this.network = null;  // Reference to global social network
  }
  
  /**
   * Set reference to global social network
   * @param {SocialNetwork} network - Social network instance
   */
  setNetwork(network) {
    this.network = network;
    network.addNode(this.personId);
  }
  
  /**
   * Get or create relationship with another person
   * @param {string} targetId - Target person ID
   * @returns {Relationship} Relationship instance
   */
  getRelationship(targetId) {
    if (!this.relationships.has(targetId)) {
      this.relationships.set(targetId, new Relationship(targetId));
      
      // Add to social network
      if (this.network) {
        this.network.addConnection(this.personId, targetId, 0.1);
      }
    }
    return this.relationships.get(targetId);
  }
  
  /**
   * Interact with another person
   * @param {string} targetId - Target person ID
   * @param {Object} interaction - Interaction details
   * @returns {Object} Interaction results
   */
  interact(targetId, interaction) {
    const relationship = this.getRelationship(targetId);
    const result = relationship.interact(interaction);
    
    // Update social network connection strength
    if (this.network) {
      const strength = relationship.getStrength();
      this.network.updateConnectionStrength(this.personId, targetId, strength);
    }
    
    // If interaction is notable, add to reputation
    if (interaction.witnesses && interaction.witnesses.length > 0) {
      this.reputation.addDeed({
        type: interaction.type,
        domain: this.mapInteractionToDomain(interaction.type),
        impact: interaction.valence * interaction.intensity,
        witnesses: interaction.witnesses,
        location: interaction.location
      });
    }
    
    return result;
  }
  
  /**
   * Map interaction type to reputation domain
   * @param {string} interactionType - Interaction type
   * @returns {string} Domain
   */
  mapInteractionToDomain(interactionType) {
    const mapping = {
      help: 'generosity',
      betrayal: 'trustworthiness',
      conflict: 'combat',
      cooperation: 'leadership',
      gift: 'generosity',
      praise: 'wisdom'
    };
    return mapping[interactionType] || 'general';
  }
  
  /**
   * Update all relationships
   * @param {number} deltaTime - Time elapsed in minutes
   */
  update(deltaTime) {
    // Decay relationships
    for (const [targetId, relationship] of this.relationships) {
      relationship.decay(deltaTime);
      
      // Remove very weak relationships
      if (relationship.getStrength() < 0.05 && relationship.type === 'stranger') {
        this.relationships.delete(targetId);
        if (this.network) {
          this.network.removeConnection(this.personId, targetId);
        }
      }
    }
    
    // Update reputation
    this.reputation.update(deltaTime);
  }
  
  /**
   * Get all relationships
   * @returns {Array} Relationships
   */
  getAllRelationships() {
    return Array.from(this.relationships.entries()).map(([id, rel]) => ({
      targetId: id,
      ...rel.getSummary()
    }));
  }
  
  /**
   * Get relationships by type
   * @param {string} type - Relationship type
   * @returns {Array} Matching relationships
   */
  getRelationshipsByType(type) {
    return this.getAllRelationships().filter(r => r.type === type);
  }
  
  /**
   * Get closest relationships
   * @param {number} count - Number of relationships
   * @returns {Array} Closest relationships
   */
  getClosestRelationships(count = 5) {
    return this.getAllRelationships()
      .sort((a, b) => b.strength - a.strength)
      .slice(0, count);
  }
  
  /**
   * Get social statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      relationshipCount: this.relationships.size,
      friends: this.getRelationshipsByType('friend').length,
      closeFriends: this.getRelationshipsByType('close_friend').length,
      enemies: this.getRelationshipsByType('enemy').length,
      reputation: this.reputation.getSummary(),
      networkDegree: this.network ? this.network.getDegree(this.personId) : 0
    };
  }
  
  /**
   * Serialize social system
   * @returns {Object} Serialized data
   */
  serialize() {
    return {
      personId: this.personId,
      relationships: Array.from(this.relationships.entries()).map(([id, rel]) => 
        [id, rel.serialize()]
      ),
      reputation: this.reputation.serialize()
    };
  }
  
  /**
   * Deserialize social system
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    this.personId = data.personId;
    
    this.relationships.clear();
    for (const [id, relData] of data.relationships || []) {
      const rel = new Relationship(id);
      rel.deserialize(relData);
      this.relationships.set(id, rel);
    }
    
    if (data.reputation) {
      this.reputation.deserialize(data.reputation);
    }
  }
}
