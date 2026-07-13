/**
 * EpisodicMemory.js
 * 
 * Implements episodic memory system for storing and recalling specific events
 * and experiences. Features:
 * - Capacity-limited storage with importance-based pruning
 * - Emotional tagging for enhanced recall
 * - Memory vividness that fades over time
 * - Realistic memory reconstruction with potential errors
 * - Context-based retrieval
 * 
 * @module EpisodicMemory
 */

export class EpisodicMemory {
  constructor(capacity = 512, kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    this.capacity = capacity;
    this.memories = [];
    this.emotionalTagging = true;
    this.reconstructionErrorRate = 0.1;
    this.consolidationThreshold = 0.6;
    
    // Memory indexing for fast retrieval
    this.indices = {
      byParticipant: new Map(),
      byLocation: new Map(),
      byType: new Map(),
      byTimestamp: []
    };
  }
  
  /**
   * Store a new episodic memory
   * @param {Object} event - Event to remember
   * @returns {Object} Created memory
   */
  store(event) {
    const memory = {
      id: this.generateMemoryId(),
      timestamp: event.timestamp || (this.kernel?.turn || 0),
      location: event.location || null,
      participants: event.participants || [],
      actions: event.actions || [],
      outcome: event.outcome || null,
      emotions: event.emotionalState ? { ...event.emotionalState } : null,
      sensoryDetails: event.sensoryDetails || {},
      importance: this.calculateImportance(event),
      vividness: 1.0,
      lastRecalled: event.timestamp || (this.kernel?.turn || 0),
      recallCount: 0,
      consolidated: false,
      tags: event.tags || []
    };
    
    // Emotional events are more vivid and important
    if (event.emotionalIntensity > 0.7) {
      memory.vividness *= 1.5;
      memory.importance *= 1.3;
    }
    
    // Surprising events are more memorable
    if (event.surprising) {
      memory.importance *= 1.2;
      memory.vividness *= 1.2;
    }
    
    // First-time experiences are more memorable
    if (event.novel) {
      memory.importance *= 1.4;
    }
    
    this.memories.push(memory);
    this.updateIndices(memory);
    this.pruneOldMemories();
    
    return memory;
  }
  
  /**
   * Calculate importance of an event
   * @param {Object} event - Event to evaluate
   * @returns {number} Importance score 0-1
   */
  calculateImportance(event) {
    let importance = 0.5;
    
    // Emotional intensity increases importance
    if (event.emotionalIntensity) {
      importance += event.emotionalIntensity * 0.3;
    }
    
    // Personal relevance
    if (event.personalRelevance) {
      importance += event.personalRelevance * 0.2;
    }
    
    // Social significance
    if (event.participants && event.participants.length > 0) {
      importance += Math.min(0.2, event.participants.length * 0.05);
    }
    
    // Consequential events
    if (event.consequences) {
      importance += 0.2;
    }
    
    // Life-changing events
    if (event.lifeChanging) {
      importance = Math.max(importance, 0.9);
    }
    
    return Math.min(1.0, importance);
  }
  
  /**
   * Recall memories matching a query
   * @param {Object} query - Search criteria
   * @param {number} limit - Maximum memories to return
   * @returns {Array} Matching memories
   */
  recall(query, limit = 10) {
    let candidates = this.findMatches(query);
    
    // Sort by relevance and recency
    candidates = this.rankMemories(candidates, query);
    
    // Reconstruct memories (may introduce errors)
    const recalled = candidates.slice(0, limit).map(m => this.reconstructMemory(m));
    
    // Update recall metadata
    for (const memory of recalled) {
      const original = this.memories.find(m => m.id === memory.id);
      if (original) {
        original.lastRecalled = (this.kernel?.turn || 0);
        original.recallCount++;
      }
    }
    
    return recalled;
  }
  
  /**
   * Find memories matching query criteria
   * @param {Object} query - Search criteria
   * @returns {Array} Matching memories
   */
  findMatches(query) {
    let candidates = [...this.memories];
    
    // Filter by participant
    if (query.participant) {
      const participantMemories = this.indices.byParticipant.get(query.participant) || [];
      candidates = candidates.filter(m => participantMemories.includes(m.id));
    }
    
    // Filter by location
    if (query.location) {
      const locationMemories = this.indices.byLocation.get(query.location) || [];
      candidates = candidates.filter(m => locationMemories.includes(m.id));
    }
    
    // Filter by type
    if (query.type) {
      const typeMemories = this.indices.byType.get(query.type) || [];
      candidates = candidates.filter(m => typeMemories.includes(m.id));
    }
    
    // Filter by time range
    if (query.timeRange) {
      const { start, end } = query.timeRange;
      candidates = candidates.filter(m => 
        m.timestamp >= start && m.timestamp <= end
      );
    }
    
    // Filter by emotion
    if (query.emotion) {
      candidates = candidates.filter(m => 
        m.emotions && m.emotions[query.emotion] > 0.5
      );
    }
    
    // Filter by tags
    if (query.tags) {
      candidates = candidates.filter(m =>
        query.tags.some(tag => m.tags.includes(tag))
      );
    }
    
    return candidates;
  }
  
  /**
   * Rank memories by relevance to query
   * @param {Array} memories - Memories to rank
   * @param {Object} query - Query context
   * @returns {Array} Sorted memories
   */
  rankMemories(memories, query) {
    return memories.sort((a, b) => {
      let scoreA = this.calculateRelevanceScore(a, query);
      let scoreB = this.calculateRelevanceScore(b, query);
      return scoreB - scoreA;
    });
  }
  
  /**
   * Calculate relevance score for a memory
   * @param {Object} memory - Memory to score
   * @param {Object} query - Query context
   * @returns {number} Relevance score
   */
  calculateRelevanceScore(memory, query) {
    let score = 0;
    
    // Importance
    score += memory.importance * 0.3;
    
    // Vividness
    score += memory.vividness * 0.2;
    
    // Recency (more recent = higher score)
    const age = (this.kernel?.turn || 0) - memory.timestamp;
    const recencyScore = Math.exp(-age / (365 * 24 * 60 * 60 * 1000)); // Decay over years
    score += recencyScore * 0.2;
    
    // Emotional match
    if (query.emotionalContext && memory.emotions) {
      const emotionalSimilarity = this.calculateEmotionalSimilarity(
        query.emotionalContext,
        memory.emotions
      );
      score += emotionalSimilarity * 0.15;
    }
    
    // Consolidation bonus
    if (memory.consolidated) {
      score += 0.15;
    }
    
    return score;
  }
  
  /**
   * Calculate emotional similarity between two emotional states
   * @param {Object} emotions1 - First emotional state
   * @param {Object} emotions2 - Second emotional state
   * @returns {number} Similarity 0-1
   */
  calculateEmotionalSimilarity(emotions1, emotions2) {
    const emotions = ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation'];
    let similarity = 0;
    let count = 0;
    
    for (const emotion of emotions) {
      if (emotions1[emotion] !== undefined && emotions2[emotion] !== undefined) {
        const diff = Math.abs(emotions1[emotion] - emotions2[emotion]);
        similarity += (1 - diff);
        count++;
      }
    }
    
    return count > 0 ? similarity / count : 0;
  }
  
  /**
   * Reconstruct a memory (may introduce errors)
   * @param {Object} memory - Original memory
   * @returns {Object} Reconstructed memory
   */
  reconstructMemory(memory) {
    const reconstructed = { ...memory };
    
    // Memory fades with each recall
    reconstructed.vividness *= 0.95;
    
    // Chance of false details based on vividness
    if (this.rng.next() > reconstructed.vividness) {
      reconstructed.details = this.addFalseDetails(reconstructed);
      reconstructed.reconstructionErrors = (reconstructed.reconstructionErrors || 0) + 1;
    }
    
    // Very old memories may have significant gaps
    const age = (this.kernel?.turn || 0) - memory.timestamp;
    const ageYears = age / (365 * 24 * 60 * 60 * 1000);
    
    if (ageYears > 5 && this.rng.next() > reconstructed.vividness) {
      reconstructed.hasGaps = true;
      reconstructed.confidence = reconstructed.vividness * 0.7;
    } else {
      reconstructed.confidence = reconstructed.vividness;
    }
    
    return reconstructed;
  }
  
  /**
   * Add false details to memory reconstruction
   * @param {Object} memory - Memory to modify
   * @returns {Object} Modified memory
   */
  addFalseDetails(memory) {
    const modified = { ...memory };
    
    // Small chance to misremember participants
    if (this.rng.next() < this.reconstructionErrorRate && memory.participants.length > 0) {
      modified.participants = [...memory.participants];
      // Might add or remove a participant
      if (this.rng.next() < 0.5 && modified.participants.length > 1) {
        modified.participants.pop();
      }
    }
    
    // Might misremember location slightly
    if (this.rng.next() < this.reconstructionErrorRate && memory.location) {
      modified.locationUncertain = true;
    }
    
    // Emotional memory might be exaggerated
    if (this.rng.next() < this.reconstructionErrorRate && memory.emotions) {
      modified.emotions = { ...memory.emotions };
      const dominantEmotion = Object.entries(modified.emotions)
        .reduce((a, b) => a[1] > b[1] ? a : b)[0];
      modified.emotions[dominantEmotion] = Math.min(1.0, modified.emotions[dominantEmotion] * 1.2);
    }
    
    return modified;
  }
  
  /**
   * Update memory over time (consolidation, fading)
   * @param {number} deltaTime - Time elapsed in minutes
   */
  update(deltaTime) {
    const now = (this.kernel?.turn || 0);
    
    for (const memory of this.memories) {
      // Vividness fades over time
      const timeSinceRecall = now - memory.lastRecalled;
      const fadeRate = 0.00001 * deltaTime;
      memory.vividness *= (1 - fadeRate);
      memory.vividness = Math.max(0.1, memory.vividness);
      
      // Important memories consolidate
      if (!memory.consolidated && memory.importance > this.consolidationThreshold) {
        const consolidationChance = memory.importance * 0.001 * deltaTime;
        if (this.rng.next() < consolidationChance) {
          memory.consolidated = true;
          memory.vividness = Math.min(1.0, memory.vividness * 1.2);
        }
      }
      
      // Frequently recalled memories stay vivid
      if (memory.recallCount > 5) {
        memory.vividness = Math.min(1.0, memory.vividness + 0.001 * deltaTime);
      }
    }
  }
  
  /**
   * Prune old, unimportant memories when at capacity
   */
  pruneOldMemories() {
    if (this.memories.length <= this.capacity) return;
    
    // Sort by importance and vividness
    this.memories.sort((a, b) => {
      const scoreA = a.importance * 0.6 + a.vividness * 0.4;
      const scoreB = b.importance * 0.6 + b.vividness * 0.4;
      return scoreB - scoreA;
    });
    
    // Remove least important memories
    const removed = this.memories.splice(this.capacity);
    
    // Update indices
    for (const memory of removed) {
      this.removeFromIndices(memory);
    }
  }
  
  /**
   * Update memory indices
   * @param {Object} memory - Memory to index
   */
  updateIndices(memory) {
    // Index by participants
    for (const participant of memory.participants) {
      if (!this.indices.byParticipant.has(participant)) {
        this.indices.byParticipant.set(participant, []);
      }
      this.indices.byParticipant.get(participant).push(memory.id);
    }
    
    // Index by location
    if (memory.location) {
      if (!this.indices.byLocation.has(memory.location)) {
        this.indices.byLocation.set(memory.location, []);
      }
      this.indices.byLocation.get(memory.location).push(memory.id);
    }
    
    // Index by tags
    for (const tag of memory.tags) {
      if (!this.indices.byType.has(tag)) {
        this.indices.byType.set(tag, []);
      }
      this.indices.byType.get(tag).push(memory.id);
    }
  }
  
  /**
   * Remove memory from indices
   * @param {Object} memory - Memory to remove
   */
  removeFromIndices(memory) {
    // Remove from participant index
    for (const participant of memory.participants) {
      const list = this.indices.byParticipant.get(participant);
      if (list) {
        const index = list.indexOf(memory.id);
        if (index > -1) list.splice(index, 1);
      }
    }
    
    // Remove from location index
    if (memory.location) {
      const list = this.indices.byLocation.get(memory.location);
      if (list) {
        const index = list.indexOf(memory.id);
        if (index > -1) list.splice(index, 1);
      }
    }
    
    // Remove from type index
    for (const tag of memory.tags) {
      const list = this.indices.byType.get(tag);
      if (list) {
        const index = list.indexOf(memory.id);
        if (index > -1) list.splice(index, 1);
      }
    }
  }
  
  /**
   * Get memory by ID
   * @param {string} id - Memory ID
   * @returns {Object|null} Memory or null
   */
  getMemory(id) {
    return this.memories.find(m => m.id === id) || null;
  }
  
  /**
   * Get all memories involving a person
   * @param {string} personId - Person ID
   * @returns {Array} Memories
   */
  getMemoriesWithPerson(personId) {
    const memoryIds = this.indices.byParticipant.get(personId) || [];
    return memoryIds.map(id => this.getMemory(id)).filter(m => m !== null);
  }
  
  /**
   * Get all memories at a location
   * @param {string} location - Location
   * @returns {Array} Memories
   */
  getMemoriesAtLocation(location) {
    const memoryIds = this.indices.byLocation.get(location) || [];
    return memoryIds.map(id => this.getMemory(id)).filter(m => m !== null);
  }
  
  /**
   * Get most recent memories
   * @param {number} count - Number of memories
   * @returns {Array} Recent memories
   */
  getRecentMemories(count = 10) {
    return [...this.memories]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, count);
  }
  
  /**
   * Get most important memories
   * @param {number} count - Number of memories
   * @returns {Array} Important memories
   */
  getImportantMemories(count = 10) {
    return [...this.memories]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, count);
  }
  
  /**
   * Generate unique memory ID
   * @returns {string} Memory ID
   */
  generateMemoryId() {
    return `memory_${(this.kernel?.turn || 0)}_${this.rng.next().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get memory statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      totalMemories: this.memories.length,
      capacity: this.capacity,
      utilizationPercent: (this.memories.length / this.capacity) * 100,
      consolidatedMemories: this.memories.filter(m => m.consolidated).length,
      averageVividness: this.memories.reduce((sum, m) => sum + m.vividness, 0) / this.memories.length,
      averageImportance: this.memories.reduce((sum, m) => sum + m.importance, 0) / this.memories.length
    };
  }
  
  /**
   * Serialize episodic memory
   * @returns {Object} Serialized data
   */
  serialize() {
    return {
      capacity: this.capacity,
      memories: this.memories,
      emotionalTagging: this.emotionalTagging,
      reconstructionErrorRate: this.reconstructionErrorRate
    };
  }
  
  /**
   * Deserialize episodic memory
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    this.capacity = data.capacity || 512;
    this.memories = data.memories || [];
    this.emotionalTagging = data.emotionalTagging !== undefined ? data.emotionalTagging : true;
    this.reconstructionErrorRate = data.reconstructionErrorRate || 0.1;
    
    // Rebuild indices
    this.indices = {
      byParticipant: new Map(),
      byLocation: new Map(),
      byType: new Map(),
      byTimestamp: []
    };
    
    for (const memory of this.memories) {
      this.updateIndices(memory);
    }
  }
}
