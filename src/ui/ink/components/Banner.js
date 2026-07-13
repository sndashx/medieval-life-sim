// Banner ─ the masthead. Renders the figlet castle crest on the left,
// the figlet title centered, and a live time/season clock on the right.

import { html, Box, Text, useState, useEffect } from './_jsx.js';
import { C, G, BANNER_LINES, BANNER_COMPACT, seasonGlyph } from '../theme.js';

const FLEUR_LEFT = `${G.fleur}  ${G.fleur}`;
const FLEUR_RIGHT = `${G.fleur}  ${G.fleur}`;

export function Banner({ info, terminalWidth = 100 }) {
  const season = info?.season || 'Spring';
  const timeOfDay = info?.timeOfDay || '';
  const turn = info?.turn ?? 0;
  const population = info?.population ?? 0;
  const settlements = info?.settlements ?? 0;
  const seasonG = seasonGlyph(season);

  const narrow = terminalWidth < 90;
  const bannerLines = narrow ? BANNER_COMPACT : BANNER_LINES;

  // Animated "candle flicker" on the fleur ornaments — pure visual delight.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const i = setInterval(() => setTick(t => t + 1), 1100);
    return () => clearInterval(i);
  }, []);
  const flicker = ['✦', '✶', '✧', '✦', '✧', '✶'][tick % 6];

  const stats = `${seasonG} ${season} ${G.bullet} ${timeOfDay} ${G.bullet} Turn ${turn}`;
  const realm = `${G.castle} ${settlements} settlements  ${G.shield} pop. ${population.toLocaleString()}`;

  return html`
    <${Box}
      flexDirection="column"
      borderStyle="double"
      borderColor=${C.gold}
      paddingX=${1}
      paddingY=${0}
    >
      <${Box} flexDirection="row" justifyContent="space-between">
        <${Text} color=${C.goldBright} bold>${FLEUR_LEFT} ${flicker} ${G.fleur}</${Text}>
        <${Text} color=${C.gold}>the illuminated codex</${Text}>
        <${Text} color=${C.goldBright} bold>${G.fleur} ${flicker} ${FLEUR_RIGHT}</${Text}>
      </${Box}>

      <${Box} flexDirection="column" alignItems="center">
        ${bannerLines.map((line, i) => html`
          <${Text} key=${'b' + i} color=${i === 2 ? C.goldBright : C.gold} bold>${line}</${Text}>
        `)}
      </${Box}>

      <${Box} flexDirection="row" justifyContent="space-between">
        <${Text} color=${C.burgundyBright}>${realm}</${Text}>
        <${Text} color=${C.burgundyBright}>${stats}</${Text}>
      </${Box}>
    </${Box}>
  `;
}