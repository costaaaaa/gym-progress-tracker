// Soglie dei telefoni. Il .95 fa valere la regola anche con zoom frazionari.
// Sotto 600 px (telefoni) i controlli di accesso sono compatti; sotto 390 px nomi lunghi vanno a capo invece dei
// puntini; sotto 360 px la scritta del marchio resta solo per gli screen reader.
export const BELOW_600 = '@media (max-width:599.95px)';
export const BELOW_390 = '@media (max-width:389.95px)';
export const BELOW_360 = '@media (max-width:359.95px)';

// Testo su una riga con i puntini da 390 px in su; sotto, a capo (reflow a 320 px, spaziatura del testo)
export const ELLIPSIS_FROM_390 = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  [BELOW_390]: { overflow: 'visible', textOverflow: 'clip', whiteSpace: 'normal', overflowWrap: 'anywhere' },
};
