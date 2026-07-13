# AAA NPC System Integration Guide

## Overview

The AAA NPC system provides advanced AI capabilities for NPCs in the medieval life simulation. It includes:

- **Advanced Psychology**: Emotional modeling, stress tracking, trauma responses
- **Multi-layered Memory**: Episodic, semantic, procedural, and working memory
- **Rich Social Dynamics**: Relationships, reputation, social networks
- **Economic Motivation**: Career progression, wealth management
- **Hybrid Decision-Making**: Utility AI + GOAP planning
- **Dynamic Personality**: Trait development over lifetime
- **Performance Optimization**: Level-of-Detail (LOD) system

## Quick Start

### Enabling AAA NPCs

```javascript
import { Game } from './src/Game.js';

// Option 1: Use a preset configuration
const game = new Game(seed, worldConfig, {
  aaaPreset: 'balanced'  // 'minimal', 'balanced', 'full', 'performance', 'narrative'
});

// Option 2: Custom configuration
const game = new Game(seed, worldConfig, {
  aaaConfig: {
    enableAAA: true,
    aaaFeatures: ['aaa_personality', 'aaa_emotions', 'aaa_memory'],
    aaaSyncInterval: 60,
    migration: {
      autoMigrate: true,
      preserveLegacy: true
    }
  }
});
```

### Configuration Presets

#### Minimal
- **Features**: Personality only
- **Use Case**: Testing, minimal overhead
- **Performance**: Excellent

#### Balanced (Recommended)
- **Features**: Personality, Emotions, Memory, Social
- **Use Case**: General gameplay
- **Performance**: Good

#### Full
- **Features**: All AAA systems enabled
- **Use Case**: Maximum immersion
- **Performance**: Moderate

#### Performance
- **Features**: Personality, Decisions
- **Use Case**: Large populations (1000+ NPCs)
- **Performance**: Optimized

#### Narrative
- **Features**: All systems with enhanced memory
- **Use Case**: Story-focused gameplay
- **Performance**: Moderate

## Feature Flags

Individual features can be enabled/disabled:

```javascript
import { AAA_FEATURES } from './src/character/aaa-npc/NPCBridge.js';

const config = {
  enableAAA: true,
  aaaFeatures: [
    AAA_FEATURES.PERSONALITY,  // Dynamic personality traits
    AAA_FEATURES.EMOTIONS,     // Emotional reactions
    AAA_FEATURES.STRESS,       // Stress and trauma
    AAA_FEATURES.MEMORY,       // Advanced memory systems
    AAA_FEATURES.SOCIAL,       // Social dynamics
    AAA_FEATURES.ECONOMIC,     // Economic motivation
    AAA_FEATURES.DECISIONS,    // Hybrid decision-making
    AAA_FEATURES.FULL          // Enable all features
  ]
};
```

## Migration

### Automatic Migration

Enable automatic migration during game initialization:

```javascript
const game = new Game(seed, worldConfig, {
  aaaPreset: 'balanced',
  aaaConfig: {
    migration: {
      autoMigrate: true,        // Migrate on initialization
      preserveLegacy: true,     // Keep backup of original data
      migrationBatchSize: 100,  // NPCs per batch
      logMigration: true        // Log progress
    }
  }
});
```

### Manual Migration

```javascript
import { createMigrationEngine } from './src/character/aaa-npc/migration.js';

// Create migration engine
const engine = createMigrationEngine('balanced', {
  enabledFeatures: ['aaa_personality', 'aaa_emotions'],
  syncInterval: 60
});

// Migrate all NPCs
const npcs = Array.from(game.kernel.entities.values())
  .filter(e => e.isPerson && !e.isPlayer);

const status = await engine.migrateBatch(npcs, (progress) => {
  console.log(`Progress: ${progress.percentage}%`);
});

console.log(status.getSummary());
```

### Migration Presets

- **safe**: Full validation, preserve legacy, stop on error
- **fast**: Minimal validation, no backups
- **balanced**: Good mix of safety and speed
- **testing**: Stop on first error for debugging

## Configuration Options

### Performance Settings

```javascript
{
  aaaSyncInterval: 60,  // Sync AAA state to Person every N ticks
  lodDistance: {
    high: 50,      // Full processing within 50 tiles
    medium: 200,   // Reduced processing within 200 tiles
    low: 500,      // Minimal processing within 500 tiles
    minimal: Infinity  // State preservation only
  }
}
```

### Memory Settings

```javascript
{
  memoryConfig: {
    episodicCapacity: 1000,      // Max episodic memories
    semanticCapacity: 500,       // Max semantic memories
    proceduralCapacity: 100,     // Max procedural memories
    workingCapacity: 7,          // Working memory slots (5-9 recommended)
    consolidationInterval: 1440, // Consolidate every day (minutes)
    forgettingCurve: 'ebbinghaus' // 'ebbinghaus' or 'power'
  }
}
```

### Personality Settings

```javascript
{
  personalityConfig: {
    enableDevelopment: true,  // Allow personality changes
    developmentRate: 0.001,   // How fast traits change
    stabilityAge: 25,         // Age when personality stabilizes
    maxTraitChange: 0.3       // Maximum lifetime change
  }
}
```

### Emotional Settings

```javascript
{
  emotionalConfig: {
    decayRate: 0.1,              // Emotion decay per minute
    moodInertia: 0.8,            // Mood resistance to change (0-1)
    emotionalMemoryBoost: 2.0    // Importance multiplier for emotional memories
  }
}
```

### Social Settings

```javascript
{
  socialConfig: {
    maxRelationships: 150,        // Dunbar's number
    relationshipDecay: 0.001,     // Decay per minute without interaction
    reputationSpread: 0.5,        // How fast reputation spreads (0-1)
    networkUpdateInterval: 60     // Update social network every N ticks
  }
}
```

### Decision Settings

```javascript
{
  decisionConfig: {
    planningHorizon: 1440,    // Plan ahead N minutes (1 day)
    replanInterval: 60,       // Replan every N ticks
    utilityThreshold: 0.3,    // Minimum utility to consider action
    goapMaxDepth: 5,          // Maximum GOAP search depth
    goapMaxNodes: 100         // Maximum GOAP nodes to explore
  }
}
```

## Accessing AAA Features

### From Person Instance

```javascript
const person = game.kernel.entities.get(personId);

// Check if AAA is enabled
if (person.aaaBridge) {
  // Get personality
  const personality = person.aaaBridge.getPersonality();
  console.log(personality.traits.openness);
  
  // Get emotional state
  const emotions = person.aaaBridge.getEmotionalState();
  console.log(emotions.dominant); // Current dominant emotion
  
  // Get stress level
  const stress = person.aaaBridge.getStressLevel();
  console.log(`Stress: ${(stress * 100).toFixed(0)}%`);
  
  // React to event
  const reaction = person.aaaBridge.reactToEvent({
    type: 'social_rejection',
    severity: 0.7,
    source: 'friend_betrayal'
  });
}
```

### Direct AAA NPC Access

```javascript
if (person.aaaBridge && person.aaaBridge.aaaNPC) {
  const aaa = person.aaaBridge.aaaNPC;
  
  // Access memory systems
  const recentMemories = aaa.memory.episodic.getRecent(10);
  
  // Access social network
  const friends = aaa.social.getFriends();
  
  // Access economic motivation
  const careerGoals = aaa.economicMotivation.getCareerGoals();
}
```

## Performance Optimization

### Level of Detail (LOD)

The system automatically adjusts processing based on distance from player:

- **High LOD** (< 50 tiles): Full AI processing
- **Medium LOD** (< 200 tiles): Essential systems only
- **Low LOD** (< 500 tiles): Minimal processing
- **Minimal LOD** (> 500 tiles): State preservation only

### Manual LOD Control

```javascript
// Force specific LOD level
if (person.aaaBridge && person.aaaBridge.aaaNPC) {
  person.aaaBridge.aaaNPC.setLOD('medium');
}
```

### Sync Interval

Control how often AAA state syncs back to Person:

```javascript
{
  aaaSyncInterval: 120  // Sync every 120 ticks (less frequent = better performance)
}
```

## Save/Load

AAA state is automatically saved and restored:

```javascript
// Save
const saveData = game.save();
// saveData.aaaConfig contains configuration
// saveData.kernel.entities contains Person data with aaaBridge

// Load
game.load(saveData);
// AAA bridges are automatically restored
```

## Troubleshooting

### NPCs Not Using AAA Features

**Problem**: NPCs behave like legacy NPCs despite AAA being enabled.

**Solution**:
1. Check if `enableAAA` is true in config
2. Verify features are in `aaaFeatures` array
3. Ensure migration ran successfully
4. Check console for migration errors

### Performance Issues

**Problem**: Game runs slowly with AAA enabled.

**Solution**:
1. Use 'performance' preset
2. Increase `aaaSyncInterval` to 120+
3. Reduce LOD distances
4. Disable unused features
5. Reduce memory capacities

### Migration Failures

**Problem**: Some NPCs fail to migrate.

**Solution**:
1. Check migration errors in console
2. Use 'safe' migration preset
3. Enable `logMigration` for details
4. Validate NPC data before migration

### Memory Leaks

**Problem**: Memory usage grows over time.

**Solution**:
1. Reduce memory capacities
2. Increase consolidation interval
3. Enable forgetting curve
4. Clear old memories periodically

## Examples

### Example 1: Minimal Setup

```javascript
const game = new Game(12345, null, {
  aaaPreset: 'minimal'
});

game.initialize();
```

### Example 2: Full Features with Custom Config

```javascript
const game = new Game(12345, null, {
  aaaConfig: {
    enableAAA: true,
    aaaFeatures: ['aaa_full'],
    aaaSyncInterval: 30,
    lodDistance: {
      high: 100,
      medium: 300,
      low: 800,
      minimal: Infinity
    },
    memoryConfig: {
      episodicCapacity: 2000,
      emotionalMemoryBoost: 3.0
    },
    migration: {
      autoMigrate: true,
      preset: 'safe'
    }
  }
});

game.initialize();
```

### Example 3: Gradual Feature Rollout

```javascript
// Start with personality only
const game = new Game(12345, null, {
  aaaConfig: {
    enableAAA: true,
    aaaFeatures: ['aaa_personality']
  }
});

game.initialize();

// Later, enable emotions
game.aaaConfig.enableFeature('aaa_emotions');

// Migrate existing NPCs to use new feature
const npcs = Array.from(game.kernel.entities.values())
  .filter(e => e.isPerson && !e.isPlayer);

for (const npc of npcs) {
  if (npc.aaaBridge) {
    npc.aaaBridge.enableFeature('aaa_emotions');
  }
}
```

### Example 4: Custom Migration

```javascript
import { MigrationEngine } from './src/character/aaa-npc/migration.js';

const engine = new MigrationEngine({
  batchSize: 50,
  validateBefore: true,
  validateAfter: true,
  preserveLegacy: true,
  enabledFeatures: ['aaa_personality', 'aaa_emotions'],
  stopOnError: false
});

const npcs = Array.from(game.kernel.entities.values())
  .filter(e => e.isPerson && !e.isPlayer);

const status = await engine.migrateBatch(npcs, (progress) => {
  console.log(`Migrated: ${progress.migrated}/${progress.total}`);
  console.log(`Failed: ${progress.failed}`);
  console.log(`Progress: ${progress.percentage}%`);
});

console.log(status.getSummary());

if (status.failed > 0) {
  console.log('Failed NPCs:', status.errors);
  
  // Rollback if needed
  engine.rollbackAll(npcs);
}
```

## Best Practices

1. **Start Small**: Begin with 'minimal' or 'balanced' preset
2. **Monitor Performance**: Watch frame rate and memory usage
3. **Gradual Rollout**: Enable features incrementally
4. **Test Migration**: Use 'testing' preset first
5. **Preserve Legacy**: Keep backups during migration
6. **Tune LOD**: Adjust distances based on world size
7. **Profile**: Use browser dev tools to identify bottlenecks
8. **Batch Operations**: Process NPCs in batches, not all at once

## API Reference

See individual module documentation:
- [NPCBridge](./src/character/aaa-npc/NPCBridge.js)
- [AAAConfig](./src/character/aaa-npc/config.js)
- [MigrationEngine](./src/character/aaa-npc/migration.js)
- [AAANPC](./src/character/aaa-npc/AAANPC.js)

## Support

For issues or questions:
1. Check console for error messages
2. Enable debug logging in config
3. Review migration status
4. Validate configuration
5. Check compatibility with other systems
