/**
 * Religion.js
 * Religious institutions, practices, beliefs, effects on behavior
 * In naturalistic mode: affects psychology/society, no actual divine intervention
 */

export class Religion {
  /**
   * @param {Culture} culture  shared culture system
   * @param {SimulationKernel|number} kernel  kernel (preferred) or seed
   *   for back-compat with old `new Religion(culture, seed)` call sites.
   * @param {Game} [game]  orchestrator reference for inter-system calls.
   */
  constructor(culture, kernel, game = null) {
    this.culture = culture;
    // Allow back-compat: if `kernel` is a number, treat it as the legacy seed.
    const seed = (typeof kernel === 'number') ? kernel : (kernel?.seed ?? 0);
    this.kernel = (typeof kernel === 'number') ? null : kernel;
    this.game = game;
    this.seed = seed;
    this.pantheon = this.generatePantheon(seed);
    this.institutions = this.generateInstitutions(seed);
    this.practices = this.generatePractices(seed);
    this.beliefs = this.generateBeliefs(seed);
    this.clergy = new Map();
    this.temples = new Map();
    this.nextTempleId = 1;
  }

  generatePantheon(seed) {
    const rng = this.seededRandom(seed);
    const type = this.selectPantheonType(rng);
    
    const pantheon = {
      type: type, // monotheistic, polytheistic, animistic, ancestor
      deities: [],
      cosmology: this.generateCosmology(rng),
      afterlife: this.generateAfterlife(rng)
    };
    
    const deityCount = type === 'monotheistic' ? 1 : 
                       type === 'polytheistic' ? Math.floor(rng() * 8) + 3 :
                       type === 'animistic' ? Math.floor(rng() * 20) + 10 : 0;
    
    for (let i = 0; i < deityCount; i++) {
      pantheon.deities.push(this.generateDeity(rng, i));
    }
    
    return pantheon;
  }

  selectPantheonType(rng) {
    const val = rng();
    if (val < 0.3) return 'monotheistic';
    if (val < 0.7) return 'polytheistic';
    if (val < 0.9) return 'animistic';
    return 'ancestor';
  }

  generateDeity(rng, index) {
    return {
      id: index,
      name: `Deity ${index + 1}`,
      domain: this.selectDomain(rng),
      attributes: this.selectAttributes(rng),
      symbols: this.selectSymbols(rng),
      offerings: this.selectOfferings(rng),
      temperament: rng() > 0.5 ? 'benevolent' : 'demanding',
      power: rng()
    };
  }

  selectDomain(rng) {
    const domains = ['sky', 'earth', 'water', 'fire', 'war', 'harvest', 'death', 'love', 'wisdom', 'craft'];
    return domains[Math.floor(rng() * domains.length)];
  }

  selectAttributes(rng) {
    const attributes = ['just', 'merciful', 'wrathful', 'wise', 'creative', 'protective', 'jealous'];
    const count = Math.floor(rng() * 3) + 1;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(attributes[Math.floor(rng() * attributes.length)]);
    }
    
    return [...new Set(selected)];
  }

  selectSymbols(rng) {
    const symbols = ['sun', 'moon', 'star', 'tree', 'mountain', 'river', 'animal', 'weapon'];
    const count = Math.floor(rng() * 2) + 1;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(symbols[Math.floor(rng() * symbols.length)]);
    }
    
    return [...new Set(selected)];
  }

  selectOfferings(rng) {
    const offerings = ['food', 'drink', 'incense', 'flowers', 'animal', 'craft', 'prayer'];
    const count = Math.floor(rng() * 3) + 1;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(offerings[Math.floor(rng() * offerings.length)]);
    }
    
    return [...new Set(selected)];
  }

  generateCosmology(rng) {
    return {
      creation: this.selectCreationMyth(rng),
      structure: this.selectCosmicStructure(rng),
      cycles: rng() > 0.5,
      endTimes: rng() > 0.6
    };
  }

  selectCreationMyth(rng) {
    const myths = ['ex_nihilo', 'cosmic_egg', 'world_parent', 'emergence', 'divine_craft'];
    return myths[Math.floor(rng() * myths.length)];
  }

  selectCosmicStructure(rng) {
    const structures = ['three_realms', 'world_tree', 'cosmic_ocean', 'celestial_dome'];
    return structures[Math.floor(rng() * structures.length)];
  }

  generateAfterlife(rng) {
    return {
      exists: rng() > 0.2,
      judgment: rng() > 0.5,
      reincarnation: rng() > 0.7,
      ancestorRealm: rng() > 0.6,
      paradise: rng() > 0.5,
      punishment: rng() > 0.6
    };
  }

  generateInstitutions(seed) {
    const rng = this.seededRandom(seed + 1);
    
    return {
      hierarchy: this.selectHierarchy(rng),
      clergy: {
        celibacy: rng() > 0.7,
        hereditary: rng() > 0.6,
        training: Math.floor(rng() * 10) + 1, // years
        roles: this.selectClergyRoles(rng)
      },
      temples: {
        architecture: this.selectArchitecture(rng),
        access: rng() > 0.5 ? 'public' : 'restricted',
        maintenance: this.selectMaintenance(rng)
      },
      authority: {
        spiritual: rng(),
        temporal: rng(),
        judicial: rng() > 0.5,
        educational: rng() > 0.6
      }
    };
  }

  selectHierarchy(rng) {
    const val = rng();
    if (val < 0.3) return 'none';
    if (val < 0.6) return 'simple';
    return 'complex';
  }

  selectClergyRoles(rng) {
    const roles = ['priest', 'healer', 'teacher', 'judge', 'prophet', 'mystic'];
    const count = Math.floor(rng() * 4) + 2;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(roles[Math.floor(rng() * roles.length)]);
    }
    
    return [...new Set(selected)];
  }

  selectArchitecture(rng) {
    const styles = ['simple', 'monumental', 'cave', 'outdoor', 'elaborate'];
    return styles[Math.floor(rng() * styles.length)];
  }

  selectMaintenance(rng) {
    const methods = ['offerings', 'tithes', 'labor', 'endowment'];
    return methods[Math.floor(rng() * methods.length)];
  }

  generatePractices(seed) {
    const rng = this.seededRandom(seed + 2);
    
    return {
      prayer: {
        frequency: this.selectFrequency(rng),
        times: this.selectPrayerTimes(rng),
        posture: this.selectPosture(rng),
        direction: rng() > 0.6
      },
      sacrifice: {
        practiced: rng() > 0.5,
        types: this.selectSacrificeTypes(rng),
        frequency: this.selectFrequency(rng)
      },
      pilgrimage: {
        required: rng() > 0.6,
        sites: Math.floor(rng() * 5) + 1,
        frequency: 'lifetime'
      },
      fasting: {
        practiced: rng() > 0.5,
        duration: Math.floor(rng() * 30) + 1, // days
        frequency: this.selectFrequency(rng)
      },
      meditation: {
        practiced: rng() > 0.6,
        techniques: this.selectMeditationTechniques(rng)
      }
    };
  }

  selectFrequency(rng) {
    const frequencies = ['daily', 'weekly', 'monthly', 'seasonal', 'annual', 'occasional'];
    return frequencies[Math.floor(rng() * frequencies.length)];
  }

  selectPrayerTimes(rng) {
    const count = Math.floor(rng() * 5) + 1;
    return count;
  }

  selectPosture(rng) {
    const postures = ['standing', 'kneeling', 'prostrate', 'sitting', 'dancing'];
    return postures[Math.floor(rng() * postures.length)];
  }

  selectSacrificeTypes(rng) {
    const types = ['food', 'drink', 'animal', 'craft', 'wealth'];
    const count = Math.floor(rng() * 3) + 1;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(types[Math.floor(rng() * types.length)]);
    }
    
    return [...new Set(selected)];
  }

  selectMeditationTechniques(rng) {
    const techniques = ['breath', 'mantra', 'visualization', 'movement', 'contemplation'];
    const count = Math.floor(rng() * 2) + 1;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(techniques[Math.floor(rng() * techniques.length)]);
    }
    
    return [...new Set(selected)];
  }

  generateBeliefs(seed) {
    const rng = this.seededRandom(seed + 3);
    
    return {
      moralCode: this.generateMoralCode(rng),
      salvation: this.selectSalvationPath(rng),
      sin: this.generateSinConcept(rng),
      virtue: this.generateVirtueConcept(rng),
      fate: rng() > 0.5 ? 'predetermined' : 'free_will',
      miracles: rng() > 0.6,
      prophecy: rng() > 0.5
    };
  }

  generateMoralCode(rng) {
    return {
      killing: rng() > 0.3 ? 'forbidden' : 'contextual',
      stealing: rng() > 0.2 ? 'forbidden' : 'contextual',
      lying: rng() > 0.4 ? 'forbidden' : 'contextual',
      adultery: rng() > 0.5 ? 'forbidden' : 'contextual',
      charity: rng() > 0.6 ? 'required' : 'encouraged',
      hospitality: rng() > 0.7 ? 'required' : 'encouraged'
    };
  }

  selectSalvationPath(rng) {
    const paths = ['faith', 'works', 'knowledge', 'devotion', 'ritual', 'grace'];
    return paths[Math.floor(rng() * paths.length)];
  }

  generateSinConcept(rng) {
    return {
      exists: rng() > 0.3,
      inherited: rng() > 0.5,
      atonement: rng() > 0.6,
      confession: rng() > 0.5
    };
  }

  generateVirtueConcept(rng) {
    const virtues = ['compassion', 'courage', 'wisdom', 'justice', 'temperance', 'piety'];
    const count = Math.floor(rng() * 4) + 3;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(virtues[Math.floor(rng() * virtues.length)]);
    }
    
    return [...new Set(selected)];
  }

  pray(person, deityId, intent) {
    const deity = this.pantheon.deities.find(d => d.id === deityId);
    if (!deity) return { success: false, reason: 'Unknown deity' };
    
    // Prayer affects person's psychology, not world state (naturalistic mode)
    const effects = {
      stress: -0.1,
      hope: 0.2,
      community: 0.1,
      time: 15 // minutes
    };
    
    // Apply psychological effects
    if (person.needs) {
      person.needs.stress = Math.max(0, (person.needs.stress || 0) - effects.stress);
    }
    
    // Social effects if public prayer
    if (intent === 'public') {
      effects.reputation = 0.05;
    }
    
    return {
      success: true,
      effects: effects,
      perceived: 'prayer_completed' // Person believes prayer was heard
    };
  }

  performRitual(person, ritualType, participants = []) {
    const ritual = this.culture.rituals[ritualType];
    if (!ritual) return { success: false, reason: 'Unknown ritual' };
    
    // Rituals have psychological and social effects
    const effects = {
      stress: -0.2,
      community: 0.3,
      meaning: 0.4,
      time: ritual.duration * 60 // minutes
    };
    
    // Strengthen social bonds
    for (const participant of participants) {
      if (participant.relationships) {
        // Strengthen relationship with each participant
        effects.socialBonding = 0.1;
      }
    }
    
    return {
      success: true,
      effects: effects,
      participants: participants.length
    };
  }

  makeOffering(person, deityId, offering) {
    const deity = this.pantheon.deities.find(d => d.id === deityId);
    if (!deity) return { success: false, reason: 'Unknown deity' };
    
    if (!deity.offerings.includes(offering.type)) {
      return { success: false, reason: 'Inappropriate offering' };
    }
    
    // Check if person has the offering
    if (!person.inventory || !person.inventory.has(offering.item)) {
      return { success: false, reason: 'Do not have offering' };
    }
    
    // Remove offering from inventory
    person.inventory.remove(offering.item);
    
    // Psychological effects
    const effects = {
      piety: 0.1,
      guilt: -0.2,
      hope: 0.15
    };
    
    return {
      success: true,
      effects: effects,
      perceived: 'offering_accepted' // Person believes deity accepted
    };
  }

  ordainClergy(person, role) {
    if (!this.institutions.clergy.roles.includes(role)) {
      return { success: false, reason: 'Invalid clergy role' };
    }

    // Check training requirement (auto-fulfill if person has no training record)
    const trainingYears = this.institutions.clergy.training;
    if (person.training && person.training[role] !== undefined && person.training[role] < trainingYears) {
      return { success: false, reason: 'Insufficient training' };
    }
    
    const clergy = {
      personId: person.id,
      role: role,
      ordainedDate: this.kernel?.turn ?? 0,
      authority: this.institutions.authority,
      temple: null
    };
    
    this.clergy.set(person.id, clergy);
    person.clergy = clergy;
    
    return {
      success: true,
      clergy: clergy
    };
  }

  buildTemple(location, size, deityId) {
    const temple = {
      id: this.nextTempleId++,
      location: location,
      size: size,
      deityId: deityId,
      architecture: this.institutions.temples.architecture,
      access: this.institutions.temples.access,
      clergy: [],
      offerings: [],
      visitors: 0,
      condition: 1.0
    };
    
    this.temples.set(temple.id, temple);
    return temple;
  }

  calculatePiety(person) {
    let piety = 0.5; // Base
    
    // Prayer frequency
    if (person.prayerCount) {
      piety += Math.min(0.3, person.prayerCount * 0.01);
    }
    
    // Ritual participation
    if (person.ritualCount) {
      piety += Math.min(0.2, person.ritualCount * 0.02);
    }
    
    // Offerings made
    if (person.offeringCount) {
      piety += Math.min(0.2, person.offeringCount * 0.03);
    }
    
    // Moral behavior (simplified)
    if (person.moralViolations) {
      piety -= Math.min(0.5, person.moralViolations * 0.1);
    }
    
    return Math.max(0, Math.min(1, piety));
  }

  checkMoralViolation(action) {
    const code = this.beliefs.moralCode;
    
    if (action.type === 'kill' && code.killing === 'forbidden') {
      return { violation: true, severity: 1.0, sin: 'killing' };
    }
    
    if (action.type === 'steal' && code.stealing === 'forbidden') {
      return { violation: true, severity: 0.7, sin: 'stealing' };
    }
    
    if (action.type === 'lie' && code.lying === 'forbidden') {
      return { violation: true, severity: 0.5, sin: 'lying' };
    }
    
    return { violation: false };
  }

  seededRandom(seed) {
    let state = seed;
    return function() {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }

  getPantheon() {
    return this.pantheon;
  }

  getInstitutions() {
    return this.institutions;
  }

  getPractices() {
    return this.practices;
  }

  getBeliefs() {
    return this.beliefs;
  }

  toJSON() {
    return {
      pantheon: this.pantheon,
      institutions: this.institutions,
      practices: this.practices,
      beliefs: this.beliefs,
      clergy: Array.from(this.clergy.entries()),
      temples: Array.from(this.temples.entries()),
      nextTempleId: this.nextTempleId,
      prophecies: this.prophecies || [],
      _lastProphecy: this._lastProphecy || 0
    };
  }

  fromJSON(data) {
    if (!data) return;
    if (data.pantheon) this.pantheon = data.pantheon;
    if (data.institutions) this.institutions = data.institutions;
    if (data.practices) this.practices = data.practices;
    if (data.beliefs) this.beliefs = data.beliefs;
    if (data.clergy) this.clergy = new Map(data.clergy);
    if (data.temples) this.temples = new Map(data.temples);
    if (typeof data.nextTempleId === 'number') this.nextTempleId = data.nextTempleId;
    if (data.prophecies) this.prophecies = data.prophecies;
    if (typeof data._lastProphecy === 'number') this._lastProphecy = data._lastProphecy;
  }
}
