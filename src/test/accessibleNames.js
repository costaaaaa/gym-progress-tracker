import { screen } from '@testing-library/react';

// Ruoli che devono avere un nome accessibile (WCAG 4.1.2). Lo scopo è sapere quali elementi della schermata
// ne sono privi: con { name: '' } Testing Library trova proprio quelli con nome vuoto.
const NAMED_ROLES = ['button', 'link', 'checkbox', 'radio', 'switch', 'combobox', 'listbox', 'textbox', 'slider', 'progressbar', 'dialog', 'menu', 'img', 'tab', 'tablist'];

// Elementi visibili alle tecnologie assistive e senza nome, come "ruolo: html" (l'elenco vuoto è il risultato atteso)
export const unnamedControls = (roles = NAMED_ROLES) => roles.flatMap((role) => (
  screen.queryAllByRole(role, { name: '' }).map((el) => `${role}: ${el.outerHTML.slice(0, 120)}`)
));

// Figli diretti di un elenco che non sono voci <li> semplici (un <div> o un <hr> tra le voci, o un ruolo
// esplicito, rompono la struttura letta dagli screen reader): l'elenco vuoto è il risultato atteso.
export const strayListChildren = (list) => [...list.children]
  .filter((child) => child.tagName !== 'LI' || child.hasAttribute('role'))
  .map((child) => child.outerHTML.slice(0, 80));

// Testo collegato a un elemento da aria-describedby (aiuto o errore sotto il campo), o undefined se non ce n'è
export const describedBy = (el) => el.getAttribute('aria-describedby')?.split(' ').map((id) => document.getElementById(id)?.textContent).join(' ');
