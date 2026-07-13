# AAA-Tier NPC System Architecture
## "Project Sentience" - Next-Generation Medieval Life AI

> **Design Philosophy**: Create NPCs that feel alive through emergent behavior, psychological depth, and meaningful agency rather than scripted responses.

---

## 🎯 Core Design Pillars

### 1. **Believability Over Realism**
- NPCs should feel human, not simulate every biological process
- Emotional responses drive behavior more than pure logic
- Imperfect decision-making creates authenticity

### 2. **Emergent Narrative**
- Stories arise from NPC interactions, not pre-written scripts
- Player actions ripple through social networks
- Historical events shape future behavior

### 3. **Performance at Scale**
- Support 1000+ active NPCs simultaneously
- Intelligent LOD (Level of Detail) system
- Predictive caching and lazy evaluation

---

## 🧠 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    NPC COGNITIVE CORE                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Perception  │→ │  Cognition   │→ │   Action     │      │
│  │   System     │  │   Engine     │  │  Execution   │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│         ↓                  ↓                  ↓              │
│  ┌──────────────────────────────────────────────────┐       │
│  │           PSYCHOLOGICAL STATE LAYER               │       │
│  │  • Emotions  • Stress  • Trauma  • Mood          │       │
│  └──────────────────────────────────────────────────┘       │
│         ↓                  ↓                  ↓              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Memory     │  │ Personality  │  │   Social     │      │
│  │   System     │  │    Traits    │  │  Network     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                  DECISION MAKING LAYER                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  Utility AI  │  │     GOAP     │  │  Behavior    │      │
│  │   Scoring    │  │   Planner    │  │    Trees     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   MOTIVATION SYSTEMS                         │
├─────────────────────────────────────────────────────────────┤
│  • Maslow's Hierarchy  • Career Ambitions  • Relationships  │
│  • Wealth Accumulation • Status Seeking   • Legacy Building │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 Module 1: Psychological State System

### Emotional Model (Plutchik's Wheel + Arousal/Valence)

```javascript
class EmotionalState {
  constructor() {
    // Primary emotions (0-1 intensity)
    this.joy = 0.5;
    this.trust = 0.5;
    this.fear = 0.0;
    this.surprise = 0.0;
    this.sadness = 0.0;
    this.disgust = 0.0;
    this.anger = 0.0;
    this.anticipation = 0.5;
    
    // Dimensional model
    this.arousal = 0.5;  // Calm ←→ Excited
    this.valence = 0.5;  // Negative ←→ Positive
    this.dominance = 0.5; // Submissive ←→ Dominant
    
    // Mood (longer-lasting emotional baseline)
    this.mood = {
      baseline: 0.5,
      current: 0.5,
      volatility: 0.3  // How quickly mood changes
    };
    
    // Emotional regulation
    this.regulation = {
      suppressionStrength: 0.5,  // Ability to hide emotions
      reappraisalSkill: 0.5,     // Ability to reframe situations
      emotionalIntelligence: 0.5  // Understanding own/others' emotions
    };
  }
  
  // Emotions decay over time toward baseline
  decay(deltaTime) {
    const decayRate = 0.01 * deltaTime;
    for (const emotion of ['joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation']) {
      this[emotion] = this[emotion] * (1 - decayRate) + this.mood.baseline * decayRate;
    }
  }
  
  // React to events with emotional response
  react(event, personality) {
    const response = this.calculateEmotionalResponse(event, personality);
    this.applyEmotionalChange(response);
    this.updateMood();
  }
  
  // Get dominant emotion
  getDominantEmotion() {
    const emotions = {
      joy: this.joy,
      trust: this.trust,
      fear: this.fear,
      surprise: this.surprise,
      sadness: this.sadness,
      disgust: this.disgust,
      anger: this.anger,
      anticipation: this.anticipation
    };
    return Object.entries(emotions).reduce((a, b) => a[1] > b[1] ? a : b)[0];
  }
}
```

### Stress & Trauma System

```javascript
class StressSystem {
  constructor() {
    this.currentStress = 0.0;  // 0-1 scale
    this.chronicStress = 0.0;   // Long-term stress accumulation
    this.resilience = 0.7;      // Ability to handle stress
    
    // Trauma tracking
    this.traumas = [];  // { type, severity, timestamp, processed }
    this.ptsdSymptoms = {
      intrusion: 0.0,      // Flashbacks, nightmares
      avoidance: 0.0,      // Avoiding triggers
      hyperarousal: 0.0,   // Heightened alertness
      negativeThoughts: 0.0 // Negative beliefs about self/world
    };
    
    // Coping mechanisms
    this.copingStrategies = {
      problemFocused: 0.5,  // Addressing the stressor
      emotionFocused: 0.5,  // Managing emotional response
      avoidant: 0.3,        // Avoiding the problem
      social: 0.6           // Seeking social support
    };
  }
  
  addStressor(stressor) {
    const impact = stressor.severity * (1 - this.resilience);
    this.currentStress = Math.min(1.0, this.currentStress + impact);
    
    // Severe stressors can cause trauma
    if (stressor.severity > 0.8) {
      this.addTrauma(stressor);
    }
  }
  
  update(deltaTime) {
    // Stress naturally decreases over time
    this.currentStress *= (1 - 0.01 * deltaTime);
    
    // Chronic stress accumulates if current stress is high
    if (this.currentStress > 0.7) {
      this.chronicStress += 0.001 * deltaTime;
    } else {
      this.chronicStress *= (1 - 0.005 * deltaTime);
    }
    
    // Update PTSD symptoms
    this.updatePTSDSymptoms(deltaTime);
  }
}
```

---

## 🧩 Module 2: Advanced Memory System

### Three-Tier Memory Architecture

```javascript
class MemorySystem {
  constructor() {
    // Episodic Memory: Specific events and experiences
    this.episodicMemory = new EpisodicMemory(512);
    
    // Semantic Memory: Facts, knowledge, concepts
    this.semanticMemory = new SemanticMemory();
    
    // Procedural Memory: Skills and how-to knowledge
    this.proceduralMemory = new ProceduralMemory();
    
    // Working Memory: Current focus and active thoughts
    this.workingMemory = new WorkingMemory(7);  // Miller's Law: 7±2 items
    
    // Memory consolidation
    this.consolidationQueue = [];
  }
}

class EpisodicMemory {
  constructor(capacity) {
    this.capacity = capacity;
    this.memories = [];
    this.emotionalTagging = true;  // Emotional events remembered better
  }
  
  store(event) {
    const memory = {
      id: generateId(),
      timestamp: event.timestamp,
      location: event.location,
      participants: event.participants,
      actions: event.actions,
      emotions: event.emotionalState,
      importance: this.calculateImportance(event),
      vividness: 1.0,  // Fades over time
      lastRecalled: event.timestamp
    };
    
    // Emotional events are more vivid
    if (event.emotionalIntensity > 0.7) {
      memory.vividness *= 1.5;
      memory.importance *= 1.3;
    }
    
    this.memories.push(memory);
    this.pruneOldMemories();
  }
  
  recall(query) {
    // Memories fade and can be reconstructed incorrectly
    const matches = this.findMatches(query);
    return matches.map(m => this.reconstructMemory(m));
  }
  
  reconstructMemory(memory) {
    // Memory reconstruction can introduce errors
    const reconstructed = { ...memory };
    reconstructed.vividness *= 0.95;  // Recall makes memory less vivid
    
    // Chance of false details based on vividness
    if (Math.random() > reconstructed.vividness) {
      reconstructed.details = this.addFalseDetails(reconstructed.details);
    }
    
    return reconstructed;
  }
}

class SemanticMemory {
  constructor() {
    // Knowledge graph structure
    this.concepts = new Map();  // concept -> { properties, relations }
    this.beliefs = new Map();   // belief -> { strength, evidence }
    this.schemas = new Map();   // schema -> { structure, instances }
  }
  
  learn(concept, properties) {
    if (!this.concepts.has(concept)) {
      this.concepts.set(concept, {
        properties: new Map(),
        relations: new Map(),
        confidence: 0.5
      });
    }
    
    const existing = this.concepts.get(concept);
    for (const [key, value] of Object.entries(properties)) {
      existing.properties.set(key, value);
    }
    existing.confidence = Math.min(1.0, existing.confidence + 0.1);
  }
  
  query(concept) {
    return this.concepts.get(concept) || null;
  }
  
  // Belief updating based on evidence
  updateBelief(belief, evidence, strength) {
    if (!this.beliefs.has(belief)) {
      this.beliefs.set(belief, { strength: 0.5, evidence: [] });
    }
    
    const existing = this.beliefs.get(belief);
    existing.evidence.push(evidence);
    
    // Bayesian-like update
    existing.strength = this.bayesianUpdate(existing.strength, strength);
  }
}
```

---

## 🤝 Module 3: Social Dynamics Engine

### Relationship System

```javascript
class RelationshipSystem {
  constructor() {
    this.relationships = new Map();  // personId -> Relationship
    this.reputation = new ReputationSystem();
    this.socialNetwork = new SocialNetwork();
  }
}

class Relationship {
  constructor(targetId) {
    this.targetId = targetId;
    
    // Multi-dimensional relationship model
    this.dimensions = {
      affection: 0.5,      // Like ←→ Dislike
      respect: 0.5,        // Disrespect ←→ Respect
      trust: 0.5,          // Distrust ←→ Trust
      familiarity: 0.0,    // Stranger ←→ Intimate
      power: 0.5,          // Subordinate ←→ Dominant
      romantic: 0.0,       // Platonic ←→ Romantic
      professional: 0.0    // Personal ←→ Professional
    };
    
    // Relationship history
    this.interactions = [];
    this.sharedExperiences = [];
    this.conflicts = [];
    this.favors = { given: 0, received: 0 };
    
    // Relationship type (dynamically determined)
    this.type = 'acquaintance';  // stranger, acquaintance, friend, close_friend, enemy, rival, lover, spouse, family
    
    // Relationship stability
    this.stability = 0.7;  // How resistant to change
    this.volatility = 0.3; // How quickly it changes
  }
  
  interact(interaction) {
    this.interactions.push(interaction);
    
    // Update dimensions based on interaction
    const impact = this.calculateImpact(interaction);
    for (const [dimension, change] of Object.entries(impact)) {
      this.dimensions[dimension] = this.clamp(
        this.dimensions[dimension] + change * (1 - this.stability),
        0, 1
      );
    }
    
    // Update relationship type
    this.updateType();
    
    // Prune old interactions
    if (this.interactions.length > 100) {
      this.interactions = this.interactions.slice(-100);
    }
  }
  
  updateType() {
    const { affection, trust, familiarity, romantic } = this.dimensions;
    
    if (romantic > 0.7 && affection > 0.7) {
      this.type = trust > 0.8 ? 'spouse' : 'lover';
    } else if (affection < 0.3 && trust < 0.3) {
      this.type = 'enemy';
    } else if (affection > 0.7 && familiarity > 0.7) {
      this.type = trust > 0.7 ? 'close_friend' : 'friend';
    } else if (familiarity > 0.3) {
      this.type = 'acquaintance';
    } else {
      this.type = 'stranger';
    }
  }
  
  getOverallSentiment() {
    // Weighted combination of dimensions
    return (
      this.dimensions.affection * 0.4 +
      this.dimensions.respect * 0.3 +
      this.dimensions.trust * 0.3
    );
  }
}

class ReputationSystem {
  constructor() {
    // Reputation across different domains
    this.domains = {
      combat: 0.5,
      craftsmanship: 0.5,
      leadership: 0.5,
      trustworthiness: 0.5,
      generosity: 0.5,
      piety: 0.5,
      wisdom: 0.5
    };
    
    // Reputation by faction/group
    this.factionReputation = new Map();
    
    // Notable deeds (positive and negative)
    this.deeds = [];
    
    // Titles and honors
    this.titles = [];
  }
  
  addDeed(deed) {
    this.deeds.push(deed);
    
    // Update relevant domain
    if (deed.domain && this.domains[deed.domain] !== undefined) {
      const change = deed.impact * deed.witnesses.length * 0.01;
      this.domains[deed.domain] = this.clamp(
        this.domains[deed.domain] + change,
        0, 1
      );
    }
    
    // Spread through social network
    this.propagateReputation(deed);
  }
  
  propagateReputation(deed) {
    // Reputation spreads through gossip
    // Negative news travels faster than positive
    const spreadRate = deed.impact < 0 ? 1.5 : 1.0;
    // Implementation would use social network to spread
  }
}
```

---

## 💰 Module 4: Economic Motivation System

### Career & Wealth Ambitions

```javascript
class EconomicMotivation {
  constructor(personality) {
    // Core economic drives
    this.wealthDesire = personality.ambition * 0.7 + personality.conscientiousness * 0.3;
    this.statusDesire = personality.ambition * 0.8 + personality.extraversion * 0.2;
    this.securityDesire = personality.neuroticism * 0.6 + personality.conscientiousness * 0.4;
    
    // Current economic state
    this.wealth = {
      liquid: 0,      // Cash on hand
      assets: 0,      // Property, goods
      income: 0,      // Regular income
      expenses: 0     // Regular expenses
    };
    
    // Career progression
    this.career = {
      occupation: 'peasant',
      experience: 0,
      reputation: 0.5,
      advancement: 0,  // Progress toward next level
      aspirations: []  // Desired occupations
    };
    
    // Economic goals
    this.goals = {
      shortTerm: [],   // Immediate needs (food, shelter)
      mediumTerm: [],  // Career advancement, savings
      longTerm: []     // Wealth accumulation, legacy
    };
    
    // Risk tolerance
    this.riskTolerance = 1 - personality.neuroticism;
  }
  
  evaluateOpportunity(opportunity) {
    const expectedValue = opportunity.reward * opportunity.successChance;
    const risk = opportunity.cost * (1 - opportunity.successChance);
    const riskAdjusted = expectedValue - (risk * (1 - this.riskTolerance));
    
    // Factor in alignment with goals
    const goalAlignment = this.calculateGoalAlignment(opportunity);
    
    return riskAdjusted * goalAlignment;
  }
  
  planCareerPath() {
    const currentOccupation = this.career.occupation;
    const possiblePaths = this.getCareerPaths(currentOccupation);
    
    // Score each path based on personality and goals
    const scoredPaths = possiblePaths.map(path => ({
      path,
      score: this.scoreCareerPath(path)
    }));
    
    // Select best path
    scoredPaths.sort((a, b) => b.score - a.score);
    return scoredPaths[0].path;
  }
  
  scoreCareerPath(path) {
    let score = 0;
    
    // Wealth potential
    score += path.incomeIncrease * this.wealthDesire * 10;
    
    // Status gain
    score += path.statusIncrease * this.statusDesire * 8;
    
    // Security
    score += path.jobSecurity * this.securityDesire * 6;
    
    // Difficulty penalty
    score -= path.difficulty * (1 - this.career.experience / 100);
    
    return score;
  }
}
```

---

## 🎮 Module 5: Decision Making - Utility AI + GOAP Hybrid

### Utility-Based Action Selection

```javascript
class UtilityAI {
  constructor(npc) {
    this.npc = npc;
    this.considerations = [];
    this.actions = [];
  }
  
  selectAction(context) {
    // Score all available actions
    const scoredActions = this.actions.map(action => ({
      action,
      score: this.scoreAction(action, context)
    }));
    
    // Sort by score
    scoredActions.sort((a, b) => b.score - a.score);
    
    // Add randomness to prevent robotic behavior
    const topActions = scoredActions.slice(0, 3);
    const weights = topActions.map((a, i) => Math.pow(0.7, i));
    const selected = this.weightedRandom(topActions, weights);
    
    return selected.action;
  }
  
  scoreAction(action, context) {
    let score = action.baseUtility;
    
    // Apply all considerations
    for (const consideration of action.considerations) {
      const value = consideration.evaluate(context, this.npc);
      const curve = consideration.responseCurve(value);
      score *= curve;
    }
    
    // Emotional modifiers
    score *= this.getEmotionalModifier(action);
    
    // Personality modifiers
    score *= this.getPersonalityModifier(action);
    
    return score;
  }
  
  getEmotionalModifier(action) {
    const emotion = this.npc.emotionalState.getDominantEmotion();
    
    // Different emotions bias different actions
    const modifiers = {
      fear: { flee: 1.5, fight: 0.5, explore: 0.3 },
      anger: { fight: 1.5, flee: 0.5, negotiate: 0.7 },
      joy: { socialize: 1.3, work: 1.1, rest: 0.8 },
      sadness: { socialize: 0.6, rest: 1.2, work: 0.8 }
    };
    
    return modifiers[emotion]?.[action.type] || 1.0;
  }
}

class Consideration {
  constructor(name, inputFunc, responseCurve) {
    this.name = name;
    this.inputFunc = inputFunc;  // Function to get input value (0-1)
    this.responseCurve = responseCurve;  // Function to transform input
  }
  
  evaluate(context, npc) {
    return this.inputFunc(context, npc);
  }
}

// Example considerations
const hungerConsideration = new Consideration(
  'hunger',
  (ctx, npc) => npc.needs.hunger,
  (x) => Math.pow(x, 2)  // Quadratic curve - hunger becomes urgent quickly
);

const wealthConsideration = new Consideration(
  'wealth',
  (ctx, npc) => 1 - (npc.wealth.liquid / npc.wealth.desired),
  (x) => 1 - Math.pow(1 - x, 3)  // Inverse cubic - diminishing returns
);
```

### GOAP (Goal-Oriented Action Planning)

```javascript
class GOAPPlanner {
  constructor() {
    this.actions = [];
    this.maxPlanDepth = 10;
  }
  
  plan(currentState, goal, availableActions) {
    // A* search for action sequence
    const openSet = [{ state: currentState, actions: [], cost: 0 }];
    const closedSet = new Set();
    
    while (openSet.length > 0) {
      // Get lowest cost node
      openSet.sort((a, b) => (a.cost + this.heuristic(a.state, goal)) - 
                              (b.cost + this.heuristic(b.state, goal)));
      const current = openSet.shift();
      
      // Check if goal reached
      if (this.goalSatisfied(current.state, goal)) {
        return current.actions;
      }
      
      // Prevent infinite loops
      if (current.actions.length >= this.maxPlanDepth) continue;
      
      const stateKey = this.stateToKey(current.state);
      if (closedSet.has(stateKey)) continue;
      closedSet.add(stateKey);
      
      // Expand neighbors
      for (const action of availableActions) {
        if (!action.preconditionsMet(current.state)) continue;
        
        const newState = action.applyEffects(current.state);
        const newCost = current.cost + action.cost;
        
        openSet.push({
          state: newState,
          actions: [...current.actions, action],
          cost: newCost
        });
      }
    }
    
    return null;  // No plan found
  }
  
  heuristic(state, goal) {
    // Estimate cost to reach goal
    let distance = 0;
    for (const [key, value] of Object.entries(goal)) {
      if (state[key] !== value) distance++;
    }
    return distance;
  }
}

class GOAPAction {
  constructor(name, cost, preconditions, effects) {
    this.name = name;
    this.cost = cost;
    this.preconditions = preconditions;  // { key: value }
    this.effects = effects;              // { key: value }
  }
  
  preconditionsMet(state) {
    for (const [key, value] of Object.entries(this.preconditions)) {
      if (state[key] !== value) return false;
    }
    return true;
  }
  
  applyEffects(state) {
    return { ...state, ...this.effects };
  }
}

// Example actions
const gatherFoodAction = new GOAPAction(
  'gather_food',
  10,
  { hasEnergy: true, inWilderness: true },
  { hasFood: true, hasEnergy: false }
);

const eatFoodAction = new GOAPAction(
  'eat_food',
  5,
  { hasFood: true, isHungry: true },
  { hasFood: false, isHungry: false, hasEnergy: true }
);
```

---

## 🎭 Module 6: Personality-Driven Behavior

### Extended Personality Model

```javascript
class PersonalitySystem {
  constructor() {
    // Big Five + Medieval-specific traits
    this.traits = {
      // Big Five
      openness: 0.5,
      conscientiousness: 0.5,
      extraversion: 0.5,
      agreeableness: 0.5,
      neuroticism: 0.5,
      
      // Medieval-specific
      piety: 0.5,           // Religious devotion
      honor: 0.5,           // Adherence to code of honor
      ambition: 0.5,        // Drive for advancement
      compassion: 0.5,      // Empathy and kindness
      courage: 0.5,         // Bravery in face of danger
      loyalty: 0.5,         // Faithfulness to commitments
      pragmatism: 0.5,      // Practical vs idealistic
      traditionalism: 0.5   // Respect for tradition
    };
    
    // Values (what the person cares about)
    this.values = {
      family: 0.8,
      wealth: 0.5,
      power: 0.4,
      knowledge: 0.5,
      faith: 0.6,
      freedom: 0.6,
      justice: 0.5,
      beauty: 0.4
    };
    
    // Behavioral tendencies
    this.tendencies = {
      riskTaking: 0.5,
      impulsivity: 0.5,
      assertiveness: 0.5,
      sociability: 0.5,
      curiosity: 0.5
    };
  }
  
  influenceDecision(decision, context) {
    let modifier = 1.0;
    
    // Personality affects decision weight
    if (decision.requiresCourage) {
      modifier *= (0.5 + this.traits.courage * 0.5);
    }
    
    if (decision.requiresSocialSkill) {
      modifier *= (0.5 + this.traits.extraversion * 0.5);
    }
    
    if (decision.isRisky) {
      modifier *= (0.5 + this.tendencies.riskTaking * 0.5);
    }
    
    // Values alignment
    const valueAlignment = this.calculateValueAlignment(decision);
    modifier *= valueAlignment;
    
    return modifier;
  }
  
  calculateValueAlignment(decision) {
    let alignment = 1.0;
    
    for (const [value, weight] of Object.entries(decision.affectedValues)) {
      const personalValue = this.values[value] || 0.5;
      alignment *= (0.5 + personalValue * weight * 0.5);
    }
    
    return alignment;
  }
  
  // Personality can change over time based on experiences
  developPersonality(experience) {
    const impact = experience.intensity * 0.01;
    
    if (experience.type === 'traumatic') {
      this.traits.neuroticism += impact;
      this.traits.openness -= impact * 0.5;
    } else if (experience.type === 'achievement') {
      this.traits.conscientiousness += impact;
      this.values.power += impact * 0.5;
    } else if (experience.type === 'social_success') {
      this.traits.extraversion += impact;
      this.tendencies.sociability += impact;
    }
    
    // Clamp all values
    this.clampAllTraits();
  }
}
```

---

## 📈 Module 7: Performance Optimization

### Intelligent LOD System

```javascript
class NPCLODSystem {
  constructor() {
    this.tiers = {
      FULL: 0,      // Full simulation (player, nearby NPCs)
      HIGH: 1,      // Reduced update frequency
      MEDIUM: 2,    // Simplified simulation
      LOW: 3,       // Statistical simulation
      DORMANT: 4    // Minimal state tracking
    };
    
    this.npcTiers = new Map();  // npcId -> tier
  }
  
  updateLOD(npc, playerPosition, importance) {
    const distance = this.calculateDistance(npc.position, playerPosition);
    const tier = this.determineTier(distance, importance);
    
    this.npcTiers.set(npc.id, tier);
    return tier;
  }
  
  determineTier(distance, importance) {
    // Importance factors: relationship with player, quest involvement, etc.
    const adjustedDistance = distance / (1 + importance);
    
    if (adjustedDistance < 10) return this.tiers.FULL;
    if (adjustedDistance < 50) return this.tiers.HIGH;
    if (adjustedDistance < 200) return this.tiers.MEDIUM;
    if (adjustedDistance < 1000) return this.tiers.LOW;
    return this.tiers.DORMANT;
  }
  
  getUpdateFrequency(tier) {
    const frequencies = {
      [this.tiers.FULL]: 1,      // Every tick
      [this.tiers.HIGH]: 5,      // Every 5 ticks
      [this.tiers.MEDIUM]: 30,   // Every 30 ticks
      [this.tiers.LOW]: 300,     // Every 300 ticks
      [this.tiers.DORMANT]: 3600 // Every hour
    };
    return frequencies[tier] || 1;
  }
}

class NPCUpdateScheduler {
  constructor() {
    this.updateQueues = new Map();  // tier -> queue of NPCs
    this.currentTick = 0;
  }
  
  scheduleUpdate(npc, tier, frequency) {
    const nextUpdate = this.currentTick + frequency;
    
    if (!this.updateQueues.has(nextUpdate)) {
      this.updateQueues.set(nextUpdate, []);
    }
    
    this.updateQueues.get(nextUpdate).push({ npc, tier });
  }
  
  tick() {
    this.currentTick++;
    
    const queue = this.updateQueues.get(this.currentTick);
    if (!queue) return [];
    
    this.updateQueues.delete(this.currentTick);
    return queue;
  }
}
```

### Predictive Caching

```javascript
class NPCPredictiveCache {
  constructor() {
    this.cache = new Map();
    this.predictions = new Map();
  }
  
  predictFutureState(npc, ticksAhead) {
    // Use simplified simulation to predict future state
    const currentState = this.captureState(npc);
    const predictedState = this.simulateForward(currentState, ticksAhead);
    
    this.predictions.set(npc.id, {
      state: predictedState,
      validUntil: this.currentTick + ticksAhead,
      confidence: this.calculateConfidence(npc)
    });
    
    return predictedState;
  }
  
  simulateForward(state, ticks) {
    // Simplified simulation for prediction
    const predicted = { ...state };
    
    // Predict needs changes
    predicted.hunger += 0.01 * ticks;
    predicted.thirst += 0.015 * ticks;
    predicted.sleep += 0.008 * ticks;
    
    // Predict position (if moving)
    if (state.currentGoal?.type === 'move_to') {
      predicted.position = this.interpolatePosition(
        state.position,
        state.currentGoal.target,
        ticks
      );
    }
    
    return predicted;
  }
  
  calculateConfidence(npc) {
    // Confidence decreases with:
    // - Emotional volatility
    // - Unpredictable personality traits
    // - Complex current goals
    
    let confidence = 1.0;
    
    confidence *= (1 - npc.emotionalState.mood.volatility);
    confidence *= (1 - npc.personality.tendencies.impulsivity * 0.5);
    
    if (npc.currentGoal?.complexity > 0.5) {
      confidence *= 0.7;
    }
    
    return confidence;
  }
}
```

---

## 🌟 Module 8: Emergent Narrative System

### Story Generation

```javascript
class NarrativeEngine {
  constructor() {
    this.storyArcs = [];
    this.activeStories = new Map();
    this.narrativeMemory = [];
  }
  
  detectStoryOpportunity(event, participants) {
    // Analyze event for narrative potential
    const potential = this.calculateNarrativePotential(event);
    
    if (potential > 0.7) {
      const arc = this.createStoryArc(event, participants);
      this.activeStories.set(arc.id, arc);
      return arc;
    }
    
    return null;
  }
  
  createStoryArc(triggerEvent, participants) {
    return {
      id: generateId(),
      type: this.classifyStoryType(triggerEvent),
      participants: participants,
      triggerEvent: triggerEvent,
      acts: this.generateActs(triggerEvent),
      currentAct: 0,
      tension: 0.3,
      resolution: null,
      themes: this.extractThemes(triggerEvent)
    };
  }
  
  classifyStoryType(event) {
    // Classify into archetypal story types
    const types = [
      'revenge', 'redemption', 'rise_to_power', 'fall_from_grace',
      'forbidden_love', 'rivalry', 'quest', 'betrayal', 'sacrifice'
    ];
    
    // Use event characteristics to determine type
    if (event.involves_betrayal) return 'betrayal';
    if (event.involves_romance) return 'forbidden_love';
    if (event.involves_conflict) return 'rivalry';
    
    return 'quest';  // Default
  }
  
  generateActs(triggerEvent) {
    // Three-act structure
    return [
      {
        name: 'Setup',
        goals: this.generateSetupGoals(triggerEvent),
        completed: false
      },
      {
        name: 'Confrontation',
        goals: this.generateConfrontationGoals(triggerEvent),
        completed: false
      },
      {
        name: 'Resolution',
        goals: this.generateResolutionGoals(triggerEvent),
        completed: false
      }
    ];
  }
  
  updateStoryArc(arcId, newEvent) {
    const arc = this.activeStories.get(arcId);
    if (!arc) return;
    
    // Check if event advances the story
    const currentAct = arc.acts[arc.currentAct];
    
    if (this.eventSatisfiesGoal(newEvent, currentAct.goals)) {
      currentAct.completed = true;
      arc.currentAct++;
      arc.tension += 0.2;
      
      // Check if story is complete
      if (arc.currentAct >= arc.acts.length) {
        this.concludeStory(arc);
      }
    }
  }
  
  concludeStory(arc) {
    // Generate narrative summary
    const narrative = this.generateNarrative(arc);
    
    // Store in narrative memory
    this.narrativeMemory.push({
      arc: arc,
      narrative: narrative,
      timestamp: Date.now(),
      impact: this.calculateImpact(arc)
    });
    
    // Remove from active stories
    this.activeStories.delete(arc.id);
    
    return narrative;
  }
  
  generateNarrative(arc) {
    // Convert story arc into readable narrative
    const template = this.getTemplate(arc.type);
    return this.fillTemplate(template, arc);
  }
}
```

---

## 🔧 Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Implement core EmotionalState class
- [ ] Implement StressSystem
- [ ] Integrate with existing Person class
- [ ] Add emotional decay and mood tracking
- [ ] Unit tests for emotional responses

### Phase 2: Memory Systems (Weeks 3-4)
- [ ] Implement EpisodicMemory with capacity limits
- [ ] Implement SemanticMemory knowledge graph
- [ ] Add memory consolidation system
- [ ] Implement memory recall with reconstruction
- [ ] Integration tests with existing Memory class

### Phase 3: Social Dynamics (Weeks 5-6)
- [ ] Implement multi-dimensional Relationship system
- [ ] Implement ReputationSystem with domains
- [ ] Create SocialNetwork graph structure
- [ ] Add relationship evolution over time
- [ ] Test relationship dynamics with multiple NPCs

### Phase 4: Economic Motivation (Weeks 7-8)
- [ ] Implement EconomicMotivation class
- [ ] Add career progression system
- [ ] Implement opportunity evaluation
- [ ] Create wealth accumulation mechanics
- [ ] Test economic decision-making

### Phase 5: Decision Making (Weeks 9-11)
- [ ] Implement UtilityAI with considerations
- [ ] Implement GOAPPlanner
- [ ] Create action library
- [ ] Integrate with existing goal planning
- [ ] Performance optimization for decision-making

### Phase 6: Personality Integration (Weeks 12-13)
- [ ] Extend PersonalitySystem with medieval traits
- [ ] Implement value system
- [ ] Add personality development over time
- [ ] Integrate personality with all decision systems
- [ ] Test personality-driven behavior variations

### Phase 7: Performance (Weeks 14-15)
- [ ] Implement NPCLODSystem
- [ ] Create NPCUpdateScheduler
- [ ] Add predictive caching
- [ ] Optimize memory usage
- [ ] Benchmark with 1000+ NPCs

### Phase 8: Narrative (Weeks 16-17)
- [ ] Implement NarrativeEngine
- [ ] Create story arc detection
- [ ] Add narrative generation
- [ ] Test emergent storytelling
- [ ] Polish narrative output

### Phase 9: Integration & Polish (Weeks 18-20)
- [ ] Full system integration
- [ ] Comprehensive testing
- [ ] Performance tuning
- [ ] Documentation
- [ ] Example scenarios

---

## 📊 Success Metrics

### Believability Metrics
- **Emotional Consistency**: NPCs maintain consistent emotional responses based on personality
- **Memory Accuracy**: NPCs recall past events with appropriate detail and occasional errors
- **Relationship Depth**: Relationships evolve naturally over time based on interactions
- **Decision Coherence**: NPC decisions align with personality, emotions, and goals

### Performance Metrics
- **Update Time**: < 1ms per NPC per update (at appropriate LOD)
- **Memory Usage**: < 10KB per NPC average
- **Scalability**: Support 1000+ active NPCs at 60 FPS
- **Cache Hit Rate**: > 80% for predictive cache

### Emergent Behavior Metrics
- **Story Generation**: 5+ emergent stories per 100 hours of gameplay
- **Unique Interactions**: 90%+ of NPC interactions feel unique
- **Player Impact**: Player actions create measurable ripples in NPC behavior
- **Unpredictability**: NPCs surprise players while remaining believable

---

## 🎯 Key Innovations

1. **Hybrid Decision System**: Combines utility AI (fast, reactive) with GOAP (strategic, goal-oriented)
2. **Psychological Depth**: Full emotional and stress modeling creates authentic behavior
3. **Imperfect Memory**: Memory reconstruction with errors creates realistic recall
4. **Multi-Dimensional Relationships**: Relationships are complex, not just a single "like" value
5. **Emergent Narrative**: Stories arise from NPC interactions, not scripts
6. **Intelligent LOD**: Performance scales gracefully with distance and importance
7. **Personality Evolution**: NPCs grow and change based on experiences
8. **Economic Agency**: NPCs have genuine economic motivations and career ambitions

---

## 🔮 Future Enhancements

- **Cultural Systems**: NPCs influenced by cultural norms and traditions
- **Ideological Beliefs**: Political and philosophical belief systems
- **Group Dynamics**: Crowd behavior and mob psychology
- **Learning AI**: NPCs learn from player behavior and adapt strategies
- **Procedural Dialogue**: Dynamic conversation generation based on context
- **Facial Animation**: Emotional states drive facial expressions
- **Voice Synthesis**: Personality-driven voice characteristics
- **Dream System**: NPCs process experiences through dreams

---

## 📚 References & Inspiration

### Academic Research
- Ortony, Clore, Collins - "The Cognitive Structure of Emotions" (OCC Model)
- Plutchik - "Wheel of Emotions"
- Maslow - "Hierarchy of Needs"
- Tulving - "Episodic and Semantic Memory"

### Game AI Systems
- **F.E.A.R.** - GOAP planning system
- **The Sims** - Needs-based behavior
- **Skyrim** - Radiant AI and daily schedules
- **Red Dead Redemption 2** - NPC routines and memory
- **Crusader Kings 3** - Personality traits and relationships
- **Dwarf Fortress** - Emergent storytelling
- **Shadow of Mordor** - Nemesis system

### Technical Resources
- "Behavioral Mathematics for Game AI" - Dave Mark
- "Game AI Pro" series
- "Programming Game AI by Example" - Mat Buckland
- GDC talks on NPC AI systems

---

*This design represents a comprehensive, AAA-quality NPC system that creates believable, autonomous characters with psychological depth, social intelligence, and emergent behavior. The modular architecture allows for incremental implementation while maintaining performance at scale.*
