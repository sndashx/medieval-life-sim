/**
 * Language.js
 * Language generation, dialects, mutual intelligibility, literacy
 * Models vocabulary, grammar, writing systems, language learning
 */

export class Language {
  constructor(kernel, game) {
    this.kernel = kernel || game?.kernel || null;
    this.languages = new Map();
    this.dialects = new Map();
    this.writingSystems = new Map();
    this.nextLanguageId = 1;
    this._lastEvolutionTick = 0;
  }

  /**
   * Per-tick adapter called by Game.advanceTurns via safeUpdate.
   * Runs language-evolution bookkeeping (dialect drift + language death) on a
   * slow cadence: once per game-year (525,600 kernel turns at 1 min/turn).
   * The kernel must expose `kernel.rng` and `kernel.turn`.
   */
  update(kernel) {
    if (!kernel || !kernel.rng) return;
    const TURNS_PER_YEAR = 525_600;
    const turn = kernel.turn || 0;
    if (turn - this._lastEvolutionTick < TURNS_PER_YEAR) return;
    this._lastEvolutionTick = turn;
    this._evolve(kernel);
  }

  _evolve(kernel) {
    const rng = kernel.rng;

    // 1. Dialect drift: each dialect's divergence grows slightly each year.
    for (const dialect of this.dialects.values()) {
      const drift = rng.next() * 0.005; // up to +0.5% divergence per year
      dialect.divergence = Math.min(0.9, (dialect.divergence || 0) + drift);
    }

    // 2. Language death: if a non-dialect language has zero speakers for a
    // long stretch and very few remaining speakers in any dialect, mark it
    // dead. We don't delete it (scriptorium records may still reference it),
    // but flag it so canCommunicate can skip revival.
    for (const lang of this.languages.values()) {
      if (lang.dead) continue;
      const totalSpeakers = (lang.speakers || 0) +
        [...this.dialects.values()]
          .filter(d => d.parentLanguage === lang.id)
          .reduce((sum, d) => sum + (d.speakers || 0), 0);
      if (totalSpeakers <= 0) {
        lang._noSpeakersYears = (lang._noSpeakersYears || 0) + 1;
        // After 3 empty census years, declare the language dead.
        if (lang._noSpeakersYears >= 3) {
          lang.dead = true;
          kernel.scheduleEvent?.({
            type: 'language_died',
            languageId: lang.id,
            languageName: lang.name
          });
        }
      } else {
        lang._noSpeakersYears = 0;
      }
    }
  }

  generateLanguage(seed, culturalInfluences = []) {
    const language = {
      id: this.nextLanguageId++,
      name: this.generateLanguageName(seed),
      seed: seed,
      phonology: this.generatePhonology(seed),
      grammar: this.generateGrammar(seed),
      vocabulary: this.generateVocabulary(seed, culturalInfluences),
      writingSystem: null,
      speakers: 0,
      prestige: 0.5,
      literacyRate: 0.0,
      parentLanguage: null,
      childLanguages: [],
      dialects: []
    };
    
    this.languages.set(language.id, language);
    return language;
  }

  generateLanguageName(seed) {
    const prefixes = ['Al', 'Bor', 'Cal', 'Dor', 'El', 'Fal', 'Gor', 'Hal'];
    const suffixes = ['ian', 'ish', 'ese', 'ic', 'an', 'en'];
    
    const rng = this.seededRandom(seed);
    const prefix = prefixes[Math.floor(rng() * prefixes.length)];
    const suffix = suffixes[Math.floor(rng() * suffixes.length)];
    
    return prefix + suffix;
  }

  generatePhonology(seed) {
    const rng = this.seededRandom(seed);
    
    return {
      consonants: this.selectPhonemes(rng, 15, 30, 'consonant'),
      vowels: this.selectPhonemes(rng, 5, 12, 'vowel'),
      syllableStructure: this.selectSyllableStructure(rng),
      stress: rng() > 0.5 ? 'initial' : 'penultimate',
      tones: rng() > 0.8 ? Math.floor(rng() * 4) + 2 : 0
    };
  }

  selectPhonemes(rng, min, max, type) {
    const consonants = ['p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 's', 'z', 'ʃ', 'ʒ', 'm', 'n', 'l', 'r', 'w', 'j', 'h', 'ŋ', 'θ', 'ð', 'x', 'ɣ', 'ʔ'];
    const vowels = ['i', 'e', 'ɛ', 'a', 'ɑ', 'ɔ', 'o', 'u', 'ɪ', 'ʊ', 'ə', 'y'];
    
    const pool = type === 'consonant' ? consonants : vowels;
    const count = Math.floor(rng() * (max - min + 1)) + min;
    
    const selected = [];
    for (let i = 0; i < count && i < pool.length; i++) {
      selected.push(pool[Math.floor(rng() * pool.length)]);
    }
    
    return [...new Set(selected)]; // Remove duplicates
  }

  selectSyllableStructure(rng) {
    const structures = ['CV', 'CVC', 'V', 'VC', 'CCV', 'CCVC', 'CVV'];
    return structures[Math.floor(rng() * structures.length)];
  }

  generateGrammar(seed) {
    const rng = this.seededRandom(seed);
    
    return {
      wordOrder: this.selectWordOrder(rng),
      nounCases: Math.floor(rng() * 8),
      verbTenses: Math.floor(rng() * 6) + 3,
      genderSystem: this.selectGenderSystem(rng),
      numberSystem: this.selectNumberSystem(rng),
      articles: rng() > 0.5,
      adjPosition: rng() > 0.5 ? 'before' : 'after'
    };
  }

  selectWordOrder(rng) {
    const orders = ['SVO', 'SOV', 'VSO', 'VOS', 'OVS', 'OSV'];
    return orders[Math.floor(rng() * orders.length)];
  }

  selectGenderSystem(rng) {
    const val = rng();
    if (val < 0.3) return 'none';
    if (val < 0.6) return 'masculine-feminine';
    if (val < 0.8) return 'masculine-feminine-neuter';
    return 'animate-inanimate';
  }

  selectNumberSystem(rng) {
    const val = rng();
    if (val < 0.2) return 'singular-plural';
    if (val < 0.7) return 'singular-dual-plural';
    return 'singular-paucal-plural';
  }

  generateVocabulary(seed, culturalInfluences) {
    const rng = this.seededRandom(seed);
    const vocabulary = new Map();
    
    // Core vocabulary domains
    const domains = [
      'body', 'family', 'nature', 'animals', 'food', 'tools',
      'actions', 'qualities', 'numbers', 'time', 'space', 'social'
    ];
    
    for (const domain of domains) {
      const words = this.generateDomainVocabulary(domain, rng, 20);
      vocabulary.set(domain, words);
    }
    
    // Cultural vocabulary
    for (const influence of culturalInfluences) {
      const culturalWords = this.generateDomainVocabulary(influence, rng, 10);
      vocabulary.set(influence, culturalWords);
    }
    
    return vocabulary;
  }

  generateDomainVocabulary(domain, rng, count) {
    const words = [];
    for (let i = 0; i < count; i++) {
      words.push(this.generateWord(rng));
    }
    return words;
  }

  generateWord(rng) {
    const syllables = Math.floor(rng() * 3) + 1;
    let word = '';
    
    for (let i = 0; i < syllables; i++) {
      word += this.generateSyllable(rng);
    }
    
    return word;
  }

  generateSyllable(rng) {
    const consonants = ['p', 'b', 't', 'd', 'k', 'g', 's', 'n', 'l', 'r'];
    const vowels = ['a', 'e', 'i', 'o', 'u'];
    
    const c = consonants[Math.floor(rng() * consonants.length)];
    const v = vowels[Math.floor(rng() * vowels.length)];
    
    return c + v;
  }

  createDialect(parentLanguageId, region, divergence = 0.2) {
    const parent = this.languages.get(parentLanguageId);
    if (!parent) return null;
    
    const dialect = {
      id: `${parentLanguageId}-${region}`,
      name: `${parent.name} (${region})`,
      parentLanguage: parentLanguageId,
      region: region,
      divergence: divergence,
      phonologyChanges: this.generatePhonologyChanges(divergence),
      vocabularyChanges: this.generateVocabularyChanges(divergence),
      grammarChanges: this.generateGrammarChanges(divergence),
      speakers: 0
    };
    
    this.dialects.set(dialect.id, dialect);
    parent.dialects.push(dialect.id);
    
    return dialect;
  }

  generatePhonologyChanges(divergence) {
    return {
      soundShifts: Math.floor(divergence * 10),
      mergers: Math.floor(divergence * 5),
      splits: Math.floor(divergence * 3)
    };
  }

  generateVocabularyChanges(divergence) {
    return {
      newWords: Math.floor(divergence * 100),
      lostWords: Math.floor(divergence * 50),
      meaningShifts: Math.floor(divergence * 30)
    };
  }

  generateGrammarChanges(divergence) {
    return {
      simplifications: Math.floor(divergence * 5),
      innovations: Math.floor(divergence * 3)
    };
  }

  calculateMutualIntelligibility(lang1Id, lang2Id) {
    const lang1 = this.languages.get(lang1Id);
    const lang2 = this.languages.get(lang2Id);
    
    if (!lang1 || !lang2) return 0;
    
    // Same language
    if (lang1Id === lang2Id) return 1.0;
    
    // Check if one is parent of other
    if (lang1.parentLanguage === lang2Id || lang2.parentLanguage === lang1Id) {
      return 0.7;
    }
    
    // Check if they share a parent
    if (lang1.parentLanguage && lang1.parentLanguage === lang2.parentLanguage) {
      return 0.5;
    }
    
    // Check dialects
    const dialect1 = this.dialects.get(lang1Id);
    const dialect2 = this.dialects.get(lang2Id);
    
    if (dialect1 && dialect2 && dialect1.parentLanguage === dialect2.parentLanguage) {
      const avgDivergence = (dialect1.divergence + dialect2.divergence) / 2;
      return Math.max(0, 1 - avgDivergence * 2);
    }
    
    // Unrelated languages
    return 0.1;
  }

  createWritingSystem(languageId, type = 'alphabet') {
    const language = this.languages.get(languageId);
    if (!language) return null;
    
    const writingSystem = {
      id: `ws-${languageId}`,
      languageId: languageId,
      type: type, // alphabet, syllabary, logographic, abjad
      characters: this.generateCharacters(type, language),
      direction: this.kernel.random() > 0.8 ? 'rtl' : 'ltr',
      complexity: this.calculateWritingComplexity(type)
    };
    
    this.writingSystems.set(writingSystem.id, writingSystem);
    language.writingSystem = writingSystem.id;
    
    return writingSystem;
  }

  generateCharacters(type, language) {
    const counts = {
      alphabet: 20 + Math.floor(this.kernel.random() * 15),
      syllabary: 50 + Math.floor(this.kernel.random() * 100),
      logographic: 500 + Math.floor(this.kernel.random() * 2000),
      abjad: 15 + Math.floor(this.kernel.random() * 10)
    };
    
    return counts[type] || 30;
  }

  calculateWritingComplexity(type) {
    const complexities = {
      alphabet: 0.3,
      syllabary: 0.5,
      logographic: 0.9,
      abjad: 0.4
    };
    
    return complexities[type] || 0.5;
  }

  learn(person, languageId, hours) {
    if (!person.languages) {
      person.languages = new Map();
    }
    
    const currentLevel = person.languages.get(languageId) || 0;
    const language = this.languages.get(languageId);
    
    if (!language) return { success: false, reason: 'Unknown language' };
    
    // Learning rate depends on native languages and similarity
    let learningRate = 0.01; // Base rate per hour
    
    // Native language bonus
    if (person.languages.size === 0) {
      learningRate *= 3; // First language learned faster
    }
    
    // Similar language bonus
    for (const [knownLangId, level] of person.languages) {
      if (level > 0.5) {
        const similarity = this.calculateMutualIntelligibility(knownLangId, languageId);
        learningRate *= (1 + similarity);
      }
    }
    
    // Intelligence factor
    if (person.intelligence) {
      learningRate *= person.intelligence;
    }
    
    const newLevel = Math.min(1, currentLevel + hours * learningRate);
    person.languages.set(languageId, newLevel);
    
    return {
      success: true,
      level: newLevel,
      progress: newLevel - currentLevel
    };
  }

  canCommunicate(person1, person2) {
    if (!person1.languages || !person2.languages) return false;
    
    let bestIntelligibility = 0;
    let sharedLanguage = null;
    
    for (const [lang1Id, level1] of person1.languages) {
      for (const [lang2Id, level2] of person2.languages) {
        const intelligibility = this.calculateMutualIntelligibility(lang1Id, lang2Id);
        const effectiveIntelligibility = intelligibility * Math.min(level1, level2);
        
        if (effectiveIntelligibility > bestIntelligibility) {
          bestIntelligibility = effectiveIntelligibility;
          sharedLanguage = lang1Id;
        }
      }
    }
    
    return {
      canCommunicate: bestIntelligibility > 0.3,
      intelligibility: bestIntelligibility,
      language: sharedLanguage
    };
  }

  translate(text, fromLangId, toLangId, translatorSkill) {
    const intelligibility = this.calculateMutualIntelligibility(fromLangId, toLangId);
    const accuracy = intelligibility * translatorSkill;
    
    // Simplified: just return accuracy
    return {
      success: accuracy > 0.5,
      accuracy: accuracy,
      translatedText: accuracy > 0.5 ? text : '[untranslatable]'
    };
  }

  seededRandom(seed) {
    let state = seed;
    return function() {
      state = (state * 1103515245 + 12345) & 0x7fffffff;
      return state / 0x7fffffff;
    };
  }

  getLanguage(id) {
    return this.languages.get(id);
  }

  getDialect(id) {
    return this.dialects.get(id);
  }

  getWritingSystem(id) {
    return this.writingSystems.get(id);
  }
}
