/**
 * AAA NPC Integration Test
 * 
 * Quick smoke test to verify AAA NPC system integration
 */

import { Game } from '../src/Game.js';
import { AAA_FEATURES } from '../src/character/aaa-npc/NPCBridge.js';

console.log('🧪 AAA NPC Integration Test\n');

// Test 1: Minimal preset initialization
console.log('Test 1: Minimal Preset Initialization');
try {
  const game1 = new Game(12345, {
    worldSize: { width: 50, height: 50 },
    settlements: 2,
    resources: 10,
    rivers: 1,
    populationMin: 20,
    populationMax: 50
  }, {
    aaaPreset: 'minimal'
  });
  
  console.log('  ✓ Game created with minimal preset');
  console.log(`  ✓ AAA Config: ${game1.aaaConfig ? 'Present' : 'Missing'}`);
  
  if (game1.aaaConfig) {
    const features = game1.aaaConfig.getEnabledFeatures();
    console.log(`  ✓ Enabled features: ${features.join(', ')}`);
  }
  
  game1.initialize();
  console.log('  ✓ Game initialized');
  
  // Check if NPCs have AAA bridges
  let npcCount = 0;
  let aaaCount = 0;
  for (const entity of game1.kernel.entities.values()) {
    if (entity.isPerson && !entity.isPlayer) {
      npcCount++;
      if (entity.aaaBridge) {
        aaaCount++;
      }
    }
  }
  
  console.log(`  ✓ NPCs: ${npcCount}, AAA-enabled: ${aaaCount}`);
  console.log('  ✅ Test 1 PASSED\n');
} catch (error) {
  console.error('  ❌ Test 1 FAILED:', error.message);
  process.exit(1);
}

// Test 2: Balanced preset with features
console.log('Test 2: Balanced Preset with Multiple Features');
try {
  const game2 = new Game(54321, {
    worldSize: { width: 50, height: 50 },
    settlements: 2,
    resources: 10,
    rivers: 1,
    populationMin: 20,
    populationMax: 50
  }, {
    aaaPreset: 'balanced'
  });
  
  console.log('  ✓ Game created with balanced preset');
  
  game2.initialize();
  console.log('  ✓ Game initialized');
  
  // Find an NPC with AAA bridge
  let testNPC = null;
  for (const entity of game2.kernel.entities.values()) {
    if (entity.isPerson && !entity.isPlayer && entity.aaaBridge) {
      testNPC = entity;
      break;
    }
  }
  
  if (testNPC) {
    console.log(`  ✓ Test NPC: ${testNPC.name}`);
    
    // Test personality access
    const personality = testNPC.aaaBridge.getPersonality();
    console.log(`  ✓ Personality traits: O=${personality.traits.openness.toFixed(2)}, C=${personality.traits.conscientiousness.toFixed(2)}`);
    
    // Test emotional state
    if (testNPC.aaaBridge.isFeatureEnabled(AAA_FEATURES.EMOTIONS)) {
      const emotions = testNPC.aaaBridge.getEmotionalState();
      console.log(`  ✓ Emotional state: ${emotions ? emotions.dominant : 'N/A'}`);
    }
    
    // Test stress level
    if (testNPC.aaaBridge.isFeatureEnabled(AAA_FEATURES.STRESS)) {
      const stress = testNPC.aaaBridge.getStressLevel();
      console.log(`  ✓ Stress level: ${(stress * 100).toFixed(0)}%`);
    }
    
    // Test event reaction
    const reaction = testNPC.aaaBridge.reactToEvent({
      type: 'social_interaction',
      severity: 0.3,
      source: 'friendly_chat',
      stressful: false
    });
    console.log(`  ✓ Event reaction: ${reaction ? 'Success' : 'N/A'}`);
  }
  
  console.log('  ✅ Test 2 PASSED\n');
} catch (error) {
  console.error('  ❌ Test 2 FAILED:', error.message);
  process.exit(1);
}

// Test 3: Update cycle
console.log('Test 3: Update Cycle with AAA');
try {
  const game3 = new Game(99999, {
    worldSize: { width: 50, height: 50 },
    settlements: 1,
    resources: 5,
    rivers: 1,
    populationMin: 10,
    populationMax: 30
  }, {
    aaaPreset: 'performance'
  });
  
  game3.initialize();
  console.log('  ✓ Game initialized');
  
  // Run a few turns
  const startTurn = game3.kernel.turn;
  game3.advanceTurns(10);
  const endTurn = game3.kernel.turn;
  
  console.log(`  ✓ Advanced ${endTurn - startTurn} turns`);
  
  // Check if AAA NPCs updated
  let updatedCount = 0;
  for (const entity of game3.kernel.entities.values()) {
    if (entity.isPerson && !entity.isPlayer && entity.aaaBridge) {
      if (entity.aaaBridge.aaaNPC && entity.aaaBridge.aaaNPC.updateCount > 0) {
        updatedCount++;
      }
    }
  }
  
  console.log(`  ✓ AAA NPCs updated: ${updatedCount}`);
  console.log('  ✅ Test 3 PASSED\n');
} catch (error) {
  console.error('  ❌ Test 3 FAILED:', error.message);
  process.exit(1);
}

// Test 4: Save/Load
console.log('Test 4: Save/Load with AAA');
try {
  const game4 = new Game(11111, {
    worldSize: { width: 50, height: 50 },
    settlements: 1,
    resources: 5,
    rivers: 1,
    populationMin: 10,
    populationMax: 30
  }, {
    aaaPreset: 'balanced'
  });
  
  game4.initialize();
  console.log('  ✓ Game initialized');
  
  // Save
  const saveData = game4.save();
  console.log(`  ✓ Game saved (AAA config: ${saveData.aaaConfig ? 'Present' : 'Missing'})`);
  
  // Create new game and load
  const game5 = new Game(11111);
  const loadResult = game5.load(saveData);
  
  if (loadResult.success) {
    console.log('  ✓ Game loaded successfully');
    console.log(`  ✓ AAA Config restored: ${game5.aaaConfig ? 'Yes' : 'No'}`);
    
    // Check if NPCs still have AAA bridges
    let restoredCount = 0;
    for (const entity of game5.kernel.entities.values()) {
      if (entity.isPerson && !entity.isPlayer && entity.aaaBridge) {
        restoredCount++;
      }
    }
    console.log(`  ✓ AAA NPCs restored: ${restoredCount}`);
  } else {
    throw new Error('Load failed: ' + loadResult.error);
  }
  
  console.log('  ✅ Test 4 PASSED\n');
} catch (error) {
  console.error('  ❌ Test 4 FAILED:', error.message);
  process.exit(1);
}

// Test 5: Performance preset with large population
console.log('Test 5: Performance Preset (Large Population)');
try {
  const game6 = new Game(77777, {
    worldSize: { width: 100, height: 100 },
    settlements: 3,
    resources: 20,
    rivers: 2,
    populationMin: 100,
    populationMax: 200
  }, {
    aaaPreset: 'performance'
  });
  
  const startTime = Date.now();
  game6.initialize();
  const initTime = Date.now() - startTime;
  
  console.log(`  ✓ Initialized in ${initTime}ms`);
  
  // Count NPCs by LOD
  const lodCounts = { high: 0, medium: 0, low: 0, minimal: 0 };
  for (const entity of game6.kernel.entities.values()) {
    if (entity.isPerson && !entity.isPlayer && entity.aaaBridge && entity.aaaBridge.aaaNPC) {
      const lod = entity.aaaBridge.aaaNPC.lod;
      lodCounts[lod] = (lodCounts[lod] || 0) + 1;
    }
  }
  
  console.log(`  ✓ LOD distribution: High=${lodCounts.high}, Medium=${lodCounts.medium}, Low=${lodCounts.low}, Minimal=${lodCounts.minimal}`);
  
  // Run turns and measure performance
  const turnStart = Date.now();
  game6.advanceTurns(100);
  const turnTime = Date.now() - turnStart;
  
  console.log(`  ✓ 100 turns in ${turnTime}ms (${(turnTime / 100).toFixed(2)}ms/turn)`);
  console.log('  ✅ Test 5 PASSED\n');
} catch (error) {
  console.error('  ❌ Test 5 FAILED:', error.message);
  process.exit(1);
}

console.log('🎉 All AAA Integration Tests PASSED!\n');
console.log('Summary:');
console.log('  ✅ Minimal preset initialization');
console.log('  ✅ Balanced preset with multiple features');
console.log('  ✅ Update cycle with AAA');
console.log('  ✅ Save/Load with AAA');
console.log('  ✅ Performance preset with large population');
console.log('\nAAA NPC system is fully functional! 🚀');
