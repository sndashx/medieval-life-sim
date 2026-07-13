/**
 * SystemRegistry.js
 *
 * Centralised system instantiation for `Game`. Each system is constructed
 * with `(kernel, game)` (and any inter-system deps that must already exist)
 * and assigned to `game.<systemName>`. This file replaces the 49-line
 * inline block that previously lived in Game.js:82-171.
 *
 * Adding a new system:
 *   1. Import the class at the top.
 *   2. Add one entry in the table below with name, factory, and any deps.
 *   3. Game will pick it up automatically.
 */

import { Combat, CraftingSystem } from '../systems/Combat.js';
import { Relationships, Household, Kinship, Economy } from '../systems/Social.js';
import { MarriageSystem } from '../systems/Marriage.js';
import { TradingSystem } from '../systems/Trading.js';
import { NaturalWorldSystem } from '../systems/NaturalWorld.js';
import { Flora } from '../systems/Flora.js';
import { Fauna } from '../systems/Fauna.js';
import { Agriculture } from '../systems/Agriculture.js';
import { Buildings } from '../systems/Buildings.js';
import { Settlements } from '../systems/Settlements.js';
import { Infrastructure } from '../systems/Infrastructure.js';
import { Reputation } from '../systems/Reputation.js';
import { Status } from '../systems/Status.js';
import { NPCScheduling } from '../systems/NPCScheduling.js';
import { Religion } from '../systems/Religion.js';
import { Communication } from '../systems/Communication.js';
import { LandOwnership } from '../systems/LandOwnership.js';
import { Factions } from '../systems/Factions.js';
import { Politics } from '../systems/Politics.js';
import { Warfare } from '../systems/Warfare.js';
import { Credit } from '../systems/Credit.js';
import { Law } from '../systems/Law.js';
import { Pathogens } from '../systems/Pathogens.js';
import { Treatment } from '../systems/Treatment.js';
import { Disability } from '../systems/Disability.js';
import { Culture } from '../systems/Culture.js';
import { Language } from '../systems/Language.js';
import { Technology } from '../systems/Technology.js';
import { Education } from '../systems/Education.js';
import { Knowledge } from '../systems/Knowledge.js';
import { Ecology, FoodWeb } from '../systems/Ecology.js';
import { FoodSystem } from '../systems/FoodSystem.js';
import { Physics, MaterialPhysics } from '../systems/Physics.js';
import { Production } from '../systems/Production.js';
import { Markets } from '../systems/Markets.js';
import { TimeManagement } from '../systems/TimeManagement.js';
import { ProceduralPipeline } from '../systems/ProceduralPipeline.js';
import { Titles } from '../systems/Titles.js';
import { Magic } from '../systems/Magic.js';
import { Transportation } from '../systems/Transportation.js';

/**
 * Each entry is { name, factory(game, kernel) } where `factory` returns the
 * constructed instance. The `game` argument is passed first so factories can
 * pull inter-system dependencies via `game.<otherSystem>`.
 */
export const SYSTEM_REGISTRY = [
  { name: 'combat',          factory: g => new Combat(g.kernel, g) },
  { name: 'crafting',        factory: () => new CraftingSystem() },
  { name: 'relationships',   factory: () => new Relationships() },
  { name: 'kinship',         factory: () => new Kinship() },
  { name: 'economy',         factory: () => new Economy() },
  { name: 'marriage',        factory: g => new MarriageSystem(g.kernel, g) },
  { name: 'trading',         factory: g => new TradingSystem(g.kernel, g) },
  { name: 'naturalWorld',    factory: g => new NaturalWorldSystem(g.kernel, g) },
  { name: 'flora',           factory: g => new Flora(g.kernel, g) },
  { name: 'fauna',           factory: g => new Fauna(g.kernel, g) },
  { name: 'agriculture',     factory: g => new Agriculture(g.kernel, g) },
  { name: 'buildings',       factory: g => new Buildings(g.kernel, g) },
  { name: 'settlements',     factory: g => new Settlements(g.kernel, g) },
  { name: 'infrastructure',  factory: g => new Infrastructure(g.kernel, g) },
  { name: 'reputation',      factory: g => new Reputation(g.kernel, g) },
  { name: 'status',          factory: g => new Status(g.kernel, g) },
  { name: 'npcScheduling',   factory: g => new NPCScheduling(g.kernel, g) },
  { name: 'culture',         factory: g => new Culture(g.seed, g.kernel, g) },
  { name: 'religion',        factory: g => new Religion(g.culture, g.seed, g) },
  { name: 'communication',   factory: g => new Communication(g.kernel, g) },
  { name: 'landOwnership',   factory: g => new LandOwnership(g.kernel, g) },
  { name: 'factions',        factory: g => new Factions(g.reputation, g.status, g.kernel, g) },
  { name: 'politics',        factory: g => new Politics(g.kernel, g) },
  { name: 'warfare',         factory: g => new Warfare(g.physics, g.kernel, g) },
  { name: 'physics',         factory: g => new Physics(g.kernel, g) },
  { name: 'materialPhysics', factory: g => new MaterialPhysics(g.kernel, g) },
  { name: 'credit',          factory: g => new Credit(g.kernel, g) },
  { name: 'law',             factory: g => new Law(g.kernel, g) },
  { name: 'pathogens',       factory: g => new Pathogens(g.kernel, g) },
  { name: 'treatment',       factory: g => new Treatment(g.pathogens, g.kernel, g) },
  { name: 'disability',      factory: g => new Disability(g.kernel, g) },
  { name: 'language',        factory: g => new Language(g.kernel, g) },
  { name: 'knowledge',       factory: g => new Knowledge(g.kernel, g) },
  { name: 'technology',      factory: g => new Technology(g.knowledge, g.kernel, g) },
  { name: 'education',       factory: g => new Education(g.kernel, g) },
  { name: 'ecology',         factory: g => new Ecology(g.world, g.kernel) },
  { name: 'foodWeb',         factory: () => new FoodWeb() },
  { name: 'foodSystem',      factory: g => new FoodSystem(g.kernel, g) },
  { name: 'production',      factory: g => new Production(g.kernel, g) },
  { name: 'markets',         factory: g => new Markets(g.kernel, g) },
  { name: 'timeManagement',  factory: () => new TimeManagement() },
  { name: 'proceduralPipeline', factory: () => new ProceduralPipeline() },
  { name: 'titles',          factory: g => new Titles(g.kernel, g) },
  { name: 'magic',           factory: g => new Magic(g.kernel, g) },
  { name: 'transportation',  factory: g => new Transportation(g.kernel, g) }
];

/**
 * Instantiate every system in the registry and attach it to `game.<name>`.
 * Order matters because some factories reference `game.<other>`; the
 * SYSTEM_REGISTRY array above is hand-ordered to satisfy those deps.
 */
export function registerSystems(game) {
  const verbose = process.env.MLS_VERBOSE_INIT === '1';
  const loaded = [];
  for (const entry of SYSTEM_REGISTRY) {
    if (verbose) console.log(`  → Loading ${entry.name} system...`);
    game[entry.name] = entry.factory(game);
    loaded.push(entry.name);
  }
  game._perceptionCache = new Map();
  game._locomotionCache = new Map();
  console.log(`  ✓ ${loaded.length} systems online (combat, kinship, economy, warfare, magic, …)`);
  return loaded;
}