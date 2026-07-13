// InkGameUI — bridge class so the new TUI can be plugged into the existing
// Game lifecycle the same way BlessedGameUI and RoguelikeUI are.
//
// API contract (matches Game expectations):
//   - constructed with a Game instance
//   - .start() launches the UI (returns when user quits)
//   - .log(msg, type) handles incoming notifications

import React from 'react';
import { render } from 'ink';
import { Store } from './ink/state.js';
import { App } from './ink/components/App.js';

export class InkGameUI {
  constructor(game) {
    this.game = game;
    this.store = new Store(game, 250);
    this.unmount = null;
  }

  start() {
    // Round-3 regression fix: `Game.registerUI` was removed; the new
    // notification channel is `registerUIListener(logFn)`. Mirror the same
    // pattern BlessedGameUI/RoguelikeUI use.
    if (typeof this.game.registerUIListener === 'function') {
      this._unregisterUI = this.game.registerUIListener((msg, type) => this.log(msg, type || 'system'));
    }

    const { unmount, waitUntilExit } = render(React.createElement(App, { store: this.store }));
    this.unmount = unmount;

    // Welcome message.
    this.store.log('The realm stirs. The world awaits.', 'system');
    this.store.log(`Seed: ${this.game.seed}`, 'system');

    // Cleanup hook so SIGINT cleanly unmounts and frees the store.
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      try { unmount(); } catch (e) { /* ignore */ }
      try { this.store.destroy(); } catch (e) { /* ignore */ }
    };
    process.once('SIGINT', cleanup);
    process.once('SIGTERM', cleanup);

    // waitUntilExit resolves when the React tree unmounts.
    if (waitUntilExit && typeof waitUntilExit.then === 'function') {
      return waitUntilExit.then(() => cleanup()).catch(err => { cleanup(); throw err; });
    }
    // Fallback: never resolves; cleanup runs on signals.
    return new Promise(() => {});
  }

  log(message, type = 'info') {
    this.store.log(message, type);
  }
}