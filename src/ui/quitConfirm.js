/**
 * Shared quit-confirm helper for all terminal UIs.
 *
 * `confirmQuit(input)` is a pure function so the decision logic is
 * unit-testable without spinning up blessed, readline, or blessed-contrib.
 *
 * Returns one of:
 *   - 'save'   -> user typed y/Y/yes/save (case-insensitive)
 *   - 'exit'   -> user typed n/N/no, '' (default), or anything not y/c
 *   - 'cancel' -> user typed c/C/cancel
 *
 * Default is 'exit' (i.e. "N") to match the agreed spec: "Default to N.
 * Y saves+exits. C cancels."
 */
export function confirmQuit(input) {
  const v = (input == null ? '' : String(input)).trim().toLowerCase();
  if (v === 'y' || v === 'yes' || v === 'save') return 'save';
  if (v === 'c' || v === 'cancel') return 'cancel';
  return 'exit';
}

/**
 * Perform the quit flow: ask the user, optionally save, then exit (or cancel).
 *
 * `ui` is expected to expose:
 *   - ui.rl.question(prompt, cb)   for readline UIs
 *   - ui.log(msg, type)            for log output (Blessed uses blessed log; Enhanced uses console)
 *   - ui.save()                    sync save() that writes the save file
 *   - ui.processExit(code)         override hook for tests
 *   - ui.processExitAfterSave()    optional override for save-and-exit
 *   - ui.processExitNoSave()       optional override for plain exit
 *
 * `promptFn` is an optional alternative to ui.rl.question (used by Blessed
 * which routes input through a commandInput box).
 */
export async function performQuit(ui, promptFn) {
  const ask = typeof promptFn === 'function' ? promptFn : null;
  const askDefault = (q, cb) => {
    if (ask) return ask(q, cb);
    if (ui.rl && typeof ui.rl.question === 'function') {
      ui.rl.question(q, cb);
      return;
    }
    cb('');
  };
  const exitFn = (code) => {
    if (typeof ui.processExit === 'function') return ui.processExit(code);
    if (typeof ui.processExitAfterSave === 'function' && code === 0 && ui._lastQuitSaved) return ui.processExitAfterSave();
    if (typeof ui.processExitNoSave === 'function' && code === 0 && !ui._lastQuitSaved) return ui.processExitNoSave();
    process.exit(code);
  };

  return new Promise((resolve) => {
    const decide = (raw) => {
      const choice = confirmQuit(raw);
      if (choice === 'cancel') {
        ui.log && ui.log('Quit cancelled.', 'system');
        ui._lastQuitSaved = false;
        resolve('cancel');
        return;
      }
      if (choice === 'save') {
        try {
          ui.save && ui.save();
          ui._lastQuitSaved = true;
          ui.log && ui.log('Saved. Exiting...', 'system');
        } catch (e) {
          ui.log && ui.log(`Save failed: ${e.message || e}`, 'error');
          ui._lastQuitSaved = false;
        }
        const code = ui._lastQuitSaved ? 0 : 1;
        exitFn(code);
        resolve(ui._lastQuitSaved ? 'save-exit' : 'exit-on-save-fail');
        return;
      }
      ui._lastQuitSaved = false;
      ui.log && ui.log('Exiting without saving...', 'system');
      exitFn(0);
      resolve('exit');
    };
    askDefault('Save before quitting? [y/N/cancel] ', decide);
  });
}