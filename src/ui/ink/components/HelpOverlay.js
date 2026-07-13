// HelpOverlay — full-screen modal with the command reference.
// Toggled with `?` or `/help`.

import { html, Box, Text } from './_jsx.js';
import { C, G, pad, trunc } from '../theme.js';

const SECTIONS = [
  {
    title: `${G.fleur}  Life`,
    color: C.gold,
    items: [
      ['/start', 'Begin a new life (when unborn)'],
      ['/look', 'Examine your surroundings'],
      ['/status', 'Detailed vitals & state'],
      ['/family', 'View parents & children'],
      ['/heirs', 'List eligible heirs'],
      ['/continue <n>', 'Play as heir n'],
      ['/save, /load', 'Persist / resume a life'],
    ],
  },
  {
    title: `${G.bolt}  Body`,
    color: C.amber,
    items: [
      ['/eat, /drink', 'Satisfy hunger & thirst'],
      ['/sleep', 'Rest until dawn'],
      ['/work', 'Labour at your occupation'],
      ['/wait [mins]', 'Pass time'],
      ['/move n|s|e|w', 'Travel a step'],
    ],
  },
  {
    title: `${G.shield}  Society`,
    color: C.burgundyBright,
    items: [
      ['/talk', 'Speak with someone nearby'],
      ['/propose', 'Offer marriage'],
      ['/faction', 'List known factions'],
      ['/warfare', 'Active conflicts'],
      ['/titles, /dynasty', 'Lineage & rule'],
    ],
  },
  {
    title: `${G.spark}  Craft & Knowledge`,
    color: C.forestBright,
    items: [
      ['/craft', 'Craft an item'],
      ['/cook', 'Cook a meal'],
      ['/study', 'Practise a skill'],
      ['/hunt, /forage', 'Procure from the wild'],
      ['/pray', 'Offer devotion'],
    ],
  },
  {
    title: `${G.crown}  Realm`,
    color: C.goldBright,
    items: [
      ['[Tab]', 'Switch view mode'],
      ['[/]', 'Focus command input'],
      ['[Q]', 'Save & quit'],
      ['[?]', 'Toggle this help'],
      ['[/quit]', 'Abandon life and quit'],
    ],
  },
];

export function HelpOverlay({ onClose }) {
  // Two-column layout.
  const left = SECTIONS.slice(0, 3);
  const right = SECTIONS.slice(3);

  function renderSection(s) {
    return html`
      <${Box} key=${s.title} flexDirection="column" marginBottom=${1}>
        <${Text} color=${s.color} bold>${s.title}</${Text}>
        <${Box} flexDirection="column" marginLeft=${2}>
          ${s.items.map(([cmd, desc]) => html`
            <${Box} key=${cmd + desc} flexDirection="row">
              <${Text} color=${C.goldBright}>${pad(cmd, 18)}</${Text}>
              <${Text} color=${C.parchment}>${desc}</${Text}>
            </${Box}>
          `)}
        </${Box}>
      </${Box}>
    `;
  }

  return html`
    <${Box}
      flexDirection="column"
      borderStyle="double"
      borderColor=${C.gold}
      paddingX=${2}
      paddingY=${1}
    >
      <${Box} flexDirection="row" justifyContent="space-between"}>
        <${Text} color=${C.gold} bold>${G.fleur}  CODEX OF COMMANDS  ${G.fleur}</${Text}>
        <${Text} color=${C.mute}>press ? or Esc to close</${Text}>
      </${Box}>
      <${Text} color=${C.mute}>${'═'.repeat(78)}</${Text}>

      <${Box} flexDirection="row">
        <${Box} flexDirection="column" width=${38} marginRight=${2}>
          ${left.map(renderSection)}
        </${Box}>
        <${Box} flexDirection="column" width=${38}>
          ${right.map(renderSection)}
        </${Box}>
      </${Box}>

      <${Text} color=${C.mute}>${'═'.repeat(78)}</${Text}>
      <${Text} color=${C.parchmentDim}>
        ${G.spark}  every command has both a slash form ${G.swashOpen}/work${G.swashClose}
        and a single-key shortcut ${G.swashOpen}w${G.swashClose}.
        Slash forms accept arguments ${G.swashOpen}/move n${G.swashClose}.
      </${Text}>
    </${Box}>
  `;
}