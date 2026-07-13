// FeedPanel — the right rail. Shows the live event stream (last 20 messages)
// and key context: weather, season, current mode.
//
// Acts as a sidebar companion to the Viewport, and as the activity log.

import { html, Box, Text } from './_jsx.js';
import { C, G, trunc, seasonGlyph, weatherGlyph } from '../theme.js';

export function FeedPanel({ snap, mode, terminalHeight = 24 }) {
  const lines = (snap.log || []).slice(-18);
  const info = snap.info || {};

  // Reserve space: header (2) + footer (3) + ~18 lines for log.
  const visibleLog = lines.slice(-Math.max(6, terminalHeight - 8));

  return html`
    <${Box}
      flexDirection="column"
      borderStyle="round"
      borderColor=${C.midnightBright}
      paddingX=${1}
      width=${36}
      flexShrink=${0}
    >
      <${Text} color=${C.gold} bold>${G.quill}  CHRONICLE</${Text}>
      <${Text} color=${C.mute}>${'─'.repeat(30)}</${Text}>

      <${Box} flexDirection="column" flexGrow=${1}>
        ${visibleLog.length === 0
          ? html`<${Text} color=${C.mute}>  ${G.bullet} nothing has happened... yet</${Text}>`
          : visibleLog.map((l, i) => {
              const color =
                l.type === 'error' ? C.bad :
                l.type === 'warn' ? C.warn :
                l.type === 'success' ? C.good :
                l.type === 'system' ? C.burgundyBright :
                C.parchment;
              const glyph =
                l.type === 'error' ? G.skull :
                l.type === 'warn' ? '!' :
                l.type === 'success' ? G.check :
                l.type === 'system' ? G.fleur :
                G.bullet;
              return html`
                <${Box} key=${'fl' + i} flexDirection="row">
                  <${Text} color=${color}>${glyph} </${Text}>
                  <${Text} color=${color}>${trunc(l.msg, 30)}</${Text}>
                </${Box}>
              `;
            })}
      </${Box}>

      <${Text} color=${C.mute}>${'─'.repeat(30)}</${Text}>

      <${Text} color=${C.parchmentDim} bold>${G.eye}  AT THIS HOUR</${Text}>
      <${Text} color=${C.parchment}>   ${seasonGlyph(info.season)} ${info.season || '—'}</${Text}>
      <${Text} color=${C.parchment}>   ${weatherGlyph('clear')} ${info.timeOfDay || '—'}</${Text}>
      <${Text} color=${C.mute}>   turn ${info.turn ?? 0}</${Text}>
    </${Box}>
  `;
}