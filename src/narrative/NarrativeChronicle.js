/**
 * NarrativeChronicle.js
 * 
 * Transforms raw game events into narrative story beats that read like a chronicle.
 * Makes the scrollback feel like a living story rather than a debug log.
 */

export class NarrativeChronicle {
  constructor(game) {
    this.game = game;
    this.kernel = game.kernel;
    this.entries = [];
    this.maxEntries = 200;
    
    // Track significant moments for AAA NPCs
    this.significantMoments = new Map(); // npcId -> recent significant events
  }

  /**
   * Add a narrative entry to the chronicle
   * @param {string} text - The narrative text
   * @param {Object} metadata - Event metadata
   */
  addEntry(text, metadata = {}) {
    const entry = {
      text,
      turn: this.kernel?.turn || 0,
      timestamp: Date.now(), // AUDIT-WHITELIST: chronicle wall-clock for player-facing display only, not in any deterministic path
      type: metadata.type || 'general',
      participants: metadata.participants || [],
      location: metadata.location || null,
      significance: metadata.significance || 0.5
    };

    this.entries.push(entry);

    // Trim old entries
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    return entry;
  }

  /**
   * Log a game event in narrative style
   * @param {Object} event - Raw game event
   */
  logEvent(event) {
    const narrative = this.eventToNarrative(event);
    if (narrative) {
      this.addEntry(narrative, {
        type: event.type,
        participants: event.participants || [],
        location: event.location,
        significance: this.calculateSignificance(event)
      });
    }
  }

  /**
   * Convert raw event to narrative text
   * @param {Object} event - Raw game event
   * @returns {string} Narrative text
   */
  eventToNarrative(event) {
    switch (event.type) {
      case 'marriage':
        return this.narrateMarriage(event);
      case 'birth':
        return this.narrateBirth(event);
      case 'death':
        return this.narrateDeath(event);
      case 'person_died':
        return this.narratePersonDied(event);
      case 'combat':
        return this.narrateCombat(event);
      case 'trade':
        return this.narrateTrade(event);
      case 'social_interaction':
        return this.narrateSocialInteraction(event);
      case 'reputation_change':
        return this.narrateReputationChange(event);
      case 'emotional_event':
        return this.narrateEmotionalEvent(event);
      case 'memory_formed':
        return this.narrateMemoryFormed(event);
      case 'gossip':
        return this.narrateGossip(event);
      default:
        return null;
    }
  }

  /**
   * Narrate a marriage event
   */
  narrateMarriage(event) {
    const person1 = this.getPerson(event.person1Id);
    const person2 = this.getPerson(event.person2Id);
    const location = event.location || 'the village chapel';

    if (!person1 || !person2) return null;

    const relationship = this.getRelationshipContext(person1, person2);
    
    return `${person1.name} and ${person2.name} were married at ${location}. ${relationship}`;
  }

  /**
   * Narrate a birth event
   */
  narrateBirth(event) {
    const mother = this.getPerson(event.motherId);
    const child = this.getPerson(event.childId);
    
    if (!mother || !child) return null;

    const father = event.fatherId ? this.getPerson(event.fatherId) : null;
    
    if (father) {
      return `${mother.name} gave birth to ${child.sex === 'male' ? 'a son' : 'a daughter'}, ${child.name}. ${father.name} is the proud father.`;
    } else {
      return `${mother.name} gave birth to ${child.sex === 'male' ? 'a son' : 'a daughter'}, ${child.name}.`;
    }
  }

  /**
   * Narrate a death event
   */
  narrateDeath(event) {
    const person = this.getPerson(event.personId);
    if (!person) return null;

    const cause = this.narratizeCause(event.cause);
    const age = Math.floor(person.age);
    
    return `${person.name}, age ${age}, ${cause}. The village mourns.`;
  }

  /**
   * Narrate person died event
   */
  narratePersonDied(event) {
    const person = this.getPerson(event.personId);
    if (!person) return null;

    const cause = this.narratizeCause(event.cause);
    const age = Math.floor(event.age || person.age);
    
    return `${person.name} (${age}) ${cause}.`;
  }

  /**
   * Narrate combat event
   */
  narrateCombat(event) {
    const attacker = this.getPerson(event.attackerId);
    const defender = this.getPerson(event.defenderId);
    
    if (!attacker || !defender) return null;

    if (event.outcome === 'hit') {
      return `${attacker.name} struck ${defender.name} in combat!`;
    } else if (event.outcome === 'miss') {
      return `${attacker.name} swung at ${defender.name} but missed.`;
    } else if (event.outcome === 'fatal') {
      return `${attacker.name} dealt a fatal blow to ${defender.name}!`;
    }
    
    return `${attacker.name} and ${defender.name} clashed in combat.`;
  }

  /**
   * Narrate trade event
   */
  narrateTrade(event) {
    const buyer = this.getPerson(event.buyerId);
    const seller = this.getPerson(event.sellerId);
    
    if (!buyer || !seller) return null;

    const item = event.item || 'goods';
    const price = event.price || 0;
    
    return `${buyer.name} bought ${item} from ${seller.name} for ${price} copper.`;
  }

  /**
   * Narrate social interaction
   */
  narrateSocialInteraction(event) {
    const person1 = this.getPerson(event.person1Id);
    const person2 = this.getPerson(event.person2Id);
    
    if (!person1 || !person2) return null;

    const interactionType = event.interactionType || 'spoke with';
    const location = event.location || 'the village';
    
    return `${person1.name} ${interactionType} ${person2.name} at ${location}.`;
  }

  /**
   * Narrate reputation change
   */
  narrateReputationChange(event) {
    const person = this.getPerson(event.personId);
    if (!person) return null;

    const change = event.change > 0 ? 'improved' : 'worsened';
    const domain = event.domain || 'general';
    
    return `${person.name}'s reputation for ${domain} has ${change}.`;
  }

  /**
   * Narrate emotional event (AAA NPC)
   */
  narrateEmotionalEvent(event) {
    const person = this.getPerson(event.personId);
    if (!person) return null;

    const emotion = event.emotion || 'emotional';
    const intensity = event.intensity || 0.5;
    
    if (intensity > 0.7) {
      return `${person.name} is overwhelmed with ${emotion}.`;
    } else if (intensity > 0.4) {
      return `${person.name} feels ${emotion}.`;
    }
    
    return null; // Don't log minor emotions
  }

  /**
   * Narrate memory formation (AAA NPC)
   */
  narrateMemoryFormed(event) {
    const person = this.getPerson(event.personId);
    if (!person) return null;

    // Only narrate highly significant memories
    if (event.importance < 0.7) return null;

    const memoryType = event.memoryType || 'event';
    const description = event.description || 'something significant';
    
    return `${person.name} will remember ${description}.`;
  }

  /**
   * Narrate gossip (AAA NPC social system)
   */
  narrateGossip(event) {
    const speaker = this.getPerson(event.speakerId);
    const listener = this.getPerson(event.listenerId);
    const subject = this.getPerson(event.subjectId);
    
    if (!speaker || !listener || !subject) return null;

    const topic = event.topic || 'something';
    
    return `You hear that ${speaker.name} told ${listener.name} that ${subject.name} ${topic}.`;
  }

  /**
   * Get person by ID
   */
  getPerson(personId) {
    if (!personId) return null;
    return this.kernel?.entities?.get(personId);
  }

  /**
   * Get relationship context between two people
   */
  getRelationshipContext(person1, person2) {
    // Check if they're neighbors
    const distance = this.calculateDistance(person1.position, person2.position);
    if (distance < 10) {
      return "They are neighbors.";
    }
    
    // Check relationship via game systems
    if (this.game.relationships) {
      const bond = this.game.relationships.getBond(person1.id, person2.id);
      if (bond) {
        if (bond.affinity > 0.7) return "They are deeply in love.";
        if (bond.affinity > 0.5) return "They care for each other.";
        if (bond.affinity < -0.5) return "There is tension between them.";
      }
    }
    
    return "";
  }

  /**
   * Calculate distance between positions
   */
  calculateDistance(pos1, pos2) {
    if (!pos1 || !pos2) return Infinity;
    const dx = pos1.x - pos2.x;
    const dy = pos1.y - pos2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Narratize death cause
   */
  narratizeCause(cause) {
    const causes = {
      starvation: 'died of starvation',
      dehydration: 'died of thirst',
      disease: 'succumbed to disease',
      combat: 'fell in combat',
      old_age: 'passed away peacefully',
      accident: 'died in an accident',
      childbirth: 'died in childbirth',
      murder: 'was murdered',
      execution: 'was executed'
    };
    
    return causes[cause] || 'died';
  }

  /**
   * Calculate event significance
   */
  calculateSignificance(event) {
    const significanceMap = {
      marriage: 0.8,
      birth: 0.9,
      death: 1.0,
      person_died: 1.0,
      combat: 0.6,
      trade: 0.3,
      social_interaction: 0.4,
      reputation_change: 0.5,
      emotional_event: 0.6,
      memory_formed: 0.7,
      gossip: 0.5
    };
    
    return significanceMap[event.type] || 0.5;
  }

  /**
   * Get recent entries
   * @param {number} count - Number of entries to retrieve
   * @returns {Array} Recent entries
   */
  getRecentEntries(count = 20) {
    return this.entries.slice(-count);
  }

  /**
   * Get entries by type
   * @param {string} type - Event type
   * @returns {Array} Matching entries
   */
  getEntriesByType(type) {
    return this.entries.filter(e => e.type === type);
  }

  /**
   * Get entries involving a person
   * @param {string} personId - Person ID
   * @returns {Array} Matching entries
   */
  getEntriesForPerson(personId) {
    return this.entries.filter(e => e.participants.includes(personId));
  }

  /**
   * Clear all entries
   */
  clear() {
    this.entries = [];
    this.significantMoments.clear();
  }
}
