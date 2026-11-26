// Misure del titolo di pagina (variante pageTitle del tema). Un titolo su una riga occupa PAGE_TITLE_BLOCK_HEIGHT, l'area
// toccabile minima di un pulsante o di una freccia: così parte alla stessa altezza in ogni pagina, con o senza pulsante o
// freccia sulla riga. Un titolo che va a capo cresce di un'interlinea per riga.
export const PAGE_TITLE_BLOCK_HEIGHT = 44;
export const PAGE_TITLE_FONT_SIZE = 28;
export const PAGE_TITLE_LINE_HEIGHT = 1.167;

// Spazio sopra e sotto una riga di titolo per arrivare all'altezza del blocco
export const PAGE_TITLE_PADDING_Y = (PAGE_TITLE_BLOCK_HEIGHT - PAGE_TITLE_FONT_SIZE * PAGE_TITLE_LINE_HEIGHT) / 2;
