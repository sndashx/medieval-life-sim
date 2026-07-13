import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Language } from '../src/systems/Language.js';
import { SeededRNG } from '../src/core/SimulationKernel.js';
import { Game } from '../src/Game.js';

function makeKernel(turn = 0, seed = 12345) {
  return {
    turn,
    rng: new SeededRNG(seed),
    entities: new Map(),
    scheduleEvent: () => {}
  };
}

test('language: game wires the system and exposes an update() function', () => {
  const game = new Game(12345, {
    worldSize: { width: 30, height: 30 },
    settlements: 1, resources: 5, rivers: 1,
    populationMin: 5, populationMax: 8
  });
  game.initialize();
  game.createPlayer('Tester', 'male');
  assert.ok(game.language, 'game.language must be wired');
  assert.equal(typeof game.language.update, 'function',
    'language.update must be a function (was missing — P0-2 fix)');
  assert.doesNotThrow(() => game.language.update(game.kernel),
    'language.update must not throw when called with the kernel');
});

test('language: update() throttles to once per game-year (525,600 turns)', () => {
  const lang = new Language();
  const k = makeKernel(0);
  lang.update(k);
  assert.equal(lang._lastEvolutionTick, 0);
  // Same year → throttled.
  k.turn = 100_000;
  lang.update(k);
  assert.equal(lang._lastEvolutionTick, 0,
    'must stay throttled within the first game-year');
  // Past one year → runs.
  k.turn = 525_600;
  lang.update(k);
  assert.equal(lang._lastEvolutionTick, 525_600, 'must run after one game-year');
});

test('language: dialect divergence grows slightly each year', () => {
  const lang = new Language();
  const k = makeKernel(525_600, 7);
  const base = lang.generateLanguage(7);
  const dialect = lang.createDialect(base.id, { x: 0, y: 0 }, 0.2);
  const before = dialect.divergence;
  lang.update(k); // fires once (turn >= 525_600)
  assert.ok(dialect.divergence > before,
    `dialect.divergence should grow each year (was ${before}, now ${dialect.divergence})`);
  assert.ok(dialect.divergence <= 0.9,
    'divergence should be capped at 0.9');
});

test('language: language with no speakers for 3 years is marked dead and emits event', () => {
  const lang = new Language();
  const events = [];
  const k = makeKernel(0, 7);
  k.scheduleEvent = (e) => events.push(e);
  const base = lang.generateLanguage(7);
  // base has 0 speakers from the start.
  assert.equal(base.speakers, 0);
  // Year 1 → 1 year empty.
  k.turn = 525_600;
  lang.update(k);
  assert.equal(base.dead, undefined, 'must not die after 1 empty year');
  // Year 2 → 2 years empty.
  k.turn = 1_051_200;
  lang.update(k);
  assert.equal(base.dead, undefined, 'must not die after 2 empty years');
  // Year 3 → 3 years empty → dead.
  k.turn = 1_576_800;
  lang.update(k);
  assert.equal(base.dead, true, 'language with 0 speakers for 3 years must die');
  assert.ok(events.some(e => e.type === 'language_died' && e.languageId === base.id),
    'language_died event must fire on the kernel');
});

test('language: language with active speakers does not die even after many years', () => {
  const lang = new Language();
  const k = makeKernel(0, 7);
  const base = lang.generateLanguage(7);
  base.speakers = 100; // plenty of speakers
  // Run for 10 years.
  for (let y = 1; y <= 10; y++) {
    k.turn = 525_600 * y;
    lang.update(k);
  }
  assert.notEqual(base.dead, true,
    'language with active speakers must not be marked dead');
  assert.equal(base._noSpeakersYears, 0,
    'speaker counter must reset to 0 when speakers are present');
});

test('language: 1000-turn game sim runs the language update path without throwing', () => {
  const game = new Game(12345, {
    worldSize: { width: 30, height: 30 },
    settlements: 1, resources: 5, rivers: 1,
    populationMin: 5, populationMax: 8
  });
  game.initialize();
  game.createPlayer('Tester', 'male');
  game.player.age = 25;
  if (game.playerHousehold) game.playerHousehold.food = 10000;
  assert.doesNotThrow(() => game.advanceTurns(1000),
    'game must run with the language update path wired');
});