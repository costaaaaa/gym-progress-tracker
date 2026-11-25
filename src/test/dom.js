import { expect } from 'vitest';

// Helper comuni dei test di pagina: risposta della fetch finta, colore calcolato di un elemento e controllo che la pagina non apra un Container annidato.
export const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data, text: async () => '' });

// Layout avvolge già ogni pagina in un Container: una pagina che ne apre un secondo sposta il contenuto.
// Fuori da questo controllo di proposito: Admin, JoinGroup e le fasi del Focus tengono il loro.
export const expectNoNestedContainer = () => expect(document.querySelector('.MuiContainer-root')).toBeNull();

export const colorOf = (el) => getComputedStyle(el).color;

// Il titolo di pagina sta in un blocco alto almeno 44 px (come pulsanti e freccia) con il testo al centro: così il titolo
// ha la stessa altezza in ogni pagina, con o senza pulsante o freccia sulla sua riga.
export const expectPageTitleBlock = (heading) => {
  const stile = getComputedStyle(heading);
  expect(stile.minHeight).toBe('44px');
  expect(stile.display).toBe('flex');
  expect(stile.alignItems).toBe('center');
};

// Guardia delle pagine delle Schede: i testi sotto i 16 px, come «testo (misura)». L'unica eccezione è il loro badge
// «Attiva» (13 px o più): su una pagina con un altro «Attiva» questa guardia non va usata.
export const textsBelow16pxExceptActiveBadge = () => [...document.body.querySelectorAll('*')]
  .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== ''))
  .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16 && !(el.textContent === 'Attiva' && parseFloat(getComputedStyle(el).fontSize) >= 13))
  .map((el) => `${el.textContent} (${getComputedStyle(el).fontSize})`);
