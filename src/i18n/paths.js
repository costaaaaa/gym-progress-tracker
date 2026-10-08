import { useCallback } from 'react';
import { useLocation } from 'react-router-dom';

// Le pagine pubbliche hanno la lingua nell'URL: /… italiano, /en/… inglese.
export const isEnPath = (pathname) => pathname === '/en' || pathname.startsWith('/en/');

export const stripLangPrefix = (pathname) => (isEnPath(pathname) ? pathname.slice(3) || '/' : pathname);

export const withLangPrefix = (pathname, lang) =>
  lang === 'en' ? `/en${pathname === '/' ? '/' : pathname}` : pathname;

// Link tra pagine pubbliche: chi è su /en/ resta su /en/.
export function useLocalizedPath() {
  const { pathname } = useLocation();
  const onEn = isEnPath(pathname);
  return useCallback((to) => (onEn && to.startsWith('/') ? withLangPrefix(to, 'en') : to), [onEn]);
}
