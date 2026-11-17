import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';

// Le pagine pubbliche hanno la lingua nell'URL: /… italiano, /en/… inglese.
export const isEnPath = (pathname) => pathname === '/en' || pathname.startsWith('/en/');

// Login e registrazione: dopo l'accesso portano al ?next=.
const AUTH_PATHS = ['/login', '/register'];

// Pagine pubbliche che hanno anche la versione /en/.
const PUBLIC_PATHS = ['/', ...AUTH_PATHS, '/forgot-password', '/reset-password'];
export const isPublicPath = (pathname) => PUBLIC_PATHS.includes(pathname);

export const stripLangPrefix = (pathname) => (isEnPath(pathname) ? pathname.slice(3) || '/' : pathname);

// Pagine di accesso: login, registrazione, password dimenticata e reimpostazione. Restano raggiungibili anche
// con l'app bloccata dalla conferma dell'email.
export const isAccessPath = (pathname) => {
  const bare = stripLangPrefix(pathname);
  return bare !== '/' && PUBLIC_PATHS.includes(bare);
};

// Login e registrazione, in tutte e due le lingue.
export const isAuthPath = (pathname) => AUTH_PATHS.includes(stripLangPrefix(pathname));

export const withLangPrefix = (pathname, lang) =>
  lang === 'en' ? `/en${pathname === '/' ? '/' : pathname}` : pathname;

// Informativa privacy e termini: pagine HTML statiche (public/), una per lingua.
export const legalPaths = (lang) =>
  lang === 'en'
    ? { privacy: '/en/privacy.html', terms: '/en/terms.html' }
    : { privacy: '/privacy.html', terms: '/termini.html' };

// Pagine PHP del blog (fuori dalla SPA): calcolatore 1RM e guida MCP nella lingua corrente.
export const blogPaths = (lang) =>
  lang === 'en'
    ? { calculator: '/en/blog/1rm-calculator/', mcp: '/en/blog/mcp/' }
    : { calculator: '/blog/calcolatore-1rm/', mcp: '/blog/mcp/' };

// Confronto dei piani Gratis / Plus / Pro: pagina pubblica fuori dalla SPA (link a pagina intera).
export const plansPath = (lang) => (lang === 'en' ? '/en/plans' : '/piani');

// Link tra pagine pubbliche: chi è su /en/ resta su /en/.
export function useLocalizedPath() {
  const { pathname } = useLocation();
  const onEn = isEnPath(pathname);
  return useCallback((to) => (onEn && to.startsWith('/') ? withLangPrefix(to, 'en') : to), [onEn]);
}
