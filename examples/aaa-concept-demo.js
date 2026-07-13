#!/usr/bin/env node
/**
 * AAA NPC Concept Demonstration
 * 
 * Shows the conceptual depth AAA NPCs add through a narrative comparison.
 * This is a conceptual demo - full integration requires AAA subsystems to be complete.
 */

console.log('═══════════════════════════════════════════════════════════');
console.log('  AAA NPC SYSTEM - CONCEPTUAL DEPTH DEMONSTRATION');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📖 THE TALE OF TWO BLACKSMITHS\n');
console.log('In the village of Ironforge, two blacksmiths compete for business.');
console.log('Thomas (Legacy NPC) and Marcus (AAA NPC) both start identically.\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('  SCENARIO 1: A NORMAL DAY');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('🔨 THOMAS (Legacy NPC):');
console.log('  State: { hunger: 0.3, goals: ["work"], action: "craft" }');
console.log('  Behavior: Deterministic state machine');
console.log('  - Checks hunger > 0.7 → eat');
console.log('  - Else → work');
console.log('  - No memory of events');
console.log('  - No emotional state');
console.log('  - Same every day\n');

console.log('🔨 MARCUS (AAA NPC):');
console.log('  State: {');
console.log('    hunger: 0.3,');
console.log('    emotion: "content" (0.6),');
console.log('    mood: 0.7,');
console.log('    stress: 0.2,');
console.log('    memories: [');
console.log('      { event: "crafted_sword", vividness: 0.8, emotion: "pride" },');
console.log('      { event: "customer_praised", vividness: 0.7, emotion: "joy" },');
console.log('      { event: "morning_routine", vividness: 0.4, emotion: "neutral" }');
console.log('    ],');
console.log('    personality: { conscientiousness: 0.8, openness: 0.6 }');
console.log('  }');
console.log('  Behavior: Emergent from psychological state');
console.log('  - Considers multiple factors (needs, emotions, memories)');
console.log('  - Personality influences decisions');
console.log('  - Remembers past experiences');
console.log('  - Emotional responses to events\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('  SCENARIO 2: A CUSTOMER INSULTS MARCUS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('💢 Event: "Your work is shoddy! I want a refund!"\n');

console.log('🔨 THOMAS (Legacy):');
console.log('  Response: None');
console.log('  State Change: None');
console.log('  Memory: Not recorded');
console.log('  Future Behavior: Unchanged\n');

console.log('🔨 MARCUS (AAA):');
console.log('  Immediate Response:');
console.log('    emotion: "content" → "angry" (0.7)');
console.log('    stress: 0.2 → 0.6');
console.log('    mood: 0.7 → 0.4');
console.log('  ');
console.log('  Memory Formed:');
console.log('    {');
console.log('      event: "customer_insult",');
console.log('      participant: "wealthy_merchant_042",');
console.log('      vividness: 0.9,  // High emotional intensity');
console.log('      emotion: "anger",');
console.log('      importance: 0.8,');
console.log('      tags: ["conflict", "reputation", "work"]');
console.log('    }');
console.log('  ');
console.log('  Personality Impact:');
console.log('    agreeableness: 0.7 → 0.65  // Slight decrease');
console.log('    neuroticism: 0.4 → 0.45    // Slight increase');
console.log('  ');
console.log('  Decision System Update:');
console.log('    - Wealthy customers now have -0.3 affinity modifier');
console.log('    - Prices for that customer type +10%');
console.log('    - Less willing to negotiate with similar customers\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('  SCENARIO 3: ONE WEEK LATER');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📊 After 168 hours (1 week):\n');

console.log('🔨 THOMAS (Legacy):');
console.log('  State: Identical to Day 1');
console.log('  Memory: No record of insult');
console.log('  Personality: Unchanged');
console.log('  Behavior: Same as always\n');

console.log('🔨 MARCUS (AAA):');
console.log('  Emotional Recovery:');
console.log('    emotion: "angry" → "neutral" (0.5)');
console.log('    stress: 0.6 → 0.3  // Gradual recovery');
console.log('    mood: 0.4 → 0.6    // Improved but not fully recovered');
console.log('  ');
console.log('  Memory Persistence:');
console.log('    {');
console.log('      event: "customer_insult",');
console.log('      vividness: 0.9 → 0.7,  // Fading but still vivid');
console.log('      recallCount: 12,       // Thought about it 12 times');
console.log('      lastRecall: 2 hours ago');
console.log('    }');
console.log('  ');
console.log('  Personality Shift:');
console.log('    agreeableness: 0.65 (permanent change)');
console.log('    neuroticism: 0.45 (permanent change)');
console.log('  ');
console.log('  Behavioral Changes:');
console.log('    - More cautious with new customers');
console.log('    - Asks for payment upfront more often');
console.log('    - Slightly defensive in conversations\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('  SCENARIO 4: THE CUSTOMER RETURNS');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('👤 The same wealthy merchant enters the forge...\n');

console.log('🔨 THOMAS (Legacy):');
console.log('  Recognition: None');
console.log('  Response: Standard greeting');
console.log('  Service: Normal\n');

console.log('🔨 MARCUS (AAA):');
console.log('  Memory Recall:');
console.log('    Query: { participant: "wealthy_merchant_042" }');
console.log('    Result: [');
console.log('      { event: "customer_insult", vividness: 0.7, emotion: "anger" }');
console.log('    ]');
console.log('  ');
console.log('  Emotional Response:');
console.log('    emotion: "neutral" → "anxious" (0.4)');
console.log('    stress: 0.3 → 0.5');
console.log('    Working memory activated: "Be careful with this one"');
console.log('  ');
console.log('  Behavioral Response:');
console.log('    - Greeting: Polite but reserved');
console.log('    - Pricing: +15% markup');
console.log('    - Negotiation: Firm, less flexible');
console.log('    - Service priority: Lower than other customers');
console.log('  ');
console.log('  Internal Monologue (Working Memory):');
console.log('    "This is the one who insulted my work..."');
console.log('    "Stay professional, but don\'t let them push you around"');
console.log('    "Charge fair price, no discounts"\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('  EMERGENT STORYTELLING');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('With AAA NPCs, stories emerge naturally:\n');

console.log('📖 Week 2: Marcus\'s Reputation');
console.log('  - Other NPCs notice Marcus is "difficult" with wealthy customers');
console.log('  - Social network spreads: "Marcus doesn\'t like nobles"');
console.log('  - Reputation impact: -0.2 with upper class, +0.1 with commoners');
console.log('  - Some see him as "standing up for craftsmen"\n');

console.log('📖 Week 3: Stress Accumulation');
console.log('  - Multiple difficult customers → stress: 0.7');
console.log('  - High stress affects work quality: -10% crafting success');
console.log('  - Marcus seeks social support (visits tavern more)');
console.log('  - Confides in friend NPC about struggles\n');

console.log('📖 Week 4: Character Development');
console.log('  - Personality shift complete:');
console.log('    • More assertive (agreeableness: 0.65 → 0.60)');
console.log('    • More anxious (neuroticism: 0.45 → 0.50)');
console.log('    • More cautious (openness: 0.6 → 0.55)');
console.log('  - New behavioral patterns established');
console.log('  - Memory of insult becomes defining moment\n');

console.log('📖 Month 2: Long-term Impact');
console.log('  - Marcus develops reputation as "honest but prickly"');
console.log('  - Attracts different customer base (working class)');
console.log('  - Forms alliance with other craftsmen');
console.log('  - The insult becomes a story he tells others');
console.log('  - Personality continues to evolve based on experiences\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('  DEPTH COMPARISON');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📊 THOMAS (Legacy NPC):');
console.log('  ✗ No emotional depth');
console.log('  ✗ No meaningful memory');
console.log('  ✗ No personality development');
console.log('  ✗ No relationship nuance');
console.log('  ✗ Predictable, repetitive behavior');
console.log('  ✗ No emergent storytelling');
console.log('  → Result: Feels like a robot\n');

console.log('📊 MARCUS (AAA NPC):');
console.log('  ✓ Rich emotional responses');
console.log('  ✓ Vivid, fading memories');
console.log('  ✓ Personality evolves over time');
console.log('  ✓ Complex relationship dynamics');
console.log('  ✓ Emergent, believable behavior');
console.log('  ✓ Natural storytelling');
console.log('  → Result: Feels like a real person\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('  TECHNICAL IMPLEMENTATION');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('🔧 AAA System Components:\n');

console.log('1. Memory System:');
console.log('   - Episodic: Specific events with emotional tags');
console.log('   - Semantic: General knowledge and facts');
console.log('   - Procedural: Skills and habits');
console.log('   - Working: Active thoughts and considerations\n');

console.log('2. Emotional System:');
console.log('   - 8 basic emotions (joy, sadness, anger, fear, etc.)');
console.log('   - Mood tracking (long-term emotional state)');
console.log('   - Emotional regulation and recovery');
console.log('   - Emotion-memory linking\n');

console.log('3. Stress System:');
console.log('   - Acute stress (immediate events)');
console.log('   - Chronic stress (accumulated over time)');
console.log('   - Trauma formation for severe events');
console.log('   - Coping mechanisms and recovery\n');

console.log('4. Personality System:');
console.log('   - Big Five traits (OCEAN model)');
console.log('   - Values and beliefs');
console.log('   - Personality development over time');
console.log('   - Trait-behavior consistency\n');

console.log('5. Social System:');
console.log('   - Relationship tracking with emotional depth');
console.log('   - Reputation across multiple domains');
console.log('   - Social network and influence');
console.log('   - Relationship dynamics and evolution\n');

console.log('6. Decision System:');
console.log('   - Utility AI for everyday decisions');
console.log('   - GOAP for complex goal planning');
console.log('   - Personality-influenced choices');
console.log('   - Memory-informed decisions\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('  PERFORMANCE & SCALABILITY');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('📈 Presets for Different Scales:\n');

console.log('narrative (100-500 NPCs):');
console.log('  - Full memory system');
console.log('  - Rich emotions and stress');
console.log('  - Complete personality development');
console.log('  - ~15KB per NPC in saves\n');

console.log('balanced (500-1000 NPCs):');
console.log('  - Core memory features');
console.log('  - Basic emotions');
console.log('  - Simplified personality');
console.log('  - ~8KB per NPC in saves\n');

console.log('performance (1000-2000 NPCs):');
console.log('  - Working memory only');
console.log('  - Minimal emotions');
console.log('  - Static personality');
console.log('  - ~5KB per NPC in saves\n');

console.log('minimal (2000+ NPCs):');
console.log('  - No AAA features');
console.log('  - Legacy behavior');
console.log('  - ~2KB per NPC in saves\n');

console.log('═══════════════════════════════════════════════════════════');
console.log('  CONCLUSION');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('AAA NPCs transform your game from a simulation into a living world:\n');

console.log('✨ Key Benefits:');
console.log('  1. NPCs feel like real people, not robots');
console.log('  2. Player actions have lasting consequences');
console.log('  3. Stories emerge naturally without scripting');
console.log('  4. Relationships develop organically');
console.log('  5. Each playthrough is unique');
console.log('  6. NPCs remember and learn from experiences\n');

console.log('🎮 Perfect For:');
console.log('  - Story-rich RPGs');
console.log('  - Life simulations');
console.log('  - Social strategy games');
console.log('  - Narrative-driven experiences');
console.log('  - Games where NPCs are central to gameplay\n');

console.log('⚡ Getting Started:');
console.log('  1. Choose a preset based on your population size');
console.log('  2. Enable AAA in Game constructor');
console.log('  3. Test with a small population first');
console.log('  4. Adjust features based on performance');
console.log('  5. Enjoy emergent storytelling!\n');

console.log('📚 Documentation:');
console.log('  - Quick Start: docs/AAA-NPC-QUICKSTART.md');
console.log('  - Integration: docs/AAA-NPC-INTEGRATION.md');
console.log('  - API Reference: src/character/aaa-npc/\n');

console.log('═══════════════════════════════════════════════════════════\n');
