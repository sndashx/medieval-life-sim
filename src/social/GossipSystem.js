/**
 * GossipSystem.js
 * 
 * Tracks and propagates gossip between NPCs using AAA memory system.
 * Creates social stakes by surfacing "who said what about whom" to the player.
 */

export class GossipSystem {
  constructor(game) {
    this.game = game;
    this.kernel = game.kernel;
    this.gossipLog = []; // Recent gossip events
    this.maxGossipLog = 100;
    
    // Track gossip chains: who told whom about what
    this.gossipChains = new Map(); // gossipId -> { speaker, listener, subject, topic, turn, spread }
    this.nextGossipId = 1;
  }

  /**
   * Create a gossip event
   * @param {string} speakerId - Person spreading gossip
   * @param {string} listenerId - Person hearing gossip
   * @param {string} subjectId - Person being gossiped about
   * @param {string} topic - What the gossip is about
   * @param {number} truthfulness - How true the gossip is (0-1)
   * @returns {Object} Gossip event
   */
  createGossip(speakerId, listenerId, subjectId, topic, truthfulness = 0.7) {
    const speaker = this.kernel.entities.get(speakerId);
    const listener = this.kernel.entities.get(listenerId);
    const subject = this.kernel.entities.get(subjectId);

    if (!speaker || !listener || !subject) return null;

    const gossipId = `gossip_${this.nextGossipId++}`;
    const gossip = {
      id: gossipId,
      speakerId,
      listenerId,
      subjectId,
      topic,
      truthfulness,
      turn: this.kernel.turn,
      spread: 1, // How many people have heard it
      believability: this.calculateBelievability(speaker, listener, truthfulness)
    };

    this.gossipChains.set(gossipId, gossip);
    this.gossipLog.push(gossip);

    // Trim old gossip
    if (this.gossipLog.length > this.maxGossipLog) {
      this.gossipLog.shift();
    }

    // Store in AAA memory if available
    if (listener.aaaBridge) {
      listener.aaaBridge.aaaNPC.reactToEvent({
        type: 'gossip_heard',
        source: speakerId,
        subject: subjectId,
        topic,
        truthfulness,
        believability: gossip.believability,
        emotionalIntensity: this.calculateEmotionalImpact(listener, subject, topic),
        participants: [speakerId, subjectId],
        location: listener.position?.settlementId || 'unknown',
        description: `Heard from ${speaker.name} that ${subject.name} ${topic}`
      });
    }

    // Log to chronicle if game has it
    if (this.game.chronicle) {
      this.game.chronicle.logEvent({
        type: 'gossip',
        speakerId,
        listenerId,
        subjectId,
        topic,
        participants: [speakerId, listenerId, subjectId],
        location: speaker.position?.settlementId
      });
    }

    return gossip;
  }

  /**
   * Calculate how believable the gossip is
   */
  calculateBelievability(speaker, listener, truthfulness) {
    let believability = truthfulness;

    // Speaker's reputation affects believability
    if (this.game.relationships) {
      const bond = this.game.relationships.getBond(listener.id, speaker.id);
      if (bond) {
        // Trust the speaker more if you like them
        believability += bond.affinity * 0.2;
      }
    }

    // Clamp to 0-1
    return Math.max(0, Math.min(1, believability));
  }

  /**
   * Calculate emotional impact of gossip on listener
   */
  calculateEmotionalImpact(listener, subject, topic) {
    let impact = 0.5;

    // Higher impact if listener knows the subject
    if (this.game.relationships) {
      const bond = this.game.relationships.getBond(listener.id, subject.id);
      if (bond) {
        impact += Math.abs(bond.affinity) * 0.3;
      }
    }

    // Topic affects impact
    const highImpactTopics = ['cheated', 'stole', 'murdered', 'betrayed', 'affair'];
    if (highImpactTopics.some(t => topic.includes(t))) {
      impact += 0.3;
    }

    return Math.max(0, Math.min(1, impact));
  }

  /**
   * Spread gossip to nearby NPCs
   * @param {string} gossipId - ID of gossip to spread
   * @param {string} speakerId - Person spreading it
   * @param {number} radius - How far to spread (in tiles)
   */
  spreadGossip(gossipId, speakerId, radius = 20) {
    const gossip = this.gossipChains.get(gossipId);
    if (!gossip) return;

    const speaker = this.kernel.entities.get(speakerId);
    if (!speaker || !speaker.position) return;

    // Find nearby NPCs
    const nearby = this.kernel.queryEntitiesNear(
      speaker.position.x,
      speaker.position.y,
      speaker.position.z || 0,
      radius
    );

    const spread = [];
    for (const listenerId of nearby) {
      if (listenerId === speakerId || listenerId === gossip.subjectId) continue;

      const listener = this.kernel.entities.get(listenerId);
      if (!listener || !listener.alive) continue;

      // Chance to spread based on gossip believability
      const spreadChance = gossip.believability * 0.6;
      if (this.kernel.random() < spreadChance) {
        const newGossip = this.createGossip(
          speakerId,
          listenerId,
          gossip.subjectId,
          gossip.topic,
          gossip.truthfulness * 0.9 // Degrades slightly with each retelling
        );
        if (newGossip) {
          spread.push(newGossip);
        }
      }
    }

    // Update spread count
    gossip.spread += spread.length;

    return spread;
  }

  /**
   * Generate gossip about a recent event
   * @param {Object} event - Event to gossip about
   * @param {string} witnessId - Person who witnessed it
   */
  generateGossipFromEvent(event, witnessId) {
    const witness = this.kernel.entities.get(witnessId);
    if (!witness || !witness.position) return null;

    let topic = null;
    let subjectId = null;
    let truthfulness = 1.0;

    switch (event.type) {
      case 'theft':
        subjectId = event.thiefId;
        topic = `stole from ${this.getPersonName(event.victimId)}`;
        break;
      case 'combat':
        subjectId = event.attackerId;
        topic = `attacked ${this.getPersonName(event.defenderId)}`;
        break;
      case 'marriage':
        subjectId = event.person1Id;
        topic = `married ${this.getPersonName(event.person2Id)}`;
        break;
      case 'betrayal':
        subjectId = event.personId;
        topic = `betrayed ${this.getPersonName(event.targetId)}`;
        break;
      case 'affair':
        subjectId = event.person1Id;
        topic = `is having an affair with ${this.getPersonName(event.person2Id)}`;
        truthfulness = 0.8; // Affairs are often rumored
        break;
      default:
        return null;
    }

    if (!subjectId || !topic) return null;

    // Find nearby people to tell
    const nearby = this.kernel.queryEntitiesNear(
      witness.position.x,
      witness.position.y,
      witness.position.z || 0,
      15
    );

    const gossips = [];
    for (const listenerId of nearby.slice(0, 3)) {
      if (listenerId === witnessId || listenerId === subjectId) continue;

      const gossip = this.createGossip(
        witnessId,
        listenerId,
        subjectId,
        topic,
        truthfulness
      );
      if (gossip) {
        gossips.push(gossip);
      }
    }

    return gossips;
  }

  /**
   * Get gossip about a specific person
   * @param {string} personId - Person to get gossip about
   * @returns {Array} Recent gossip about this person
   */
  getGossipAbout(personId) {
    return this.gossipLog.filter(g => g.subjectId === personId);
  }

  /**
   * Get gossip heard by a specific person
   * @param {string} personId - Person who heard gossip
   * @returns {Array} Gossip this person has heard
   */
  getGossipHeardBy(personId) {
    return this.gossipLog.filter(g => g.listenerId === personId);
  }

  /**
   * Get gossip spread by a specific person
   * @param {string} personId - Person who spread gossip
   * @returns {Array} Gossip this person has spread
   */
  getGossipSpreadBy(personId) {
    return this.gossipLog.filter(g => g.speakerId === personId);
  }

  /**
   * Get recent gossip involving the player
   * @param {string} playerId - Player ID
   * @returns {Array} Recent gossip involving player
   */
  getPlayerGossip(playerId) {
    return this.gossipLog.filter(g => 
      g.subjectId === playerId || 
      g.listenerId === playerId ||
      g.speakerId === playerId
    ).slice(-10);
  }

  /**
   * Get person name safely
   */
  getPersonName(personId) {
    const person = this.kernel.entities.get(personId);
    return person ? person.name : 'someone';
  }

  /**
   * Tick - spread gossip naturally over time
   */
  tick() {
    // Every 10 turns, randomly spread some gossip
    if (this.kernel.turn % 10 !== 0) return;

    const recentGossip = this.gossipLog.slice(-20);
    for (const gossip of recentGossip) {
      // 20% chance to spread each piece of gossip
      if (this.kernel.random() < 0.2) {
        // Pick a random person who heard it to spread it
        const listener = this.kernel.entities.get(gossip.listenerId);
        if (listener && listener.alive && listener.position) {
          this.spreadGossip(gossip.id, gossip.listenerId, 15);
        }
      }
    }
  }

  /**
   * Clear old gossip
   */
  clearOldGossip(turnsOld = 1000) {
    const cutoff = this.kernel.turn - turnsOld;
    this.gossipLog = this.gossipLog.filter(g => g.turn > cutoff);
    
    // Clean up chains
    for (const [id, gossip] of this.gossipChains.entries()) {
      if (gossip.turn < cutoff) {
        this.gossipChains.delete(id);
      }
    }
  }
}
