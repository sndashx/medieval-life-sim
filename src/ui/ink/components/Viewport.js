// Viewport — the central panel. Renders one of four "modes":
//
//   realm      — overview of settlements, factions, government, weather
//   map        — tile map of the world with player position
//   character  — full character sheet, skills, traits, relationships
//   chronicle  — paginated history of events (drawn from store log)
//
// Each mode is a separate subcomponent below.

import { html, Box, Text, useEffect, useState, useMemo } from './_jsx.js';
import { C, G, trunc, pad, fmt, seasonGlyph, weatherGlyph } from '../theme.js';

// ── Realm ──────────────────────────────────────────────────────────────────
function RealmView({ snap, game, width = 60 }) {
  const settlements = game.world?.settlements || [];
  const factions = Array.from(game.factions?.factions?.values?.() || []);
  const conflicts = Array.from(game.factions?.conflicts?.values?.() || []);
  const governments = Array.from(game.politics?.governments?.values?.() || []);
  const info = snap.info || {};

  // Compute column widths from overall width.
  const colW = Math.max(20, Math.floor((width - 2) / 2));

  return html`
    <${Box} flexDirection="column">
      <${Text} color=${C.gold} bold>${G.fleur}  THE REALM</${Text}>
      <${Text} color=${C.mute}>${'─'.repeat(Math.min(width - 2, 80))}</${Text}>

      <${Box} flexDirection="row" marginTop=${0}>
        <${Box} flexDirection="column" width=${colW}>
          <${Text} color=${C.parchmentDim} bold>${G.castle}  SETTLEMENTS</${Text}>
          ${settlements.slice(0, 4).map((s, i) => html`
            <${Box} key=${'s' + i} flexDirection="column" marginLeft=${1}>
              <${Text} color=${C.goldBright} bold>${G.castle} ${s.name || '—'}</${Text}>
              <${Text} color=${C.parchment}>   ${s.type || 'hamlet'} · pop ${s.population ?? '?'}</${Text}>
            </${Box}>
          `)}
          ${settlements.length > 4 && html`
            <${Text} color=${C.mute}>  ${G.ellipsis} +${settlements.length - 4} more</${Text}>
          `}
        </${Box}>

        <${Box} flexDirection="column" width=${colW}>
          <${Text} color=${C.parchmentDim} bold>${G.shield}  FACTIONS</${Text}>
          ${factions.length === 0
            ? html`<${Text} color=${C.mute}>  ${G.bullet} none yet</${Text}>`
            : factions.slice(0, 4).map((f, i) => html`
                <${Box} key=${'f' + i} flexDirection="column" marginLeft=${1}>
                  <${Text} color=${C.goldBright} bold>${G.fleur} ${f.name}</${Text}>
                  <${Text} color=${C.parchment}>   ${f.purpose || '—'} · ${(f.members || []).length} members</${Text}>
                </${Box}>
              `)}
        </${Box}>
      </${Box}>

      <${Text} color=${C.mute}>${'─'.repeat(Math.min(width - 2, 80))}</${Text}>

      <${Box} flexDirection="row" marginTop=${0}>
        <${Box} flexDirection="column" width=${colW}>
          <${Text} color=${C.parchmentDim} bold>${G.crown}  GOVERNMENTS</${Text}>
          ${governments.length === 0
            ? html`<${Text} color=${C.mute}>  ${G.bullet} no realm</${Text}>`
            : governments.slice(0, 3).map((g, i) => {
                const ruler = g.ruler != null ? game.kernel.entities.get(g.ruler)?.name || '—' : 'vacant';
                return html`
                  <${Box} key=${'g' + i} flexDirection="column" marginLeft=${1}>
                    <${Text} color=${C.goldBright} bold>${G.crown} ${g.type || 'realm'}</${Text}>
                    <${Text} color=${C.parchment}>   ${trunc(ruler, colW - 8)}</${Text}>
                    <${Text} color=${C.parchment}>   t ${fmt(g.treasury || 0)} · leg ${((g.legitimacy || 0) * 100).toFixed(0)}%</${Text}>
                  </${Box}>
                `;
              })}
        </${Box}>

        <${Box} flexDirection="column" width=${colW}>
          <${Text} color=${C.parchmentDim} bold>${G.sword}  CONFLICTS</${Text}>
          ${conflicts.length === 0
            ? html`<${Text} color=${C.good}>  ${G.fleur} the realm is at peace</${Text}>`
            : conflicts.slice(0, 4).map((c, i) => {
                const a = game.factions.factions.get(c.factions?.[0])?.name || '—';
                const b = game.factions.factions.get(c.factions?.[1])?.name || '—';
                return html`
                  <${Box} key=${'c' + i} flexDirection="row" marginLeft=${1}>
                    <${Text} color=${C.crimson}>${G.sword}</${Text}>
                    <${Text} color=${C.parchment}> ${trunc(a, 8)} ${G.sword} ${trunc(b, 8)}</${Text}>
                  </${Box}>
                `;
              })}
        </${Box}>
      </${Box}>

      <${Text} color=${C.mute}>${'─'.repeat(Math.min(width - 2, 80))}</${Text}>
      <${Box} flexDirection="row" justifyContent="space-between">
        <${Text} color=${C.parchmentDim}>${seasonGlyph(info.season)} ${info.season}  ${G.bullet}  ${weatherGlyph('clear')} ${info.timeOfDay}</${Text}>
        <${Text} color=${C.mute}>turn ${info.turn ?? 0}</${Text}>
      </${Box}>
    </${Box}>
  `;
}

// ── Map ────────────────────────────────────────────────────────────────────
const BIOME_GLYPHS = {
  forest: '♣',
  plains: '∴',
  hills: '∩',
  mountains: '▲',
  desert: '∴',
  swamp: '≈',
  coast: '~',
  ocean: '~',
  lake: '~',
  river: '≈',
  tundra: '·',
  unknown: '·',
};

function MapView({ snap, game }) {
  const world = game.world;
  const settlements = world?.settlements || [];
  const resources = world?.resources || [];
  const p = game.player;
  const pos = p?.position || { x: 0, y: 0 };

  // Try to find actual map tiles; fall back to procedural scatter from settlements.
  let tiles = world?.tiles || world?.map?.tiles;
  let W = world?.width || 100;
  let H = world?.height || 100;

  // Render: pick a viewport around the player (or center).
  const VIEW_W = 50;
  const VIEW_H = 16;
  let cx = pos.x || Math.floor(W / 2);
  let cy = pos.y || Math.floor(H / 2);

  const grid = [];
  for (let row = -Math.floor(VIEW_H / 2); row < Math.floor(VIEW_H / 2); row++) {
    const line = [];
    for (let col = -Math.floor(VIEW_W / 2); col < Math.floor(VIEW_W / 2); col++) {
      const x = cx + col;
      const y = cy + row;
      let glyph = ' ';
      let color = C.mute;
      if (tiles && tiles[y]?.[x]) {
        const t = tiles[y][x];
        glyph = BIOME_GLYPHS[t.biome] || BIOME_GLYPHS.unknown;
        color = BIOME_COLOR[t.biome] || C.parchmentDim;
      } else if (x >= 0 && x < W && y >= 0 && y < H) {
        glyph = '·';
        color = C.mute;
      }
      line.push({ x, y, glyph, color });
    }
    grid.push(line);
  }

  // Overlay settlements.
  for (const s of settlements) {
    const dx = (s.x ?? s.location?.x ?? 0) - (cx - Math.floor(VIEW_W / 2));
    const dy = (s.y ?? s.location?.y ?? 0) - (cy - Math.floor(VIEW_H / 2));
    if (dy >= 0 && dy < VIEW_H && dx >= 0 && dx < VIEW_W) {
      grid[dy][dx] = { x: s.x, y: s.y, glyph: G.castle, color: C.goldBright };
    }
  }

  // Overlay player.
  const px = Math.floor(VIEW_W / 2);
  const py = Math.floor(VIEW_H / 2);
  if (grid[py]) grid[py][px] = { glyph: G.crown, color: C.crimson };

  return html`
    <${Box} flexDirection="column">
      <${Text} color=${C.gold} bold>${G.spark}  THE WORLD</${Text}>
      <${Text} color=${C.mute}>${'─'.repeat(VIEW_W)}</${Text}>
      ${grid.map((line, y) => html`
        <${Box} key=${'r' + y}>
          ${line.map((cell, x) => html`
            <${Text} key=${'c' + x + '_' + y} color=${cell.color}>${cell.glyph}</${Text}>
          `)}
        </${Box}>
      `)}
      <${Text} color=${C.mute}>${'─'.repeat(VIEW_W)}</${Text}>

      <${Box} flexDirection="row" marginTop=${1} justifyContent="space-between">
        <${Box} flexDirection="row">
          <${Text} color=${C.crimson}>${G.crown}</${Text}><${Text} color=${C.parchment}> you  </${Text}>
          <${Text} color=${C.goldBright}>${G.castle}</${Text}><${Text} color=${C.parchment}> settlement  </${Text}>
          <${Text} color=${C.forestBright}>♣</${Text}><${Text} color=${C.parchment}> forest  </${Text}>
          <${Text} color=${C.midnightBright}>≈</${Text}><${Text} color=${C.parchment}> water  </${Text}>
        </${Box}>
        <${Text} color=${C.mute}>${pos.x ?? '?'}, ${pos.y ?? '?'}</${Text}>
      </${Box}>
    </${Box}>
  `;
}

const BIOME_COLOR = {
  forest: C.forestBright,
  plains: C.forest,
  hills: C.amber,
  mountains: C.inkSoft,
  desert: C.gold,
  swamp: C.moss,
  coast: C.midnightBright,
  ocean: C.midnightBright,
  lake: C.midnightBright,
  river: C.midnightBright,
  tundra: C.parchmentDim,
  unknown: C.mute,
};

// ── Character sheet ────────────────────────────────────────────────────────
function CharacterView({ snap, width = 60 }) {
  const p = snap.player;
  if (!p) return html`<${Text} color=${C.mute}>no life yet</${Text}>`;
  const skills = p.skills || {};
  const traits = p.traits || {};

  // Collect top skills across categories.
  const flatSkills = [];
  for (const cat of Object.keys(skills)) {
    const v = skills[cat];
    if (!v || typeof v !== 'object') continue;
    for (const sk of Object.keys(v)) {
      const val = v[sk];
      if (typeof val === 'number') flatSkills.push({ cat, sk, val });
    }
  }
  flatSkills.sort((a, b) => b.val - a.val);
  const top = flatSkills.slice(0, 12);

  const traitLines = [];
  for (const k of ['agreeableness','conscientiousness','extraversion','neuroticism','openness','honesty','generosity']) {
    if (traits[k] != null) traitLines.push([k, traits[k]]);
  }

  const spouse = p.spouseName ? `${p.spouseName}` : '—';
  const rep = p.reputation || null;
  const colW = Math.max(20, Math.floor((width - 2) / 2));
  const rule = '─'.repeat(Math.min(width - 2, 80));

  return html`
    <${Box} flexDirection="column">
      <${Text} color=${C.gold} bold>${G.crown}  ${p.name}</${Text}>
      <${Text} color=${C.burgundyBright}>${p.age.toFixed(1)} years · ${p.sex} · ${p.occupation}${p.title ? ', ' + p.title : ''}</${Text}>
      <${Text} color=${C.mute}>${rule}</${Text}>

      <${Box} flexDirection="row" marginTop=${0}>
        <${Box} flexDirection="column" width=${colW}>
          <${Text} color=${C.parchmentDim} bold>${G.heart}  FAMILY</${Text}>
          <${Text} color=${C.parchment}>   ${G.crown2} father: ${p.father || '—'}</${Text}>
          <${Text} color=${C.parchment}>   ${G.crown2} mother: ${p.mother || '—'}</${Text}>
          <${Text} color=${C.parchment}>   ${G.heartEmpty} spouse: ${spouse}</${Text}>
          <${Text} color=${C.parchment}>   ${G.flower} children: ${(p.children || []).length}</${Text}>
        </${Box}>

        <${Box} flexDirection="column" width=${colW}>
          <${Text} color=${C.parchmentDim} bold>${G.fleur}  TRAITS</${Text}>
          ${traitLines.length === 0
            ? html`<${Text} color=${C.mute}>  ${G.bullet} —</${Text}>`
            : traitLines.map(([n, v]) => html`
                <${Box} key=${'t' + n} flexDirection="row">
                  <${Text} color=${C.parchment}>   ${pad(n, 18)} </${Text}>
                  <${Text} color=${v > 0.2 ? C.good : v < -0.2 ? C.warn : C.mute}>
                    ${v >= 0 ? '+' : ''}${(v).toFixed(2)}
                  </${Text}>
                </${Box}>
              `)}
        </${Box}>
      </${Box}>

      <${Text} color=${C.mute}>${rule}</${Text}>

      <${Text} color=${C.parchmentDim} bold>${G.bolt}  SKILLS (top)</${Text}>
      ${top.length === 0
        ? html`<${Text} color=${C.mute}>  ${G.bullet} untrained</${Text}>`
        : top.map((s, i) => html`
            <${Box} key=${'sk' + i} flexDirection="row">
              <${Text} color=${C.gold}>   ${pad(s.cat + '·' + s.sk, 30)}</${Text}>
              <${Text} color=${C.parchment}> ${(s.val * 100).toFixed(0).padStart(3)}/100</${Text}>
            </${Box}>
          `)}

      ${rep && html`
        <${Text} color=${C.mute}>${rule}</${Text}>
        <${Text} color=${C.parchmentDim} bold>${G.crown}  REPUTATION</${Text}>
        <${Text} color=${C.parchment}>   ${G.fleur} honor ${rep.honor.toFixed(2)}  ${G.bolt} fame ${rep.fame.toFixed(2)}  ${G.skull} infamy ${rep.infamy.toFixed(2)}</${Text}>
      `}
    </${Box}>
  `;
}
// ── Chronicle ──────────────────────────────────────────────────────────────
function ChronicleView({ snap }) {
  const lines = (snap.log || []).slice(-30).reverse();
  return html`
    <${Box} flexDirection="column">
      <${Text} color=${C.gold} bold>${G.quill}  CHRONICLE</${Text}>
      <${Text} color=${C.mute}>${'─'.repeat(64)}</${Text}>
      ${lines.length === 0
        ? html`<${Text} color=${C.mute}>  the chronicle is yet empty</${Text}>`
        : lines.map((l, i) => {
            const color =
              l.type === 'error' ? C.bad :
              l.type === 'warn' ? C.warn :
              l.type === 'success' ? C.good :
              l.type === 'system' ? C.burgundyBright :
              l.type === 'info' ? C.parchment :
              C.parchmentDim;
            const glyph =
              l.type === 'error' ? G.skull :
              l.type === 'warn' ? '!' :
              l.type === 'success' ? G.check :
              l.type === 'system' ? G.fleur :
              G.bullet;
            return html`
              <${Box} key=${'l' + i} flexDirection="row">
                <${Text} color=${color}>${glyph} </${Text}>
                <${Text} color=${color}>${trunc(l.msg, 60)}</${Text}>
              </${Box}>
            `;
          })}
    </${Box}>
  `;
}

// ── Root Viewport ──────────────────────────────────────────────────────────
export function Viewport({ mode, snap, game, width }) {
  return html`
    <${Box}
      flexDirection="column"
      borderStyle="round"
      borderColor=${C.goldDeep}
      paddingX=${1}
      flexShrink=${1}
      width=${width}
      overflow="hidden"
    >
      ${mode === 'realm' ? html`<${RealmView} snap=${snap} game=${game} width=${width || 60} />` : null}
      ${mode === 'map' ? html`<${MapView} snap=${snap} game=${game} />` : null}
      ${mode === 'character' ? html`<${CharacterView} snap=${snap} game=${game} width=${width || 60} />` : null}
      ${mode === 'chronicle' ? html`<${ChronicleView} snap=${snap} game=${game} width=${width || 60} />` : null}
    </${Box}>
  `;
}