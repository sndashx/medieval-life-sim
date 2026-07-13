// StatusBar — top status strip under the banner.
// Shows mode tabs and aggregate world snapshot.

import { html, Box, Text } from './_jsx.js';
import { C, G } from '../theme.js';

export function StatusBar({ mode, setMode, snap }) {
  const tabs = [
    { id: 'realm',      label: `${G.realm} Realm` },
    { id: 'map',        label: `${G.map} Map` },
    { id: 'character',  label: `${G.char} Character` },
    { id: 'chronicle',  label: `${G.chronicle} Chronicle` },
  ];
  const info = snap.info || {};

  return html`
    <${Box}
      flexDirection="row"
      borderStyle="single"
      borderColor=${C.goldDeep}
      paddingX=${1}
      justifyContent="space-between"
    >
      <${Box} flexDirection="row">
        ${tabs.map(t => {
          const active = t.id === mode;
          return html`<${Box} key=${t.id} marginRight=${1}>
              <${Text}
                color=${active ? C.goldBright : C.mute}
                bold=${active}
                underline=${active}
              >${t.label}</${Text}>
              ${active ? html`<${Text} color=${C.goldBright}> ${G.arrowD}</${Text}>` : null}
            </${Box}>`;
        })}
      </${Box}>

      <${Box} flexDirection="row">
        <${Text} color=${C.mute}>${G.castle} ${info.settlements ?? 0} settlements</${Text}>
        <${Text} color=${C.mute}>  ${G.shield} pop ${(info.population ?? 0).toLocaleString()}</${Text}>
        <${Text} color=${C.mute}>  ${G.bolt} turn ${info.turn ?? 0}</${Text}>
      </${Box}>
    </${Box}>
  `;
}