// App — root React component for the Ink TUI.
//
// Wires the Store + Actions + UI panels together. Top-level useInput
// captures single-key shortcuts; the CommandBar's TextInput captures
// slash commands.

import { html, Box, Text, useState, useEffect, useCallback, useMemo, useApp, useInput, useFocus, useFocusManager } from './_jsx.js';
import { Banner } from './Banner.js';
import { VitalsPanel } from './VitalsPanel.js';
import { Viewport } from './Viewport.js';
import { FeedPanel } from './FeedPanel.js';
import { CommandBar } from './CommandBar.js';
import { StatusBar } from './StatusBar.js';
import { HelpOverlay } from './HelpOverlay.js';
import { NamePrompt } from './NamePrompt.js';
import { HeirsOverlay } from './HeirsOverlay.js';
import { C, G } from '../theme.js';
import { Actions } from '../actions.js';
import { useSnapshot } from '../state.js';

// Slash → method on Actions. Single keys map to same handlers (without args).
const SLASH_COMMANDS = {
  '?': 'help', 'help': 'help',
  'start': 'start', 'begin': 'start', 'born': 'start',
  'look': 'look', 'l': 'look',
  'status': 'status', 'stat': 'status',
  'inventory': 'inventory', 'inv': 'inventory', 'i': 'inventory',
  'move': 'move', 'm': 'move', 'go': 'move', 'walk': 'move',
  'take': 'take', 'get': 'take',
  'drop': 'drop',
  'eat': 'eat', 'e': 'eat',
  'drink': 'drink', 'd': 'drink',
  'sleep': 'sleep', 's': 'sleep', 'rest': 'sleep',
  'work': 'work', 'w': 'work',
  'wait': 'wait', 'z': 'wait',
  'talk': 'talk', 't': 'talk',
  'propose': 'propose',
  'family': 'family', 'fam': 'family',
  'faction': 'faction', 'factions': 'faction',
  'warfare': 'warfare', 'war': 'warfare',
  'titles': 'titles', 'title': 'titles',
  'dynasty': 'dynasty',
  'heirs': 'dynasty',
  'continue': 'continue',
  'study': 'study',
  'craft': 'craft',
  'cook': 'cook',
  'hunt': 'hunt',
  'forage': 'forage',
  'pray': 'pray',
  'save': 'save',
  'load': 'load',
  'quit': 'quit', 'exit': 'quit', 'q': 'quit',
};

// Single-key shortcuts (without /).
const KEY_COMMANDS = {
  'l': 'look',
  'w': 'work',
  'e': 'eat',
  'd': 'drink',
  's': 'sleep',
  'i': 'inventory',
  'n': 'wait', // quick next-turn
  'h': 'help',
  '?': 'help',
};

// Keys that don't dispatch a command — they toggle UI.
const UI_KEYS = {
  'tab': 'cycle-mode',
};

export function App({ store }) {
  const { exit } = useApp();
  const focusManager = useFocusManager();
  const snap = useSnapshot(store, 250);
  const actions = useMemo(() => new Actions(store.game, store), [store]);
  const [mode, setMode] = useState('realm');
  const [showHelp, setShowHelp] = useState(false);
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [pendingHeirs, setPendingHeirs] = useState(null); // null | array of {id,name,...}
  const [termSize, setTermSize] = useState(() => ({
    width: process.stdout.columns || 100,
    height: process.stdout.rows || 32,
  }));

  // Turn on Ink's focus system so useFocus() works inside TextInput.
  useEffect(() => { focusManager.enableFocus(); }, []);

  // Watch for player death — show heir prompt.
  useEffect(() => {
    if (snap.player === null && snap.alive === false && store.game.kernel) {
      const heirs = store.game.kinship?.getEligibleHeirs?.(store.game.player?.id) || [];
      const list = heirs.map(id => {
        const h = store.game.kernel.entities.get(id);
        return h && h.alive ? { id, name: h.name, sex: h.sex, age: h.age, occupation: h.occupation } : null;
      }).filter(Boolean);
      setPendingHeirs(list);
    }
  }, [snap.player, snap.alive, store]);

  // Track terminal size.
  useEffect(() => {
    const update = () => {
      setTermSize({
        width: process.stdout.columns || 100,
        height: process.stdout.rows || 32,
      });
    };
    update();
    process.stdout.on('resize', update);
    return () => process.stdout.off('resize', update);
  }, []);

  // Register exit alias for Actions.quit.
  useEffect(() => {
    actions.exit = () => { exit(); };
  }, [actions, exit]);

  const dispatchCommand = useCallback(async (raw) => {
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    let body = trimmed;
    if (body.startsWith('/')) body = body.slice(1);
    const [name, ...args] = body.split(/\s+/);
    const cmd = SLASH_COMMANDS[name.toLowerCase()] || name.toLowerCase();
    if (cmd === 'help') { setShowHelp(true); return; }
    if (cmd === 'start') {
      if (store.game.player) {
        store.log('You already have an active life.', 'error');
        return;
      }
      setShowNamePrompt(true);
      return;
    }
    if (cmd === 'quit') { actions.exit = () => exit(); await actions.run('save', []); exit(); return; }
    await actions.run(cmd, args);
  }, [actions, exit, store]);

  const handleNameComplete = useCallback(async ({ name, sex }) => {
    setShowNamePrompt(false);
    await actions.run('start', [name, sex]);
  }, [actions]);

  const handleHeirChoose = useCallback(async (idx) => {
    setPendingHeirs(null);
    await actions.run('continue', [String(idx + 1)]);
  }, [actions]);

  const handleStartNew = useCallback(async () => {
    setPendingHeirs(null);
    setShowNamePrompt(true);
  }, []);

  // ── Global key handler ────────────────────────────────────────────────
  // We deliberately do NOT compete with the TextInput for normal characters.
  // Strategy: use Ink's focus system (turned on above). When the CommandBar's
  // TextInput is focused, ONLY its useInput fires for normal characters; our
  // global handler ignores character input and only handles:
  //   - Tab / Shift+Tab to cycle focus
  //   - Escape to close overlays or move focus to the prompt
  //   - Ctrl+C / Ctrl+S to abort / save
  //   - Single-key shortcuts — but only when the prompt is NOT focused, so
  //     typing 'l' for "look" doesn't get swallowed by TextInput.

  // Two input modes:
  //   prompt mode (default) — TextInput is focused, all chars go into it.
  //     Slash commands (/work, /help) and Enter submit work here.
  //   shortcut mode — single-letter keys (l, w, e, s, i, n, ?) act as
  //     commands. Toggled with Esc.
  //
  // Visual cue: when in prompt mode, the command bar border is bright gold
  // and shows the placeholder. When in shortcut mode, the border dims and
  // a hint appears explaining the mode.

  const [promptActive, setPromptActive] = useState(true);
  const [pendingChar, setPendingChar] = useState('');
  const focusManagerRef = useMemo(() => focusManager, [focusManager]);

  // Keep the CommandBar's focus in sync with promptActive.
  useEffect(() => {
    if (promptActive) focusManagerRef.focus('commandbar');
  }, [promptActive, focusManagerRef]);

  useInput((input, key) => {
    // Ctrl shortcuts always work.
    if (key.ctrl && input === 'c') { exit(); return; }
    if (key.ctrl && input === 's') { actions.run('save', []); return; }

    // Slash always goes to the prompt — even in shortcut mode. We seed the
    // TextInput value with '/' so the user can keep typing their command.
    if (input === '/' && !promptActive) {
      setPromptActive(true);
      setPendingChar('/');
      return;
    }

    // Esc toggles between prompt and shortcut mode.
    if (key.escape) {
      if (showHelp) { setShowHelp(false); return; }
      setPromptActive(p => !p);
      return;
    }

    // In prompt mode, leave everything to TextInput.
    if (promptActive) return;

    // ── Shortcut mode handlers below ──

    // Help shortcut.
    if (input === '?' || (key.ctrl && input === 'h')) {
      setShowHelp(s => !s);
      return;
    }

    // Quit shortcut.
    if (input === 'Q') {
      actions.run('save', []);
      exit();
      return;
    }

    // Quick turn.
    if (input === ' ') {
      actions.run('wait', ['60']);
      return;
    }

    // Single-key shortcuts.
    if (input.length === 1) {
      const cmd = KEY_COMMANDS[input.toLowerCase()];
      if (cmd) { actions.run(cmd, []); return; }
    }

    // Tab cycles modes.
    if (key.tab) {
      const order = ['realm', 'map', 'character', 'chronicle'];
      const idx = order.indexOf(mode);
      setMode(order[(idx + 1) % order.length]);
      return;
    }
  }, { isActive: !showHelp });

  // Layout sizing. The center viewport is the biggest. On narrow terminals
// we hide the right feed to keep the dashboard readable.
  const w = termSize.width;
  const hideFeed = w < 95;
  const leftW = w < 95 ? 28 : Math.max(30, Math.min(38, Math.floor(w * 0.24)));
  const rightW = hideFeed ? 0 : Math.max(28, Math.min(36, Math.floor(w * 0.22)));
  const gap = hideFeed ? 2 : 4;
  const mainW = Math.max(36, w - leftW - rightW - gap);

  if (showHelp) {
    return html`
      <${Box} flexDirection="column" paddingX=${1}>
        <${HelpOverlay} onClose=${() => setShowHelp(false)} />
      </${Box}>
    `;
  }

  if (showNamePrompt) {
    return html`
      <${Box} flexDirection="column" paddingX=${1}>
        <${Banner} info=${snap.info} terminalWidth=${termSize.width} />
        <${Box} marginTop=${1}>
          <${NamePrompt} onComplete=${handleNameComplete} />
        </${Box}>
      </${Box}>
    `;
  }

  if (pendingHeirs !== null) {
    return html`
      <${Box} flexDirection="column" paddingX=${1}>
        <${Banner} info=${snap.info} terminalWidth=${termSize.width} />
        <${Box} marginTop=${1}>
          <${HeirsOverlay}
            heirs=${pendingHeirs}
            onChoose=${handleHeirChoose}
            onStartNew=${handleStartNew}
          />
        </${Box}>
      </${Box}>
    `;
  }

  // ── Welcome screen (no player yet) ────────────────────────────────────
  if (!snap.player && !snap.alive) {
    return html`
      <${Box} flexDirection="column" paddingX=${1}>
        <${Banner} info=${snap.info} terminalWidth=${termSize.width} />
        <${Box} flexDirection="row" marginTop=${1}>
          <${Box} flexDirection="column" borderStyle="round" borderColor=${C.midnightBright} paddingX=${1} width=${leftW}>
            <${Text} color=${C.gold} bold>${G.fleur}  the illuminated codex</${Text}>
            <${Text} color=${C.mute}>${'─'.repeat(28)}</${Text}>
            <${Text} color=${C.parchmentDim}>${G.cross}  no life begun yet</${Text}>
            <${Text} color=${C.mute}>  type ${G.swashOpen}/start${G.swashClose} to begin</${Text}>
            <${Text} color=${C.mute}>  or ${G.swashOpen}?${G.swashClose} for guidance</${Text}>
          </${Box}>

          <${Box} flexDirection="column" borderStyle="round" borderColor=${C.goldDeep} paddingX=${1} flexGrow=${1} marginLeft=${1}>
            <${Text} color=${C.gold} bold>${G.spark}  WELCOME</${Text}>
            <${Text} color=${C.mute}>${'─'.repeat(60)}</${Text}>
            <${Text} color=${C.parchment}>  You stand at the threshold of an age.</${Text}>
            <${Text} color=${C.parchment}>  Beyond this gate, ten thousand souls go about</${Text}>
            <${Text} color=${C.parchment}>  their lives — some to greatness, most to quiet dust.</${Text}>
            <${Text}>${''}</${Text}>
            <${Text} color=${C.goldBright}>  ${G.crown} ${G.swashOpen}/start${G.swashClose} ${G.arrowR} begin your life</${Text}>
            <${Text} color=${C.parchment}>     born in a hamlet, raised by a peasant family.</${Text}>
            <${Text}>${''}</${Text}>
            <${Text} color=${C.goldBright}>  ${G.book} ${G.swashOpen}/help${G.swashClose} ${G.arrowR} see all commands</${Text}>
            <${Text} color=${C.goldBright}>  ${G.skull} ${G.swashOpen}/quit${G.swashClose} ${G.arrowR} leave the realm</${Text}>
            <${Text}>${''}</${Text}>
            <${Text} color=${C.mute}>  ${G.fleur}  the world is yours to shape.</${Text}>
          </${Box}>
        </${Box}>

        <${CommandBar} onCommand=${dispatchCommand} mode=${mode} terminalWidth=${termSize.width} active=${promptActive} initialChar=${pendingChar} onConsumedChar=${() => setPendingChar('')} />
      </${Box}>
    `;
  }

  return html`
    <${Box} flexDirection="column" paddingX=${1}>
      <${Banner} info=${snap.info} terminalWidth=${termSize.width} />
      <${StatusBar} mode=${mode} setMode=${setMode} snap=${snap} />

      <${Box} flexDirection="row" marginTop=${1}>
        <${VitalsPanel} snap=${snap} width=${leftW} />
        <${Box} marginLeft=${1}>
          <${Text}>${''}</${Text}>
        </${Box}>
        <${Viewport} mode=${mode} snap=${snap} game=${store.game} width=${mainW} />
        ${!hideFeed ? html`
          <${Box} marginLeft=${1}>
            <${Text}>${''}</${Text}>
          </${Box}>
          <${FeedPanel} snap=${snap} mode=${mode} terminalHeight=${termSize.height} />
        ` : null}
      </${Box}>

      <${CommandBar} onCommand=${dispatchCommand} mode=${mode} terminalWidth=${termSize.width} active=${promptActive} initialChar=${pendingChar} onConsumedChar=${() => setPendingChar('')} />
    </${Box}>
  `;
}