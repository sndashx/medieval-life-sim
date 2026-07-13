/**
 * OpeningHook.js
 * 
 * Creates a compelling 60-second opening experience that teaches core mechanics
 * through an immediate, personal story hook.
 */

export class OpeningHook {
  constructor(game) {
    this.game = game;
    this.kernel = game.kernel;
  }

  /**
   * Create the opening scenario: Edda's cow in the river
   * Returns the player, Edda, and the scenario state
   */
  createOpeningScenario() {
    // Find or create a named village (prefer first settlement)
    const village = this.game.world.settlements[0];
    if (!village.name || village.name.includes('Settlement')) {
      village.name = this.generateVillageName();
    }

    // Spawn player in the village center
    const player = this.game.player;
    player.position = {
      x: village.x,
      y: village.y,
      z: 0,
      settlementId: 0
    };

    // Find or create Edda (female, middle-aged, farmer)
    let edda = this.findOrCreateEdda(village);

    // Create the cow crisis
    const scenario = {
      type: 'cow_in_river',
      npc: edda,
      village: village,
      state: 'active',
      timeStarted: this.kernel.turn,
      resolved: false
    };

    // Add Edda as player's neighbor
    if (this.game.relationships) {
      this.game.relationships.createBond(player.id, edda.id, 'neighbor', 0.3);
    }

    return { player, edda, scenario, village };
  }

  /**
   * Generate a memorable village name
   */
  generateVillageName() {
    const prefixes = ['Green', 'Oak', 'Stone', 'River', 'Mill', 'Crow', 'Ash', 'Iron'];
    const suffixes = ['ford', 'bridge', 'haven', 'vale', 'bury', 'ton', 'field', 'wood'];
    const rng = this.kernel.rng;
    return prefixes[rng.nextInt(0, prefixes.length - 1)] + 
           suffixes[rng.nextInt(0, suffixes.length - 1)];
  }

  /**
   * Find existing Edda or create her
   */
  findOrCreateEdda(village) {
    // Try to find existing female farmer
    for (const person of this.kernel.alivePeople) {
      if (person.sex === 'female' && 
          person.age >= 30 && person.age <= 50 &&
          person.occupation === 'farmer' &&
          person.position?.settlementId === 0) {
        person.name = 'Edda';
        return person;
      }
    }

    // Create Edda
    const edda = this.game.createPerson({
      name: 'Edda',
      age: 38,
      sex: 'female',
      position: { x: village.x, y: village.y, z: 0, settlementId: 0 },
      occupation: 'farmer',
      enableAAA: true,
      aaaFeatures: ['memory', 'emotions', 'social', 'decisions']
    }, 'active');

    return edda;
  }

  /**
   * Get the opening narrative text
   */
  getOpeningNarrative(scenario) {
    const { village, edda } = scenario;
    
    return [
      `═══════════════════════════════════════════════════════════`,
      `  Welcome to ${village.name}`,
      `═══════════════════════════════════════════════════════════`,
      ``,
      `You arrive in ${village.name} on a crisp autumn morning.`,
      `The village is small but lively, with smoke rising from`,
      `chimneys and the sound of a blacksmith's hammer ringing`,
      `in the distance.`,
      ``,
      `As you approach the village green, you hear shouting.`,
      ``,
      `"Help! Someone help!" cries ${edda.name}, your neighbor.`,
      `She's running toward the river, pointing frantically.`,
      `"My cow! She's fallen in the river and can't get out!"`,
      ``,
      `${edda.name} looks at you desperately. "Please, I can't`,
      `lose her — she's all I have!"`,
      ``,
      `═══════════════════════════════════════════════════════════`,
      `  What do you do?`,
      `═══════════════════════════════════════════════════════════`,
      ``,
      `Type 'help edda' to rescue the cow`,
      `Type 'look' to examine your surroundings`,
      `Type 'talk edda' to speak with her`,
      `Type 'ignore' to walk away`,
      ``,
      `(Type 'help' anytime for a list of commands)`,
      ``
    ].join('\n');
  }

  /**
   * Handle player response to the opening hook
   */
  handleResponse(command, scenario) {
    const { edda, village } = scenario;
    const player = this.game.player;

    if (command.includes('help') && command.includes('edda')) {
      return this.resolveHelpCow(player, edda, scenario);
    } else if (command.includes('ignore')) {
      return this.resolveIgnore(player, edda, scenario);
    } else if (command.includes('talk') && command.includes('edda')) {
      return this.resolveTalk(player, edda, scenario);
    } else if (command.includes('look')) {
      return this.describeSurroundings(village, edda);
    }

    return null;
  }

  /**
   * Player helps rescue the cow
   */
  resolveHelpCow(player, edda, scenario) {
    scenario.resolved = true;
    scenario.outcome = 'helped';

    // Update relationship
    if (this.game.relationships) {
      this.game.relationships.modifyAffinity(edda.id, player.id, 0.4, 'helped_in_crisis');
    }

    // AAA NPC emotional response
    if (edda.aaaBridge) {
      edda.aaaBridge.aaaNPC.reactToEvent({
        type: 'received_help',
        source: player.id,
        severity: 0.8,
        emotionalIntensity: 0.9,
        participants: [player.id],
        location: 'river',
        description: 'Player rescued cow from river'
      });
    }

    return [
      ``,
      `You rush to the riverbank. The cow is struggling in the`,
      `current, eyes wide with fear. You wade in, the cold water`,
      `shocking your legs, and grab the cow's halter.`,
      ``,
      `With effort, you guide the frightened animal back to shore.`,
      `The cow stumbles onto the bank, shaking water from her hide.`,
      ``,
      `${edda.name} throws her arms around the cow's neck, tears`,
      `streaming down her face. "Thank you! Thank you so much!"`,
      `She looks at you with genuine gratitude.`,
      ``,
      `"I won't forget this kindness. If you ever need anything,`,
      `you come find me, you hear?"`,
      ``,
      `[+0.4 relationship with ${edda.name}]`,
      `[${edda.name} will remember your kindness]`,
      ``,
      `═══════════════════════════════════════════════════════════`,
      `  Tutorial Complete`,
      `═══════════════════════════════════════════════════════════`,
      ``,
      `You've learned the basics:`,
      `  • 'help <person>' to assist someone`,
      `  • 'talk <person>' to have a conversation`,
      `  • 'look' to examine your surroundings`,
      ``,
      `Your actions have consequences. ${edda.name} now trusts you,`,
      `and word of your deed will spread through ${scenario.village.name}.`,
      ``,
      `Type 'look' to explore the village, or 'help' for more commands.`,
      ``
    ].join('\n');
  }

  /**
   * Player ignores Edda
   */
  resolveIgnore(player, edda, scenario) {
    scenario.resolved = true;
    scenario.outcome = 'ignored';

    // Update relationship negatively
    if (this.game.relationships) {
      this.game.relationships.modifyAffinity(edda.id, player.id, -0.3, 'ignored_in_crisis');
    }

    // AAA NPC emotional response
    if (edda.aaaBridge) {
      edda.aaaBridge.aaaNPC.reactToEvent({
        type: 'betrayal',
        source: player.id,
        severity: 0.6,
        emotionalIntensity: 0.7,
        participants: [player.id],
        location: 'village_green',
        description: 'Player ignored plea for help'
      });
    }

    return [
      ``,
      `You turn away from ${edda.name}'s desperate cries.`,
      ``,
      `Behind you, you hear her sobbing as she runs toward`,
      `the river alone. Other villagers rush past you to help.`,
      ``,
      `One of them, an older man, gives you a hard look.`,
      `"That's not how we do things in ${scenario.village.name},"`,
      `he mutters.`,
      ``,
      `[-0.3 relationship with ${edda.name}]`,
      `[${edda.name} will remember your refusal]`,
      `[Village reputation decreased]`,
      ``,
      `═══════════════════════════════════════════════════════════`,
      `  Tutorial Complete`,
      `═══════════════════════════════════════════════════════════`,
      ``,
      `Your actions have consequences. ${edda.name} now distrusts you,`,
      `and the village has taken notice.`,
      ``,
      `Type 'look' to explore the village, or 'help' for more commands.`,
      ``
    ].join('\n');
  }

  /**
   * Player talks to Edda
   */
  resolveTalk(player, edda, scenario) {
    return [
      ``,
      `${edda.name}: "Please, there's no time! My cow is drowning!"`,
      ``,
      `She gestures frantically toward the river.`,
      ``,
      `Type 'help edda' to rescue the cow, or 'ignore' to walk away.`,
      ``
    ].join('\n');
  }

  /**
   * Describe the surroundings
   */
  describeSurroundings(village, edda) {
    return [
      ``,
      `You're standing on the village green of ${village.name}.`,
      ``,
      `To the north, you see a small chapel with a wooden cross.`,
      `To the east, smoke rises from the blacksmith's forge.`,
      `To the south, the river flows swiftly past the village.`,
      `To the west, farmhouses dot the landscape.`,
      ``,
      `${edda.name} is here, looking at you desperately.`,
      `Several other villagers are going about their business.`,
      ``,
      `You can hear the cow's distressed lowing from the river.`,
      ``,
      `Type 'help edda' to rescue the cow, or 'ignore' to walk away.`,
      ``
    ].join('\n');
  }
}
