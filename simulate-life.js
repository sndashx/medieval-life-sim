#!/usr/bin/env node

/**
 * Life Simulation Script
 * 
 * Simulates a randomly generated entity's complete life in a randomly generated world.
 * Outputs:
 * - Full life log (all events, actions, relationships)
 * - Ancestry lineage (family tree)
 * - Beautiful written history (narrative format)
 */

import { Game } from './src/Game.js';
import fs from 'fs';
import path from 'path';

// Configuration
const OUTPUT_DIR = './simulation-output';
const TICK_BATCH_SIZE = 100; // Process ticks in batches for performance
const MAX_AGE = 80; // Maximum age to simulate to

class LifeSimulator {
  constructor(seed) {
    this.seed = seed || Date.now();
    this.game = null;
    this.subject = null;
    this.lifeEvents = [];
    this.relationships = new Map();
    this.startTime = Date.now();
    
    // Ensure output directory exists
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  }

  async initialize() {
    console.log('🌍 Initializing world...');
    console.log(`   Seed: ${this.seed}`);
    
    // Create game with default world config
    const worldConfig = {
      worldSize: { width: 100, height: 100 },
      settlements: 5,
      resources: 50,
      rivers: 5,
      populationMin: 50,
      populationMax: 500
    };
    
    this.game = new Game(this.seed, worldConfig);
    const initResult = this.game.initialize();
    
    if (!initResult.success) {
      throw new Error('Failed to initialize world');
    }
    
    console.log('✓ World initialized');
    return true;
  }

  createSubject() {
    console.log('\n👤 Creating simulation subject...');
    
    // Generate random name and sex
    const sex = this.game.kernel.rng.next() < 0.5 ? 'male' : 'female';
    const name = this.game.generateName(sex, this.game.kernel.rng);
    
    // Create player character
    const result = this.game.createPlayer(name, sex);
    
    if (!result.success) {
      throw new Error('Failed to create subject');
    }
    
    this.subject = result.player;
    const settlement = result.settlement;
    
    console.log(`✓ Created: ${name} (${sex})`);
    console.log(`   Born in: ${settlement.name}`);
    console.log(`   Parents: ${this.getParentNames()}`);
    
    this.logEvent('birth', {
      name: name,
      sex: sex,
      settlement: settlement.name,
      parents: this.getParentNames()
    });
    
    return true;
  }

  getParentNames() {
    if (!this.subject || !this.subject.kinship) return 'Unknown';
    
    const mother = this.subject.kinship.mother 
      ? this.game.kernel.entities.get(this.subject.kinship.mother)
      : null;
    const father = this.subject.kinship.father
      ? this.game.kernel.entities.get(this.subject.kinship.father)
      : null;
    
    const motherName = mother ? mother.name : 'Unknown';
    const fatherName = father ? father.name : 'Unknown';
    
    return `${motherName} and ${fatherName}`;
  }

  logEvent(type, data) {
    const event = {
      turn: this.game.kernel.turn,
      age: Math.floor(this.subject.age),
      worldTime: this.game.kernel.worldTime.toString(),
      type: type,
      data: data
    };
    
    this.lifeEvents.push(event);
  }

  simulateLife() {
    console.log('\n⏳ Simulating life...');
    console.log('   (This may take a while)\n');
    
    let lastAge = 0;
    let tickCount = 0;
    const startTurn = this.game.kernel.turn;
    
    while (this.subject.alive && this.subject.age < MAX_AGE) {
      // Advance time in batches
      this.game.advanceTurns(TICK_BATCH_SIZE);
      tickCount += TICK_BATCH_SIZE;
      
      // Check for age milestones
      const currentAge = Math.floor(this.subject.age);
      if (currentAge > lastAge) {
        console.log(`   Age ${currentAge}: ${this.subject.occupation} in ${this.getCurrentSettlement()}`);
        
        this.logEvent('birthday', {
          age: currentAge,
          occupation: this.subject.occupation,
          settlement: this.getCurrentSettlement(),
          health: this.subject.getHealthStatus().overall
        });
        
        lastAge = currentAge;
      }
      
      // Track major life events
      this.trackLifeEvents();
      
      // Safety check - prevent infinite loops
      if (tickCount > 1000000) {
        console.log('   ⚠️  Simulation timeout - stopping');
        break;
      }
    }
    
    const endTurn = this.game.kernel.turn;
    const totalTurns = endTurn - startTurn;
    
    console.log(`\n✓ Life simulation complete`);
    console.log(`   Final age: ${Math.floor(this.subject.age)}`);
    console.log(`   Status: ${this.subject.alive ? 'Alive' : 'Deceased'}`);
    if (!this.subject.alive) {
      console.log(`   Cause of death: ${this.subject.deathCause}`);
    }
    console.log(`   Total turns: ${totalTurns.toLocaleString()}`);
    console.log(`   Total events: ${this.lifeEvents.length}`);
  }

  getCurrentSettlement() {
    if (!this.subject.position || this.subject.position.settlementId === undefined) {
      return 'Unknown';
    }
    
    const settlement = this.game.world.settlements[this.subject.position.settlementId];
    return settlement ? settlement.name : 'Unknown';
  }

  trackLifeEvents() {
    // Track marriage
    if (this.subject.marriage && this.subject.marriage.spouse) {
      const spouseId = this.subject.marriage.spouse;
      if (!this.relationships.has(`married_${spouseId}`)) {
        const spouse = this.game.kernel.entities.get(spouseId);
        if (spouse) {
          this.logEvent('marriage', {
            spouse: spouse.name,
            age: Math.floor(this.subject.age)
          });
          this.relationships.set(`married_${spouseId}`, true);
        }
      }
    }
    
    // Track children
    if (this.subject.kinship && this.subject.kinship.children) {
      for (const childId of this.subject.kinship.children) {
        if (!this.relationships.has(`child_${childId}`)) {
          const child = this.game.kernel.entities.get(childId);
          if (child) {
            this.logEvent('child_born', {
              child: child.name,
              sex: child.sex,
              age: Math.floor(this.subject.age)
            });
            this.relationships.set(`child_${childId}`, true);
          }
        }
      }
    }
    
    // Track occupation changes
    const currentOccupation = this.subject.occupation;
    if (!this.relationships.has(`occupation_${currentOccupation}`)) {
      this.logEvent('occupation_change', {
        occupation: currentOccupation,
        age: Math.floor(this.subject.age)
      });
      this.relationships.set(`occupation_${currentOccupation}`, true);
    }
  }

  buildAncestryTree() {
    console.log('\n🌳 Building ancestry tree...');
    
    const tree = {
      subject: this.getPersonInfo(this.subject),
      parents: this.getParents(this.subject),
      grandparents: this.getGrandparents(this.subject),
      siblings: this.getSiblings(this.subject),
      spouse: this.getSpouse(this.subject),
      children: this.getChildren(this.subject)
    };
    
    console.log(`✓ Ancestry tree built`);
    console.log(`   Parents: ${tree.parents.length}`);
    console.log(`   Grandparents: ${tree.grandparents.length}`);
    console.log(`   Siblings: ${tree.siblings.length}`);
    console.log(`   Spouse: ${tree.spouse ? 'Yes' : 'No'}`);
    console.log(`   Children: ${tree.children.length}`);
    
    return tree;
  }

  getPersonInfo(person) {
    if (!person) return null;
    
    return {
      id: person.id,
      name: person.name,
      sex: person.sex,
      age: Math.floor(person.age),
      occupation: person.occupation,
      alive: person.alive,
      deathCause: person.deathCause
    };
  }

  getParents(person) {
    const parents = [];
    
    if (person.kinship) {
      if (person.kinship.mother) {
        const mother = this.game.kernel.entities.get(person.kinship.mother);
        if (mother) parents.push(this.getPersonInfo(mother));
      }
      
      if (person.kinship.father) {
        const father = this.game.kernel.entities.get(person.kinship.father);
        if (father) parents.push(this.getPersonInfo(father));
      }
    }
    
    return parents;
  }

  getGrandparents(person) {
    const grandparents = [];
    const parents = this.getParents(person);
    
    for (const parent of parents) {
      const parentEntity = this.game.kernel.entities.get(parent.id);
      if (parentEntity && parentEntity.kinship) {
        if (parentEntity.kinship.mother) {
          const gm = this.game.kernel.entities.get(parentEntity.kinship.mother);
          if (gm) grandparents.push(this.getPersonInfo(gm));
        }
        if (parentEntity.kinship.father) {
          const gf = this.game.kernel.entities.get(parentEntity.kinship.father);
          if (gf) grandparents.push(this.getPersonInfo(gf));
        }
      }
    }
    
    return grandparents;
  }

  getSiblings(person) {
    const siblings = [];
    
    if (person.kinship && person.kinship.siblings) {
      for (const siblingId of person.kinship.siblings) {
        const sibling = this.game.kernel.entities.get(siblingId);
        if (sibling) siblings.push(this.getPersonInfo(sibling));
      }
    }
    
    return siblings;
  }

  getSpouse(person) {
    if (person.marriage && person.marriage.spouse) {
      const spouse = this.game.kernel.entities.get(person.marriage.spouse);
      return spouse ? this.getPersonInfo(spouse) : null;
    }
    return null;
  }

  getChildren(person) {
    const children = [];
    
    if (person.kinship && person.kinship.children) {
      for (const childId of person.kinship.children) {
        const child = this.game.kernel.entities.get(childId);
        if (child) children.push(this.getPersonInfo(child));
      }
    }
    
    return children;
  }

  generateNarrative() {
    console.log('\n📖 Generating narrative history...');
    
    const narrative = [];
    const pronoun = this.subject.sex === 'male' ? 'he' : 'she';
    const Pronoun = this.subject.sex === 'male' ? 'He' : 'She';
    const possessive = this.subject.sex === 'male' ? 'his' : 'her';
    const Possessive = this.subject.sex === 'male' ? 'His' : 'Her';
    const objective = this.subject.sex === 'male' ? 'him' : 'her';
    
    // Title
    narrative.push('═'.repeat(80));
    narrative.push(`AN ANTHROPOLOGICAL BIOGRAPHY OF ${this.subject.name.toUpperCase()}`);
    narrative.push(`A Life Examined Through the Lens of Medieval Social Structures`);
    narrative.push('═'.repeat(80));
    narrative.push('');
    
    // Abstract
    narrative.push('ABSTRACT');
    narrative.push('─'.repeat(80));
    const birthEvent = this.lifeEvents.find(e => e.type === 'birth');
    if (birthEvent) {
      narrative.push(`This biographical study examines the life trajectory of ${this.subject.name}, a ${this.subject.sex}`);
      narrative.push(`individual born within the settlement of ${birthEvent.data.settlement} during simulation epoch`);
      narrative.push(`${this.seed}. Through careful analysis of ${possessive} lived experience, we observe the`);
      narrative.push(`intricate interplay between individual agency and the constraining forces of medieval`);
      narrative.push(`social stratification, kinship networks, and economic subsistence patterns that`);
      narrative.push(`characterized ${possessive} existence within this pre-industrial agrarian society.`);
    }
    narrative.push('');
    
    // Birth and Origins
    narrative.push('I. NATALITY AND KINSHIP ORIGINS');
    narrative.push('─'.repeat(80));
    if (birthEvent) {
      narrative.push(`The subject entered the phenomenological world within the territorial bounds of`);
      narrative.push(`${birthEvent.data.settlement}, a settlement embedded within the broader socio-economic`);
      narrative.push(`matrix of medieval life. Born to ${birthEvent.data.parents}, ${this.subject.name}'s natal`);
      narrative.push(`circumstances positioned ${objective} within the lower strata of the feudal hierarchy—a`);
      narrative.push(`structural location that would profoundly shape ${possessive} life chances, social mobility`);
      narrative.push(`prospects, and access to material resources throughout ${possessive} biographical trajectory.`);
      narrative.push('');
      narrative.push(`From an anthropological perspective, ${possessive} birth represents not merely a biological`);
      narrative.push(`event, but rather a moment of social inscription—the point at which ${pronoun} was`);
      narrative.push(`incorporated into existing kinship networks, economic obligations, and the symbolic`);
      narrative.push(`order of medieval cosmology that governed daily existence in ${birthEvent.data.settlement}.`);
    }
    narrative.push('');
    
    // Childhood and Socialization
    narrative.push('II. CHILDHOOD SOCIALIZATION AND CULTURAL TRANSMISSION');
    narrative.push('─'.repeat(80));
    const childhoodEvents = this.lifeEvents.filter(e => e.age < 12);
    if (childhoodEvents.length > 0 || this.subject.age >= 12) {
      narrative.push(`The formative years of ${this.subject.name}'s development occurred within the pedagogical`);
      narrative.push(`framework characteristic of medieval childhood—a period marked by the gradual`);
      narrative.push(`acquisition of cultural knowledge, practical skills, and the internalization of social`);
      narrative.push(`norms governing behavior within ${possessive} community. Through processes of observational`);
      narrative.push(`learning and participatory engagement in household labor, ${pronoun} absorbed the tacit`);
      narrative.push(`knowledge systems essential for survival in an agrarian subsistence economy.`);
      narrative.push('');
      narrative.push(`This phase of ontogenetic development served as the primary mechanism through which`);
      narrative.push(`${this.subject.name} was enculturated into the lifeways, belief systems, and material`);
      narrative.push(`practices of ${possessive} natal community—a process anthropologists recognize as fundamental`);
      narrative.push(`to the reproduction of cultural continuity across generational cohorts.`);
    } else {
      narrative.push(`The ethnographic record concerning ${this.subject.name}'s childhood remains fragmentary,`);
      narrative.push(`a lacuna in the biographical data that prevents comprehensive analysis of ${possessive}`);
      narrative.push(`early socialization experiences. This absence itself speaks to the precarious nature`);
      narrative.push(`of life in medieval society, where infant and child mortality rates significantly`);
      narrative.push(`impacted demographic patterns and household composition.`);
    }
    narrative.push('');
    
    // Coming of Age and Economic Role
    narrative.push('III. TRANSITION TO ADULTHOOD AND ECONOMIC PARTICIPATION');
    narrative.push('─'.repeat(80));
    const occupationChange = this.lifeEvents.find(e => e.type === 'occupation_change' && e.age >= 12);
    if (occupationChange) {
      narrative.push(`Upon reaching approximately ${occupationChange.age} years of age, ${this.subject.name} underwent the`);
      narrative.push(`culturally significant transition from childhood dependency to adult economic agency,`);
      narrative.push(`assuming the occupational role of ${occupationChange.data.occupation}. This rite of passage marked ${possessive}`);
      narrative.push(`formal integration into the productive economy of ${this.getCurrentSettlement()}, positioning`);
      narrative.push(`${objective} within the division of labor that structured medieval economic life.`);
      narrative.push('');
      narrative.push(`From a materialist perspective, ${possessive} occupation as ${this.subject.occupation} situated ${objective}`);
      narrative.push(`within specific relations of production—determining ${possessive} access to surplus value,`);
      narrative.push(`social prestige, and the material conditions of daily existence. This economic`);
      narrative.push(`positioning fundamentally shaped ${possessive} life trajectory, constraining possibilities while`);
      narrative.push(`simultaneously opening certain pathways for social reproduction and, potentially,`);
      narrative.push(`limited forms of upward mobility within the rigid stratification system.`);
    } else if (this.subject.occupation !== 'child') {
      narrative.push(`${this.subject.name}'s economic role as ${this.subject.occupation} positioned ${objective} within the intricate`);
      narrative.push(`web of productive relations that characterized medieval economic organization. This`);
      narrative.push(`occupational identity served not merely as a means of subsistence, but as a primary`);
      narrative.push(`marker of social identity—shaping ${possessive} relationships, status, and position within`);
      narrative.push(`the community's symbolic hierarchy.`);
    }
    narrative.push('');
    
    // Marriage and Kinship Networks
    const marriageEvent = this.lifeEvents.find(e => e.type === 'marriage');
    if (marriageEvent) {
      narrative.push('IV. MARRIAGE ALLIANCE AND KINSHIP NETWORK EXPANSION');
      narrative.push('─'.repeat(80));
      narrative.push(`At the age of ${marriageEvent.age}, ${this.subject.name} entered into a marriage alliance with`);
      narrative.push(`${marriageEvent.data.spouse}, an event of profound anthropological significance that extended beyond`);
      narrative.push(`mere romantic union. This conjugal bond represented a strategic alliance between`);
      narrative.push(`kinship groups, facilitating the exchange of resources, labor power, and social capital`);
      narrative.push(`while simultaneously establishing new networks of reciprocal obligation and mutual aid.`);
      narrative.push('');
      narrative.push(`The marital household established by ${this.subject.name} and ${marriageEvent.data.spouse} in ${this.getCurrentSettlement()}`);
      narrative.push(`functioned as the fundamental unit of economic production and social reproduction—a`);
      narrative.push(`domestic sphere wherein daily subsistence activities, child-rearing practices, and the`);
      narrative.push(`transmission of cultural knowledge occurred. This conjugal unit served as the primary`);
      narrative.push(`locus of identity formation and material security within the broader community structure.`);
      narrative.push('');
      
      // Children and Reproduction
      const childEvents = this.lifeEvents.filter(e => e.type === 'child_born');
      if (childEvents.length > 0) {
        narrative.push('V. BIOLOGICAL REPRODUCTION AND GENERATIONAL CONTINUITY');
        narrative.push('─'.repeat(80));
        narrative.push(`The union between ${this.subject.name} and ${marriageEvent.data.spouse} proved reproductively successful,`);
        narrative.push(`yielding ${childEvents.length} offspring who represented both the biological continuation of ${possessive}`);
        narrative.push(`genetic lineage and the social perpetuation of ${possessive} household's position within the`);
        narrative.push(`community's stratification system. These children constituted vital economic assets—`);
        narrative.push(`future sources of labor power who would contribute to household subsistence while`);
        narrative.push(`simultaneously serving as vectors for the intergenerational transmission of cultural`);
        narrative.push(`knowledge, property rights, and social status.`);
        narrative.push('');
        narrative.push(`The documented offspring include:`);
        for (const child of childEvents) {
          narrative.push(`  • ${child.data.child} (${child.data.sex}), born during ${this.subject.name}'s ${child.age}th year—a ${child.data.sex}`);
          narrative.push(`    individual whose life trajectory would be shaped by the same structural forces`);
          narrative.push(`    that constrained and enabled ${possessive} parent's existence.`);
        }
        narrative.push('');
        narrative.push(`From a demographic perspective, this reproductive output reflects the high fertility`);
        narrative.push(`patterns characteristic of pre-industrial societies, wherein large family sizes served`);
        narrative.push(`as adaptive strategies for ensuring household labor sufficiency and providing social`);
        narrative.push(`security in the absence of formal institutional support systems.`);
        narrative.push('');
      }
    }
    
    // Later Life
    const laterEvents = this.lifeEvents.filter(e => e.age > 40);
    if (laterEvents.length > 0) {
      narrative.push('VI. MATURE ADULTHOOD AND COMMUNITY INTEGRATION');
      narrative.push('─'.repeat(80));
      narrative.push(`Throughout ${possessive} mature years, ${this.subject.name} maintained ${possessive} economic role as ${this.subject.occupation},`);
      narrative.push(`contributing to the collective subsistence of ${this.getCurrentSettlement()} through ${possessive} specialized`);
      narrative.push(`labor. This sustained participation in the community's productive economy positioned`);
      narrative.push(`${objective} as an established member of the social fabric—someone whose accumulated`);
      narrative.push(`experience, social networks, and cultural knowledge granted ${objective} a measure of respect`);
      narrative.push(`and authority within the local hierarchy.`);
      narrative.push('');
      narrative.push(`The longevity ${pronoun} achieved represents a notable demographic accomplishment within a`);
      narrative.push(`historical context characterized by high mortality rates, limited medical knowledge, and`);
      narrative.push(`the constant threat of famine, disease, and environmental catastrophe. ${Possessive} survival`);
      narrative.push(`into middle and later adulthood speaks to a combination of fortunate circumstances,`);
      narrative.push(`adaptive strategies, and the protective benefits of social integration within a`);
      narrative.push(`functioning community network.`);
      narrative.push('');
    }
    
    // Death or Current Status
    if (!this.subject.alive) {
      narrative.push('VII. MORTALITY AND THE TERMINATION OF BIOGRAPHICAL TRAJECTORY');
      narrative.push('─'.repeat(80));
      narrative.push(`${this.subject.name}'s biographical narrative reached its terminus at the age of ${Math.floor(this.subject.age)},`);
      narrative.push(`when ${pronoun} succumbed to ${this.subject.deathCause}—a cause of death that illuminates the`);
      narrative.push(`material conditions and environmental hazards that structured mortality patterns in`);
      narrative.push(`medieval society. This death represents not merely the cessation of individual biological`);
      narrative.push(`function, but rather a moment of social rupture—the removal of a node from the`);
      narrative.push(`kinship network, the loss of accumulated cultural knowledge, and the redistribution`);
      narrative.push(`of ${possessive} social roles and economic resources among surviving community members.`);
      narrative.push('');
      narrative.push(`From an anthropological perspective, ${possessive} death would have triggered culturally`);
      narrative.push(`prescribed mourning rituals, inheritance practices, and the reorganization of household`);
      narrative.push(`structures—processes through which the community absorbed the loss while maintaining`);
      narrative.push(`social continuity. ${Possessive} memory, preserved through oral tradition and the lived`);
      narrative.push(`experience of ${possessive} descendants, constitutes ${possessive} enduring legacy within the collective`);
      narrative.push(`consciousness of ${this.getCurrentSettlement()}.`);
    } else {
      narrative.push('VII. PRESENT CIRCUMSTANCES AND ONGOING LIFE TRAJECTORY');
      narrative.push('─'.repeat(80));
      narrative.push(`At the present moment of ethnographic observation, ${this.subject.name} continues to inhabit`);
      narrative.push(`the social world of ${this.getCurrentSettlement()}, having accumulated ${Math.floor(this.subject.age)} years of lived`);
      narrative.push(`experience within this medieval community. ${Possessive} ongoing existence represents an`);
      narrative.push(`unfolding biographical narrative—a life still in process, still subject to the`);
      narrative.push(`contingencies of historical circumstance, environmental conditions, and the complex`);
      narrative.push(`interplay of structure and agency that characterizes human social existence.`);
      narrative.push('');
      narrative.push(`${Possessive} current status as ${this.subject.occupation} positions ${objective} within the continuing flow of`);
      narrative.push(`daily life, participating in the rhythms of agricultural production, community ritual,`);
      narrative.push(`and social interaction that constitute the fabric of medieval existence. The trajectory`);
      narrative.push(`of ${possessive} remaining years remains indeterminate—subject to the same forces of chance,`);
      narrative.push(`social structure, and individual choice that have shaped ${possessive} life thus far.`);
    }
    narrative.push('');
    
    // Statistics
    narrative.push('VIII. QUANTITATIVE BIOGRAPHICAL DATA AND ANALYTICAL SUMMARY');
    narrative.push('─'.repeat(80));
    narrative.push(`The following demographic and social indicators provide a quantitative framework for`);
    narrative.push(`understanding ${this.subject.name}'s life trajectory within the broader patterns of medieval`);
    narrative.push(`social organization:`);
    narrative.push('');
    narrative.push(`  Chronological Lifespan: ${Math.floor(this.subject.age)} years`);
    narrative.push(`    (Contextual note: This longevity must be evaluated against the median life`);
    narrative.push(`     expectancy of medieval populations, typically ranging from 30-40 years)`);
    narrative.push('');
    narrative.push(`  Primary Occupational Identity: ${this.subject.occupation}`);
    narrative.push(`    (Structural position within the division of labor and economic hierarchy)`);
    narrative.push('');
    narrative.push(`  Marital Unions Contracted: ${this.lifeEvents.filter(e => e.type === 'marriage').length}`);
    narrative.push(`    (Indicator of social integration and kinship network formation)`);
    narrative.push('');
    narrative.push(`  Documented Offspring: ${this.lifeEvents.filter(e => e.type === 'child_born').length}`);
    narrative.push(`    (Measure of reproductive success and contribution to demographic continuity)`);
    narrative.push('');
    narrative.push(`  Recorded Biographical Events: ${this.lifeEvents.length}`);
    narrative.push(`    (Ethnographic data points documenting significant life transitions)`);
    narrative.push('');
    
    narrative.push('═'.repeat(80));
    narrative.push('METHODOLOGICAL NOTE');
    narrative.push('─'.repeat(80));
    narrative.push(`This biographical reconstruction was generated through computational simulation`);
    narrative.push(`(seed: ${this.seed}) and represents an idealized model of medieval life trajectories.`);
    narrative.push(`While grounded in anthropological theory and historical demographic patterns, this`);
    narrative.push(`narrative should be understood as a heuristic device for exploring the structural`);
    narrative.push(`forces and cultural logics that shaped individual lives within pre-industrial`);
    narrative.push(`agrarian societies. The analysis draws upon theoretical frameworks from cultural`);
    narrative.push(`anthropology, historical demography, and social history to illuminate the complex`);
    narrative.push(`interplay between individual agency and social structure that characterized medieval`);
    narrative.push(`existence.`);
    narrative.push('');
    narrative.push(`Computational processing time: ${((Date.now() - this.startTime) / 1000).toFixed(2)} seconds`);
    narrative.push(`Ethnographic documentation completed: ${new Date().toISOString()}`);
    narrative.push('═'.repeat(80));
    
    console.log('✓ Narrative generated');
    
    return narrative.join('\n');
  }

  saveResults() {
    console.log('\n💾 Saving results...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = `${this.subject.name.replace(/\s+/g, '_')}_${timestamp}`;
    
    // Save life log
    const lifeLogPath = path.join(OUTPUT_DIR, `${baseName}_life_log.json`);
    fs.writeFileSync(lifeLogPath, JSON.stringify({
      subject: this.getPersonInfo(this.subject),
      seed: this.seed,
      events: this.lifeEvents,
      finalStatus: {
        age: Math.floor(this.subject.age),
        alive: this.subject.alive,
        deathCause: this.subject.deathCause,
        occupation: this.subject.occupation,
        settlement: this.getCurrentSettlement()
      }
    }, null, 2));
    console.log(`   ✓ Life log: ${lifeLogPath}`);
    
    // Save ancestry tree
    const ancestryTree = this.buildAncestryTree();
    const ancestryPath = path.join(OUTPUT_DIR, `${baseName}_ancestry.json`);
    fs.writeFileSync(ancestryPath, JSON.stringify(ancestryTree, null, 2));
    console.log(`   ✓ Ancestry: ${ancestryPath}`);
    
    // Save narrative
    const narrative = this.generateNarrative();
    const narrativePath = path.join(OUTPUT_DIR, `${baseName}_history.txt`);
    fs.writeFileSync(narrativePath, narrative);
    console.log(`   ✓ Narrative: ${narrativePath}`);
    
    console.log('\n✅ All results saved successfully!');
    console.log(`\nOutput directory: ${path.resolve(OUTPUT_DIR)}`);
  }

  async run() {
    try {
      await this.initialize();
      this.createSubject();
      this.simulateLife();
      this.saveResults();
      
      console.log('\n🎉 Simulation complete!\n');
      return true;
    } catch (error) {
      console.error('\n❌ Simulation failed:', error.message);
      console.error(error.stack);
      return false;
    }
  }
}

// Main execution
async function main() {
  const seed = process.argv[2] ? parseInt(process.argv[2]) : Date.now();
  
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         MEDIEVAL LIFE SIMULATION - LIFE SIMULATOR         ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  
  const simulator = new LifeSimulator(seed);
  const success = await simulator.run();
  
  process.exit(success ? 0 : 1);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
