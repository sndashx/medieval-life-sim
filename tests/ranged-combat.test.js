import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SimulationKernel } from '../src/core/SimulationKernel.js';
import { RangedCombat } from '../src/systems/RangedCombat.js';

/**
 * Ranged combat tests — run in isolation against a fresh SimulationKernel
 * (the Game orchestrator is the only thing allowed to instantiate this and
 * is explicitly off-limits here per the task spec).
 */

function makeKernel(seed = 12345) {
  return new SimulationKernel(seed);
}

function makePerson(opts = {}) {
  return {
    id: opts.id ?? 1,
    type: 'person',
    alive: true,
    position: opts.position || { x: 0, y: 0 },
    skills: {
      combat: {
        ranged: opts.ranged ?? 0.5,
        defense: opts.defense ?? 0.3,
        melee: 0.5
      }
    },
    equipment: opts.equipment || {},
    inventory: opts.inventory || [],
    rangedAmmo: opts.rangedAmmo || null,
    physiology: opts.physiology || {
      getHealthStatus: () => ({ strength: 0.7, stamina: 0.8 }),
      applyInjury: () => {},
      takeDamage: () => {}
    },
    health: 100
  };
}

test('ranged: class is constructible', () => {
  const k = makeKernel();
  const rc = new RangedCombat(k, null);
  assert.ok(rc instanceof RangedCombat);
  assert.equal(typeof rc.attack, 'function');
  assert.equal(typeof rc.calculateAccuracy, 'function');
  assert.equal(typeof rc.getReloadTime, 'function');
  assert.equal(typeof rc.hasAmmo, 'function');
  assert.equal(typeof rc.consumeAmmo, 'function');
  assert.equal(typeof rc.getWeapons, 'function');
  assert.equal(typeof rc.update, 'function');
});

test('ranged: getWeapons returns at least 8 weapons across all 4 categories', () => {
  const k = makeKernel();
  const rc = new RangedCombat(k, null);
  const weapons = rc.getWeapons();
  assert.ok(Array.isArray(weapons));
  assert.ok(weapons.length >= 8, `expected >=8 weapons, got ${weapons.length}`);

  const cats = new Set(weapons.map(w => w.category));
  for (const need of ['bow', 'crossbow', 'thrown', 'sling']) {
    assert.ok(cats.has(need), `missing category ${need}`);
  }

  const bowCount = weapons.filter(w => w.category === 'bow').length;
  const xbowCount = weapons.filter(w => w.category === 'crossbow').length;
  const thrCount = weapons.filter(w => w.category === 'thrown').length;
  const slingCount = weapons.filter(w => w.category === 'sling').length;
  assert.ok(bowCount >= 1 && xbowCount >= 1 && thrCount >= 1 && slingCount >= 1,
    `every category needs >=1 entry (bow=${bowCount}, crossbow=${xbowCount}, thrown=${thrCount}, sling=${slingCount})`);
});

test('ranged: longbow is in the weapon catalog with reasonable stats', () => {
  const k = makeKernel();
  const rc = new RangedCombat(k, null);
  const lb = rc.getWeapon('longbow');
  assert.ok(lb, 'longbow present');
  assert.equal(lb.category, 'bow');
  assert.equal(lb.ammoType, 'arrow');
  assert.ok(lb.damage > 10, `longbow damage too low: ${lb.damage}`);
  assert.ok(lb.range >= 150, `longbow range too low: ${lb.range}`);
  assert.ok(lb.reloadTime >= 0 && lb.reloadTime <= 3);
});

test('ranged: crossbow has higher armor penetration than bow', () => {
  const k = makeKernel();
  const rc = new RangedCombat(k, null);
  const weapons = rc.getWeapons();
  const bestBowPen = Math.max(...weapons.filter(w => w.category === 'bow').map(w => w.armorPenetration));
  const worstXbowPen = Math.min(...weapons.filter(w => w.category === 'crossbow').map(w => w.armorPenetration));
  assert.ok(worstXbowPen > bestBowPen,
    `worst crossbow pen (${worstXbowPen}) should exceed best bow pen (${bestBowPen})`);
});

test('ranged: sling has low damage but ignores armor', () => {
  const k = makeKernel();
  const rc = new RangedCombat(k, null);
  const weapons = rc.getWeapons();
  const slings = weapons.filter(w => w.category === 'sling');
  assert.ok(slings.length >= 1);
  for (const s of slings) {
    assert.ok(s.ignoresArmor === true, `${s.id} should ignoreArmor`);
    assert.ok(s.damage < 15, `${s.id} damage too high for sling: ${s.damage}`);
  }
});

test('ranged: attack returns a result object with all required fields', () => {
  const k = makeKernel(7);
  const rc = new RangedCombat(k, null);
  const attacker = makePerson({ id: 1, ranged: 0.9, defense: 0.2, rangedAmmo: { arrow: 5 } });
  const defender = makePerson({ id: 2, position: { x: 15, y: 0 }, defense: 0.2 });
  const result = rc.attack(attacker, defender, 'longbow', { material: 'iron' }, { distance: 20 });

  assert.equal(typeof result.success, 'boolean');
  assert.equal(typeof result.hit, 'boolean');
  assert.equal(typeof result.damage, 'number');
  assert.ok(typeof result.location === 'string' || result.location === null);
  assert.equal(typeof result.cause, 'string');
  assert.equal(typeof result.ammoConsumed, 'boolean');
});

test('ranged: attack with no ammo returns success:false, reason:no_ammo', () => {
  const k = makeKernel(11);
  const rc = new RangedCombat(k, null);
  const attacker = makePerson({ id: 1, rangedAmmo: { arrow: 0 } });
  const defender = makePerson({ id: 2, position: { x: 10, y: 0 } });
  const result = rc.attack(attacker, defender, 'longbow', { material: 'iron' }, { distance: 20 });
  assert.equal(result.success, false);
  assert.equal(result.reason, 'no_ammo');
  assert.equal(result.ammoConsumed, false);
});

test('ranged: calculateAccuracy falls off with distance', () => {
  const k = makeKernel(13);
  const rc = new RangedCombat(k, null);
  const attacker = makePerson({ ranged: 0.8, defense: 0.2 });
  const defender = makePerson({ defense: 0.2 });

  const accPB   = rc.calculateAccuracy(attacker, defender, 'longbow', 5,   { cover: 'none' });
  const accShort= rc.calculateAccuracy(attacker, defender, 'longbow', 30,  { cover: 'none' });
  const accLong = rc.calculateAccuracy(attacker, defender, 'longbow', 150, { cover: 'none' });
  const accExt  = rc.calculateAccuracy(attacker, defender, 'longbow', 220, { cover: 'none' });

  assert.ok(accPB > accShort, `point-blank ${accPB} should beat short ${accShort}`);
  assert.ok(accShort > accLong, `short ${accShort} should beat long ${accLong}`);
  assert.ok(accLong > accExt, `long ${accLong} should beat extreme ${accExt}`);
});

test('ranged: cover reduces defender accuracy', () => {
  const k = makeKernel(17);
  const rc = new RangedCombat(k, null);
  const attacker = makePerson({ ranged: 0.8 });
  const defender = makePerson();

  const none   = rc.calculateAccuracy(attacker, defender, 'longbow', 30, { cover: 'none' });
  const light  = rc.calculateAccuracy(attacker, defender, 'longbow', 30, { cover: 'light' });
  const medium = rc.calculateAccuracy(attacker, defender, 'longbow', 30, { cover: 'medium' });
  const heavy  = rc.calculateAccuracy(attacker, defender, 'longbow', 30, { cover: 'heavy' });

  assert.ok(none  > light,  `none ${none} should beat light ${light}`);
  assert.ok(light > medium, `light ${light} should beat medium ${medium}`);
  assert.ok(medium > heavy, `medium ${medium} should beat heavy ${heavy}`);
});

test('ranged: 1000-turn game sim runs without throwing', () => {
  const k = makeKernel(99);
  const rc = new RangedCombat(k, null);

  const attacker = makePerson({ id: 1, ranged: 0.9, rangedAmmo: { arrow: 50, bolt: 50, sling_stone: 50 } });
  const defender = makePerson({ id: 2, position: { x: 20, y: 0 }, defense: 0.3 });

  for (let t = 0; t < 1000; t++) {
    k.turn = t;
    rc.update(k);
    // Fire a mix of weapons so every code path is exercised.
    const weapons = ['longbow', 'heavy_crossbow', 'sling', 'javelin'];
    const w = weapons[t % weapons.length];
    rc.attack(attacker, defender, w, { material: 'iron' }, { distance: 25 + (t % 60), cover: 'none', aimTurns: t % 5 });
  }

  assert.equal(k.turn, 999);
  // We just want to confirm no exception escaped — the assertion above is the real test.
  assert.ok(true);
});

test('ranged: deterministic — same seed produces same attack outcomes', () => {
  function runOnce(seed) {
    const k = makeKernel(seed);
    const rc = new RangedCombat(k, null);
    const attacker = makePerson({ id: 1, ranged: 0.9, defense: 0.2, rangedAmmo: { arrow: 100 } });
    const defender = makePerson({ id: 2, position: { x: 20, y: 0 }, defense: 0.2 });
    const out = [];
    for (let i = 0; i < 50; i++) {
      out.push(rc.attack(attacker, defender, 'longbow', { material: 'iron' }, { distance: 30, cover: 'none', aimTurns: 2 }));
    }
    return out.map(r => ({ hit: r.hit, damage: r.damage, location: r.location }));
  }
  const a = runOnce(2024);
  const b = runOnce(2024);
  assert.deepEqual(a, b, 'same seed must yield identical attack outcomes');

  // Sanity: a different seed should diverge somewhere in 50 trials with overwhelming probability.
  const c = runOnce(7777);
  let diffs = 0;
  for (let i = 0; i < a.length; i++) if (a[i].hit !== c[i].hit) diffs++;
  assert.ok(diffs > 0, 'different seeds should produce at least some divergent outcomes');
});