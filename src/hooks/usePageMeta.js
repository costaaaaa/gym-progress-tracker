import { useEffect } from 'react';

// Default globali definiti staticamente in index.html (audit SEO 25/08/2026,
// Deliverable 2) — tenuti qui in sync a mano per il ripristino on cleanup.
const DEFAULT_TITLE = 'LiftIndex – Diario Allenamento Palestra Online';
const DEFAULT_DESCRIPTION =
  'Diario allenamento palestra online: piani illimitati, Focus Mode con timer recupero, gamification, mappa muscolare e grafici progressi.';

/**
 * Imposta document.title e la meta description per la pagina/route corrente.
 *
 * Non usiamo react-helmet-async (dipendenza non presente nel progetto, vedi
 * audit SEO): è una SPA client-side pura senza SSR, quindi l'head "vero" letto
 * dai bot che NON eseguono JS resta comunque quello statico di index.html
 * (limite noto, fuori scope risolverlo qui). Questo hook copre solo il caso
 * di bot/crawler che eseguono JS (es. Googlebot) e l'esperienza utente (tab
 * del browser, condivisioni con anteprima generata client-side).
 *
 * Al cleanup ripristina i default globali: così, se una route futura
 * dimentica di chiamare l'hook, non eredita il titolo/description della
 * pagina precedente all'infinito.
 */
export function usePageMeta(title, description) {
  useEffect(() => {
    const fullTitle = title
      ? `${title} | LiftIndex`
      : DEFAULT_TITLE;
    document.title = fullTitle;

    const meta = document.querySelector('meta[name="description"]');
    if (meta && description) {
      meta.setAttribute('content', description);
    }

    return () => {
      document.title = DEFAULT_TITLE;
      if (meta) {
        meta.setAttribute('content', DEFAULT_DESCRIPTION);
      }
    };
  }, [title, description]);
}
