/**
 * Communication.js
 * Conversation, rumor propagation, records, information flow
 * Models speech acts, credibility, distortion, secrecy
 */

export class Communication {
  constructor(languageSystemOrKernel, gameOrLang = null) {
    // Backwards-compatible signatures:
    //   new Communication(languageSystem)            // legacy/test signature
    //   new Communication(kernel, game)              // canonical signature
    //   new Communication(languageSystem, kernel)    // mixed signature
    if (languageSystemOrKernel && typeof languageSystemOrKernel.rng === 'object' && typeof languageSystemOrKernel.turn !== 'undefined') {
      this.kernel = languageSystemOrKernel;
      this.game = gameOrLang;
      this.languageSystem = (gameOrLang && gameOrLang.language) || null;
    } else if (gameOrLang && typeof gameOrLang.rng === 'object' && typeof gameOrLang.turn !== 'undefined') {
      this.languageSystem = languageSystemOrKernel;
      this.kernel = gameOrLang;
      this.game = null;
    } else {
      this.languageSystem = languageSystemOrKernel;
      this.kernel = null;
      this.game = null;
    }
    this.conversations = [];
    this.rumors = new Map();
    this.records = new Map();
    this.nextRumorId = 1;
    this.nextRecordId = 1;
    this._lastRumorTick = 0;
    this._rng = null;
  }

  /**
   * Per-tick adapter called by Game.advanceTurns via safeUpdate.
   * Throttles rumor propagation so it runs once per game-day (the kernel's
   * turn counter advances 1 minute per tick, so 1440 ticks ≈ 1 day).
   */
  update(kernel) {
    if (!kernel) return;
    this._rng = kernel.rng;
    const turn = kernel.turn || 0;
    const TURNS_PER_DAY = 1440;
    if (turn - this._lastRumorTick < TURNS_PER_DAY) return;
    this._lastRumorTick = turn;
    this.updateRumorPropagation(kernel);
  }

  initiateConversation(speaker, listener, topic, intent) {
    // Check if can communicate
    const canCommunicate = this.languageSystem.canCommunicate(speaker, listener);
    
    if (!canCommunicate.canCommunicate) {
      return {
        success: false,
        reason: 'Language barrier',
        intelligibility: canCommunicate.intelligibility
      };
    }
    
    // Check if listener is paying attention
    if (listener.perception && !listener.perception.attention.canAttend()) {
      return {
        success: false,
        reason: 'Listener not paying attention'
      };
    }
    
    const conversation = {
      speaker: speaker,
      listener: listener,
      topic: topic,
      intent: intent, // inform, persuade, deceive, request, threaten, comfort
      language: canCommunicate.language,
      intelligibility: canCommunicate.intelligibility,
      timestamp: this.kernel?.turn ?? 0,
      exchanges: []
    };
    
    this.conversations.push(conversation);
    return { success: true, conversation: conversation };
  }

  speak(conversation, message, truthfulness = 1.0) {
    const speaker = conversation.speaker;
    const listener = conversation.listener;
    
    // Calculate message effectiveness
    const effectiveness = this.calculateEffectiveness(
      conversation,
      message,
      truthfulness,
      speaker,
      listener
    );
    
    // Create exchange
    const exchange = {
      speaker: speaker.id,
      message: message,
      truthfulness: truthfulness,
      effectiveness: effectiveness,
      understood: effectiveness.understood,
      believed: effectiveness.believed,
      timestamp: this.kernel?.turn ?? 0
    };
    
    conversation.exchanges.push(exchange);
    
    // Update listener's beliefs
    if (effectiveness.believed) {
      this.updateBeliefs(listener, message, speaker, effectiveness.credibility);
    }
    
    // Update relationship
    this.updateRelationship(speaker, listener, conversation.intent, effectiveness);
    
    return {
      success: true,
      effectiveness: effectiveness,
      exchange: exchange
    };
  }

  calculateEffectiveness(conversation, message, truthfulness, speaker, listener) {
    // Language intelligibility
    const intelligibility = conversation.intelligibility;
    
    // Speaker's communication skill
    const speakerSkill = speaker.skills?.social?.communication || 0.5;
    
    // Listener's comprehension
    const listenerComprehension = listener.skills?.knowledge?.literacy || 0.5;
    
    // Relationship affects credibility
    const relationship = this.getRelationship(speaker, listener);
    const trustFactor = relationship?.trust || 0.5;
    
    // Calculate understanding
    const understood = intelligibility * speakerSkill * listenerComprehension;
    
    // Calculate credibility
    let credibility = trustFactor * truthfulness;
    
    // Intent affects credibility
    if (conversation.intent === 'deceive') {
      const deceptionSkill = speaker.skills?.social?.deception || 0.3;
      const detectionSkill = listener.skills?.social?.insight || 0.3;
      credibility *= (deceptionSkill / (deceptionSkill + detectionSkill));
    }
    
    // Calculate belief
    const believed = understood * credibility > 0.5;
    
    return {
      understood: understood,
      credibility: credibility,
      believed: believed,
      intelligibility: intelligibility
    };
  }

  updateBeliefs(person, message, source, credibility) {
    if (!person.beliefs) {
      person.beliefs = new Map();
    }
    
    const belief = {
      content: message,
      source: source.id,
      credibility: credibility,
      timestamp: this.kernel?.turn ?? 0,
      verified: false
    };
    
    person.beliefs.set(message.topic || 'general', belief);
  }

  updateRelationship(speaker, listener, intent, effectiveness) {
    const relationship = this.getRelationship(speaker, listener);
    if (!relationship) return;
    
    // Successful communication improves familiarity
    if (effectiveness.understood > 0.7) {
      relationship.familiarity = Math.min(1, relationship.familiarity + 0.01);
    }
    
    // Intent affects relationship
    switch (intent) {
      case 'inform':
        if (effectiveness.believed) {
          relationship.trust = Math.min(1, relationship.trust + 0.02);
        }
        break;
      case 'deceive':
        if (!effectiveness.believed) {
          const rng = this._rng || (this.kernel && this.kernel.rng);
          if (!rng) throw new Error('Communication requires a kernel or _rng for deceive detection');
          const detectRoll = rng.next();
          if (detectRoll < 0.3) {
            // Deception detected
            relationship.trust = Math.max(0, relationship.trust - 0.2);
            relationship.resentment = Math.min(1, relationship.resentment + 0.3);
          }
        }
        break;
      case 'comfort':
        relationship.affection = Math.min(1, relationship.affection + 0.05);
        break;
      case 'threaten':
        relationship.fear = Math.min(1, relationship.fear + 0.1);
        relationship.resentment = Math.min(1, relationship.resentment + 0.05);
        break;
    }
  }

  createRumor(content, source, truthfulness, importance) {
    const turnCreated = (this._rng && this._rng.turnAtCreate !== undefined)
      ? this._rng.turnAtCreate
      : (this._turnAtCreate || 0);
    const rumor = {
      id: this.nextRumorId++,
      content: content,
      originalSource: source.id,
      truthfulness: truthfulness,
      importance: importance,
      distortion: 0,
      spread: 1, // Number of people who know
      believers: [source.id],
      skeptics: [],
      timestamp: this.kernel?.turn ?? 0,
      // Determinism: turnCreated drives rumor age math in updateRumorPropagation.
      // Falls back to 0 if the caller didn't supply it (so old rumors stay alive
      // until the kernel turn passes 30 game-days).
      turnCreated,
      locations: [source.position]
    };

    this.rumors.set(rumor.id, rumor);
    return rumor;
  }

  spreadRumor(rumorId, from, to) {
    const rumor = this.rumors.get(rumorId);
    if (!rumor) return { success: false, reason: 'Unknown rumor' };
    
    // Check if can communicate
    const canCommunicate = this.languageSystem.canCommunicate(from, to);
    if (!canCommunicate.canCommunicate) {
      return { success: false, reason: 'Language barrier' };
    }
    
    // Calculate distortion
    const distortionRate = 0.05 * (1 - canCommunicate.intelligibility);
    rumor.distortion = Math.min(1, rumor.distortion + distortionRate);
    
    // Calculate belief
    const relationship = this.getRelationship(from, to);
    const trustFactor = relationship?.trust || 0.5;
    const believability = rumor.truthfulness * (1 - rumor.distortion) * trustFactor;

    const beliefRoll = this._rng ? this._rng.next() : (this.kernel && this.kernel.random());
    const believed = beliefRoll < believability;
    
    if (believed) {
      rumor.believers.push(to.id);
    } else {
      rumor.skeptics.push(to.id);
    }
    
    rumor.spread++;
    
    // Add location
    if (!rumor.locations.some(loc => loc.x === to.position.x && loc.y === to.position.y)) {
      rumor.locations.push(to.position);
    }
    
    return {
      success: true,
      believed: believed,
      distortion: rumor.distortion,
      spread: rumor.spread
    };
  }

  updateRumorPropagation(kernel) {
    const rng = this._rng || (this.kernel && this.kernel.rng);
    if (!rng) throw new Error('Communication.updateRumorPropagation requires a kernel or _rng');
    const next = () => rng.next();
    const turnNow = (kernel && typeof kernel.turn === 'number') ? kernel.turn : 0;
    for (const [id, rumor] of this.rumors) {
      // Rumors spread based on importance and recency. Age is measured in
      // game-days using the kernel turn counter (1 turn = 1 minute, 1440 turns
      // per day) so the result is deterministic from the seed.
      const TURNS_PER_DAY = 1440;
      const ageTurns = turnNow - (rumor.turnCreated || turnNow);
      const age = ageTurns / TURNS_PER_DAY; // game-days
      const spreadRate = rumor.importance * Math.exp(-age / 7); // Decay over week

      if (next() < spreadRate * 0.1) {
        // Find nearby people
        for (const location of rumor.locations) {
          const nearby = kernel.queryEntitiesNear(location.x, location.y, location.z, 100);

          for (const entityId of nearby) {
            const entity = kernel.entities.get(entityId);
            if (!entity || !entity.isPerson) continue;

            // Check if already knows
            if (rumor.believers.includes(entity.id) || rumor.skeptics.includes(entity.id)) {
              continue;
            }

            // Find someone who knows to spread from
            const knower = rumor.believers[Math.floor(next() * rumor.believers.length)];
            const knowerEntity = kernel.entities.get(knower);

            if (knowerEntity) {
              this.spreadRumor(id, knowerEntity, entity);
            }
          }
        }
      }

      // Old rumors fade after a game-month.
      if (age > 30) {
        this.rumors.delete(id);
      }
    }
  }

  createRecord(author, content, type, language) {
    const record = {
      id: this.nextRecordId++,
      author: author.id,
      content: content,
      type: type, // letter, contract, chronicle, recipe, map, law
      language: language,
      timestamp: this.kernel?.turn ?? 0,
      location: author.position,
      condition: 1.0, // Degrades over time
      copies: 0
    };
    
    this.records.set(record.id, record);
    return record;
  }

  readRecord(reader, recordId) {
    const record = this.records.get(recordId);
    if (!record) return { success: false, reason: 'Record not found' };
    
    // Check literacy
    const literacy = reader.skills?.knowledge?.literacy || 0;
    if (literacy < 0.3) {
      return { success: false, reason: 'Cannot read' };
    }
    
    // Check language
    const languageLevel = reader.languages?.get(record.language) || 0;
    if (languageLevel < 0.5) {
      return { success: false, reason: 'Cannot read this language' };
    }
    
    // Check condition
    if (record.condition < 0.3) {
      return { success: false, reason: 'Record too damaged to read' };
    }
    
    // Calculate comprehension
    const comprehension = literacy * languageLevel * record.condition;
    
    return {
      success: true,
      content: record.content,
      comprehension: comprehension,
      fullyUnderstood: comprehension > 0.8
    };
  }

  copyRecord(scribe, recordId) {
    const record = this.records.get(recordId);
    if (!record) return { success: false, reason: 'Record not found' };
    
    // Check literacy
    const literacy = scribe.skills?.knowledge?.literacy || 0;
    if (literacy < 0.5) {
      return { success: false, reason: 'Insufficient literacy to copy' };
    }
    
    // Check language
    const languageLevel = scribe.languages?.get(record.language) || 0;
    if (languageLevel < 0.7) {
      return { success: false, reason: 'Insufficient language skill' };
    }
    
    // Calculate copy quality
    const quality = literacy * languageLevel * 0.9; // Always some degradation
    
    // Create copy
    const copy = {
      id: this.nextRecordId++,
      author: record.author,
      content: record.content,
      type: record.type,
      language: record.language,
      timestamp: this.kernel?.turn ?? 0,
      location: scribe.position,
      condition: quality,
      copies: 0,
      originalId: recordId
    };
    
    this.records.set(copy.id, copy);
    record.copies++;
    
    return {
      success: true,
      copy: copy,
      quality: quality
    };
  }

  degradeRecords(kernel) {
    for (const [id, record] of this.records) {
      // Records degrade over time
      const age = (this.kernel?.turn ?? 0 - record.timestamp) / (1000 * 60 * 60 * 24 * 365); // years
      const degradationRate = 0.01 * age;
      
      record.condition = Math.max(0, record.condition - degradationRate);
      
      // Destroyed records are removed
      if (record.condition <= 0) {
        this.records.delete(id);
      }
    }
  }

  getRelationship(person1, person2) {
    // Simplified - would integrate with Social.js
    return {
      familiarity: 0.5,
      trust: 0.5,
      affection: 0.5,
      fear: 0,
      resentment: 0
    };
  }

  getConversationHistory(person1, person2, limit = 10) {
    return this.conversations
      .filter(c => 
        (c.speaker.id === person1.id && c.listener.id === person2.id) ||
        (c.speaker.id === person2.id && c.listener.id === person1.id)
      )
      .slice(-limit);
  }

  getRumorsKnownBy(personId) {
    const known = [];
    
    for (const [id, rumor] of this.rumors) {
      if (rumor.believers.includes(personId) || rumor.skeptics.includes(personId)) {
        known.push({
          id: id,
          content: rumor.content,
          believed: rumor.believers.includes(personId),
          distortion: rumor.distortion
        });
      }
    }
    
    return known;
  }

  getRecordsAt(location, radius = 10) {
    const nearby = [];

    for (const [id, record] of this.records) {
      const distance = Math.sqrt(
        Math.pow(record.location.x - location.x, 2) +
        Math.pow(record.location.y - location.y, 2)
      );

      if (distance <= radius) {
        nearby.push(record);
      }
    }

    return nearby;
  }

  toJSON() {
    const lastConversations = this.conversations.slice(-50);
    return {
      conversations: lastConversations,
      rumors: Array.from(this.rumors.entries()),
      records: Array.from(this.records.entries()),
      nextRumorId: this.nextRumorId,
      nextRecordId: this.nextRecordId
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.conversations) this.conversations = data.conversations;
    if (data.rumors) this.rumors = new Map(data.rumors);
    if (data.records) this.records = new Map(data.records);
    if (typeof data.nextRumorId === 'number') this.nextRumorId = data.nextRumorId;
    if (typeof data.nextRecordId === 'number') this.nextRecordId = data.nextRecordId;
  }
}
