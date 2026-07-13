# Medieval Life Simulation - Complete Gameplay Guide

## 🎮 What You CAN Do in a Full Playthrough

### ✅ Character & Life Management

**Birth & Growth**
- ✅ Be born as a baby in a medieval settlement
- ✅ Have parents (mother and father) automatically created
- ✅ Belong to a household with family members
- ✅ Age naturally over time (1 turn = 1 minute of game time)
- ✅ Experience childhood, adulthood, and old age
- ✅ Die from old age, starvation, dehydration, or injuries

**Basic Needs**
- ✅ Manage hunger (eat food to survive)
- ✅ Manage thirst (drink water to survive)
- ✅ Manage sleep (rest to recover fatigue)
- ✅ Monitor health, pain, and fatigue levels
- ✅ Experience consequences of neglecting needs (death)

**Physiology**
- ✅ Track blood volume, body temperature, metabolism
- ✅ Experience pain from injuries
- ✅ Suffer from fatigue affecting performance
- ✅ Monitor organ health (heart, lungs, liver, etc.)
- ✅ Experience realistic injury effects on body parts

### ✅ Movement & Exploration

**Navigation**
- ✅ Move in 4 directions (north, south, east, west)
- ✅ Explore a procedurally generated 100×100 world (or larger)
- ✅ Visit 5+ settlements with unique names and populations
- ✅ Discover different biomes (forest, grassland, desert, tundra, mountain)
- ✅ Experience varied terrain (elevation 0-500m)
- ✅ Encounter rivers and water sources

**Environment**
- ✅ Experience dynamic weather (rain, clear skies)
- ✅ Feel temperature changes (-50°C to +50°C)
- ✅ See seasonal changes (spring, summer, autumn, winter)
- ✅ Observe time of day (morning, afternoon, evening, night)
- ✅ Find resources (iron, copper, gold, timber, stone, etc.)

### ✅ Social Interactions

**Relationships**
- ✅ Talk to 1,500+ NPCs across settlements
- ✅ Build relationships through conversations
- ✅ Track affinity levels (friendship/hostility)
- ✅ Recognize family members (parents, siblings)
- ✅ Have special dialogue with kinship members
- ✅ Make friends and enemies

**Combat**
- ✅ Attack other characters
- ✅ Use weapons for bonus damage
- ✅ Target specific body parts
- ✅ Deal and receive injuries
- ✅ Kill NPCs (they can die permanently)
- ✅ Experience combat consequences (pain, bleeding)

### ✅ Economy & Work

**Occupation System**
- ✅ Start as a child (no work)
- ✅ Become a peasant, craftsman, merchant, or other occupation
- ✅ Work 8-hour shifts at your job
- ✅ Earn wealth for your household
- ✅ Generate food through work
- ✅ Productivity based on skills and health

**Household Management**
- ✅ Share resources with household members
- ✅ Track household wealth (coins)
- ✅ Monitor household food stores
- ✅ See number of household members
- ✅ Contribute to family prosperity

### ✅ Items & Inventory

**Item Management**
- ✅ Pick up items from the ground
- ✅ Drop items to the ground
- ✅ Carry items with weight limits
- ✅ View detailed inventory
- ✅ Items persist at specific locations
- ✅ Find food, tools, weapons, materials

**Item Types Available**
- ✅ Food items (bread, meat, vegetables)
- ✅ Tools (wooden stick, stone axe)
- ✅ Weapons (sword, spear, bow)
- ✅ Materials (wood, stone, metal)
- ✅ Crafted items (varies by recipe)

### ✅ Crafting System

**Item Creation**
- ✅ Craft items using recipes
- ✅ Require specific materials
- ✅ Skill-based success rates
- ✅ Create tools, weapons, and goods
- ✅ Improve with practice

### ✅ Game Management

**Save/Load**
- ✅ Save game at any time
- ✅ Auto-timestamped save files
- ✅ Load from multiple save slots
- ✅ Full world state preservation
- ✅ Character, inventory, and relationships saved

**UI Features**
- ✅ Full-screen terminal interface
- ✅ Split-panel layout (location + status)
- ✅ Progress bars for all stats
- ✅ Color-coded messages
- ✅ Interactive selection menus
- ✅ Scrollable message log
- ✅ Developer mode for debugging

### ✅ World Simulation

**Emergent Gameplay**
- ✅ No scripted quests (pure sandbox)
- ✅ NPCs live their own lives
- ✅ Dynamic world state
- ✅ Consequences for all actions
- ✅ Realistic cause and effect
- ✅ Generational gameplay potential

---

## ⚠️ What Is Not Yet Exposed In-Game

The features below have **working code on disk** (`src/systems/*` and `Game.js`) but are not yet fully wired into the default UIs. See `docs/GDD_GAP_ANALYSIS.md` for the wired-vs-unwired breakdown.

### Social Features

**Marriage & Family** *(Enhanced UI only)*
- ✅ Can marry other characters (`propose` / `marry`)
- ✅ Can have children via pregnancy/birth system
- ❌ Cannot adopt children (not implemented)
- ✅ Can divorce (`divorce`)
- ⚠️ Courtship is gated by 70% relationship affinity — raise affinity via repeated `talk` first
- ❌ No wedding ceremonies

**Complex Relationships**
- ⚠️ Reputation system exists (`src/systems/Reputation.js`) but is a stub — NPCs don't yet propagate reputation
- ❌ Cannot form alliances or factions (Factions.js exists but not wired)
- ❌ Cannot declare war (Warfare.js exists but not wired)
- ❌ No political intrigue / betrayal mechanics

### Economy

**Trading** *(Enhanced UI only)*
- ✅ Can buy items from merchants (`shop`, `browse`, `buy`)
- ✅ Can sell items to NPCs (`sell`)
- ✅ Market prices and economy simulation
- ✅ Can haggle (`haggle`)
- ❌ No barter / currency exchange
- ⚠️ Blessed UI and Roguelike UI do not expose trading commands (run `./sandboxed` for the Enhanced UI)

**Property**
- ⚠️ Buildings system exists but is not wired
- ❌ Cannot buy/sell land

### Crafting

- ✅ Basic crafting (`craft <recipe>`) via CraftingSystem
- ❌ Cannot set up workshops
- ❌ Cannot hire workers
- ❌ Cannot mass-produce items
- ❌ No production chains
- ❌ No quality tiers for crafted items
- ❌ Limited recipe variety

**Agriculture** *(Flora, Fauna, Agriculture systems exist on disk)*
- ⚠️ Flora/Fauna/Agriculture systems instantiated in Game.js but use a different per-tick signature, so updates are guarded and may be no-ops
- ❌ No player-facing plant/harvest commands

### ⚠️ Advanced Combat

**Tactical Combat**
- ✅ Basic combat (`attack`) works via Combat.resolveAttack
- ❌ No formations or tactics
- ❌ NPCs do not initiate combat autonomously
- ❌ No mounted combat
- ❌ No armor effectiveness system

**Military**
- ⚠️ Warfare.js exists (515 LOC) but is not wired
- ❌ No sieges or large battles
- ❌ No war campaigns

### ⚠️ Character Progression

**Skills & Training**
- ✅ Skills improve passively via practice
- ❌ No deliberate skill training commands
- ❌ No skill teachers / mentors / books

**Character Customization**
- ❌ Cannot choose starting occupation (random from peasant/craftsman/merchant/soldier/priest)
- ❌ Cannot select traits or perks

### ❌ Quests & Objectives

- ❌ No quests, storyline, or milestones (pure sandbox)

### ❌ Magic & Fantasy

- ❌ No magic system, spells, or supernatural elements

### ⚠️ Religion & Culture

- ⚠️ Religion.js instantiated but not yet generating temples/clergy
- ❌ No prayer, rituals, or festivals yet

### ❌ Transportation

- ❌ No horses, carts, boats, or fast travel

### ⚠️ Advanced UI Features

- ✅ Roguelike UI has an ASCII world map
- ❌ No graphical interface
- ❌ No mouse support
- ❌ No sound/music

### ❌ Multiplayer

- ❌ Single-player only

### ❌ Modding & Customization

**Extensibility**
- ❌ No mod support (yet)
- ❌ Cannot add custom content easily
- ❌ No modding tools
- ❌ No plugin system
- ❌ Code changes required for modifications

---

## 🎯 Recommended Playstyles

Given the current features, here are the best ways to enjoy the game:

### 1. **Survival Challenge**
- Focus on managing needs (hunger, thirst, sleep)
- Work regularly to earn food and wealth
- Explore to find resources
- Avoid combat to stay alive longer
- **Goal**: Survive as many years as possible

### 2. **Social Butterfly**
- Talk to everyone you meet
- Build relationships with NPCs
- Make friends in every settlement
- Avoid making enemies
- **Goal**: Befriend 50+ people

### 3. **Wandering Explorer**
- Travel to all settlements
- Discover all biomes
- Find rare resources
- Map the entire world
- **Goal**: Visit every corner of the map

### 4. **Combat Warrior**
- Attack hostile NPCs
- Build combat skills through practice
- Collect weapons and equipment
- Survive dangerous encounters
- **Goal**: Defeat 10+ opponents

### 5. **Economic Tycoon**
- Work constantly to earn wealth
- Build household prosperity
- Accumulate food stores
- Manage resources efficiently
- **Goal**: Reach 1000+ household wealth

### 6. **Generational Legacy**
- Live a full life from birth to death
- Build relationships and wealth
- Prepare for succession (future feature)
- Document your character's story
- **Goal**: Live 50+ game years

---

## 📊 Gameplay Statistics

**Average Playthrough**
- Lifespan: 20-70 game years (depending on care)
- NPCs met: 50-200 people
- Settlements visited: 3-5
- Items collected: 10-50
- Relationships formed: 10-30
- Wealth earned: 100-1000 coins
- Food consumed: 500-2000 units

**World Scale**
- Total NPCs: 1,500-2,000 (default config)
- Total settlements: 5 (default)
- World size: 100×100 tiles (10,000 locations)
- Playable area: Entire world
- Time scale: 1 turn = 1 minute

---

## 🔮 Future Possibilities

Features that could be added in future versions:

**High Priority**
- Marriage and family expansion
- Trading and economy system
- Agriculture and farming
- Skill training system
- Quest generation

**Medium Priority**
- Property ownership
- Advanced crafting
- Transportation (horses, carts)
- Religion and culture
- Political systems

**Low Priority**
- Magic system (if desired)
- Multiplayer support
- Graphical interface
- Modding support
- Sound and music

---

## 💡 Tips for Maximum Enjoyment

1. **Set Your Own Goals**: Since there are no quests, create your own objectives
2. **Role-Play**: Imagine your character's personality and motivations
3. **Experiment**: Try different approaches and see what happens
4. **Save Often**: Use multiple save slots to try different paths
5. **Explore Thoroughly**: The world is large and full of details
6. **Build Relationships**: Social interactions are a core feature
7. **Manage Resources**: Balance work, rest, and exploration
8. **Accept Consequences**: Death is permanent, actions matter
9. **Use Developer Mode**: Learn the underlying systems
10. **Be Patient**: This is a slow-paced, contemplative game

---

## 🎮 Conclusion

**Medieval Life Simulation** is a **sandbox life simulator** focused on:
- ✅ Realistic survival mechanics
- ✅ Social interactions and relationships
- ✅ Emergent gameplay and player freedom
- ✅ Naturalistic world simulation
- ✅ Turn-based contemplative gameplay

It is **NOT** a game with:
- ❌ Quests or structured objectives
- ❌ Complex economy or trading
- ❌ Advanced combat tactics
- ❌ Magic or fantasy elements
- ❌ Multiplayer features

**Best For**: Players who enjoy sandbox games, life simulators, and emergent storytelling
**Not For**: Players seeking action, quests, or structured progression

**Play it to**: Experience a realistic medieval life, make your own stories, and see what emerges from the simulation!
