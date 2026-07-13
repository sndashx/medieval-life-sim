/**
 * Status.js
 * Social status from multiple sources, coercion mechanics
 * Models hierarchy, deference, power dynamics
 */

export class Status {
  constructor(kernel = null) {
    this.kernel = kernel;
    this.statusSources = new Map();
    this.hierarchies = new Map();
    this.interactions = new Map();
    this.nextSourceId = 1;
    this.nextHierarchyId = 1;
    this.nextInteractionId = 1;
  }

  defineStatusSource(name, type, weight) {
    const source = {
      id: this.nextSourceId++,
      name: name,
      type: type, // wealth, birth, office, achievement, religious, military
      weight: weight, // How much this source contributes to overall status
      values: new Map() // personId -> value
    };
    
    this.statusSources.set(source.id, source);
    return source;
  }

  setStatusValue(sourceId, personId, value) {
    const source = this.statusSources.get(sourceId);
    if (!source) {
      return { success: false, reason: 'Unknown status source' };
    }
    
    source.values.set(personId, value);
    
    return {
      success: true,
      value: value
    };
  }

  calculateOverallStatus(personId) {
    let totalStatus = 0;
    let totalWeight = 0;
    
    for (const source of this.statusSources.values()) {
      const value = source.values.get(personId);
      if (value !== undefined) {
        totalStatus += value * source.weight;
        totalWeight += source.weight;
      }
    }
    
    return totalWeight > 0 ? totalStatus / totalWeight : 0;
  }

  createHierarchy(name, basis, levels) {
    const hierarchy = {
      id: this.nextHierarchyId++,
      name: name,
      basis: basis, // What determines position: wealth, birth, merit, etc.
      levels: levels, // Array of level names from lowest to highest
      members: new Map(), // personId -> level
      established: this.kernel?.turn ?? 0
    };
    
    this.hierarchies.set(hierarchy.id, hierarchy);
    return hierarchy;
  }

  assignLevel(hierarchyId, personId, level) {
    const hierarchy = this.hierarchies.get(hierarchyId);
    if (!hierarchy) {
      return { success: false, reason: 'Unknown hierarchy' };
    }
    
    if (!hierarchy.levels.includes(level)) {
      return { success: false, reason: 'Invalid level' };
    }
    
    hierarchy.members.set(personId, level);
    
    return {
      success: true,
      level: level,
      rank: hierarchy.levels.indexOf(level)
    };
  }

  compareStatus(person1Id, person2Id, context) {
    const status1 = this.calculateOverallStatus(person1Id);
    const status2 = this.calculateOverallStatus(person2Id);
    
    // Context can modify effective status
    let effectiveStatus1 = status1;
    let effectiveStatus2 = status2;
    
    if (context === 'religious' && this.statusSources.has('religious')) {
      const religiousSource = Array.from(this.statusSources.values())
        .find(s => s.type === 'religious');
      if (religiousSource) {
        effectiveStatus1 = religiousSource.values.get(person1Id) || status1;
        effectiveStatus2 = religiousSource.values.get(person2Id) || status2;
      }
    }
    
    return {
      person1: effectiveStatus1,
      person2: effectiveStatus2,
      higher: effectiveStatus1 > effectiveStatus2 ? person1Id : person2Id,
      difference: Math.abs(effectiveStatus1 - effectiveStatus2)
    };
  }

  interact(higherId, lowerId, interactionType) {
    const comparison = this.compareStatus(higherId, lowerId, 'general');
    
    const interaction = {
      id: this.nextInteractionId++,
      higher: comparison.higher,
      lower: comparison.higher === higherId ? lowerId : higherId,
      type: interactionType, // command, request, defer, challenge
      statusDifference: comparison.difference,
      timestamp: this.kernel?.turn ?? 0,
      outcome: null
    };
    
    // Determine interaction outcome
    interaction.outcome = this.resolveInteraction(interaction);
    
    this.interactions.set(interaction.id, interaction);
    
    return {
      success: true,
      interaction: interaction
    };
  }

  resolveInteraction(interaction) {
    switch (interaction.type) {
      case 'command':
        // Higher status can command lower
        if (interaction.statusDifference > 0.3) {
          return {
            success: true,
            compliance: 0.9,
            resistance: 0.1
          };
        } else {
          return {
            success: false,
            compliance: 0.3,
            resistance: 0.7
          };
        }
        
      case 'request':
        // Requests are more likely to succeed with higher status
        const successChance = 0.5 + interaction.statusDifference * 0.3;
        return {
          success: this.kernel.random() < successChance,
          compliance: successChance,
          resistance: 1 - successChance
        };

      case 'defer':
        // Lower status defers to higher
        return {
          success: true,
          deference: 0.8 + interaction.statusDifference * 0.2
        };

      case 'challenge':
        // Challenging higher status is risky
        const challengeSuccess = this.kernel.random() < (0.3 - interaction.statusDifference * 0.5);
        return {
          success: challengeSuccess,
          statusChange: challengeSuccess ? 0.1 : -0.2,
          socialCost: 0.3
        };
    }
  }

  coerce(coercerId, targetId, demand, threat) {
    const comparison = this.compareStatus(coercerId, targetId, 'general');
    
    // Coercion effectiveness depends on status difference and threat credibility
    let effectiveness = comparison.difference * 0.5;
    
    // Threat credibility
    if (threat.type === 'violence' && threat.capability > 0.7) {
      effectiveness += 0.3;
    } else if (threat.type === 'social' && comparison.difference > 0.5) {
      effectiveness += 0.2;
    } else if (threat.type === 'economic' && threat.resources > targetId.wealth) {
      effectiveness += 0.25;
    }
    
    const success = this.kernel.random() < effectiveness;
    
    if (success) {
      // Coercion damages relationship
      return {
        success: true,
        compliance: true,
        relationshipDamage: 0.3,
        resentment: 0.5
      };
    }
    
    return {
      success: false,
      compliance: false,
      statusLoss: 0.1 // Failed coercion reduces coercer's status
    };
  }

  grantPrivilege(granterId, recipientId, privilege) {
    const comparison = this.compareStatus(granterId, recipientId, 'general');
    
    if (comparison.higher !== granterId) {
      return { success: false, reason: 'Insufficient status to grant privilege' };
    }
    
    // Granting privilege increases recipient's status
    const statusIncrease = privilege.value * 0.1;
    
    return {
      success: true,
      privilege: privilege,
      statusIncrease: statusIncrease
    };
  }

  challenge(challengerId, targetId, basis) {
    const comparison = this.compareStatus(challengerId, targetId, 'general');
    
    // Challenging someone of higher status
    if (comparison.higher === targetId) {
      const risk = comparison.difference;
      const successChance = 0.2 - risk * 0.3;
      
      if (this.kernel.random() < successChance) {
        // Successful challenge
        return {
          success: true,
          statusChange: {
            challenger: 0.2,
            target: -0.2
          },
          reputation: 'bold'
        };
      } else {
        // Failed challenge
        return {
          success: false,
          statusChange: {
            challenger: -0.3,
            target: 0.1
          },
          reputation: 'foolish'
        };
      }
    }
    
    // Challenging someone of lower status
    return {
      success: true,
      statusChange: {
        challenger: -0.1, // Bullying reduces status
        target: 0.05
      },
      reputation: 'bully'
    };
  }

  displayDeference(lowerId, higherId, context) {
    const comparison = this.compareStatus(lowerId, higherId, context);
    
    if (comparison.higher !== higherId) {
      return { success: false, reason: 'Not higher status' };
    }
    
    // Appropriate deference maintains social order
    const deferenceLevel = Math.min(1, comparison.difference * 2);
    
    return {
      success: true,
      deferenceLevel: deferenceLevel,
      socialApproval: 0.1,
      behaviors: this.getDeferentialBehaviors(deferenceLevel)
    };
  }

  getDeferentialBehaviors(level) {
    const behaviors = [];
    
    if (level > 0.2) behaviors.push('bow');
    if (level > 0.4) behaviors.push('use_title');
    if (level > 0.6) behaviors.push('wait_for_permission');
    if (level > 0.8) behaviors.push('prostrate');
    
    return behaviors;
  }

  violateNorms(personId, violation) {
    // Status violations have consequences
    const currentStatus = this.calculateOverallStatus(personId);
    
    let penalty = 0;
    
    switch (violation.type) {
      case 'disrespect_superior':
        penalty = 0.2;
        break;
      case 'exceed_station':
        penalty = 0.15;
        break;
      case 'abuse_inferior':
        penalty = 0.1;
        break;
      case 'refuse_deference':
        penalty = 0.25;
        break;
    }
    
    // Higher status people face less severe penalties
    penalty *= (1 - currentStatus * 0.5);
    
    return {
      violation: violation,
      penalty: penalty,
      newStatus: Math.max(0, currentStatus - penalty)
    };
  }

  getStatusBySource(personId, sourceType) {
    const source = Array.from(this.statusSources.values())
      .find(s => s.type === sourceType);
    
    if (!source) return null;
    
    return source.values.get(personId) || 0;
  }

  getHierarchyPosition(personId, hierarchyId) {
    const hierarchy = this.hierarchies.get(hierarchyId);
    if (!hierarchy) return null;
    
    const level = hierarchy.members.get(personId);
    if (!level) return null;
    
    return {
      level: level,
      rank: hierarchy.levels.indexOf(level),
      totalLevels: hierarchy.levels.length
    };
  }

  getStatusSources(personId) {
    const sources = [];
    
    for (const source of this.statusSources.values()) {
      const value = source.values.get(personId);
      if (value !== undefined) {
        sources.push({
          name: source.name,
          type: source.type,
          value: value,
          weight: source.weight,
          contribution: value * source.weight
        });
      }
    }
    
    return sources;
  }

  getStatusDistribution() {
    const distribution = {
      high: 0, // > 0.7
      medium: 0, // 0.3 - 0.7
      low: 0 // < 0.3
    };
    
    const allPeople = new Set();
    for (const source of this.statusSources.values()) {
      for (const personId of source.values.keys()) {
        allPeople.add(personId);
      }
    }
    
    for (const personId of allPeople) {
      const status = this.calculateOverallStatus(personId);
      if (status > 0.7) distribution.high++;
      else if (status > 0.3) distribution.medium++;
      else distribution.low++;
    }
    
    return distribution;
  }

  getStatusSource(id) {
    return this.statusSources.get(id);
  }

  getHierarchy(id) {
    return this.hierarchies.get(id);
  }

  getInteraction(id) {
    return this.interactions.get(id);
  }

  getInteractionsByPerson(personId) {
    return Array.from(this.interactions.values())
      .filter(i => i.higher === personId || i.lower === personId);
  }

  toJSON() {
    return {
      statusSources: Array.from(this.statusSources.entries()).map(([k, v]) => [k, {
        ...v,
        values: Array.from(v.values.entries())
      }]),
      hierarchies: Array.from(this.hierarchies.entries()).map(([k, v]) => [k, {
        ...v,
        members: Array.from(v.members.entries())
      }]),
      interactions: Array.from(this.interactions.entries()),
      nextSourceId: this.nextSourceId,
      nextHierarchyId: this.nextHierarchyId,
      nextInteractionId: this.nextInteractionId
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.statusSources) {
      this.statusSources = new Map(
        data.statusSources.map(([k, v]) => [k, {
          ...v,
          values: new Map(v.values || [])
        }])
      );
    }
    if (data.hierarchies) {
      this.hierarchies = new Map(
        data.hierarchies.map(([k, v]) => [k, {
          ...v,
          members: new Map(v.members || [])
        }])
      );
    }
    if (data.interactions) this.interactions = new Map(data.interactions);
    if (typeof data.nextSourceId === 'number') this.nextSourceId = data.nextSourceId;
    if (typeof data.nextHierarchyId === 'number') this.nextHierarchyId = data.nextHierarchyId;
    if (typeof data.nextInteractionId === 'number') this.nextInteractionId = data.nextInteractionId;
  }
}
