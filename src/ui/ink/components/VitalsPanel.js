// VitalsPanel — left rail of the dashboard.
// Shows player identity, vitals (health/energy/temp), needs bars,
// household & family snapshot, and quick inventory peek.

import { html, Box, Text } from './_jsx.js';
import { C, G, renderBar, barColor, pad, trunc, fmt, visibleLen } from '../theme.js';

function Bar({ pct, width = 14, label, glyph, inverse = false, muted = false }) {
  const { filled, empty, color } = renderBar(pct, width, { inverse });
  const filledStr = '━'.repeat(filled);
  const emptyStr = '·'.repeat(empty);
  const labelStr = pad(label, 8);
  const pctTxt = `${(pct * 100).toFixed(0).padStart(3)}%`;
  return html`
    <${Box} flexDirection="row">
      <${Text} color=${muted ? C.mute : C.parchmentDim}>${glyph} ${labelStr}</${Text}>
      <${Text} color=${color}>${filledStr}</${Text}>
      <${Text} color=${C.mute}>${emptyStr}</${Text}>
      <${Text} color=${muted ? C.mute : color}> ${pctTxt}</${Text}>
    </${Box}>
  `;
}

function StatLine({ glyph, label, value, color }) {
  return html`
    <${Box} flexDirection="row">
      <${Text} color=${C.gold}>${glyph} ${pad(label, 9)}</${Text}>
      <${Text} color=${color || C.parchment} bold>${value}</${Text}>
    </${Box}>
  `;
}

function Section({ title, glyph = G.fleur, children, color = C.gold }) {
  return html`
    <${Box} flexDirection="column" marginTop=${1}>
      <${Box} flexDirection="row">
        <${Text} color=${color} bold>${glyph} ${title}</${Text}>
      </${Box}>
      <${Box} flexDirection="column" marginLeft=${1} marginTop=${0}>
        ${children}
      </${Box}>
      <${Text} color=${C.mute}>${'─'.repeat(22)}</${Text}>
    </${Box}>
  `;
}

export function VitalsPanel({ snap, width = 32 }) {
  const p = snap.player;
  const info = snap.info || {};

  if (!p) {
    return html`
      <${Box}
        flexDirection="column"
        borderStyle="round"
        borderColor=${C.midnightBright}
        paddingX=${1}
        width=${width}
        flexGrow=${0}
      >
        <${Text} color=${C.gold} bold>${G.fleur}  the illuminated codex</${Text}>
        <${Box} flexDirection="column" marginTop=${1}>
          <${Text} color=${C.parchmentDim}>${G.cross}  no life begun yet</${Text}>
          <${Text} color=${C.mute}>  press ${G.swashOpen}/start${G.swashClose} to begin</${Text}>
          <${Text} color=${C.mute}>  or ${G.swashOpen}?${G.swashClose} for guidance</${Text}>
        </${Box}>
      </${Box}>
    `;
  }

  const isPlayer = p.isPlayer;
  const ageStr = `${p.age.toFixed(1)}y ${p.sex}`;
  const occStr = p.occupation || 'peasant';
  const titleStr = p.title ? `, ${p.title}` : '';

  const needs = p.needs || {};
  const warmth = needs.warmth ?? 1;
  const shelter = needs.shelter ?? 1;
  const social = needs.social ?? 0.5;
  const safety = needs.safety ?? 1;

  const inv = p.inventory || [];
  const invCount = inv.length;
  const invPreview = inv.slice(0, 4).map((it, i) => {
    const name = it.name || it.type || 'item';
    const qty = it.qty > 1 ? `×${it.qty}` : '';
    return `${G.bullet} ${trunc(name, 16)}${qty ? ' ' + qty : ''}`;
  });

  const spouse = p.spouseName ? `${p.spouseName}` : '—';
  const father = p.father || '—';
  const mother = p.mother || '—';
  const kids = p.children || [];
  const hh = p.householdName || '—';

  return html`
    <${Box}
      flexDirection="column"
      borderStyle="round"
      borderColor=${C.midnightBright}
      paddingX=${1}
      width=${width}
      flexShrink=${0}
    >
      <${Text} color=${C.gold} bold>${G.fleur}  ${isPlayer ? G.crown : G.castle}  ${p.name}</${Text}>
      <${Text} color=${C.burgundyBright}>   ${ageStr} ${G.bullet} ${occStr}${titleStr}</${Text}>

      <${Text} color=${C.mute}>${'─'.repeat(22)}</${Text}>

      <${Text} color=${C.parchmentDim} bold>${G.bolt} VITALS</${Text}>
      <${Bar} pct=${p.health} width=${16} label="health" glyph=${G.heart} />
      <${Bar} pct=${p.energy} width=${16} label="energy" glyph=${G.bolt} />
      <${Bar} pct=${p.temp} width=${16} label="warmth" glyph=${G.fire} />

      <${Text} color=${C.mute}>${'─'.repeat(22)}</${Text}>

      <${Text} color=${C.parchmentDim} bold>${G.leaf} NEEDS</${Text}>
      <${Bar} pct=${needs.hunger} width=${16} label="hunger"  glyph=${G.flower} inverse=${true} />
      <${Bar} pct=${needs.thirst} width=${16} label="thirst"  glyph=${G.water}  inverse=${true} />
      <${Bar} pct=${needs.sleep}  width=${16} label="sleep"   glyph=${G.moon}   inverse=${true} />
      <${Bar} pct=${social}      width=${16} label="social"  glyph=${G.heart} />
      <${Bar} pct=${safety}      width=${16} label="safety"  glyph=${G.shield} />

      <${Text} color=${C.mute}>${'─'.repeat(22)}</${Text}>

      <${Text} color=${C.parchmentDim} bold>${G.castle} HOUSEHOLD</${Text}>
      <${Text} color=${C.parchment}>   ${G.castle} ${trunc(hh, 22)}</${Text}>
      <${Text} color=${C.parchment}>   ${G.crown2} ${trunc(spouse, 22)}</${Text}>
      ${p.householdFood != null && html`
        <${Text} color=${p.householdFood > 50 ? C.good : C.warn}>
          ${p.householdFood > 50 ? '●' : '◌'} stores ${fmt(p.householdFood)}
        </${Text}>
      `}

      <${Text} color=${C.mute}>${'─'.repeat(22)}</${Text}>

      <${Text} color=${C.parchmentDim} bold>${G.fleur} KIN</${Text}>
      <${Text} color=${C.parchmentDim}>  ${G.crown2} ${trunc(father, 18)} ${G.heartEmpty} ${trunc(mother, 18)}</${Text}>
      ${kids.length > 0 ? html`<>
        <${Text} color=${C.parchmentDim}>  ${G.flower} ${kids.length} child${kids.length === 1 ? '' : 'ren'}</${Text}>
        ${kids.slice(0, 3).map(k => html`
          <${Text} color=${C.parchment} key=${'k' + k.id}>     ${G.bullet} ${k.name} ${k.age}y</${Text}>
        `)}
      </>` : html`<>
        <${Text} color=${C.mute}>  ${G.flower} no children</${Text}>
      </>`}

      <${Text} color=${C.mute}>${'─'.repeat(22)}</${Text}>

      <${Text} color=${C.parchmentDim} bold>${G.bag} PACK (${invCount})</${Text}>
      ${invPreview.length === 0
        ? html`<${Text} color=${C.mute}>  ${G.bullet} — empty —</${Text}>`
        : invPreview.map((line, i) => html`<${Text} color=${C.parchment} key=${'i' + i}>  ${line}</${Text}>`)}
      ${invCount > 4 && html`<${Text} color=${C.mute}>  ${G.ellipsis} +${invCount - 4} more</${Text}>`}
    </${Box}>
  `;
}