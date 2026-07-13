/**
 * SocialNetwork.js
 * 
 * Implements social network graph for tracking connections between NPCs.
 * Features:
 * - Graph-based network structure
 * - Connection strength tracking
 * - Network analysis (centrality, clustering, etc.)
 * - Community detection
 * - Influence propagation
 * 
 * @module SocialNetwork
 */

export class SocialNetwork {
  constructor(kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    // Adjacency list representation
    this.nodes = new Map();  // personId -> node data
    this.edges = new Map();  // personId -> Map of connections
    
    // Network metrics cache
    this.metricsCache = new Map();
    this.cacheValidUntil = 0;
    this.cacheLifetime = 60 * 60 * 1000; // 1 hour
    
    // Communities
    this.communities = new Map();
  }
  
  /**
   * Add a person to the network
   * @param {string} personId - Person ID
   * @param {Object} data - Person data
   */
  addNode(personId, data = {}) {
    if (!this.nodes.has(personId)) {
      this.nodes.set(personId, {
        id: personId,
        ...data,
        addedAt: (this.kernel?.turn || 0)
      });
      this.edges.set(personId, new Map());
      this.invalidateCache();
    }
  }
  
  /**
   * Remove a person from the network
   * @param {string} personId - Person ID
   */
  removeNode(personId) {
    // Remove all edges to this node
    for (const [id, connections] of this.edges) {
      connections.delete(personId);
    }
    
    // Remove node and its edges
    this.nodes.delete(personId);
    this.edges.delete(personId);
    this.invalidateCache();
  }
  
  /**
   * Add or update connection between two people
   * @param {string} person1 - First person ID
   * @param {string} person2 - Second person ID
   * @param {number} strength - Connection strength (0-1)
   * @param {Object} metadata - Additional connection data
   */
  addConnection(person1, person2, strength = 0.5, metadata = {}) {
    // Ensure both nodes exist
    if (!this.nodes.has(person1)) this.addNode(person1);
    if (!this.nodes.has(person2)) this.addNode(person2);
    
    // Add bidirectional edge
    this.edges.get(person1).set(person2, {
      target: person2,
      strength,
      ...metadata,
      createdAt: (this.kernel?.turn || 0),
      lastUpdated: (this.kernel?.turn || 0)
    });
    
    this.edges.get(person2).set(person1, {
      target: person1,
      strength,
      ...metadata,
      createdAt: (this.kernel?.turn || 0),
      lastUpdated: (this.kernel?.turn || 0)
    });
    
    this.invalidateCache();
  }
  
  /**
   * Remove connection between two people
   * @param {string} person1 - First person ID
   * @param {string} person2 - Second person ID
   */
  removeConnection(person1, person2) {
    if (this.edges.has(person1)) {
      this.edges.get(person1).delete(person2);
    }
    if (this.edges.has(person2)) {
      this.edges.get(person2).delete(person1);
    }
    this.invalidateCache();
  }
  
  /**
   * Update connection strength
   * @param {string} person1 - First person ID
   * @param {string} person2 - Second person ID
   * @param {number} newStrength - New strength (0-1)
   */
  updateConnectionStrength(person1, person2, newStrength) {
    const edge1 = this.edges.get(person1)?.get(person2);
    const edge2 = this.edges.get(person2)?.get(person1);
    
    if (edge1) {
      edge1.strength = newStrength;
      edge1.lastUpdated = (this.kernel?.turn || 0);
    }
    if (edge2) {
      edge2.strength = newStrength;
      edge2.lastUpdated = (this.kernel?.turn || 0);
    }
    
    this.invalidateCache();
  }
  
  /**
   * Get all connections for a person
   * @param {string} personId - Person ID
   * @returns {Array} Connections
   */
  getConnections(personId) {
    const connections = this.edges.get(personId);
    if (!connections) return [];
    
    return Array.from(connections.values());
  }
  
  /**
   * Get connection between two people
   * @param {string} person1 - First person ID
   * @param {string} person2 - Second person ID
   * @returns {Object|null} Connection or null
   */
  getConnection(person1, person2) {
    return this.edges.get(person1)?.get(person2) || null;
  }
  
  /**
   * Check if two people are connected
   * @param {string} person1 - First person ID
   * @param {string} person2 - Second person ID
   * @returns {boolean} True if connected
   */
  areConnected(person1, person2) {
    return this.edges.get(person1)?.has(person2) || false;
  }
  
  /**
   * Get degree (number of connections) for a person
   * @param {string} personId - Person ID
   * @returns {number} Degree
   */
  getDegree(personId) {
    return this.edges.get(personId)?.size || 0;
  }
  
  /**
   * Find shortest path between two people
   * @param {string} start - Start person ID
   * @param {string} end - End person ID
   * @returns {Array|null} Path or null if no path exists
   */
  findShortestPath(start, end) {
    if (start === end) return [start];
    if (!this.nodes.has(start) || !this.nodes.has(end)) return null;
    
    const queue = [[start]];
    const visited = new Set([start]);
    
    while (queue.length > 0) {
      const path = queue.shift();
      const current = path[path.length - 1];
      
      const connections = this.getConnections(current);
      for (const conn of connections) {
        if (conn.target === end) {
          return [...path, end];
        }
        
        if (!visited.has(conn.target)) {
          visited.add(conn.target);
          queue.push([...path, conn.target]);
        }
      }
    }
    
    return null; // No path found
  }
  
  /**
   * Calculate betweenness centrality for a person
   * @param {string} personId - Person ID
   * @returns {number} Betweenness centrality
   */
  calculateBetweenness(personId) {
    const cacheKey = `betweenness_${personId}`;
    if (this.isCacheValid() && this.metricsCache.has(cacheKey)) {
      return this.metricsCache.get(cacheKey);
    }
    
    let betweenness = 0;
    const nodes = Array.from(this.nodes.keys());
    
    // For each pair of nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const source = nodes[i];
        const target = nodes[j];
        
        if (source === personId || target === personId) continue;
        
        const path = this.findShortestPath(source, target);
        if (path && path.includes(personId)) {
          betweenness++;
        }
      }
    }
    
    // Normalize
    const n = this.nodes.size;
    if (n > 2) {
      betweenness = betweenness / ((n - 1) * (n - 2) / 2);
    }
    
    this.metricsCache.set(cacheKey, betweenness);
    return betweenness;
  }
  
  /**
   * Calculate closeness centrality for a person
   * @param {string} personId - Person ID
   * @returns {number} Closeness centrality
   */
  calculateCloseness(personId) {
    const cacheKey = `closeness_${personId}`;
    if (this.isCacheValid() && this.metricsCache.has(cacheKey)) {
      return this.metricsCache.get(cacheKey);
    }
    
    let totalDistance = 0;
    let reachable = 0;
    
    for (const [otherId] of this.nodes) {
      if (otherId === personId) continue;
      
      const path = this.findShortestPath(personId, otherId);
      if (path) {
        totalDistance += path.length - 1;
        reachable++;
      }
    }
    
    const closeness = reachable > 0 ? reachable / totalDistance : 0;
    this.metricsCache.set(cacheKey, closeness);
    return closeness;
  }
  
  /**
   * Calculate eigenvector centrality (influence) for a person
   * @param {string} personId - Person ID
   * @returns {number} Eigenvector centrality
   */
  calculateInfluence(personId) {
    const cacheKey = `influence_${personId}`;
    if (this.isCacheValid() && this.metricsCache.has(cacheKey)) {
      return this.metricsCache.get(cacheKey);
    }
    
    // Simplified influence: sum of connection strengths weighted by neighbor's degree
    let influence = 0;
    const connections = this.getConnections(personId);
    
    for (const conn of connections) {
      const neighborDegree = this.getDegree(conn.target);
      influence += conn.strength * Math.log(neighborDegree + 1);
    }
    
    this.metricsCache.set(cacheKey, influence);
    return influence;
  }
  
  /**
   * Find mutual connections between two people
   * @param {string} person1 - First person ID
   * @param {string} person2 - Second person ID
   * @returns {Array} Mutual connections
   */
  findMutualConnections(person1, person2) {
    const connections1 = new Set(
      this.getConnections(person1).map(c => c.target)
    );
    const connections2 = this.getConnections(person2);
    
    return connections2
      .filter(c => connections1.has(c.target))
      .map(c => c.target);
  }
  
  /**
   * Detect communities using simple label propagation
   * @param {number} iterations - Number of iterations
   * @returns {Map} Community assignments
   */
  detectCommunities(iterations = 10) {
    // Initialize: each node is its own community
    const labels = new Map();
    for (const [id] of this.nodes) {
      labels.set(id, id);
    }
    
    // Iterate
    for (let iter = 0; iter < iterations; iter++) {
      const newLabels = new Map();
      
      for (const [id] of this.nodes) {
        // Get neighbor labels
        const neighborLabels = new Map();
        const connections = this.getConnections(id);
        
        for (const conn of connections) {
          const label = labels.get(conn.target);
          const weight = conn.strength;
          neighborLabels.set(label, (neighborLabels.get(label) || 0) + weight);
        }
        
        // Adopt most common label
        if (neighborLabels.size > 0) {
          const mostCommon = Array.from(neighborLabels.entries())
            .reduce((a, b) => a[1] > b[1] ? a : b)[0];
          newLabels.set(id, mostCommon);
        } else {
          newLabels.set(id, labels.get(id));
        }
      }
      
      labels.clear();
      for (const [id, label] of newLabels) {
        labels.set(id, label);
      }
    }
    
    // Group by community
    this.communities.clear();
    for (const [id, label] of labels) {
      if (!this.communities.has(label)) {
        this.communities.set(label, []);
      }
      this.communities.get(label).push(id);
    }
    
    return this.communities;
  }
  
  /**
   * Get community for a person
   * @param {string} personId - Person ID
   * @returns {Array|null} Community members or null
   */
  getCommunity(personId) {
    for (const [label, members] of this.communities) {
      if (members.includes(personId)) {
        return members;
      }
    }
    return null;
  }
  
  /**
   * Propagate influence through network
   * @param {string} sourceId - Source person ID
   * @param {number} initialStrength - Initial influence strength
   * @param {number} maxDepth - Maximum propagation depth
   * @returns {Map} Influence received by each person
   */
  propagateInfluence(sourceId, initialStrength = 1.0, maxDepth = 3) {
    const influence = new Map();
    const queue = [{ id: sourceId, strength: initialStrength, depth: 0 }];
    const visited = new Set();
    
    while (queue.length > 0) {
      const { id, strength, depth } = queue.shift();
      
      if (visited.has(id) || depth > maxDepth) continue;
      visited.add(id);
      
      influence.set(id, (influence.get(id) || 0) + strength);
      
      // Propagate to connections
      const connections = this.getConnections(id);
      for (const conn of connections) {
        const propagatedStrength = strength * conn.strength * 0.7; // Decay
        if (propagatedStrength > 0.01) {
          queue.push({
            id: conn.target,
            strength: propagatedStrength,
            depth: depth + 1
          });
        }
      }
    }
    
    return influence;
  }
  
  /**
   * Get network statistics
   * @returns {Object} Statistics
   */
  getStats() {
    const degrees = Array.from(this.nodes.keys()).map(id => this.getDegree(id));
    const avgDegree = degrees.reduce((a, b) => a + b, 0) / degrees.length || 0;
    
    return {
      nodeCount: this.nodes.size,
      edgeCount: Array.from(this.edges.values())
        .reduce((sum, conns) => sum + conns.size, 0) / 2,
      averageDegree: avgDegree,
      maxDegree: Math.max(...degrees, 0),
      minDegree: Math.min(...degrees, Infinity),
      communities: this.communities.size
    };
  }
  
  /**
   * Invalidate metrics cache
   */
  invalidateCache() {
    this.cacheValidUntil = 0;
    this.metricsCache.clear();
  }
  
  /**
   * Check if cache is valid
   * @returns {boolean} True if valid
   */
  isCacheValid() {
    return (this.kernel?.turn || 0) < this.cacheValidUntil;
  }
  
  /**
   * Update cache validity
   */
  updateCacheValidity() {
    this.cacheValidUntil = (this.kernel?.turn || 0) + this.cacheLifetime;
  }
  
  /**
   * Serialize social network
   * @returns {Object} Serialized data
   */
  serialize() {
    return {
      nodes: Array.from(this.nodes.entries()),
      edges: Array.from(this.edges.entries()).map(([id, conns]) => 
        [id, Array.from(conns.entries())]
      ),
      communities: Array.from(this.communities.entries())
    };
  }
  
  /**
   * Deserialize social network
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    this.nodes = new Map(data.nodes || []);
    this.edges = new Map(
      (data.edges || []).map(([id, conns]) => [id, new Map(conns)])
    );
    this.communities = new Map(data.communities || []);
    this.invalidateCache();
  }
}
