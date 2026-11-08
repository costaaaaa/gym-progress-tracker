// ?next= porta solo a pagine di questo sito, anche quando il browser riscrive l'indirizzo.
import { describe, it, expect } from 'vitest';
import { safeNext, loginWithNext } from './safeNext';

const nextOf = (value) => safeNext(`?${new URLSearchParams({ next: value })}`);

describe('safeNext', () => {
  it.each([
    '/profilo?tab=settings#sezione',
    '/entra?codice=AB12&x=1',
    '/gruppi/3',
  ])('tiene il percorso interno %s', (value) => {
    expect(nextOf(value)).toBe(value);
  });

  it.each([
    ['assente', null],
    ['indirizzo esterno', 'https://example.com/'],
    ['javascript:', 'javascript:alert(1)'],
    ['relativo', 'profilo'],
    ['doppia barra', '//example.com/'],
    ['barra rovesciata', '/\\example.com/'],
    ['TAB dopo la barra', '/\t/example.com/'],
    ['a capo dopo la barra', '/\n/example.com/'],
    ['ritorno a capo e barra rovesciata', '/\r\\example.com/'],
    ['punto e TAB', '/./\t/example.com/'],
    ['punti, a capo e barra rovesciata', '/x/../\n\\example.com/'],
    ['punto e doppia barra', '/.//example.com/'],
    ['due punti e doppia barra', '/..//example.com/'],
  ])('rifiuta %s e torna alla home', (_name, value) => {
    expect(value === null ? safeNext('') : nextOf(value)).toBe('/');
  });
});

describe('loginWithNext', () => {
  it('codifica pagina, parametri e ancora in un next che safeNext rilegge', () => {
    const url = loginWithNext({ pathname: '/profilo', search: '?tab=settings&x=è', hash: '#sezione' });
    expect(url).toBe('/login?next=%2Fprofilo%3Ftab%3Dsettings%26x%3D%C3%A8%23sezione');
    // Il percorso torna come lo scrive il browser, con i caratteri non ASCII codificati
    expect(safeNext(url.slice('/login'.length))).toBe('/profilo?tab=settings&x=%C3%A8#sezione');
  });
});
