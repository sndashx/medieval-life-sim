# AAA NPC System

A comprehensive, AAA-quality NPC system for medieval life simulation games, featuring advanced psychological modeling, multi-layered memory systems, rich social dynamics, and intelligent decision-making.

## Features

### 🧠 Psychology System
- **Emotional State**: Plutchik's Wheel of Emotions (8 primary emotions) combined with PAD (Pleasure-Arousal-Dominance) dimensional model
- **Stress & Trauma**: Comprehensive stress tracking with PTSD symptom modeling, coping mechanisms, and burnout indicators
- **Mood System**: Long-lasting emotional baseline that influences behavior
- **Emotional Regulation**: Suppression and reappraisal capabilities based on personality

### 💭 Memory Systems
- **Episodic Memory**: Stores specific events and experiences with emotional tagging and realistic memory reconstruction
- **Semantic Memory**: Knowledge graph for facts, beliefs, and concepts with Bayesian belief updating
- **Procedural Memory**: Skill acquisition, habit formation, and muscle memory with practice-based improvement
- **Working Memory**: Limited capacity (7±2 items) short-term memory with attention management
- **Memory Consolidation**: Automatic transfer from working to long-term memory

### 👥 Social Dynamics
- **Relationships**: Multi-dimensional relationship model (affection, respect, trust, familiarity, power, romantic, professional)
- **Reputation System**: Domain-specific reputation tracking with fame/infamy, titles, and notable deeds
- **Social Network**: Graph-based network with centrality metrics, community detection, and influence propagation
- **Relationship Evolution**: Dynamic relationships that change based on interactions and time

### 💰 Economic Motivation
- **Wealth Management**: Tracks liquid assets, property, income, expenses, debt, and investments
- **Career Progression**: Occupation advancement with experience, reputation, and skill requirements
- **Goal Setting**: Short, medium, and long-term economic goals
- **Opportunity Evaluation**: Risk-adjusted decision making for economic opportunities
- **Spending Behavior**: Personality-influenced purchasing decisions

### 🎯 Decision Making
- **Utility AI**: Consideration-based action selection with response curves and emotional/personality modifiers
- **GOAP (Goal-Oriented Action Planning)**: A* search for strategic action sequences
- **Hybrid System**: Combines reactive (Utility AI) and strategic (GOAP) decision-making based on urgency
- **Dynamic Replanning**: Automatic replanning when goals change or plans fail

### 🎭 Personality System
- **Big Five Traits**: Openness, Conscientiousness, Extraversion, Agreeableness, Neuroticism
- **Medieval Traits**: Piety, Honor, Courage, Ambition, Compassion, Loyalty, Pragmatism, Traditionalism
- **Value System**: Core values that influence decisions (family, wealth, power, knowledge, faith, etc.)
- **Personality Development**: Traits evolve based on experiences and life events
- **Behavioral Tendencies**: Risk-taking, impulsivity, assertiveness, sociability, curiosity, etc.

### ⚡ Performance Optimization
- **Level of Detail (LOD)**: Four LOD levels (high, medium, low, minimal) for performance scaling
- **Selective Updates**: Only essential systems run at lower LOD levels
- **Memory Caching**: Cached computations for expensive operations
- **Efficient Data Structures**: Optimized for large numbers of NPCs

## Installation

```javascript
import { AAANPC } from './src/character/aaa-npc/index.js';
```

## Quick Start

### Creating an NPC

```javascript
const npc = new AAANPC({
  name: 'Sir Edmund',
  age: 32,
  gender: 'male',
  location: 'castle_courtyard',
  personality: {
    courage: 0.9,
    honor: 0.8,
    ambition: 0.7,
    openness: 0.6,
    conscientiousness: 0.7,
    extraversion: 0.5,
    agreeableness: 0.6,
    neuroticism: 0.3
  },
  initialWealth: 500
});
```

### Updating the NPC

```javascript
// Main game loop
function gameLoop(deltaTime) {
  const context = {
    location: 'castle_courtyard',
    dangerLevel: 0.0,
    timeOfDay: 'morning'
  };
  
  npc.update(deltaTime, context);
}
```

### Reacting to Events

```javascript
npc.reactToEvent({
  type: 'achievement',
  description: 'Won tournament',
  intensity: 0.8,
  witnesses: ['npc_123', 'npc_456'],
  location: 'tournament_grounds',
  emotionalIntensity: 0.9,
  stressful: false,
  developmentImpact: 0.5
});
```

### Social Interactions

```javascript
npc.interactWith('npc_456', {
  type: 'conversation',
  valence: 0.7,
  intensity: 0.5,
  location: 'tavern',
  witnesses: []
});
```

### Decision Making

```javascript
// Register actions
import { Action, Consideration } from './src/character/aaa-npc/index.js';

const eatAction = new Action({
  name: 'eat',
  baseUtility: 0.5,
  considerations: [
    new Consideration(
      'hunger',
      (ctx, npc) => npc.needs.hunger,
      (x) => x * x // Quadratic curve
    )
  ],
  execute: (ctx, npc) => {
    npc.needs.hunger = 0;
    return { success: true };
  }
});

npc.decisionSystem.registerUtilityActions([eatAction]);
```

### Setting Goals

```javascript
import { Goal } from './src/character/aaa-npc/index.js';

const becomeRichGoal = new Goal({
  name: 'become_wealthy',
  priority: 7,
  desiredState: {
    hasMoney: true,
    isWealthy: true
  },
  isValid: (ctx) => npc.economicMotivation.wealth.liquid < 1000
});

npc.decisionSystem.addGoal(becomeRichGoal);
```

## Performance Optimization

### Level of Detail (LOD)

```javascript
// Set LOD based on distance from player or importance
if (distanceFromPlayer > 100) {
  npc.setLOD('low');
} else if (distanceFromPlayer > 50) {
  npc.setLOD('medium');
} else {
  npc.setLOD('high');
}
```

LOD Levels:
- **High**: All systems active, full decision-making
- **Medium**: Essential systems only, simplified decisions
- **Low**: Minimal processing, state preservation
- **Minimal**: Time passage only, no active processing

## API Reference

### AAANPC

Main NPC class that integrates all subsystems.

#### Methods

- `update(deltaTime, context)` - Main update loop
- `reactToEvent(event)` - Process an event and update state
- `interactWith(targetId, interaction)` - Interact with another NPC
- `setLOD(lod)` - Set level of detail
- `getState()` - Get comprehensive NPC state
- `getStatus()` - Get brief status for UI
- `serialize()` - Serialize for saving
- `static deserialize(data)` - Deserialize from saved data

### EmotionalState

Manages emotional state using Plutchik's Wheel and PAD model.

#### Properties

- `joy`, `trust`, `fear`, `surprise`, `sadness`, `disgust`, `anger`, `anticipation` - Primary emotions (0-1)
- `arousal`, `valence`, `dominance` - PAD dimensions (0-1)
- `mood` - Longer-lasting emotional baseline

#### Methods

- `update(deltaTime)` - Update emotional state
- `react(event, personality)` - React to event
- `getDominantEmotion()` - Get currently dominant emotion
- `getEmotionalIntensity()` - Get overall intensity

### MemorySystem

Integrated memory system combining all memory types.

#### Properties

- `episodic` - Episodic memory instance
- `semantic` - Semantic memory instance
- `procedural` - Procedural memory instance
- `working` - Working memory instance

#### Methods

- `update(deltaTime)` - Update all memory systems
- `rememberEvent(event)` - Store event in episodic memory
- `learnFact(concept, properties, confidence)` - Store fact in semantic memory
- `practiceSkill(skill, category, quality, duration)` - Practice skill

### SocialSystem

Manages relationships, reputation, and social network.

#### Methods

- `getRelationship(targetId)` - Get or create relationship
- `interact(targetId, interaction)` - Interact with another person
- `getAllRelationships()` - Get all relationships
- `getClosestRelationships(count)` - Get closest relationships

### EconomicMotivation

Handles economic goals and career progression.

#### Properties

- `wealth` - Wealth tracking (liquid, assets, income, expenses, debt, savings)
- `career` - Career information (occupation, experience, reputation)
- `goals` - Economic goals (short, medium, long-term)

#### Methods

- `evaluateOpportunity(opportunity)` - Evaluate economic opportunity
- `planCareerPath(availableOccupations)` - Plan career progression
- `makeSpendingDecision(purchase)` - Decide on purchase

### HybridDecisionSystem

Combines Utility AI and GOAP for decision-making.

#### Methods

- `decide(context)` - Make a decision
- `registerUtilityActions(actions)` - Register utility actions
- `registerGOAPActions(actions)` - Register GOAP actions
- `addGoal(goal)` - Add a goal

### PersonalitySystem

Manages personality traits, values, and development.

#### Properties

- `traits` - Personality traits (Big Five + medieval traits)
- `values` - Core values
- `tendencies` - Behavioral tendencies

#### Methods

- `influenceDecision(decision, context)` - Influence decision based on personality
- `developPersonality(experience)` - Develop personality from experience
- `getArchetype()` - Get personality archetype
- `calculateCompatibility(other)` - Calculate compatibility with another personality

## Architecture

```
AAANPC
├── PersonalitySystem (traits, values, development)
├── EmotionalState (emotions, mood, PAD model)
├── StressSystem (stress, trauma, PTSD, coping)
├── MemorySystem
│   ├── EpisodicMemory (events, experiences)
│   ├── SemanticMemory (facts, knowledge, beliefs)
│   ├── ProceduralMemory (skills, habits, procedures)
│   └── WorkingMemory (short-term, attention)
├── SocialSystem
│   ├── Relationships (multi-dimensional)
│   ├── ReputationSystem (domains, factions, deeds)
│   └── SocialNetwork (graph, communities, influence)
├── EconomicMotivation (wealth, career, goals)
└── HybridDecisionSystem
    ├── UtilityAI (reactive decisions)
    └── GOAPPlanner (strategic planning)
```

## Examples

### Complete NPC Setup

```javascript
import { AAANPC, Action, Consideration, Goal } from './src/character/aaa-npc/index.js';

// Create NPC
const knight = new AAANPC({
  name: 'Sir Roland',
  age: 35,
  personality: {
    courage: 0.9,
    honor: 0.85,
    loyalty: 0.8,
    conscientiousness: 0.7
  }
});

// Register actions
const trainAction = new Action({
  name: 'train_combat',
  baseUtility: 0.4,
  requiresCourage: true,
  considerations: [
    new Consideration('skill_need', (ctx, npc) => 
      1 - (npc.memory.procedural.getSkillLevel('combat', 'martial') || 0)
    )
  ],
  execute: (ctx, npc) => {
    npc.memory.practiceSkill('combat', 'martial', 0.8, 60);
    return { success: true };
  }
});

knight.decisionSystem.registerUtilityActions([trainAction]);

// Add goals
knight.decisionSystem.addGoal(new Goal({
  name: 'become_master_warrior',
  priority: 8,
  desiredState: { combatMastery: true }
}));

// Game loop
setInterval(() => {
  knight.update(1, { location: 'training_grounds' });
}, 1000);
```

## Best Practices

1. **Performance**: Use LOD system for NPCs far from player
2. **Memory Management**: Limit episodic memory capacity based on available RAM
3. **Decision Frequency**: Don't make decisions every frame - use intervals
4. **Serialization**: Save NPC state periodically for game saves
5. **Event Batching**: Batch multiple events before processing
6. **Network Optimization**: Update social network less frequently than individual NPCs

## License

MIT License - See LICENSE file for details

## Contributing

Contributions welcome! Please read CONTRIBUTING.md for guidelines.

## Credits

Based on research in:
- Plutchik's Wheel of Emotions
- Russell's Circumplex Model of Affect
- Big Five Personality Model
- Goal-Oriented Action Planning (GOAP)
- Utility-based AI
- Cognitive Psychology and Memory Systems
