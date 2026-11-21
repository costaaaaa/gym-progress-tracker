import { createContext } from 'react';

// In «Modifica Home» ogni blocco riceve da HomeBlocks i suoi comandi (un nodo): il guscio non è più un link e li disegna
// in fondo. Fuori dalla modifica vale null.
export const BlockEditContext = createContext(null);
