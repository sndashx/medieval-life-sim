// CommandBar — the input prompt at the bottom. Uses ink-text-input for
// keyboard handling. Slash-prefixed commands dispatch to Actions.
//
// Participates in Ink's focus system via useFocus({ autoFocus: true }) so the
// input is naturally the focused element when the UI mounts. The global
// key handler in App checks focus state to decide who owns each keystroke.

import { html, Box, Text, useState, useCallback, useEffect, useFocus } from './_jsx.js';
import { C, G } from '../theme.js';
import TextInput from 'ink-text-input';

export function CommandBar({ onCommand, mode, terminalWidth = 100, focusId = 'commandbar', active = true, initialChar = '', onConsumedChar }) {
  const [value, setValue] = useState('');
  const [history, setHistory] = useState([]);
  const [hint, setHint] = useState(null);

  // When the parent toggles active and supplies initialChar (e.g. user
  // pressed '/' in shortcut mode), seed the input with it. The parent
  // notifies us via the changed `active` flag.
  useEffect(() => {
    if (active && initialChar) {
      setValue(v => v + initialChar);
      if (onConsumedChar) onConsumedChar();
    }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-focus on mount. The `active` prop tells us whether the prompt is
  // currently in "typing mode" — when false, the TextInput ignores keystrokes
  // and they pass through to the global handler (shortcut mode).
  const { isFocused } = useFocus({ id: focusId, autoFocus: true });

  // While active=false, force the TextInput's focus to false so it doesn't
  // swallow single-key shortcuts.
  const textInputFocused = active && isFocused;

  const submit = useCallback((raw) => {
    const v = raw.trim();
    if (!v) return;
    setHistory(h => [...h.slice(-9), v]);
    onCommand(v);
    setValue('');
    setHint(null);
  }, [onCommand]);

  const handleChange = useCallback((v) => {
    setValue(v);
    if (v.startsWith('/') && v.length > 1) {
      const stem = v.slice(1).toLowerCase();
      const cmds = ['help','?','start','look','l','status','inventory','i','move','m','take','drop','eat','e','drink','sleep','s','work','w','wait','talk','propose','family','faction','warfare','titles','dynasty','heirs','continue','study','craft','cook','hunt','forage','pray','save','load','quit','exit'];
      const hit = cmds.find(c => c.startsWith(stem));
      setHint(hit && hit !== stem ? hit : null);
    } else {
      setHint(null);
    }
  }, []);

  const modeLabel = {
    realm: `${G.realm} realm`,
    map: `${G.map} map`,
    character: `${G.char} character`,
    chronicle: `${G.chronicle} chronicle`,
  }[mode] || mode;

  const hints = active ? [
    `${G.swashOpen}Esc${G.swashClose} shortcut mode`,
    `${G.swashOpen}/help${G.swashClose} all commands`,
    `${G.swashOpen}Tab${G.swashClose} modes`,
    `${G.swashOpen}Ctrl+S${G.swashClose} save`,
    `${G.swashOpen}Ctrl+C${G.swashClose} quit`,
  ] : [
    `${G.swashOpen}Esc${G.swashClose} prompt mode`,
    `${G.swashOpen}?${G.swashClose} help`,
    `${G.swashOpen}l${G.swashClose} look`,
    `${G.swashOpen}w${G.swashClose} work`,
    `${G.swashOpen}e${G.swashClose} eat`,
    `${G.swashOpen}s${G.swashClose} sleep`,
    `${G.swashOpen}n${G.swashClose} next turn`,
    `${G.swashOpen}Tab${G.swashClose} mode`,
    `${G.swashOpen}Q${G.swashClose} quit`,
  ];

  return html`
    <${Box} flexDirection="column" marginTop=${1}>
      <${Box} flexDirection="row" justifyContent="space-between">
        ${hints.map((h, i) => html`<${Text} key=${'h' + i} color=${C.mute}>${h}</${Text}>`)}
      </${Box}>

      <${Box}
        flexDirection="row"
        borderStyle="round"
        borderColor=${active ? C.goldBright : C.midnightBright}
        paddingX=${1}
        marginTop=${0}
      >
        <${Text} color=${active ? C.goldBright : C.mute} bold>
          ${active ? `${G.crown} ${modeLabel} ${G.arrowR}` : `${G.bolt} shortcut mode ${G.arrowR}`}
        </${Text}>
        <${Box} flexGrow=${1} marginLeft=${1}>
          <${TextInput}
            value=${value}
            onChange=${handleChange}
            onSubmit=${submit}
            placeholder=${active ? 'type a command, or /help for guidance…' : 'press Esc to return to prompt mode'}
            focus=${textInputFocused}
          />
        </${Box}>
        ${hint && active ? html`<${Text} color=${C.mute}>  ${G.arrowR} /${hint}</${Text}>` : null}
      </${Box}>

      ${history.length > 0 && html`
        <${Box} flexDirection="row" marginTop=${0}>
          <${Text} color=${C.mute}>recent: ${history.slice(-3).map(h => `${G.swashOpen}${h}${G.swashClose}`).join('  ')}</${Text}>
        </${Box}>
      `}
    </${Box}>
  `;
}