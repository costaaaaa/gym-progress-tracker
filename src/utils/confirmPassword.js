// Stato della riga sotto «Conferma password» (registrazione, recupero e cambio password).
//   hint     conferma vuota, oppure diversa e l'utente non ha ancora lasciato il campo
//   match    conferma uguale alla password: subito, mentre si scrive
//   mismatch conferma diversa dopo l'uscita dal campo o l'invio (checked), mai mentre si scrive
export const confirmState = ({ password, confirm, checked }) => {
  if (!confirm) return 'hint';
  if (confirm === password) return 'match';
  return checked ? 'mismatch' : 'hint';
};
