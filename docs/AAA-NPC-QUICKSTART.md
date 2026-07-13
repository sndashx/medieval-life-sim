# AAA NPC Quick Start Guide

## Overview

The AAA (Advanced AI Architecture) NPC system provides rich psychological modeling, memory systems, and decision-making for NPCs. It's currently **disabled by default** to maintain backward compatibility.

## Enabling AAA NPCs

### Option 1: Use a Preset (Recommended)

```javascript
import { Game } from './src/Game.js';

const game = new Game(12345, null, {
  aaaPreset: 'narrative'  // or 'balanced', 'performance', 'minimal'
});
```

### Option 2: Custom Configuration

```javascript
const game = new Game(12345, null, {
  aaaConfig: {
    enableAAA: true,
    aaaFeatures: ['memory', 'emotions', 'decisions'],
    aaaSyncInterval: 60,
    lodDistance: {
      active: 50,
      regional: 200,
      distant: 500
    }
  }
});
```

## Presets

### `narrative` (Recommended for Story-Rich Games)
- Full memory system (episodic, semantic, procedural)
- Rich emotional modeling
- Advanced decision-making (GOAP + Utility AI)
- Social relationships and reputation
- **Performance**: Medium (suitable for 100-500 NPCs)

### `balanced` (Default Recommended)
- Core memory features
- Basic emotions and stress
- Utility AI decisions
- **Performance**: Good (suitable for 500-1000 NPCs)

### `performance` (Large Populations)
- Minimal memory (working memory only)
- Simplified emotions
- Fast decision-making
- **Performance**: Excellent (suitable for 1000+ NPCs)

### `minimal` (Maximum Performance)
- No memory system
- Basic needs only
- Legacy decision-making
- **Performance**: Maximum (suitable for 5000+ NPCs)

## Feature Flags

Individual features can be enabled/disabled:

```javascript
import { AAA_FEATURES } from './src/character/aaa-npc/NPCBridge.js';

const game = new Game(12345, null, {
  aaaConfig: {
    enableAAA: true,
    aaaFeatures: [
      AAA_FEATURES.MEMORY,      // Episodic/semantic/procedural memory
      AAA_FEATURES.EMOTIONS,    // Emotional state and regulation
      AAA_FEATURES.STRESS,      // Stress and trauma modeling
      AAA_FEATURES.SOCIAL,      // Relationships and reputation
      AAA_FEATURES.DECISIONS,   // Advanced decision-making
      AAA_FEATURES.PERSONALITY, // Personality development
      AAA_FEATURES.ECONOMIC     // Economic motivation
    ]
  }
});
```

## Migration from Legacy NPCs

To migrate existing NPCs to AAA:

```javascript
import { createMigrationEngine } from './src/character/aaa-npc/migration.js';

// Safe migration with validation
const engine = createMigrationEngine('safe');
const status = await engine.migrateBatch(game.kernel.alivePeople);

console.log(status.getSummary());
// Migration: 450/500 (90%) - Failed: 5, Skipped: 45
```

## Performance Considerations

### Population Scaling

| Population | Recommended Preset | Expected Performance |
|------------|-------------------|---------------------|
| < 100      | narrative         | Excellent           |
| 100-500    | narrative/balanced| Good                |
| 500-1000   | balanced          | Good                |
| 1000-2000  | performance       | Acceptable          |
| 2000+      | minimal           | Good                |

### Memory Impact

AAA NPCs store more data per NPC:
- **Legacy NPC**: ~2KB per save
- **AAA NPC (minimal)**: ~5KB per save
- **AAA NPC (narrative)**: ~15KB per save

For 500 NPCs with narrative preset: ~7.5MB additional save data

## Determinism

AAA NPCs are **fully deterministic** when using the kernel's RNG:
- Same seed = same behavior
- Replays work correctly
- Multiplayer-safe (if implemented)

## Current Limitations

1. **Not enabled by default** - Must explicitly opt-in
2. **Save compatibility** - Schema version 3+ required
3. **Test coverage** - Integration tests exist but need CI setup
4. **Documentation** - API docs in progress

## Next Steps

1. **Enable in your game**: Choose a preset and test
2. **Monitor performance**: Use `game.kernel.getStats()` to track
3. **Adjust as needed**: Switch presets or disable features
4. **Report issues**: File bugs with reproduction steps

## Example: Story-Rich RPG

```javascript
// Create game with rich NPC personalities
const game = new Game(Date.now(), {
  worldSize: { width: 100, height: 100 },
  settlements: 3,
  populationMax: 200
}, {
  aaaPreset: 'narrative'
});

// NPCs will now:
// - Remember past interactions
// - Develop relationships
// - Show emotional responses
// - Make complex decisions
// - Develop personalities over time

// Access NPC state
const npc = game.kernel.alivePeople.values().next().value;
if (npc.aaaBridge) {
  const status = npc.aaaBridge.getStatus();
  console.log(`${npc.name} feels ${status.emotion} (mood: ${status.mood})`);
  
  const memories = npc.aaaBridge.aaaNPC.memory.episodic.getRecentMemories(5);
  console.log(`Recent memories:`, memories);
}
```

## Support

- **Documentation**: See `/docs/AAA-NPC-INTEGRATION.md`
- **Examples**: See `/tests/aaa-integration.test.js`
- **Issues**: File on GitHub with `[AAA]` prefix
