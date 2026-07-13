import { Game } from './src/Game.js';

const game = new Game(42, {
  worldSize: { width: 50, height: 50 },
  settlements: 4,
  resources: 20,
  rivers: 2,
  populationMin: 20,
  populationMax: 40
});
game.initialize();
game.createPlayer('TestPlayer', 'male');

const banditFactions = Array.from(game.factions.factions.values()).filter(f => f.purpose === 'military');
const banditsInWorld = Array.from(game.kernel.entities.values()).filter(p => p.isPerson && p.occupation === 'bandit');

console.log('Bandit factions created:', banditFactions.length);
for (const f of banditFactions) {
  console.log(`  - ${f.name}: ${f.members.length} members, ideology=${JSON.stringify(f.ideology)}`);
}
console.log('Bandit persons in kernel.entities:', banditsInWorld.length);
console.log('Player factionId:', game.player.factionId);
console.log('Bandits in activeTier:', banditsInWorld.filter(b => game.kernel.activeTier.has(b.id)).length);

// Drive _npcAutonomousTick repeatedly WITHOUT advancing kernel ticks, so
// the bandit combat rolls fire many times without the player dying of
// environmental causes in a tiny test world. We bypass advanceTurns so
// player-death doesn't break the loop.
for (let i = 0; i < 2000; i++) {
  try { game._npcAutonomousTick(); } catch (e) {}
  if (game.combat.combatLog && game.combat.combatLog.length >= 5) break;
}

const combatLog = game.combat.combatLog || [];
console.log('NPC-initiated combats:', combatLog.length);
console.log('Sample combat log entry:', JSON.stringify(combatLog[0], null, 2));

if (banditFactions.length < 2) { console.error('FAIL: expected >=2 bandit factions'); process.exit(1); }
if (banditsInWorld.length < 4) { console.error('FAIL: expected >=4 bandit persons'); process.exit(1); }
if (combatLog.length < 1) { console.error('FAIL: expected at least 1 NPC-initiated combat'); process.exit(1); }
console.log('OK: T3-2 verification passed.');
