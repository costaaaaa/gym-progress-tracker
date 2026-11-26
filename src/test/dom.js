import { expect } from 'vitest';
import { screen, within } from '@testing-library/react';

// Helper comuni dei test di pagina: risposta della fetch finta, colore calcolato di un elemento e controllo che la pagina non apra un Container annidato.
export const json = (data, status = 200) => ({ ok: status < 400, status, json: async () => data, text: async () => '' });

// Layout avvolge già ogni pagina in un Container: una pagina che ne apre un secondo sposta il contenuto.
// Fuori da questo controllo di proposito: Admin, JoinGroup e le fasi del Focus tengono il loro.
export const expectNoNestedContainer = () => expect(document.querySelector('.MuiContainer-root')).toBeNull();

export const colorOf = (el) => getComputedStyle(el).color;

// Una riga di titolo di pagina occupa 44 px (come pulsanti e freccia), con il testo al centro: interlinea più lo stesso
// spazio sopra e sotto. Così il titolo parte alla stessa altezza in ogni pagina, con o senza pulsante o freccia sulla riga.
const pageTitleBlockHeight = (heading) => {
  const stile = getComputedStyle(heading);
  return parseFloat(stile.fontSize) * parseFloat(stile.lineHeight) + parseFloat(stile.paddingTop) + parseFloat(stile.paddingBottom);
};

export const expectPageTitleBlock = (heading) => {
  const stile = getComputedStyle(heading);
  expect(stile.paddingTop).toBe(stile.paddingBottom);
  expect(pageTitleBlockHeight(heading)).toBeCloseTo(44, 5);
};

// Il pulsante sulla riga del titolo è alto quanto il blocco del titolo: più alto farebbe crescere la riga e il titolo,
// centrato, scenderebbe rispetto alle pagine senza pulsante.
export const expectTitleRowButton = (heading, button) => {
  expect(button.parentElement).toBe(heading.parentElement);
  expect(parseFloat(getComputedStyle(button).height)).toBeCloseTo(pageTitleBlockHeight(heading), 5);
};

// Guardia delle pagine delle Schede: i testi sotto i 16 px, come «testo (misura)». L'unica eccezione è il loro badge
// «Attiva» (13 px o più): su una pagina con un altro «Attiva» questa guardia non va usata.
export const textsBelow16pxExceptActiveBadge = () => [...document.body.querySelectorAll('*')]
  .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim() !== ''))
  .filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16 && !(el.textContent === 'Attiva' && parseFloat(getComputedStyle(el).fontSize) >= 13))
  .map((el) => `${el.textContent} (${getComputedStyle(el).fontSize})`);

// La finestra di conferma di un'eliminazione (o di un'uscita) è la stessa ovunque: «Elimina» (o il testo dato) rosso pieno senza
// icona, corpo a 16 px nel colore del testo principale. I colori (tema chiaro: text.primary e error) li dà il test che chiama:
// i sorgenti fuori dai test non scrivono colori a mano.
export const expectDestructiveConfirm = (corpo, conferma, { ink, red }) => {
  const dialog = within(screen.getByRole('dialog'));
  const bottone = dialog.getByRole('button', { name: conferma });
  expect(bottone.querySelector('svg')).toBeNull();
  expect(bottone.classList.contains('MuiButton-containedError')).toBe(true);
  expect(getComputedStyle(bottone).backgroundColor).toBe(red);
  const testo = dialog.getByText(corpo);
  expect(colorOf(testo)).toBe(ink);
  expect(getComputedStyle(testo).fontSize).toBe('16px');
};
