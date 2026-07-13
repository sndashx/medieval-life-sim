// Shared test helpers. No external deps; Node built-ins only.
import { Game } from '../src/Game.js';

// Small world = fast (<1s init). Keeps tests under 5s.
export const SMALL_WORLD = {
  worldSize: { width: 30, height: 30 },
  settlements: 1,
  resources: 5,
  rivers: 1,
  populationMin: 5,
  populationMax: 8
};

export function makeGame(seed = 12345, worldConfig = SMALL_WORLD) {
  const game = new Game(seed, worldConfig);
  game.initialize();
  return game;
}

export function makeGameWithPlayer(seed = 12345, worldConfig = SMALL_WORLD, name = 'Tester', sex = 'male') {
  const game = makeGame(seed, worldConfig);
  game.createPlayer(name, sex);
  return game;
}

// Track call sites that use unseeded Math.random for the determinism test.
const mathRandomSites = [];
export function getMathRandomSites() { return mathRandomSites; }

// Returns a Proxy that records every Math.random() call (file + line) instead
// of returning the actual value. Tests install this temporarily.
export function installMathRandomSpy() {
  const original = Math.random;
  let counter = 0;
  Math.random = function () {
    const stack = new Error().stack;
    const line = (stack || '').split('\n').slice(2, 4).join(' | ');
    mathRandomSites.push({ call: ++counter, site: line });
    return original.call(Math);
  };
  return () => { Math.random = original; };
}

// Build an EnhancedGameUI without a real TTY. Stubs rl so command handlers
// that take args=[] (and would normally await showSelectionMenu / rl.question)
// resolve immediately. Caller is responsible for closing rl afterwards.
export async function makeHeadlessUI(game) {
  const { EnhancedGameUI } = await import('../src/ui/EnhancedGameUI.js');
  const ui = new EnhancedGameUI(game);
  // The original `rl` was created against process.stdin / process.stdout and
  // attaches a 'close' handler that calls process.exit(0). Detach both ends
  // and unref so the loop can exit naturally. Then replace with a stub.
  try { ui.rl.removeAllListeners('line'); ui.rl.removeAllListeners('close'); } catch (e) {}
  try { ui.rl.pause(); } catch (e) {}
  try { ui.rl.close(); } catch (e) {}
  ui.rl = {
    prompt: () => {},
    question: (_prompt, cb) => cb(''),
    on: () => {},
    once: (_evt, cb) => cb(''),
    close: () => {}
  };
  // Selection menus return first item or null so async handlers exit fast.
  ui.showSelectionMenu = async (items) => (items && items.length ? items[0] : null);
  // showHelp / listXxx / showXxx all print to stdout — capture instead.
  ui.log = () => {};
  ui.clearScreen = () => {};
  ui.showGameScreen = () => {};
  ui.refresh = () => {};
  return ui;
}

// Drives `handleInput(cmd)` for a list of commands; returns the list of
// commands that threw. Used by tests/commands.test.js.
export async function exerciseCommands(ui, commands) {
  const failures = [];
  const settledPromises = [];
  for (const cmd of commands) {
    let p;
    try {
      p = ui.handleInput(cmd);
    } catch (err) {
      failures.push({ cmd, error: err.message });
      continue;
    }
    if (p && typeof p.then === 'function') {
      // Swallow any rejection so post-test unhandledRejection doesn't fire.
      // Swallow attaches its own .catch so the rejection is captured even if
      // it lands after our timeout. We race against a timeout; if it times
      // out, the swallow promise will still settle later (just slowly).
      let settled = false;
      const swallow = p.catch((err) => {
        if (!settled) {
          settled = true;
          return { __err: err };
        }
        return null;
      });
      let timer;
      const timeout = new Promise(res => {
        timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            res({ __timeout: true });
          }
        }, 500);
      });
      settledPromises.push(swallow);
      try {
        const result = await Promise.race([swallow, timeout]);
        if (result && result.__err) {
          failures.push({ cmd, error: result.__err.message });
        }
      } catch (err) {
        failures.push({ cmd, error: err.message });
      } finally {
        clearTimeout(timer);
      }
    }
  }
  // Give all swallow promises generous time to settle so any late rejections
  // are absorbed before the test runner considers the suite done.
  await Promise.allSettled(settledPromises);
  // Extra safety net: even if the swallow promise somehow doesn't settle in
  // the allSettled window, wait a real tick.
  await new Promise(res => setTimeout(res, 100));
  return failures;
}
