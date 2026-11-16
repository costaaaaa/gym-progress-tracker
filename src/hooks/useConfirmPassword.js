import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { confirmState } from '../utils/confirmPassword';

// Stato della riga sotto «Conferma password», uguale in registrazione, recupero e cambio password.
// `mismatchText` è il messaggio di errore del modulo. Il rosso (mismatch) compare solo dopo un'uscita dalla
// coppia di campi o un invio, mai mentre si scrive: ogni modifica a uno dei due campi rimette il suggerimento.
//   edit()   da chiamare nell'onChange di Password e di Conferma
//   leave    onBlur di ciò che contiene il campo (occhio compreso): spostare il focus dentro non è un'uscita
//   submit() da chiamare all'invio, prima dei controlli
//   reset()  riparte da zero (riapertura di un dialog)
export default function useConfirmPassword({ password, confirm, mismatchText }) {
  const { t } = useTranslation();
  const [checked, setChecked] = useState(false);
  const state = confirmState({ password, confirm, checked });
  const text = { hint: t('password.confirm_hint'), match: t('password.confirm_match'), mismatch: mismatchText }[state];
  return {
    state,
    text,
    // Annuncio per il lettore di schermo: solo in match o mismatch, mai per il suggerimento
    announce: state === 'hint' ? '' : text,
    edit: () => setChecked(false),
    leave: (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setChecked(true); },
    submit: () => setChecked(true),
    reset: () => setChecked(false),
  };
}
