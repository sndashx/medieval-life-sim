// HeirsOverlay — shown when the player dies. Lists eligible heirs and
// accepts a number to continue as that heir, or `/start` for a new life.

import { html, Box, Text } from './_jsx.js';
import { C, G, pad, trunc } from '../theme.js';
import { useEffect, useState } from 'react';
import TextInput from 'ink-text-input';

export function HeirsOverlay({ heirs, onChoose, onStartNew }) {
  const [value, setValue] = useState('');

  if (!heirs || heirs.length === 0) {
    return html`
      <${Box}
        flexDirection="column"
        borderStyle="double"
        borderColor=${C.crimson}
        paddingX=${2}
        paddingY=${1}
      >
        <${Text} color=${C.crimson} bold>${G.skull}  YOU HAVE FALLEN</${Text}>
        <${Text} color=${C.mute}>${'═'.repeat(60)}</${Text}>
        <${Text} color=${C.parchment}>  Your line is ended. There are no heirs.</${Text}>
        <${Text}>${''}</${Text}>
        <${Text} color=${C.goldBright}>  ${G.book} type ${G.swashOpen}/start${G.swashClose} to begin a new life</${Text}>
      </${Box}>
    `;
  }

  return html`
    <${Box}
      flexDirection="column"
      borderStyle="double"
      borderColor=${C.crimson}
      paddingX=${2}
      paddingY=${1}
    >
      <${Text} color=${C.crimson} bold>${G.skull}  YOU HAVE FALLEN</${Text}>
      <${Text} color=${C.mute}>${'═'.repeat(60)}</${Text}>
      <${Text} color=${C.parchment}>  Your story ends here. But the bloodline lives on.</${Text}>
      <${Text}>${''}</${Text}>
      <${Text} color=${C.gold} bold>  ${G.crown}  Eligible heirs:</${Text}>
      ${heirs.map((h, i) => html`
        <${Box} key=${'h' + h.id} flexDirection="row"}>
          <${Text} color=${C.goldBright}>    ${i + 1}. ${pad(h.name, 18)}</${Text}>
          <${Text} color=${C.parchment}> ${h.sex}  ${h.age.toFixed(0)}y  ${h.occupation}</${Text}>
        </${Box}>
      `)}
      <${Text}>${''}</${Text}>
      <${Text} color=${C.parchmentDim}>  type ${G.swashOpen}n${G.swashClose} + Enter to continue as heir n</${Text}>
      <${Text} color=${C.parchmentDim}>  or   ${G.swashOpen}/start${G.swashClose}     to begin a new life</${Text}>
      <${Text}>${''}</${Text}>
      <${Box} flexDirection="row"}>
        <${Text} color=${C.goldBright} bold>  ${G.crown} ${G.arrowR}</${Text}>
        <${Box} marginLeft=${1}>
          <${TextInput}
            value=${value}
            onChange=${setValue}
            onSubmit=${(v) => {
              const n = parseInt(v, 10);
              if (n >= 1 && n <= heirs.length) onChoose(n - 1);
              else if (v === '/start' || v === 'start' || v === 'new') onStartNew();
            }}
            placeholder="1, 2, …, or /start"
          />
        </${Box}>
      </${Box}>
    </${Box}>
  `;
}