/**
 * ReputationSystem.js
 * 
 * Implements reputation tracking across multiple domains and factions.
 * Features:
 * - Domain-specific reputation (combat, craftsmanship, leadership, etc.)
 * - Faction-based reputation
 * - Notable deeds tracking
 * - Reputation propagation through social networks
 * - Titles and honors
 * 
 * @module ReputationSystem
 */

export class ReputationSystem {
  constructor(personId, kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    this.personId = personId;
    
    // Reputation across different domains (0-1 scale)
    this.domains = {
      combat: 0.5,
      craftsmanship: 0.5,
      leadership: 0.5,
      trustworthiness: 0.5,
      generosity: 0.5,
      piety: 0.5,
      wisdom: 0.5,
      wealth: 0.5,
      beauty: 0.5,
      cunning: 0.5
    };
    
    // Reputation by faction/group
    this.factionReputation = new Map();
    
    // Notable deeds (positive and negative)
    this.deeds = [];
    
    // Titles and honors
    this.titles = [];
    
    // Infamy vs fame balance
    this.infamy = 0.0;  // 0 = unknown, 1 = infamous
    this.fame = 0.0;    // 0 = unknown, 1 = famous
    
    // Reputation spread tracking
    this.knownBy = new Set();  // Set of person IDs who know of this person
    
    // Reputation modifiers
    this.modifiers = new Map();  // Temporary reputation modifiers
  }
  
  /**
   * Add a notable deed
   * @param {Object} deed - Deed details
   * @returns {Object} Reputation changes
   */
  addDeed(deed) {
    const {
      type,
      domain,
      impact,           // -1 to 1
      witnesses = [],
      location = null,
      description = '',
      timestamp = (this.kernel?.turn || 0)
    } = deed;
    
    // Store deed
    this.deeds.push({
      type,
      domain,
      impact,
      witnesses: [...witnesses],
      location,
      description,
      timestamp,
      spread: witnesses.length
    });
    
    // Update relevant domain
    if (domain && this.domains[domain] !== undefined) {
      const change = impact * witnesses.length * 0.01;
      this.domains[domain] = this.clamp(
        this.domains[domain] + change,
        0, 1
      );
    }
    
    // Update fame/infamy
    if (impact > 0) {
      this.fame = Math.min(1.0, this.fame + Math.abs(impact) * witnesses.length * 0.005);
    } else {
      this.infamy = Math.min(1.0, this.infamy + Math.abs(impact) * witnesses.length * 0.005);
    }
    
    // Add witnesses to known-by set
    for (const witness of witnesses) {
      this.knownBy.add(witness);
    }
    
    // Prune old deeds
    if (this.deeds.length > 100) {
      this.deeds = this.deeds.slice(-100);
    }
    
    return {
      domainChange: domain ? change : 0,
      fameChange: impact > 0 ? Math.abs(impact) * witnesses.length * 0.005 : 0,
      infamyChange: impact < 0 ? Math.abs(impact) * witnesses.length * 0.005 : 0,
      newWitnesses: witnesses.length
    };
  }
  
  /**
   * Propagate reputation through social network
   * @param {Object} deed - Deed to propagate
   * @param {Object} socialNetwork - Social network graph
   * @returns {number} Number of people reached
   */
  propagateReputation(deed, socialNetwork) {
    if (!socialNetwork) return 0;
    
    const { impact, witnesses } = deed;
    const spreadRate = impact < 0 ? 1.5 : 1.0; // Negative news travels faster
    const maxDepth = Math.ceil(Math.abs(impact) * 3);
    
    let reached = 0;
    const queue = witnesses.map(w => ({ id: w, depth: 0 }));
    const visited = new Set(witnesses);
    
    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      
      if (depth >= maxDepth) continue;
      
      // Get connections from social network
      const connections = socialNetwork.getConnections(id);
      
      for (const connection of connections) {
        if (!visited.has(connection.id)) {
          // Probability of spreading decreases with depth
          const spreadChance = spreadRate * Math.pow(0.7, depth);
          
          if (this.rng.next() < spreadChance) {
            visited.add(connection.id);
            this.knownBy.add(connection.id);
            queue.push({ id: connection.id, depth: depth + 1 });
            reached++;
          }
        }
      }
    }
    
    // Update deed spread count
    const deedIndex = this.deeds.findIndex(d => 
      d.timestamp === deed.timestamp && d.type === deed.type
    );
    if (deedIndex > -1) {
      this.deeds[deedIndex].spread += reached;
    }
    
    return reached;
  }
  
  /**
   * Get reputation in a specific domain
   * @param {string} domain - Domain name
   * @returns {number} Reputation (0-1)
   */
  getDomainReputation(domain) {
    return this.domains[domain] || 0.5;
  }
  
  /**
   * Get reputation with a faction
   * @param {string} factionId - Faction ID
   * @returns {number} Reputation (0-1)
   */
  getFactionReputation(factionId) {
    return this.factionReputation.get(factionId) || 0.5;
  }
  
  /**
   * Set faction reputation
   * @param {string} factionId - Faction ID
   * @param {number} value - Reputation value (0-1)
   */
  setFactionReputation(factionId, value) {
    this.factionReputation.set(factionId, this.clamp(value, 0, 1));
  }
  
  /**
   * Modify faction reputation
   * @param {string} factionId - Faction ID
   * @param {number} change - Change amount
   */
  modifyFactionReputation(factionId, change) {
    const current = this.getFactionReputation(factionId);
    this.setFactionReputation(factionId, current + change);
  }
  
  /**
   * Award a title
   * @param {Object} title - Title details
   */
  awardTitle(title) {
    const {
      name,
      type,
      grantedBy = null,
      reason = '',
      timestamp = (this.kernel?.turn || 0)
    } = title;
    
    this.titles.push({
      name,
      type,
      grantedBy,
      reason,
      timestamp,
      active: true
    });
    
    // Titles boost relevant domain reputation
    if (type === 'combat') {
      this.domains.combat = Math.min(1.0, this.domains.combat + 0.1);
    } else if (type === 'leadership') {
      this.domains.leadership = Math.min(1.0, this.domains.leadership + 0.1);
    }
    
    // Titles increase fame
    this.fame = Math.min(1.0, this.fame + 0.05);
  }
  
  /**
   * Revoke a title
   * @param {string} titleName - Title name
   */
  revokeTitle(titleName) {
    const title = this.titles.find(t => t.name === titleName && t.active);
    if (title) {
      title.active = false;
      title.revokedAt = (this.kernel?.turn || 0);
    }
  }
  
  /**
   * Get active titles
   * @returns {Array} Active titles
   */
  getActiveTitles() {
    return this.titles.filter(t => t.active);
  }
  
  /**
   * Check if person is known by another
   * @param {string} personId - Person ID
   * @returns {boolean} True if known
   */
  isKnownBy(personId) {
    return this.knownBy.has(personId);
  }
  
  /**
   * Get overall reputation score
   * @returns {number} Overall reputation (0-1)
   */
  getOverallReputation() {
    const domainValues = Object.values(this.domains);
    const average = domainValues.reduce((a, b) => a + b, 0) / domainValues.length;
    
    // Factor in fame/infamy
    const notoriety = (this.fame - this.infamy + 1) / 2;
    
    return (average * 0.7 + notoriety * 0.3);
  }
  
  /**
   * Get reputation descriptor
   * @returns {string} Descriptor
   */
  getReputationDescriptor() {
    const overall = this.getOverallReputation();
    
    if (this.infamy > 0.7) return 'notorious';
    if (this.fame > 0.7) return 'renowned';
    if (overall > 0.8) return 'excellent';
    if (overall > 0.6) return 'good';
    if (overall > 0.4) return 'average';
    if (overall > 0.2) return 'poor';
    return 'terrible';
  }
  
  /**
   * Get most notable deeds
   * @param {number} count - Number of deeds
   * @returns {Array} Notable deeds
   */
  getNotableDeeds(count = 5) {
    return [...this.deeds]
      .sort((a, b) => {
        const scoreA = Math.abs(a.impact) * a.spread;
        const scoreB = Math.abs(b.impact) * b.spread;
        return scoreB - scoreA;
      })
      .slice(0, count);
  }
  
  /**
   * Get deeds in domain
   * @param {string} domain - Domain name
   * @returns {Array} Deeds
   */
  getDeedsInDomain(domain) {
    return this.deeds.filter(d => d.domain === domain);
  }
  
  /**
   * Add temporary reputation modifier
   * @param {string} name - Modifier name
   * @param {string} domain - Domain to modify
   * @param {number} value - Modifier value
   * @param {number} duration - Duration in minutes
   */
  addModifier(name, domain, value, duration) {
    this.modifiers.set(name, {
      domain,
      value,
      expiresAt: (this.kernel?.turn || 0) + duration * 60 * 1000
    });
  }
  
  /**
   * Get effective reputation with modifiers
   * @param {string} domain - Domain name
   * @returns {number} Effective reputation
   */
  getEffectiveReputation(domain) {
    let base = this.getDomainReputation(domain);
    
    // Apply modifiers
    for (const [name, modifier] of this.modifiers) {
      if (modifier.domain === domain && (this.kernel?.turn || 0) < modifier.expiresAt) {
        base += modifier.value;
      }
    }
    
    return this.clamp(base, 0, 1);
  }
  
  /**
   * Update reputation system
   * @param {number} deltaTime - Time elapsed in minutes
   */
  update(deltaTime) {
    // Remove expired modifiers
    for (const [name, modifier] of this.modifiers) {
      if ((this.kernel?.turn || 0) >= modifier.expiresAt) {
        this.modifiers.delete(name);
      }
    }
    
    // Reputation slowly regresses toward 0.5 (average)
    const regressionRate = 0.0001 * deltaTime;
    for (const domain in this.domains) {
      const distance = this.domains[domain] - 0.5;
      this.domains[domain] -= distance * regressionRate;
    }
    
    // Fame and infamy slowly decay
    this.fame *= (1 - 0.0001 * deltaTime);
    this.infamy *= (1 - 0.0001 * deltaTime);
  }
  
  /**
   * Get reputation summary
   * @returns {Object} Summary
   */
  getSummary() {
    return {
      overall: this.getOverallReputation(),
      descriptor: this.getReputationDescriptor(),
      fame: this.fame,
      infamy: this.infamy,
      domains: { ...this.domains },
      titles: this.getActiveTitles().length,
      notableDeeds: this.getNotableDeeds(3),
      knownByCount: this.knownBy.size
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
   * Serialize reputation system
   * @returns {Object} Serialized data
   */
  serialize() {
    return {
      personId: this.personId,
      domains: this.domains,
      factionReputation: Array.from(this.factionReputation.entries()),
      deeds: this.deeds.slice(-50), // Keep last 50
      titles: this.titles,
      infamy: this.infamy,
      fame: this.fame,
      knownBy: Array.from(this.knownBy),
      modifiers: Array.from(this.modifiers.entries())
    };
  }
  
  /**
   * Deserialize reputation system
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    this.personId = data.personId;
    this.domains = data.domains || {};
    this.factionReputation = new Map(data.factionReputation || []);
    this.deeds = data.deeds || [];
    this.titles = data.titles || [];
    this.infamy = data.infamy || 0;
    this.fame = data.fame || 0;
    this.knownBy = new Set(data.knownBy || []);
    this.modifiers = new Map(data.modifiers || []);
  }
}
