// Font dell'app in un punto solo. Lexend per titoli e numeri grandi, Inter per il resto.
// I ruoli tipografici (h1–h6 e `cardTitle`) stanno nel tema (ThemeModeContext.jsx): per un titolo di card
// usare <Typography variant="cardTitle"> (o sx={{ typography: 'cardTitle' }}), per gli altri usi di Lexend
// serve fontFamily: TITLE_FONT_FAMILY. Scrivere "Lexend" a mano è vietato da ESLint.
export const TITLE_FONT_FAMILY = '"Lexend", sans-serif';

// Font dei chip che si premono (scelte, filtri, suggerimenti, azioni rapide), uguale all'app: Lexend 500.
// Anche «Personalizzata» nella riga dei preset del cartoncino, che non si preme ma sta fra quelli che si premono,
// e l'obiettivo settimanale in Account (nell'app è una riga di chip). I badge restano Inter.
export const CHIP_FONT = { fontFamily: TITLE_FONT_FAMILY, fontWeight: 500 };

// Cifre che cambiano (timer, cronometro, durata, valori): Inter con cifre tabulari, così non ballano.
export const TABULAR = { fontFamily: '"Inter", sans-serif', fontVariantNumeric: 'tabular-nums', fontFeatureSettings: '"tnum"' };
