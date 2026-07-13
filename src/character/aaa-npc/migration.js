/**
 * migration.js
 * 
 * Migration utilities for transitioning from legacy Person system to AAA NPC
 * Provides batch migration, validation, and rollback capabilities
 * 
 * @module migration
 */

import { NPCBridge, AAA_FEATURES } from './NPCBridge.js';
import { AAANPC } from './AAANPC.js';

/**
 * Migration status tracking
 */
export class MigrationStatus {
  constructor() {
    this.total = 0;
    this.migrated = 0;
    this.failed = 0;
    this.skipped = 0;
    this.errors = [];
    this.startTime = null;
    this.endTime = null;
  }
  
  start(total) {
    this.total = total;
    this.startTime = Date.now();
  }
  
  success() {
    this.migrated++;
  }
  
  fail(error) {
    this.failed++;
    this.errors.push(error);
  }
  
  skip(reason) {
    this.skipped++;
  }
  
  complete() {
    this.endTime = Date.now();
  }
  
  getProgress() {
    return {
      total: this.total,
      migrated: this.migrated,
      failed: this.failed,
      skipped: this.skipped,
      remaining: this.total - this.migrated - this.failed - this.skipped,
      percentage: this.total > 0 ? ((this.migrated + this.failed + this.skipped) / this.total * 100).toFixed(1) : 0,
      duration: this.endTime ? this.endTime - this.startTime : Date.now() - this.startTime,
      errors: this.errors
    };
  }
  
  getSummary() {
    const progress = this.getProgress();
    return `Migration: ${progress.migrated}/${progress.total} (${progress.percentage}%) - Failed: ${progress.failed}, Skipped: ${progress.skipped}, Duration: ${(progress.duration / 1000).toFixed(1)}s`;
  }
}

/**
 * Migration validator
 */
export class MigrationValidator {
  /**
   * Validate a Person before migration
   * @param {Person} person - Person to validate
   * @returns {Object} Validation result
   */
  static validatePerson(person) {
    const errors = [];
    const warnings = [];
    
    if (!person) {
      errors.push('Person is null or undefined');
      return { valid: false, errors, warnings };
    }
    
    if (!person.id) {
      errors.push('Person missing ID');
    }
    
    if (!person.name) {
      warnings.push('Person missing name');
    }
    
    if (person.age === undefined || person.age === null) {
      warnings.push('Person missing age');
    }
    
    if (!person.sex) {
      warnings.push('Person missing sex');
    }
    
    if (!person.personality) {
      warnings.push('Person missing personality - will use defaults');
    }
    
    if (!person.memory) {
      warnings.push('Person missing memory - will create new');
    }
    
    if (!person.needs) {
      errors.push('Person missing needs');
    }
    
    if (!person.physiology) {
      errors.push('Person missing physiology');
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
  
  /**
   * Validate migrated data
   * @param {Person} person - Original person
   * @param {NPCBridge} bridge - Migrated bridge
   * @returns {Object} Validation result
   */
  static validateMigration(person, bridge) {
    const errors = [];
    const warnings = [];
    
    if (!bridge) {
      errors.push('Bridge is null');
      return { valid: false, errors, warnings };
    }
    
    if (!bridge.aaaNPC) {
      errors.push('AAA NPC not created');
      return { valid: false, errors, warnings };
    }
    
    const aaa = bridge.aaaNPC;
    
    // Validate basic data transfer
    if (aaa.id !== person.id) {
      errors.push(`ID mismatch: ${aaa.id} !== ${person.id}`);
    }
    
    if (aaa.name !== person.name) {
      warnings.push(`Name mismatch: ${aaa.name} !== ${person.name}`);
    }
    
    if (Math.abs(aaa.age - person.age) > 1) {
      warnings.push(`Age mismatch: ${aaa.age} !== ${person.age}`);
    }
    
    // Validate needs transfer
    if (Math.abs(aaa.needs.hunger - person.needs.hunger) > 0.1) {
      warnings.push('Hunger not properly transferred');
    }
    
    if (Math.abs(aaa.needs.thirst - person.needs.thirst) > 0.1) {
      warnings.push('Thirst not properly transferred');
    }
    
    if (Math.abs(aaa.needs.sleep - person.needs.sleep) > 0.1) {
      warnings.push('Sleep not properly transferred');
    }
    
    // Validate personality transfer
    if (person.personality && aaa.personality) {
      const traits = aaa.personality.traits;
      if (Math.abs(traits.openness - person.personality.openness) > 0.1) {
        warnings.push('Openness not properly transferred');
      }
      if (Math.abs(traits.conscientiousness - person.personality.conscientiousness) > 0.1) {
        warnings.push('Conscientiousness not properly transferred');
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }
}

/**
 * Migration engine
 */
export class MigrationEngine {
  constructor(config = {}) {
    this.config = {
      batchSize: config.batchSize || 100,
      validateBefore: config.validateBefore !== false,
      validateAfter: config.validateAfter !== false,
      preserveLegacy: config.preserveLegacy !== false,
      enabledFeatures: config.enabledFeatures || [],
      syncInterval: config.syncInterval || 60,
      lodDistance: config.lodDistance,
      logProgress: config.logProgress !== false,
      stopOnError: config.stopOnError || false
    };
    
    this.status = new MigrationStatus();
    this.backups = new Map();
  }
  
  /**
   * Migrate a single Person to AAA NPC
   * @param {Person} person - Person to migrate
   * @returns {Object} Migration result
   */
  migratePerson(person) {
    // Validate before migration
    if (this.config.validateBefore) {
      const validation = MigrationValidator.validatePerson(person);
      if (!validation.valid) {
        return {
          success: false,
          person,
          errors: validation.errors,
          warnings: validation.warnings
        };
      }
    }
    
    // Backup original state if preserving legacy
    if (this.config.preserveLegacy) {
      this.backups.set(person.id, this.backupPerson(person));
    }
    
    try {
      // Create AAA bridge
      const bridge = new NPCBridge(person, {
        enabledFeatures: this.config.enabledFeatures,
        syncInterval: this.config.syncInterval,
        lodDistance: this.config.lodDistance
      });
      
      // Attach to person
      person.aaaBridge = bridge;
      
      // Validate after migration
      if (this.config.validateAfter) {
        const validation = MigrationValidator.validateMigration(person, bridge);
        if (!validation.valid) {
          // Rollback on validation failure
          if (this.config.preserveLegacy) {
            this.rollbackPerson(person);
          }
          return {
            success: false,
            person,
            bridge: null,
            errors: validation.errors,
            warnings: validation.warnings
          };
        }
        
        return {
          success: true,
          person,
          bridge,
          errors: [],
          warnings: validation.warnings
        };
      }
      
      return {
        success: true,
        person,
        bridge,
        errors: [],
        warnings: []
      };
      
    } catch (error) {
      // Rollback on exception
      if (this.config.preserveLegacy) {
        this.rollbackPerson(person);
      }
      
      return {
        success: false,
        person,
        bridge: null,
        errors: [error.message],
        warnings: []
      };
    }
  }
  
  /**
   * Migrate multiple people in batches
   * @param {Array<Person>} people - People to migrate
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<MigrationStatus>} Migration status
   */
  async migrateBatch(people, onProgress = null) {
    this.status = new MigrationStatus();
    this.status.start(people.length);
    
    const batchSize = this.config.batchSize;
    
    for (let i = 0; i < people.length; i += batchSize) {
      const batch = people.slice(i, Math.min(i + batchSize, people.length));
      
      for (const person of batch) {
        const result = this.migratePerson(person);
        
        if (result.success) {
          this.status.success();
        } else {
          this.status.fail({
            personId: person.id,
            personName: person.name,
            errors: result.errors,
            warnings: result.warnings
          });
          
          if (this.config.stopOnError) {
            this.status.complete();
            return this.status;
          }
        }
        
        if (onProgress) {
          onProgress(this.status.getProgress());
        }
      }
      
      // Yield to event loop between batches
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    this.status.complete();
    
    if (this.config.logProgress) {
      console.log(this.status.getSummary());
    }
    
    return this.status;
  }
  
  /**
   * Backup person state
   * @param {Person} person - Person to backup
   * @returns {Object} Backup data
   */
  backupPerson(person) {
    return {
      id: person.id,
      name: person.name,
      age: person.age,
      sex: person.sex,
      personality: person.personality ? { ...person.personality } : null,
      needs: person.needs ? { ...person.needs } : null,
      memory: person.memory ? this.backupMemory(person.memory) : null,
      relationships: person.relationships ? new Map(person.relationships) : null,
      marriage: person.marriage,
      kinship: person.kinship ? { ...person.kinship } : null,
      goals: person.goals ? [...person.goals] : null,
      currentAction: person.currentAction ? { ...person.currentAction } : null,
      aaaBridge: null // Don't backup the bridge itself
    };
  }
  
  /**
   * Backup memory state
   * @param {Object} memory - Memory to backup
   * @returns {Object} Backup data
   */
  backupMemory(memory) {
    return {
      events: memory.events ? [...memory.events] : [],
      head: memory.head,
      size: memory.size,
      knowledge: memory.knowledge ? new Map(memory.knowledge) : new Map(),
      relationships: memory.relationships ? new Map(memory.relationships) : new Map()
    };
  }
  
  /**
   * Rollback person to backup state
   * @param {Person} person - Person to rollback
   * @returns {boolean} Success
   */
  rollbackPerson(person) {
    const backup = this.backups.get(person.id);
    if (!backup) return false;
    
    person.name = backup.name;
    person.age = backup.age;
    person.sex = backup.sex;
    person.personality = backup.personality;
    person.needs = backup.needs;
    person.memory = backup.memory;
    person.relationships = backup.relationships;
    person.marriage = backup.marriage;
    person.kinship = backup.kinship;
    person.goals = backup.goals;
    person.currentAction = backup.currentAction;
    person.aaaBridge = null;
    
    return true;
  }
  
  /**
   * Rollback all migrations
   * @param {Array<Person>} people - People to rollback
   * @returns {number} Number rolled back
   */
  rollbackAll(people) {
    let count = 0;
    
    for (const person of people) {
      if (this.rollbackPerson(person)) {
        count++;
      }
    }
    
    return count;
  }
  
  /**
   * Clear backups
   */
  clearBackups() {
    this.backups.clear();
  }
  
  /**
   * Get migration statistics
   * @returns {Object} Statistics
   */
  getStatistics() {
    return {
      status: this.status.getProgress(),
      backupsStored: this.backups.size,
      memoryUsage: this.estimateMemoryUsage()
    };
  }
  
  /**
   * Estimate memory usage of backups
   * @returns {number} Estimated bytes
   */
  estimateMemoryUsage() {
    // Rough estimate: ~10KB per backup
    return this.backups.size * 10240;
  }
}

/**
 * Migration presets for common scenarios
 */
export const MIGRATION_PRESETS = {
  // Safe migration - full validation, preserve legacy
  safe: {
    batchSize: 50,
    validateBefore: true,
    validateAfter: true,
    preserveLegacy: true,
    stopOnError: true,
    logProgress: true
  },
  
  // Fast migration - minimal validation
  fast: {
    batchSize: 200,
    validateBefore: false,
    validateAfter: false,
    preserveLegacy: false,
    stopOnError: false,
    logProgress: true
  },
  
  // Balanced migration
  balanced: {
    batchSize: 100,
    validateBefore: true,
    validateAfter: true,
    preserveLegacy: true,
    stopOnError: false,
    logProgress: true
  },
  
  // Testing migration - stop on first error
  testing: {
    batchSize: 10,
    validateBefore: true,
    validateAfter: true,
    preserveLegacy: true,
    stopOnError: true,
    logProgress: true
  }
};

/**
 * Create migration engine with preset
 * @param {string} presetName - Preset name
 * @param {Object} overrides - Config overrides
 * @returns {MigrationEngine} Migration engine
 */
export function createMigrationEngine(presetName = 'balanced', overrides = {}) {
  const preset = MIGRATION_PRESETS[presetName];
  if (!preset) {
    throw new Error(`Unknown migration preset: ${presetName}`);
  }
  
  return new MigrationEngine({ ...preset, ...overrides });
}

/**
 * Quick migration helper
 * @param {Array<Person>} people - People to migrate
 * @param {Object} config - Migration config
 * @returns {Promise<MigrationStatus>} Migration status
 */
export async function migrateAll(people, config = {}) {
  const engine = new MigrationEngine(config);
  return await engine.migrateBatch(people, (progress) => {
    if (config.onProgress) {
      config.onProgress(progress);
    }
  });
}

export default {
  MigrationEngine,
  MigrationStatus,
  MigrationValidator,
  MIGRATION_PRESETS,
  createMigrationEngine,
  migrateAll
};
