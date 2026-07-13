// NamePrompt — overlay shown when the user starts a new life.
// Asks for a name and sex. Uses ink-text-input.

import { html, Box, Text, useState, useCallback } from './_jsx.js';
import { C, G } from '../theme.js';
import TextInput from 'ink-text-input';

export function NamePrompt({ onComplete }) {
  const [step, setStep] = useState('name');
  const [name, setName] = useState('');
  const [sex, setSex] = useState(null);

  const submitName = useCallback((value) => {
    const v = (value || '').trim();
    if (!v) return;
    setName(v);
    setStep('sex');
  }, []);

  const submitSex = useCallback((value) => {
    const v = (value || '').trim().toLowerCase();
    let chosen = sex;
    if (v === 'm' || v === 'male' || v === '1') chosen = 'male';
    else if (v === 'f' || v === 'female' || v === '2') chosen = 'female';
    if (!chosen) return;
    onComplete({ name, sex: chosen });
  }, [name, sex, onComplete]);

  return html`
    <${Box}
      flexDirection="column"
      borderStyle="double"
      borderColor=${C.gold}
      paddingX=${2}
      paddingY=${1}
    >
      <${Text} color=${C.gold} bold>${G.fleur}  BIRTH</${Text}>
      <${Text} color=${C.mute}>${'─'.repeat(60)}</${Text}>

      ${step === 'name' && html`<>
        <${Text} color=${C.parchment}>  ${G.crown}  What name shall the village elders give you?</${Text}>
        <${Text}>${''}</${Text}>
        <${Box} flexDirection="row"}>
          <${Text} color=${C.goldBright} bold>  ${G.swashOpen}name${G.swashClose} ${G.arrowR}</${Text}>
          <${Box} marginLeft=${1}>
            <${TextInput}
              value=${name}
              onChange=${setName}
              onSubmit=${submitName}
              placeholder="Aldric, Miriam, …"
            />
          </${Box}>
        </${Box}>
        <${Text} color=${C.mute}>  (press Enter to confirm)</${Text}>
      </>`}

      ${step === 'sex' && html`<>
        <${Text} color=${C.parchment}>  ${G.fleur}  ${name} — a fine name. And your sex?</${Text}>
        <${Text}>${''}</${Text}>
        <${Text} color=${C.goldBright}>  ${G.crown2} ${G.swashOpen}m${G.swashClose}  male   ${G.heart} ${G.swashOpen}f${G.swashClose}  female</${Text}>
        <${Text}>${''}</${Text}>
        <${Box} flexDirection="row"}>
          <${Text} color=${C.goldBright} bold>  ${G.swashOpen}sex${G.swashClose} ${G.arrowR}</${Text}>
          <${Box} marginLeft=${1}>
            <${TextInput}
              value=${sex || ''}
              onChange=${(v) => setSex(v)}
              onSubmit=${submitSex}
              placeholder="m or f"
            />
          </${Box}>
        </${Box}>
      </>`}
    </${Box}>
  `;
}