import { expect } from 'vitest';

// Helper comuni dei test di pagina: risposta della fetch finta, colore calcolato di un elemento e controllo che la pagina non apra un Container annidato.
export const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data, text: async () => '' });

// Layout avvolge già ogni pagina in un Container: una pagina che ne apre un secondo sposta il contenuto.
// Fuori da questo controllo di proposito: Admin, JoinGroup e le fasi del Focus tengono il loro.
export const expectNoNestedContainer = () => expect(document.querySelector('.MuiContainer-root')).toBeNull();

export const colorOf = (el) => getComputedStyle(el).color;

// Testi sotto i 16 px nella pagina, come «testo (misura)»; l'unica eccezione è la pillola «Attiva» a 13 px o più.
export const textsBelow16px = () => [...document.body.querySelectorAll('*')]
  .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== ''))
  .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16 && !(el.textContent === 'Attiva' && parseFloat(getComputedStyle(el).fontSize) >= 13))
  .map((el) => `${el.textContent} (${getComputedStyle(el).fontSize})`);
