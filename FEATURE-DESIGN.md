# Medieval Life Simulation - Feature Design Document

## Overview
This document outlines the design for removing all major limitations and creating a fully-featured medieval life simulation.

---

## 1. Marriage and Family Expansion System

### Core Mechanics
**Marriage System**
- **Courtship Phase**: Build relationship affinity to 70%+ with eligible NPCs
- **Proposal Command**: `propose <name>` - success based on affinity, age, social status
- **Wedding Ceremony**: Automatic event when proposal accepted
- **Marriage Benefits**: Shared household, combined wealth, relationship bonuses

**Eligibility Rules**
- Age 16+ for both parties
- Not already married
- Opposite sex (configurable for same-sex marriages)
- Affinity threshold met
- Not close relatives (kinship check)

**Children System**
- **Conception**: Automatic chance each month when married (5-10% base)
- **Pregnancy**: 9-month gestation period with status effects
- **Birth**: New Person entity created with genetic traits from parents
- **Childhood**: Ages 0-16, cannot work, requires care
- **Inheritance**: Traits, skills, and physical attributes from parents

**Family Management**
- Track spouse relationship
- Monitor children's growth and needs
- Family events (birthdays, coming of age)
- Inheritance when parents die
- Generational gameplay (play as heir)

### Data Structures
```javascript
Person.marriage = {
  spouse: entityId,
  marriedDate: timestamp,
  anniversaries: number,
  children: [entityIds]
}

Person.pregnancy = {
  isPregnant: boolean,
  father: entityId,
  dueDate: timestamp,
  complications: []
}
```

### Commands
- `propose <name>` - Propose marriage
- `marry <name>` - Accept proposal
- `divorce` - End marriage (consequences)
- `family` - View family tree
- `heir` - Designate heir for succession

---

## 2. Trading and Economy System

### Market System
**Shop Types**
- **General Store**: Food, basic tools, clothing
- **Blacksmith**: Weapons, armor, metal tools
- **Apothecary**: Medicine, herbs, potions
- **Tavern**: Food, drink, lodging, rumors
- **Market Stall**: Varied goods, better prices

**Pricing Mechanics**
- Base price per item type
- Supply/demand modifiers (scarcity increases price)
- Merchant skill affects prices (haggling)
- Settlement wealth affects available goods
- Seasonal variations (food cheaper in harvest)

**Trading Commands**
- `shop` - List nearby shops
- `browse <shop>` - View shop inventory
- `buy <item> [quantity]` - Purchase items
- `sell <item> [quantity]` - Sell to merchant
- `haggle` - Attempt to negotiate price
- `trade <person> <offer> for <request>` - Barter with NPCs

**Currency System**
- Copper coins (1 value)
- Silver coins (10 copper)
- Gold coins (100 copper)
- Automatic conversion
- Wealth stored in household and personal purse

**Economic Simulation**
- Settlements generate goods based on population and resources
- Merchants travel between settlements (trade routes)
- Prices fluctuate based on supply/demand
- Economic events (famine, boom, trade disruption)

### Data Structures
```javascript
Shop = {
  id: string,
  name: string,
  type: 'general'|'blacksmith'|'apothecary'|'tavern',
  owner: entityId,
  location: {x, y},
  inventory: Map<itemType, {quantity, price}>,
  wealth: number,
  reputation: number
}

Person.purse = {
  copper: number,
  silver: number,
  gold: number
}

Market = {
  settlementId: string,
  shops: [Shop],
  priceIndex: Map<itemType, priceModifier>,
  supplyDemand: Map<itemType, {supply, demand}>
}
```

---

## 3. Property Ownership System

### Property Types
**Residential**
- Hovel (cheap, small)
- Cottage (medium, family)
- House (large, wealthy)
- Manor (very large, noble)

**Commercial**
- Shop (sell goods)
- Workshop (craft items)
- Tavern (food, lodging)
- Farm (agriculture)

**Land**
- Field (farming)
- Pasture (livestock)
- Forest (timber)
- Mine (resources)

### Ownership Mechanics
**Buying Property**
- `properties` - List available properties
- `buy property <id>` - Purchase property
- `view property <id>` - Inspect before buying
- Price based on size, location, condition
- Requires wealth and possibly social status

**Property Management**
- Pay maintenance costs (monthly)
- Upgrade/improve property
- Rent to tenants (passive income)
- Sell property
- Inherit property

**Building System**
- `build <type> at <x,y>` - Construct new building
- Requires materials, workers, time
- Building phases: foundation, walls, roof, interior
- Can hire NPCs to help build

### Data Structures
```javascript
Property = {
  id: string,
  type: 'residential'|'commercial'|'land',
  subtype: string,
  owner: entityId,
  location: {x, y},
  size: number,
  value: number,
  condition: 0-1,
  upgrades: [],
  tenants: [entityIds],
  income: number,
  expenses: number
}

Person.properties = [propertyIds]
```

### Commands
- `properties` - List available/owned properties
- `buy property <id>` - Purchase
- `sell property <id>` - Sell
- `upgrade property <id>` - Improve
- `rent property <id> to <person>` - Rent out
- `evict <person>` - Remove tenant

---

## 4. Agriculture and Farming System

### Crop System
**Crop Types**
- Wheat (staple grain)
- Barley (brewing, animal feed)
- Vegetables (carrots, turnips, cabbage)
- Fruit (apples, berries)
- Herbs (medicinal, cooking)

**Farming Cycle**
1. **Preparation**: Plow field (spring)
2. **Planting**: Sow seeds (spring)
3. **Growing**: Water, weed, protect (summer)
4. **Harvest**: Collect crops (autumn)
5. **Storage**: Preserve for winter

**Farming Mechanics**
- Crops require specific seasons
- Weather affects growth (rain good, drought bad)
- Pests and disease can damage crops
- Soil quality affects yield
- Skills improve yield and quality

### Livestock System
**Animal Types**
- Chickens (eggs, meat)
- Pigs (meat, leather)
- Cows (milk, meat, leather)
- Sheep (wool, meat)
- Horses (transportation, work)

**Animal Care**
- Feed daily (grain, grass)
- Water access required
- Shelter from weather
- Breeding for offspring
- Slaughter for products

### Commands
- `plow <field>` - Prepare field for planting
- `plant <crop> in <field>` - Sow seeds
- `water <field>` - Irrigate crops
- `harvest <field>` - Collect crops
- `feed <animals>` - Feed livestock
- `breed <animal1> <animal2>` - Breed animals
- `slaughter <animal>` - Butcher for products
- `milk <cow>` - Collect milk
- `shear <sheep>` - Collect wool

### Data Structures
```javascript
Field = {
  id: string,
  owner: entityId,
  location: {x, y},
  size: number,
  soilQuality: 0-1,
  crop: cropType|null,
  growthStage: 0-1,
  health: 0-1,
  plantedDate: timestamp,
  harvestDate: timestamp
}

Animal = {
  id: string,
  type: 'chicken'|'pig'|'cow'|'sheep'|'horse',
  owner: entityId,
  age: number,
  health: 0-1,
  hunger: 0-1,
  pregnant: boolean,
  products: {eggs, milk, wool}
}

Person.farm = {
  fields: [fieldIds],
  animals: [animalIds],
  barn: {capacity, stored},
  equipment: [tools]
}
```

---

## 5. Quest Generation System

### Quest Types
**Personal Quests**
- Delivery (take item to person/place)
- Collection (gather X items)
- Escort (protect person traveling)
- Investigation (find information)
- Revenge (confront enemy)

**Economic Quests**
- Trade route (establish commerce)
- Craft order (make specific items)
- Resource gathering (mine, chop, hunt)
- Debt collection (recover money)

**Social Quests**
- Matchmaking (help NPCs marry)
- Mediation (resolve disputes)
- Recruitment (find workers)
- Reputation (improve standing)

**Combat Quests**
- Bandit clearing (eliminate threats)
- Protection (guard person/place)
- Hunting (kill dangerous animals)
- Duel (challenge to combat)

### Quest Generation
**Dynamic Creation**
- NPCs generate quests based on needs
- Settlement events create quests
- Random encounters trigger quests
- Relationship-based quests from friends

**Quest Properties**
- Giver (NPC or settlement)
- Objective (clear goal)
- Reward (money, items, reputation)
- Time limit (optional)
- Difficulty (based on player level)
- Prerequisites (skills, items, relationships)

### Quest System
- `quests` - View active quests
- `accept quest <id>` - Accept quest
- `abandon quest <id>` - Cancel quest
- `complete quest <id>` - Turn in quest
- Quest log tracks progress
- Multiple active quests allowed
- Quest chains (one leads to another)

### Data Structures
```javascript
Quest = {
  id: string,
  title: string,
  description: string,
  giver: entityId,
  type: 'delivery'|'collection'|'escort'|etc,
  objective: {
    type: string,
    target: any,
    progress: number,
    required: number
  },
  reward: {
    money: number,
    items: [],
    reputation: number,
    experience: number
  },
  timeLimit: timestamp|null,
  difficulty: 1-10,
  status: 'available'|'active'|'completed'|'failed'
}

Person.quests = {
  active: [questIds],
  completed: [questIds],
  failed: [questIds]
}
```

---

## 6. Skill Training System

### Skill Categories
**Physical Skills**
- Combat (melee, ranged, defense)
- Athletics (running, climbing, swimming)
- Crafting (smithing, carpentry, tailoring)
- Labor (farming, mining, construction)

**Mental Skills**
- Knowledge (medicine, history, nature)
- Social (persuasion, deception, leadership)
- Trade (haggling, appraisal, accounting)
- Magic (if enabled - alchemy, enchanting)

### Training Mechanics
**Learning Methods**
1. **Practice**: Use skill to improve (slow)
2. **Training**: Pay trainer for lessons (fast)
3. **Books**: Read to gain knowledge (medium)
4. **Mentorship**: Apprentice to master (best)

**Trainers**
- NPCs with high skills can train
- Cost based on skill level and trainer reputation
- Training sessions take time
- Multiple sessions needed for advancement
- Relationship affects training quality

**Skill Progression**
- Levels 1-100 per skill
- Experience points per use
- Diminishing returns at high levels
- Specializations unlock at level 50
- Master level at 90+

### Commands
- `skills` - View all skills and levels
- `train <skill> with <trainer>` - Start training
- `practice <skill>` - Solo practice
- `read <book>` - Study from book
- `apprentice <master>` - Become apprentice
- `teach <skill> to <student>` - Teach others

### Data Structures
```javascript
Person.skills = {
  physical: {
    combat: {level, xp, specialization},
    athletics: {level, xp, specialization},
    crafting: {level, xp, specialization},
    labor: {level, xp, specialization}
  },
  mental: {
    knowledge: {level, xp, specialization},
    social: {level, xp, specialization},
    trade: {level, xp, specialization}
  },
  training: {
    currentSkill: string|null,
    trainer: entityId|null,
    sessionsRemaining: number,
    progress: 0-1
  }
}

Trainer = {
  id: entityId,
  skills: Map<skillName, level>,
  students: [entityIds],
  rate: number,
  reputation: number
}
```

---

## 7. Transportation System

### Mount System
**Horse Types**
- Draft (slow, strong, cargo)
- Riding (fast, travel)
- War (combat, armored)
- Pony (cheap, small)

**Horse Mechanics**
- Purchase from stable
- Feed and care required
- Can die from neglect or combat
- Speeds up travel (3x faster)
- Carry extra cargo
- Can be stolen

### Vehicle System
**Cart Types**
- Hand cart (push, small)
- Ox cart (slow, large cargo)
- Wagon (horse-drawn, very large)
- Carriage (passenger transport)

**Vehicle Mechanics**
- Requires animal to pull (except hand cart)
- Much larger cargo capacity
- Slower than riding
- Can transport multiple people
- Requires roads for best speed

### Boat System
**Boat Types**
- Raft (basic, rivers)
- Rowboat (small, lakes)
- Sailboat (medium, coast)
- Ship (large, ocean)

**Water Travel**
- Rivers and lakes navigable
- Coastal sailing
- Weather affects travel
- Can transport cargo
- Fishing from boat

### Commands
- `mount <horse>` - Ride horse
- `dismount` - Get off horse
- `hitch <animal> to <cart>` - Attach vehicle
- `board <boat>` - Enter boat
- `sail <direction>` - Navigate water
- `stable` - View/buy horses
- `feed <mount>` - Care for animal

### Data Structures
```javascript
Mount = {
  id: string,
  type: 'horse'|'pony',
  subtype: 'draft'|'riding'|'war',
  owner: entityId,
  age: number,
  health: 0-1,
  hunger: 0-1,
  speed: number,
  carryCapacity: number,
  location: {x, y}
}

Vehicle = {
  id: string,
  type: 'cart'|'wagon'|'carriage',
  owner: entityId,
  animal: mountId|null,
  cargoCapacity: number,
  cargo: [items],
  passengers: [entityIds],
  location: {x, y}
}

Boat = {
  id: string,
  type: 'raft'|'rowboat'|'sailboat'|'ship',
  owner: entityId,
  cargoCapacity: number,
  passengerCapacity: number,
  location: {x, y},
  inWater: boolean
}
```

---

## 8. Advanced Combat Tactics

### Formation System
**Formation Types**
- Shield Wall (defensive)
- Wedge (offensive charge)
- Line (balanced)
- Skirmish (ranged)
- Ambush (surprise)

**Formation Mechanics**
- Requires 3+ combatants
- Leader commands formation
- Bonuses to defense/attack
- Morale affects cohesion
- Can break under pressure

### Tactical Commands
- `form <formation>` - Create formation
- `command <order>` - Give orders to allies
- `flank <target>` - Attack from side
- `retreat` - Organized withdrawal
- `charge` - Aggressive advance
- `hold` - Defensive stance

### Mounted Combat
**Mechanics**
- Charge bonus damage
- Height advantage
- Trample infantry
- Vulnerable to spears
- Horse can be killed
- Dismounted if horse dies

### Siege Warfare
**Siege Equipment**
- Battering ram (break gates)
- Siege tower (scale walls)
- Catapult (ranged bombardment)
- Trebuchet (heavy artillery)

**Siege Mechanics**
- Attacker vs defender
- Walls provide defense bonus
- Supplies matter (food, arrows)
- Morale affects outcome
- Can negotiate surrender

### Ranged Combat
**Weapon Types**
- Bow (medium range, fast)
- Crossbow (long range, slow)
- Javelin (short range, thrown)
- Sling (cheap, weak)

**Ranged Mechanics**
- Distance affects accuracy
- Wind affects arrows
- Cover provides protection
- Ammunition limited
- Can target specific body parts

### Data Structures
```javascript
Formation = {
  id: string,
  type: 'shield_wall'|'wedge'|'line'|'skirmish',
  leader: entityId,
  members: [entityIds],
  cohesion: 0-1,
  bonuses: {attack, defense, morale}
}

Combat.tactics = {
  formation: formationId|null,
  stance: 'aggressive'|'defensive'|'balanced',
  target: entityId|null,
  orders: []
}

Siege = {
  id: string,
  attacker: factionId,
  defender: factionId,
  location: settlementId,
  equipment: [siegeEquipment],
  duration: number,
  supplies: {food, arrows, morale}
}
```

---

## 9. Religion and Culture Systems

### Religion System
**Belief Types**
- Monotheism (one god)
- Polytheism (many gods)
- Animism (nature spirits)
- Ancestor worship

**Religious Mechanics**
- Choose religion at start or convert
- Attend services (weekly)
- Pray for bonuses (daily)
- Religious festivals (seasonal)
- Pilgrimages (travel to holy sites)
- Tithes (donate money)

**Religious Buildings**
- Church/Temple (worship)
- Monastery (study, healing)
- Shrine (small, local)
- Cathedral (large, important)

**Clergy System**
- Priests (lead services)
- Monks (study, craft)
- Bishops (high rank)
- Can become clergy (vocation)

### Culture System
**Cultural Traits**
- Language (affects communication)
- Customs (marriage, death, festivals)
- Values (honor, wealth, family)
- Taboos (forbidden actions)
- Art (music, stories, crafts)

**Cultural Mechanics**
- Born into culture
- Can learn other cultures
- Cultural conflicts (prejudice)
- Cultural exchange (trade, marriage)
- Festivals and holidays
- Traditional clothing and food

### Commands
- `pray` - Pray to deity
- `worship` - Attend service
- `donate <amount>` - Give to church
- `pilgrimage <site>` - Travel to holy site
- `convert <religion>` - Change faith
- `festival` - Participate in celebration
- `learn culture <name>` - Study culture

### Data Structures
```javascript
Religion = {
  id: string,
  name: string,
  type: 'monotheism'|'polytheism'|'animism'|'ancestor',
  deities: [{name, domain, symbol}],
  tenets: [beliefs],
  rituals: [practices],
  holyDays: [dates],
  clergy: [entityIds]
}

Culture = {
  id: string,
  name: string,
  language: string,
  customs: {marriage, death, festivals},
  values: [priorities],
  taboos: [forbidden],
  art: {music, stories, crafts}
}

Person.religion = {
  faith: religionId,
  piety: 0-100,
  lastPrayer: timestamp,
  lastService: timestamp,
  donations: number,
  pilgrimages: [sites]
}

Person.culture = {
  primary: cultureId,
  learned: [cultureIds],
  fluency: Map<cultureId, 0-1>
}
```

---

## Implementation Priority

## Implementation Status (as of 2026-07-12)

Phases 1-5 of the original timeline are aspirational fiction — the
project has been in single-developer maintenance mode. The actual current
state is:

- **In MVP / wired to player**: combat, marriage, trading, agriculture,
  flora, fauna, religion, language, magic, transportation, housing,
  daily survival (eat/drink/sleep), reputation/gossip.
- **Stubbed but not wired**: warfare, factions (player-driven), politics
  (player-driven), magic (player-driven), modding, multiplayer, sound,
  graphical UI.
- **Not started**: see `docs/C_DDA_MEDIEVAL_ROADMAP.md` for a realistic
  roadmap.

The 10-week timeline below is the original aspirational plan; it does
not reflect the actual pace of work.

---

## Technical Considerations

### Performance
- Lazy loading for distant entities
- Caching for frequently accessed data
- Optimize pathfinding for mounts/vehicles
- Limit active quests per player
- Batch updates for farms/properties

### Save System
- Incremental saves (only changed data)
- Compression for large worlds
- Version migration for updates
- Cloud save support (optional)

### Modding Support
- JSON-based data files
- Plugin system for custom content
- Event hooks for extensions
- Documentation for modders

### Multiplayer Considerations
- Client-server architecture
- Synchronization of world state
- Player interaction protocols
- Anti-cheat measures
- Scalability for many players

---

## Success Metrics

### Player Engagement
- Average session length > 2 hours
- Return rate > 60% after 1 week
- Completion of at least 1 major goal per session

### System Usage
*(Note: the specific percentages previously listed in this section were
fabricated — no player telemetry exists. They have been removed.)*

The repo's actual player-visible coverage is tracked in
`docs/GDD_GAP_ANALYSIS.md` (~55% as of 2026-07-12).

### Technical Performance
- Load time < 5 seconds
- Frame rate > 30 FPS (for UI updates)
- Save/load < 2 seconds
- No memory leaks over 10+ hour sessions

---

## Conclusion

This design document provides a comprehensive blueprint for transforming Medieval Life Simulation from a basic sandbox into a fully-featured medieval life RPG. Each system is designed to integrate with existing mechanics while adding depth and player agency.

The phased implementation approach ensures steady progress while maintaining stability. Priority is given to systems that provide immediate player value (marriage, trading, skills) before moving to more complex features (advanced combat, religion).

All systems are designed with:
- **Realism**: Grounded in medieval history
- **Emergence**: Systems interact to create unexpected gameplay
- **Player Agency**: Meaningful choices with consequences
- **Scalability**: Can handle large worlds and many NPCs
- **Moddability**: Easy to extend and customize

**Next Steps**: see `docs/C_DDA_MEDIEVAL_ROADMAP.md` for current realistic roadmap.
