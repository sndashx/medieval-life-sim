/**
 * WorkingMemory.js
 * 
 * Implements working memory (short-term memory) for current focus and active thoughts.
 * Based on Miller's Law (7±2 items) with attention management.
 * Features:
 * - Limited capacity (typically 7 items)
 * - Attention allocation
 * - Priority-based item management
 * - Rapid decay without rehearsal
 * - Integration with long-term memory systems
 * 
 * @module WorkingMemory
 */

export class WorkingMemory {
  constructor(capacity = 7, kernel = null) {
    this.kernel = kernel;
    this.rng = kernel?.rng || { next: () => this.rng.next(), nextInt: (min, max) => Math.floor(this.rng.next() * (max - min + 1)) + min };
    this.capacity = capacity;
    this.items = [];
    this.attentionFocus = null;
    this.attentionCapacity = 1.0;
    this.decayRate = 0.1; // Items decay quickly without attention
  }
  
  /**
   * Add item to working memory
   * @param {Object} item - Item to add
   * @param {number} priority - Priority (0-1)
   * @returns {boolean} True if added successfully
   */
  add(item, priority = 0.5) {
    // Check if already in working memory
    const existing = this.items.find(i => i.id === item.id);
    if (existing) {
      existing.activation = Math.min(1.0, existing.activation + 0.2);
      existing.priority = Math.max(existing.priority, priority);
      return true;
    }
    
    // If at capacity, remove lowest priority item
    if (this.items.length >= this.capacity) {
      this.items.sort((a, b) => a.priority - b.priority);
      this.items.shift();
    }
    
    this.items.push({
      ...item,
      id: item.id || this.generateItemId(),
      activation: 1.0,
      priority,
      addedAt: (this.kernel?.turn || 0),
      lastAccessed: (this.kernel?.turn || 0)
    });
    
    return true;
  }
  
  /**
   * Remove item from working memory
   * @param {string} itemId - Item ID
   * @returns {boolean} True if removed
   */
  remove(itemId) {
    const index = this.items.findIndex(i => i.id === itemId);
    if (index > -1) {
      this.items.splice(index, 1);
      return true;
    }
    return false;
  }
  
  /**
   * Get item from working memory
   * @param {string} itemId - Item ID
   * @returns {Object|null} Item or null
   */
  get(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      item.lastAccessed = (this.kernel?.turn || 0);
      item.activation = Math.min(1.0, item.activation + 0.1);
    }
    return item || null;
  }
  
  /**
   * Set attention focus
   * @param {string} itemId - Item to focus on
   * @returns {boolean} True if focused
   */
  focus(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return false;
    
    this.attentionFocus = itemId;
    item.activation = 1.0;
    item.lastAccessed = (this.kernel?.turn || 0);
    
    return true;
  }
  
  /**
   * Get currently focused item
   * @returns {Object|null} Focused item or null
   */
  getFocused() {
    if (!this.attentionFocus) return null;
    return this.get(this.attentionFocus);
  }
  
  /**
   * Clear attention focus
   */
  clearFocus() {
    this.attentionFocus = null;
  }
  
  /**
   * Get all items in working memory
   * @returns {Array} Items sorted by activation
   */
  getAll() {
    return [...this.items].sort((a, b) => b.activation - a.activation);
  }
  
  /**
   * Get items by type
   * @param {string} type - Item type
   * @returns {Array} Matching items
   */
  getByType(type) {
    return this.items.filter(i => i.type === type);
  }
  
  /**
   * Check if item is in working memory
   * @param {string} itemId - Item ID
   * @returns {boolean} True if present
   */
  has(itemId) {
    return this.items.some(i => i.id === itemId);
  }
  
  /**
   * Rehearse item to maintain activation
   * @param {string} itemId - Item ID
   */
  rehearse(itemId) {
    const item = this.items.find(i => i.id === itemId);
    if (item) {
      item.activation = 1.0;
      item.lastAccessed = (this.kernel?.turn || 0);
    }
  }
  
  /**
   * Update working memory - decay items without attention
   * @param {number} deltaTime - Time elapsed in minutes
   */
  update(deltaTime) {
    const now = (this.kernel?.turn || 0);
    
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      
      // Items decay without attention
      if (item.id !== this.attentionFocus) {
        item.activation -= this.decayRate * deltaTime;
      }
      
      // Remove items with very low activation
      if (item.activation <= 0) {
        this.items.splice(i, 1);
      }
    }
  }
  
  /**
   * Clear all items from working memory
   */
  clear() {
    this.items = [];
    this.attentionFocus = null;
  }
  
  /**
   * Get capacity utilization
   * @returns {number} Utilization 0-1
   */
  getUtilization() {
    return this.items.length / this.capacity;
  }
  
  /**
   * Check if working memory is full
   * @returns {boolean} True if full
   */
  isFull() {
    return this.items.length >= this.capacity;
  }
  
  /**
   * Get available capacity
   * @returns {number} Available slots
   */
  getAvailableCapacity() {
    return Math.max(0, this.capacity - this.items.length);
  }
  
  /**
   * Consolidate item to long-term memory
   * @param {string} itemId - Item ID
   * @param {Object} longTermMemory - Long-term memory system
   * @returns {boolean} True if consolidated
   */
  consolidate(itemId, longTermMemory) {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return false;
    
    // Store in appropriate long-term memory system
    if (item.type === 'event' && longTermMemory.episodic) {
      longTermMemory.episodic.store(item);
    } else if (item.type === 'fact' && longTermMemory.semantic) {
      longTermMemory.semantic.learn(item.concept, item.properties);
    } else if (item.type === 'skill' && longTermMemory.procedural) {
      longTermMemory.procedural.practice(item.skill, item.category, item.quality, item.duration);
    }
    
    return true;
  }
  
  /**
   * Generate unique item ID
   * @returns {string} Item ID
   */
  generateItemId() {
    return `wm_${(this.kernel?.turn || 0)}_${this.rng.next().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get working memory statistics
   * @returns {Object} Statistics
   */
  getStats() {
    return {
      capacity: this.capacity,
      itemCount: this.items.length,
      utilization: this.getUtilization(),
      focused: this.attentionFocus !== null,
      averageActivation: this.items.reduce((sum, i) => sum + i.activation, 0) / this.items.length || 0
    };
  }
  
  /**
   * Serialize working memory
   * @returns {Object} Serialized data
   */
  serialize() {
    return {
      capacity: this.capacity,
      items: this.items,
      attentionFocus: this.attentionFocus,
      attentionCapacity: this.attentionCapacity
    };
  }
  
  /**
   * Deserialize working memory
   * @param {Object} data - Serialized data
   */
  deserialize(data) {
    this.capacity = data.capacity || 7;
    this.items = data.items || [];
    this.attentionFocus = data.attentionFocus || null;
    this.attentionCapacity = data.attentionCapacity || 1.0;
  }
}
