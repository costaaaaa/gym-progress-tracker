import { expect } from 'vitest';

// Helper comuni dei test di pagina: risposta della fetch finta, colore calcolato di un elemento e controllo che la pagina non apra un Container annidato.
export const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data, text: async () => '' });

// Layout avvolge già ogni pagina in un Container: una pagina che ne apre un secondo sposta il contenuto.
// Fuori da questo controllo di proposito: Admin, JoinGroup e le fasi del Focus tengono il loro.
export const expectNoNestedContainer = () => expect(document.querySelector('.MuiContainer-root')).toBeNull();

export const colorOf = (el) => getComputedStyle(el).color;
