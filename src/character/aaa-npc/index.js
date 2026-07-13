/**
 * AAA NPC System
 * 
 * A comprehensive, AAA-quality NPC system for medieval life simulation.
 * 
 * Features:
 * - Advanced emotional modeling (Plutchik's Wheel + PAD model)
 * - Comprehensive stress and trauma tracking
 * - Multi-layered memory systems (episodic, semantic, procedural, working)
 * - Rich social dynamics (relationships, reputation, social networks)
 * - Economic motivation and career progression
 * - Hybrid decision-making (Utility AI + GOAP)
 * - Dynamic personality system with development
 * - Performance optimization with LOD system
 * 
 * @module aaa-npc
 */

export { AAANPC } from './AAANPC.js';

// Integration layer
export { NPCBridge, AAA_FEATURES } from './NPCBridge.js';

// Configuration
export { 
  AAAConfig, 
  DEFAULT_AAA_CONFIG, 
  AAA_PRESETS 
} from './config.js';

// Migration utilities
export { 
  MigrationEngine, 
  MigrationStatus, 
  MigrationValidator,
  MIGRATION_PRESETS,
  createMigrationEngine,
  migrateAll
} from './migration.js';

// Psychology subsystems
export { EmotionalState, StressSystem } from './psychology/index.js';

// Memory subsystems
export { 
  EpisodicMemory, 
  SemanticMemory, 
  ProceduralMemory, 
  WorkingMemory,
  MemorySystem 
} from './memory/index.js';

// Social subsystems
export { 
  Relationship, 
  ReputationSystem, 
  SocialNetwork,
  SocialSystem 
} from './social/index.js';

// Economic subsystems
export { EconomicMotivation } from './economic/index.js';

// Decision-making subsystems
export { 
  UtilityAI, 
  Action, 
  Consideration, 
  ConsiderationFactory,
  GOAPPlanner, 
  GOAPAction, 
  GOAPActionFactory, 
  Goal, 
  GoalManager,
  HybridDecisionSystem 
} from './decision/index.js';

// Personality subsystems
export { PersonalitySystem } from './personality/index.js';

export default AAANPC;
