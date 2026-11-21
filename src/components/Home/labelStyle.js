// Etichetta maiuscola piccola sopra un blocco («Oggi», «Settimana», «Ultimo allenamento»)
export const LABEL = { fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' };
// Aspetto disabilitato dei comandi che restano raggiungibili col fuoco (aria-disabled invece di disabled)
export const DISABLED = { '&[aria-disabled="true"]': { opacity: 0.38, cursor: 'default' } };
// Card a bordo tratteggiato (blocco nascosto in modifica, proposta di un modulo)
export const DASHED_CARD = { border: '1px dashed', borderColor: 'text.secondary', boxShadow: 'none' };
// Bottone di testo della Home (44 px di area, 14 px)
export const HOME_BUTTON = { minHeight: 44, minWidth: 44, fontSize: 14, fontWeight: 700 };
