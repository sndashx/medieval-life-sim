/**
 * Culture.js
 * Cultural norms, rituals, beliefs, taboos, drift over time
 * Models etiquette, dress codes, foodways, art, music, stories
 */

export class Culture {
  constructor(seed, kernel, game) {
    this.seed = seed;
    this.kernel = kernel || game?.kernel || null;
    this.norms = this.generateNorms(seed);
    this.rituals = this.generateRituals(seed);
    this.taboos = this.generateTaboos(seed);
    this.values = this.generateValues(seed);
    this.artStyles = this.generateArtStyles(seed);
    this.musicStyles = this.generateMusicStyles(seed);
    this.stories = [];
    this.festivals = this.generateFestivals(seed);
    this.dressCode = this.generateDressCode(seed);
    this.foodways = this.generateFoodways(seed);
  }

  generateNorms(seed) {
    const rng = this.seededRandom(seed);
    
    return {
      greeting: this.selectGreeting(rng),
      eyeContact: rng() > 0.5 ? 'direct' : 'averted',
      personalSpace: rng() * 1.5 + 0.5, // meters
      giftGiving: rng() > 0.6,
      hospitality: rng() * 0.5 + 0.5, // 0.5-1.0
      punctuality: rng() > 0.5 ? 'strict' : 'flexible',
      hierarchy: rng() > 0.5 ? 'formal' : 'informal',
      elderRespect: rng() * 0.5 + 0.5,
      genderRoles: this.selectGenderRoles(rng),
      childRearing: this.selectChildRearing(rng)
    };
  }

  selectGreeting(rng) {
    const greetings = ['bow', 'handshake', 'embrace', 'nod', 'kiss', 'verbal'];
    return greetings[Math.floor(rng() * greetings.length)];
  }

  selectGenderRoles(rng) {
    const val = rng();
    if (val < 0.3) return 'egalitarian';
    if (val < 0.7) return 'complementary';
    return 'hierarchical';
  }

  selectChildRearing(rng) {
    const val = rng();
    if (val < 0.3) return 'permissive';
    if (val < 0.7) return 'authoritative';
    return 'authoritarian';
  }

  generateRituals(seed) {
    const rng = this.seededRandom(seed + 1);
    
    return {
      birth: this.generateRitual(rng, 'birth'),
      comingOfAge: this.generateRitual(rng, 'comingOfAge'),
      marriage: this.generateRitual(rng, 'marriage'),
      death: this.generateRitual(rng, 'death'),
      harvest: this.generateRitual(rng, 'harvest'),
      seasonal: this.generateRitual(rng, 'seasonal')
    };
  }

  generateRitual(rng, type) {
    return {
      type: type,
      duration: Math.floor(rng() * 7) + 1, // 1-7 days
      participants: this.selectParticipants(rng),
      location: this.selectLocation(rng),
      offerings: rng() > 0.5,
      music: rng() > 0.6,
      dance: rng() > 0.6,
      feast: rng() > 0.7,
      symbolism: this.generateSymbolism(rng),
      importance: rng() * 0.5 + 0.5
    };
  }

  selectParticipants(rng) {
    const options = ['family', 'community', 'elders', 'specialists', 'all'];
    return options[Math.floor(rng() * options.length)];
  }

  selectLocation(rng) {
    const options = ['home', 'temple', 'outdoors', 'gathering_place', 'sacred_site'];
    return options[Math.floor(rng() * options.length)];
  }

  generateSymbolism(rng) {
    const symbols = ['fire', 'water', 'earth', 'sky', 'animals', 'plants', 'ancestors'];
    const count = Math.floor(rng() * 3) + 1;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(symbols[Math.floor(rng() * symbols.length)]);
    }
    
    return [...new Set(selected)];
  }

  generateTaboos(seed) {
    const rng = this.seededRandom(seed + 2);
    const taboos = [];
    
    const possibleTaboos = [
      { type: 'food', item: 'pork', severity: 0.8 },
      { type: 'food', item: 'beef', severity: 0.8 },
      { type: 'behavior', item: 'left_hand_eating', severity: 0.6 },
      { type: 'social', item: 'touching_head', severity: 0.7 },
      { type: 'social', item: 'eye_contact_elder', severity: 0.5 },
      { type: 'death', item: 'speaking_name_deceased', severity: 0.6 },
      { type: 'marriage', item: 'cousin_marriage', severity: 0.7 },
      { type: 'religious', item: 'blasphemy', severity: 0.9 }
    ];
    
    for (const taboo of possibleTaboos) {
      if (rng() > 0.6) {
        taboos.push(taboo);
      }
    }
    
    return taboos;
  }

  generateValues(seed) {
    const rng = this.seededRandom(seed + 3);
    
    return {
      honor: rng(),
      loyalty: rng(),
      honesty: rng(),
      courage: rng(),
      wisdom: rng(),
      generosity: rng(),
      humility: rng(),
      independence: rng(),
      community: rng(),
      tradition: rng(),
      innovation: rng(),
      harmony: rng()
    };
  }

  generateArtStyles(seed) {
    const rng = this.seededRandom(seed + 4);
    
    return {
      visual: {
        style: this.selectArtStyle(rng),
        colors: this.selectColors(rng),
        patterns: this.selectPatterns(rng),
        materials: this.selectArtMaterials(rng)
      },
      sculpture: {
        subjects: this.selectSubjects(rng),
        scale: rng() > 0.5 ? 'monumental' : 'intimate'
      }
    };
  }

  selectArtStyle(rng) {
    const styles = ['realistic', 'abstract', 'symbolic', 'geometric', 'naturalistic'];
    return styles[Math.floor(rng() * styles.length)];
  }

  selectColors(rng) {
    const colors = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'purple', 'orange'];
    const count = Math.floor(rng() * 4) + 2;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(colors[Math.floor(rng() * colors.length)]);
    }
    
    return [...new Set(selected)];
  }

  selectPatterns(rng) {
    const patterns = ['geometric', 'floral', 'animal', 'abstract', 'narrative'];
    const count = Math.floor(rng() * 3) + 1;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(patterns[Math.floor(rng() * patterns.length)]);
    }
    
    return [...new Set(selected)];
  }

  selectArtMaterials(rng) {
    const materials = ['clay', 'stone', 'wood', 'metal', 'textile', 'pigment'];
    const count = Math.floor(rng() * 4) + 2;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(materials[Math.floor(rng() * materials.length)]);
    }
    
    return [...new Set(selected)];
  }

  selectSubjects(rng) {
    const subjects = ['human', 'animal', 'deity', 'nature', 'abstract', 'ancestor'];
    const count = Math.floor(rng() * 3) + 1;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(subjects[Math.floor(rng() * subjects.length)]);
    }
    
    return [...new Set(selected)];
  }

  generateMusicStyles(seed) {
    const rng = this.seededRandom(seed + 5);
    
    return {
      instruments: this.selectInstruments(rng),
      scales: this.selectScales(rng),
      rhythm: this.selectRhythm(rng),
      occasions: this.selectMusicOccasions(rng)
    };
  }

  selectInstruments(rng) {
    const instruments = ['drum', 'flute', 'string', 'voice', 'bell', 'horn'];
    const count = Math.floor(rng() * 4) + 2;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(instruments[Math.floor(rng() * instruments.length)]);
    }
    
    return [...new Set(selected)];
  }

  selectScales(rng) {
    const scales = ['pentatonic', 'diatonic', 'chromatic', 'modal'];
    return scales[Math.floor(rng() * scales.length)];
  }

  selectRhythm(rng) {
    const rhythms = ['simple', 'complex', 'polyrhythmic', 'free'];
    return rhythms[Math.floor(rng() * rhythms.length)];
  }

  selectMusicOccasions(rng) {
    const occasions = ['ritual', 'celebration', 'work', 'mourning', 'entertainment'];
    const count = Math.floor(rng() * 3) + 2;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(occasions[Math.floor(rng() * occasions.length)]);
    }
    
    return [...new Set(selected)];
  }

  generateFestivals(seed) {
    const rng = this.seededRandom(seed + 6);
    const festivals = [];
    const count = Math.floor(rng() * 6) + 2;
    
    for (let i = 0; i < count; i++) {
      festivals.push({
        name: `Festival ${i + 1}`,
        season: this.selectSeason(rng),
        duration: Math.floor(rng() * 5) + 1,
        purpose: this.selectFestivalPurpose(rng),
        activities: this.selectActivities(rng),
        importance: rng()
      });
    }
    
    return festivals;
  }

  selectSeason(rng) {
    const seasons = ['spring', 'summer', 'autumn', 'winter'];
    return seasons[Math.floor(rng() * seasons.length)];
  }

  selectFestivalPurpose(rng) {
    const purposes = ['harvest', 'planting', 'solstice', 'ancestor', 'deity', 'community'];
    return purposes[Math.floor(rng() * purposes.length)];
  }

  selectActivities(rng) {
    const activities = ['feast', 'dance', 'music', 'games', 'ritual', 'market', 'storytelling'];
    const count = Math.floor(rng() * 4) + 2;
    const selected = [];
    
    for (let i = 0; i < count; i++) {
      selected.push(activities[Math.floor(rng() * activities.length)]);
    }
    
    return [...new Set(selected)];
  }

  generateDressCode(seed) {
    const rng = this.seededRandom(seed + 7);
    
    return {
      modesty: rng() * 0.5 + 0.5,
      colorSignificance: rng() > 0.6,
      statusDisplay: rng() > 0.5,
      genderDistinction: rng() > 0.5,
      headCovering: this.selectHeadCovering(rng),
      footwear: rng() > 0.7 ? 'required' : 'optional',
      jewelry: rng() > 0.6,
      tattoos: rng() > 0.7,
      scarification: rng() > 0.8
    };
  }

  selectHeadCovering(rng) {
    const val = rng();
    if (val < 0.3) return 'none';
    if (val < 0.6) return 'optional';
    if (val < 0.8) return 'women';
    return 'all';
  }

  generateFoodways(seed) {
    const rng = this.seededRandom(seed + 8);
    
    return {
      mealTimes: Math.floor(rng() * 2) + 2, // 2-3 meals
      communalEating: rng() > 0.5,
      utensils: this.selectUtensils(rng),
      seatingArrangement: this.selectSeating(rng),
      foodSharing: rng() > 0.6,
      fasting: rng() > 0.5,
      dietaryRestrictions: this.selectDietaryRestrictions(rng)
    };
  }

  selectUtensils(rng) {
    const options = ['hands', 'spoon', 'chopsticks', 'fork_knife', 'bread'];
    return options[Math.floor(rng() * options.length)];
  }

  selectSeating(rng) {
    const options = ['floor', 'bench', 'chair', 'standing', 'hierarchical'];
    return options[Math.floor(rng() * options.length)];
  }

  selectDietaryRestrictions(rng) {
    const restrictions = [];
    
    if (rng() > 0.7) restrictions.push('no_meat');
    if (rng() > 0.8) restrictions.push('no_pork');
    if (rng() > 0.8) restrictions.push('no_beef');
    if (rng() > 0.9) restrictions.push('no_alcohol');
    
    return restrictions;
  }

  checkNormViolation(action, actor) {
    const violations = [];
    
    // Check greeting norms
    if (action.type === 'greet' && action.method !== this.norms.greeting) {
      violations.push({
        norm: 'greeting',
        severity: 0.3,
        consequence: 'social_awkwardness'
      });
    }
    
    // Check taboos
    for (const taboo of this.taboos) {
      if (this.isTabooViolation(action, taboo)) {
        violations.push({
          norm: 'taboo',
          type: taboo.type,
          severity: taboo.severity,
          consequence: 'social_sanction'
        });
      }
    }
    
    // Check dress code
    if (action.type === 'appear_public' && !this.checkDressCode(actor)) {
      violations.push({
        norm: 'dress_code',
        severity: this.dressCode.modesty,
        consequence: 'shame'
      });
    }
    
    return violations;
  }

  isTabooViolation(action, taboo) {
    if (taboo.type === 'food' && action.type === 'eat') {
      return action.food === taboo.item;
    }
    
    if (taboo.type === 'behavior' && action.type === taboo.item) {
      return true;
    }
    
    return false;
  }

  checkDressCode(actor) {
    // Simplified check
    return actor.clothing && actor.clothing.modesty >= this.dressCode.modesty;
  }

  culturalDrift(years) {
    // Culture changes slowly over time
    const driftRate = 0.01 * years;
    
    // Values drift
    for (const [key, value] of Object.entries(this.values)) {
      const change = (this.kernel.random() - 0.5) * driftRate;
      this.values[key] = Math.max(0, Math.min(1, value + change));
    }
    
    // Norms evolve
    if (this.kernel.random() < driftRate) {
      this.norms.hierarchy = this.kernel.random() > 0.5 ? 'formal' : 'informal';
    }
    
    // New taboos can emerge, old ones fade
    if (this.kernel.random() < driftRate * 0.5) {
      this.taboos = this.taboos.filter(t => this.kernel.random() > 0.1);
    }
  }

  seededRandom(seed) {
    let state = seed;
    return function() {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }

  getNorms() {
    return this.norms;
  }

  getRituals() {
    return this.rituals;
  }

  getTaboos() {
    return this.taboos;
  }

  getValues() {
    return this.values;
  }

  getFestivals() {
    return this.festivals;
  }
}
