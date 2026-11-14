// Soglie dei telefoni stretti (320 px compreso). Il .95 fa valere la regola anche con zoom frazionari.
// Sotto 390 px i controlli si stringono; sotto 360 px la scritta del marchio resta solo per gli screen reader.
export const BELOW_390 = '@media (max-width:389.95px)';
export const BELOW_360 = '@media (max-width:359.95px)';
// Tra 390 e 398 px la barra in alto (marchio e bottoni di accesso) non sta in una riga senza togliere 6px al margine.
export const NARROW_FIT = '@media (min-width:390px) and (max-width:397.95px)';
