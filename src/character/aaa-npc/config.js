/**
 * config.js
 * 
 * Configuration system for AAA NPC features
 * Provides feature flags, performance settings, and migration options
 * 
 * @module config
 */

import { AAA_FEATURES } from './NPCBridge.js';

/**
 * Default AAA NPC configuration
 */
export const DEFAULT_AAA_CONFIG = {
  // Feature flags - enable/disable specific AAA systems
  enableAAA: false, // Master switch
  aaaFeatures: [], // Array of enabled features from AAA_FEATURES
  
  // Performance settings
  aaaSyncInterval: 60, // Sync AAA state to Person every N ticks
  lodDistance: {
    high: 50,      // Full AAA processing within 50 tiles
    medium: 200,   // Reduced processing within 200 tiles
    low: 500,      // Minimal processing within 500 tiles
    minimal: Infinity // State preservation only beyond 500 tiles
  },
  
  // Memory settings
  memoryConfig: {
    episodicCapacity: 1000,
    semanticCapacity: 500,
    proceduralCapacity: 100,
    workingCapacity: 7,
    consolidationInterval: 1440, // Consolidate memories every day (1440 minutes)
    forgettingCurve: 'ebbinghaus' // 'ebbinghaus' or 'power'
  },
  
  // Personality settings
  personalityConfig: {
    enableDevelopment: true,
    developmentRate: 0.001, // How fast traits change
    stabilityAge: 25, // Age at which personality becomes more stable
    maxTraitChange: 0.3 // Maximum trait change over lifetime
  },
  
  // Emotional settings
  emotionalConfig: {
    decayRate: 0.1, // How fast emotions decay per minute
    moodInertia: 0.8, // How much mood resists change (0-1)
    emotionalMemoryBoost: 2.0 // Multiplier for emotional memory importance
  },
  
  // Social settings
  socialConfig: {
    maxRelationships: 150, // Dunbar's number
    relationshipDecay: 0.001, // Decay per minute without interaction
    reputationSpread: 0.5, // How fast reputation spreads (0-1)
    networkUpdateInterval: 60 // Update social network every N ticks
  },
  
  // Decision settings
  decisionConfig: {
    planningHorizon: 1440, // Plan ahead N minutes (1 day)
    replanInterval: 60, // Replan every N ticks
    utilityThreshold: 0.3, // Minimum utility to consider action
    goapMaxDepth: 5, // Maximum GOAP search depth
    goapMaxNodes: 100 // Maximum GOAP nodes to explore
  },
  
  // Migration settings
  migration: {
    autoMigrate: false, // Automatically migrate legacy data
    preserveLegacy: true, // Keep legacy data alongside AAA data
    migrationBatchSize: 100, // Migrate N NPCs per tick
    logMigration: true // Log migration progress
  },
  
  // Debug settings
  debug: {
    logDecisions: false,
    logEmotions: false,
    logMemory: false,
    logSocial: false,
    logPerformance: false
  }
};

/**
 * Preset configurations for different use cases
 */
export const AAA_PRESETS = {
  // Minimal - Only essential features for testing
  minimal: {
    enableAAA: true,
    aaaFeatures: [AAA_FEATURES.PERSONALITY],
    aaaSyncInterval: 120,
    lodDistance: {
      high: 20,
      medium: 100,
      low: 300,
      minimal: Infinity
    }
  },
  
  // Balanced - Good mix of features and performance
  balanced: {
    enableAAA: true,
    aaaFeatures: [
      AAA_FEATURES.PERSONALITY,
      AAA_FEATURES.EMOTIONS,
      AAA_FEATURES.MEMORY,
      AAA_FEATURES.SOCIAL
    ],
    aaaSyncInterval: 60,
    lodDistance: {
      high: 50,
      medium: 200,
      low: 500,
      minimal: Infinity
    }
  },
  
  // Full - All AAA features enabled
  full: {
    enableAAA: true,
    aaaFeatures: [AAA_FEATURES.FULL],
    aaaSyncInterval: 30,
    lodDistance: {
      high: 100,
      medium: 300,
      low: 800,
      minimal: Infinity
    }
  },
  
  // Performance - Optimized for large populations
  performance: {
    enableAAA: true,
    aaaFeatures: [
      AAA_FEATURES.PERSONALITY,
      AAA_FEATURES.DECISIONS
    ],
    aaaSyncInterval: 120,
    lodDistance: {
      high: 30,
      medium: 100,
      low: 300,
      minimal: Infinity
    },
    memoryConfig: {
      episodicCapacity: 500,
      semanticCapacity: 250,
      proceduralCapacity: 50,
      workingCapacity: 5,
      consolidationInterval: 2880
    }
  },
  
  // Narrative - Optimized for storytelling
  narrative: {
    enableAAA: true,
    aaaFeatures: [AAA_FEATURES.FULL],
    aaaSyncInterval: 30,
    memoryConfig: {
      episodicCapacity: 2000,
      semanticCapacity: 1000,
      proceduralCapacity: 200,
      workingCapacity: 10,
      consolidationInterval: 720,
      emotionalMemoryBoost: 3.0
    },
    emotionalConfig: {
      decayRate: 0.05,
      moodInertia: 0.9,
      emotionalMemoryBoost: 3.0
    },
    debug: {
      logDecisions: true,
      logEmotions: true
    }
  }
};

/**
 * Configuration manager
 */
export class AAAConfig {
  constructor(config = {}) {
    this.config = this.mergeConfig(DEFAULT_AAA_CONFIG, config);
  }
  
  /**
   * Merge user config with defaults
   * @param {Object} defaults - Default config
   * @param {Object} user - User config
   * @returns {Object} Merged config
   */
  mergeConfig(defaults, user) {
    const merged = { ...defaults };
    
    for (const key in user) {
      if (typeof user[key] === 'object' && !Array.isArray(user[key]) && user[key] !== null) {
        merged[key] = this.mergeConfig(defaults[key] || {}, user[key]);
      } else {
        merged[key] = user[key];
      }
    }
    
    return merged;
  }
  
  /**
   * Load a preset configuration
   * @param {string} presetName - Name of preset
   * @returns {AAAConfig} New config instance
   */
  static loadPreset(presetName) {
    const preset = AAA_PRESETS[presetName];
    if (!preset) {
      throw new Error(`Unknown preset: ${presetName}`);
    }
    return new AAAConfig(preset);
  }
  
  /**
   * Get configuration value
   * @param {string} path - Dot-separated path (e.g., 'memoryConfig.episodicCapacity')
   * @returns {*} Configuration value
   */
  get(path) {
    const parts = path.split('.');
    let value = this.config;
    
    for (const part of parts) {
      if (value === undefined || value === null) return undefined;
      value = value[part];
    }
    
    return value;
  }
  
  /**
   * Set configuration value
   * @param {string} path - Dot-separated path
   * @param {*} value - New value
   */
  set(path, value) {
    const parts = path.split('.');
    const last = parts.pop();
    let obj = this.config;
    
    for (const part of parts) {
      if (!(part in obj)) obj[part] = {};
      obj = obj[part];
    }
    
    obj[last] = value;
  }
  
  /**
   * Check if a feature is enabled
   * @param {string} feature - Feature flag
   * @returns {boolean} True if enabled
   */
  isFeatureEnabled(feature) {
    if (!this.config.enableAAA) return false;
    if (this.config.aaaFeatures.includes(AAA_FEATURES.FULL)) return true;
    return this.config.aaaFeatures.includes(feature);
  }
  
  /**
   * Enable a feature
   * @param {string} feature - Feature to enable
   */
  enableFeature(feature) {
    if (!this.config.enableAAA) {
      this.config.enableAAA = true;
    }
    if (!this.config.aaaFeatures.includes(feature)) {
      this.config.aaaFeatures.push(feature);
    }
  }
  
  /**
   * Disable a feature
   * @param {string} feature - Feature to disable
   */
  disableFeature(feature) {
    const index = this.config.aaaFeatures.indexOf(feature);
    if (index > -1) {
      this.config.aaaFeatures.splice(index, 1);
    }
    
    if (this.config.aaaFeatures.length === 0) {
      this.config.enableAAA = false;
    }
  }
  
  /**
   * Get all enabled features
   * @returns {Array<string>} Enabled features
   */
  getEnabledFeatures() {
    if (!this.config.enableAAA) return [];
    if (this.config.aaaFeatures.includes(AAA_FEATURES.FULL)) {
      return Object.values(AAA_FEATURES);
    }
    return [...this.config.aaaFeatures];
  }
  
  /**
   * Validate configuration
   * @returns {Object} Validation result
   */
  validate() {
    const errors = [];
    const warnings = [];
    
    // Check sync interval
    if (this.config.aaaSyncInterval < 1) {
      errors.push('aaaSyncInterval must be at least 1');
    }
    if (this.config.aaaSyncInterval < 30) {
      warnings.push('Low aaaSyncInterval may impact performance');
    }
    
    // Check LOD distances
    const lod = this.config.lodDistance;
    if (lod.high >= lod.medium) {
      errors.push('lodDistance.high must be less than lodDistance.medium');
    }
    if (lod.medium >= lod.low) {
      errors.push('lodDistance.medium must be less than lodDistance.low');
    }
    
    // Check memory capacities
    const mem = this.config.memoryConfig;
    if (mem.episodicCapacity < 100) {
      warnings.push('Low episodicCapacity may limit memory quality');
    }
    if (mem.workingCapacity < 5 || mem.workingCapacity > 9) {
      warnings.push('workingCapacity should be 5-9 (based on cognitive research)');
    }
    
    // Check personality settings
    const pers = this.config.personalityConfig;
    if (pers.developmentRate > 0.01) {
      warnings.push('High developmentRate may cause unrealistic personality changes');
    }
    if (pers.maxTraitChange > 0.5) {
      warnings.push('High maxTraitChange may cause unrealistic personality shifts');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Export configuration as JSON
   * @returns {string} JSON string
   */
  toJSON() {
    return JSON.stringify(this.config, null, 2);
  }
  
  /**
   * Import configuration from JSON
   * @param {string} json - JSON string
   * @returns {AAAConfig} New config instance
   */
  static fromJSON(json) {
    const config = JSON.parse(json);
    return new AAAConfig(config);
  }
  
  /**
   * Clone configuration
   * @returns {AAAConfig} Cloned config
   */
  clone() {
    return new AAAConfig(JSON.parse(JSON.stringify(this.config)));
  }
}

export default AAAConfig;
