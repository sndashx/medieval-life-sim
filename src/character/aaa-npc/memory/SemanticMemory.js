/**
 * SemanticMemory.js
 * 
 * Implements semantic memory system for storing facts, knowledge, and concepts.
 * Features:
 * - Knowledge graph structure with concepts and relations
 * - Belief system with evidence tracking
 * - Schema-based knowledge organization
 * - Bayesian belief updating
 * - Concept learning and forgetting
 * 
 * @module SemanticMemory
 */

export class SemanticMemory {
  constructor(kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    // Knowledge graph: concepts and their properties/relations
    this.concepts = new Map();
    
    // Beliefs with strength and supporting evidence
    this.beliefs = new Map();
    
    // Schemas: structured knowledge templates
    this.schemas = new Map();
    
    // Categories for organizing concepts
    this.categories = new Map();
    
    // Learning rate
    this.learningRate = 0.1;
    
    // Forgetting rate
    this.forgettingRate = 0.001;
  }
  
  /**
   * Learn a new concept or update existing one
   * @param {string} concept - Concept name
   * @param {Object} properties - Properties of the concept
   * @param {number} confidence - Initial confidence (0-1)
   * @returns {Object} Concept
   */
  learn(concept, properties = {}, confidence = 0.5) {
    if (!this.concepts.has(concept)) {
      this.concepts.set(concept, {
        name: concept,
        properties: new Map(),
        relations: new Map(),
        confidence: confidence,
        lastAccessed: (this.kernel?.turn || 0),
        accessCount: 0,
        category: properties.category || 'general'
      });
    }
    
    const existing = this.concepts.get(concept);
    
    // Update properties
    for (const [key, value] of Object.entries(properties)) {
      if (key !== 'category') {
        existing.properties.set(key, {
          value,
          confidence: confidence,
          lastUpdated: (this.kernel?.turn || 0)
        });
      }
    }
    
    // Increase confidence with learning
    existing.confidence = Math.min(1.0, existing.confidence + this.learningRate);
    existing.lastAccessed = (this.kernel?.turn || 0);
    existing.accessCount++;
    
    // Add to category
    if (properties.category) {
      this.addToCategory(concept, properties.category);
    }
    
    return existing;
  }
  
  /**
   * Add a relation between two concepts
   * @param {string} concept1 - First concept
   * @param {string} relation - Relation type
   * @param {string} concept2 - Second concept
   * @param {number} strength - Relation strength (0-1)
   */
  addRelation(concept1, relation, concept2, strength = 0.8) {
    if (!this.concepts.has(concept1)) {
      this.learn(concept1);
    }
    
    const concept = this.concepts.get(concept1);
    
    if (!concept.relations.has(relation)) {
      concept.relations.set(relation, []);
    }
    
    concept.relations.get(relation).push({
      target: concept2,
      strength,
      created: (this.kernel?.turn || 0)
    });
  }
  
  /**
   * Query a concept
   * @param {string} concept - Concept to query
   * @returns {Object|null} Concept data or null
   */
  query(concept) {
    const data = this.concepts.get(concept);
    
    if (data) {
      data.lastAccessed = (this.kernel?.turn || 0);
      data.accessCount++;
      return this.formatConcept(data);
    }
    
    return null;
  }
  
  /**
   * Format concept for output
   * @param {Object} concept - Raw concept data
   * @returns {Object} Formatted concept
   */
  formatConcept(concept) {
    return {
      name: concept.name,
      properties: Object.fromEntries(concept.properties),
      relations: Object.fromEntries(concept.relations),
      confidence: concept.confidence,
      category: concept.category,
      accessCount: concept.accessCount
    };
  }
  
  /**
   * Get property of a concept
   * @param {string} concept - Concept name
   * @param {string} property - Property name
   * @returns {*} Property value or null
   */
  getProperty(concept, property) {
    const data = this.concepts.get(concept);
    if (!data) return null;
    
    const prop = data.properties.get(property);
    return prop ? prop.value : null;
  }
  
  /**
   * Get relations of a concept
   * @param {string} concept - Concept name
   * @param {string} relationType - Optional relation type filter
   * @returns {Array} Relations
   */
  getRelations(concept, relationType = null) {
    const data = this.concepts.get(concept);
    if (!data) return [];
    
    if (relationType) {
      return data.relations.get(relationType) || [];
    }
    
    const allRelations = [];
    for (const [type, relations] of data.relations) {
      for (const rel of relations) {
        allRelations.push({ type, ...rel });
      }
    }
    
    return allRelations;
  }
  
  /**
   * Update or create a belief
   * @param {string} belief - Belief statement
   * @param {Object} evidence - Supporting evidence
   * @param {number} strength - Evidence strength (-1 to 1)
   */
  updateBelief(belief, evidence, strength) {
    if (!this.beliefs.has(belief)) {
      this.beliefs.set(belief, {
        statement: belief,
        strength: 0.5,
        evidence: [],
        lastUpdated: (this.kernel?.turn || 0)
      });
    }
    
    const existing = this.beliefs.get(belief);
    existing.evidence.push({
      ...evidence,
      strength,
      timestamp: (this.kernel?.turn || 0)
    });
    
    // Bayesian-like update
    existing.strength = this.bayesianUpdate(existing.strength, strength);
    existing.lastUpdated = (this.kernel?.turn || 0);
    
    // Prune old evidence
    if (existing.evidence.length > 50) {
      existing.evidence = existing.evidence.slice(-50);
    }
  }
  
  /**
   * Bayesian belief update
   * @param {number} prior - Prior belief strength (0-1)
   * @param {number} evidence - Evidence strength (-1 to 1)
   * @returns {number} Updated belief strength
   */
  bayesianUpdate(prior, evidence) {
    // Convert to log-odds for easier calculation
    const priorOdds = prior / (1 - prior);
    const evidenceOdds = (evidence + 1) / (1 - evidence);
    
    // Update odds
    const posteriorOdds = priorOdds * evidenceOdds;
    
    // Convert back to probability
    const posterior = posteriorOdds / (1 + posteriorOdds);
    
    return Math.max(0, Math.min(1, posterior));
  }
  
  /**
   * Get belief strength
   * @param {string} belief - Belief statement
   * @returns {number|null} Belief strength or null
   */
  getBelief(belief) {
    const data = this.beliefs.get(belief);
    return data ? data.strength : null;
  }
  
  /**
   * Check if believes something
   * @param {string} belief - Belief statement
   * @param {number} threshold - Belief threshold (default 0.6)
   * @returns {boolean} True if believes
   */
  believes(belief, threshold = 0.6) {
    const strength = this.getBelief(belief);
    return strength !== null && strength >= threshold;
  }
  
  /**
   * Add or update a schema
   * @param {string} schemaName - Schema name
   * @param {Object} structure - Schema structure
   */
  addSchema(schemaName, structure) {
    this.schemas.set(schemaName, {
      name: schemaName,
      structure,
      instances: [],
      created: (this.kernel?.turn || 0)
    });
  }
  
  /**
   * Instantiate a schema with specific data
   * @param {string} schemaName - Schema name
   * @param {Object} data - Instance data
   * @returns {Object} Schema instance
   */
  instantiateSchema(schemaName, data) {
    const schema = this.schemas.get(schemaName);
    if (!schema) return null;
    
    const instance = {
      id: this.generateInstanceId(),
      schema: schemaName,
      data,
      created: (this.kernel?.turn || 0)
    };
    
    schema.instances.push(instance);
    return instance;
  }
  
  /**
   * Get schema instances
   * @param {string} schemaName - Schema name
   * @returns {Array} Instances
   */
  getSchemaInstances(schemaName) {
    const schema = this.schemas.get(schemaName);
    return schema ? schema.instances : [];
  }
  
  /**
   * Add concept to category
   * @param {string} concept - Concept name
   * @param {string} category - Category name
   */
  addToCategory(concept, category) {
    if (!this.categories.has(category)) {
      this.categories.set(category, new Set());
    }
    
    this.categories.get(category).add(concept);
  }
  
  /**
   * Get concepts in category
   * @param {string} category - Category name
   * @returns {Array} Concepts
   */
  getCategory(category) {
    const concepts = this.categories.get(category);
    return concepts ? Array.from(concepts) : [];
  }
  
  /**
   * Find related concepts
   * @param {string} concept - Starting concept
   * @param {number} maxDepth - Maximum relation depth
   * @returns {Array} Related concepts
   */
  findRelated(concept, maxDepth = 2) {
    const related = new Set();
    const queue = [{ concept, depth: 0 }];
    const visited = new Set();
    
    while (queue.length > 0) {
      const { concept: current, depth } = queue.shift();
      
      if (visited.has(current) || depth > maxDepth) continue;
      visited.add(current);
      
      if (depth > 0) related.add(current);
      
      const relations = this.getRelations(current);
      for (const rel of relations) {
        if (!visited.has(rel.target)) {
          queue.push({ concept: rel.target, depth: depth + 1 });
        }
      }
    }
    
    return Array.from(related);
  }
  
  /**
   * Semantic search for concepts
   * @param {string} query - Search query
   * @param {number} limit - Maximum results
   * @returns {Array} Matching concepts
   */
  search(query, limit = 10) {
    const results = [];
    const queryLower = query.toLowerCase();
    
    for (const [name, concept] of this.concepts) {
      let score = 0;
      
      // Name match
      if (name.toLowerCase().includes(queryLower)) {
        score += 1.0;
      }
      
      // Property match
      for (const [key, prop] of concept.properties) {
        const valueStr = String(prop.value).toLowerCase();
        if (valueStr.includes(queryLower)) {
          score += 0.5;
        }
      }
      
      // Category match
      if (concept.category.toLowerCase().includes(queryLower)) {
        score += 0.3;
      }
      
      if (score > 0) {
        results.push({
          concept: name,
          score,
          confidence: concept.confidence
        });
      }
    }
    
    return results
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * Update semantic memory over time
   * @param {number} deltaTime - Time elapsed in minutes
   */
  update(deltaTime) {
    const now = (this.kernel?.turn || 0);
    const forgettingThreshold = 30 * 24 * 60 * 60 * 1000; // 30 days
    
    for (const [name, concept] of this.concepts) {
      const timeSinceAccess = now - concept.lastAccessed;
      
      // Concepts fade if not accessed
      if (timeSinceAccess > forgettingThreshold) {
        const fadeRate = this.forgettingRate * deltaTime;
        concept.confidence *= (1 - fadeRate);
        
        // Remove if confidence too low
        if (concept.confidence < 0.1) {
          this.concepts.delete(name);
          
          // Remove from category
          if (this.categories.has(concept.category)) {
            this.categories.get(concept.category).delete(name);
          }
        }
      }
    }
    
    // Update beliefs
    for (const [statement, belief] of this.beliefs) {
      const timeSinceUpdate = now - belief.lastUpdated;
      
      // Beliefs fade without reinforcement
      if (timeSinceUpdate > forgettingThreshold) {
        const fadeRate = this.forgettingRate * deltaTime * 0.5;
        belief.strength = belief.strength * (1 - fadeRate) + 0.5 * fadeRate;
      }
    }
  }
  
  /**
   * Generate unique instance ID
   * @returns {string} Instance ID
   */
  generateInstanceId() {
    return `instance_${(this.kernel?.turn || 0)}_${this.rng.next().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get memory statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      totalConcepts: this.concepts.size,
      totalBeliefs: this.beliefs.size,
      totalSchemas: this.schemas.size,
      totalCategories: this.categories.size,
      averageConfidence: Array.from(this.concepts.values())
        .reduce((sum, c) => sum + c.confidence, 0) / this.concepts.size
    };
  }
  
  /**
   * Serialize semantic memory
   * @returns {Object} Serialized data
   */
  serialize() {
    return {
      concepts: Array.from(this.concepts.entries()).map(([name, data]) => ({
        name,
        properties: Array.from(data.properties.entries()),
        relations: Array.from(data.relations.entries()),
        confidence: data.confidence,
        category: data.category,
        lastAccessed: data.lastAccessed,
        accessCount: data.accessCount
      })),
      beliefs: Array.from(this.beliefs.entries()),
      schemas: Array.from(this.schemas.entries()),
      categories: Array.from(this.categories.entries()).map(([cat, concepts]) => 
        [cat, Array.from(concepts)]
      )
    };
  }
  
  /**
   * Deserialize semantic memory
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    // Restore concepts
    this.concepts.clear();
    for (const concept of data.concepts || []) {
      this.concepts.set(concept.name, {
        name: concept.name,
        properties: new Map(concept.properties),
        relations: new Map(concept.relations),
        confidence: concept.confidence,
        category: concept.category,
        lastAccessed: concept.lastAccessed,
        accessCount: concept.accessCount
      });
    }
    
    // Restore beliefs
    this.beliefs = new Map(data.beliefs || []);
    
    // Restore schemas
    this.schemas = new Map(data.schemas || []);
    
    // Restore categories
    this.categories.clear();
    for (const [cat, concepts] of data.categories || []) {
      this.categories.set(cat, new Set(concepts));
    }
  }
}
