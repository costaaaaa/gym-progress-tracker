import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from './usePageMeta';

const NO_ALIASES = {};

/**
 * Stato delle pagine "hub" a tab (Dashboard, Profilo, Allenamenti): la tab
 * attiva vive nell'URL (?tab=...) così i link diretti e il tasto indietro
 * funzionano.
 *
 * - `tabs`: `[{ id, label }]` in ordine (la prima è il default; `label` è la chiave
 *   i18n del nome). Va passato un array statico definito fuori dal componente: una nuova identità a ogni render
 *   farebbe rieseguire gli effetti sotto a ogni render e non solo al cambio tab.
 * - `visitedTabs`: serve a montare (lazy) una tab solo alla prima visita e poi
 *   tenerla montata, nascosta, per non perderne lo stato.
 * - Una tab non valida nell'URL viene sostituita (replace) con quella di default.
 * - `aliases`: `{ vecchio: 'nuovo' }`, i nomi di tab che non esistono più: l'indirizzo viene sostituito (replace) con la tab
 *   che ha preso il loro posto, invece che con quella di default. Come `tabs`, va definito fuori dal componente.
 * - Al cambio tab la pagina torna in cima.
 * - `page`: `{ title, description }` già tradotti (le chiavi restano letterali nelle pagine,
 *   così i18n:check le vede); il titolo del documento è «tab · pagina».
 */
export function useTabbedPage(tabs, { title, description, aliases = NO_ALIASES }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  // Solo le chiavi di `aliases`: `?tab=constructor` non è un alias
  const isAlias = Object.hasOwn(aliases, requestedTab);
  const currentTab = (isAlias ? aliases[requestedTab] : requestedTab) || tabs[0].id;
  const tabIndex = Math.max(tabs.findIndex((tab) => tab.id === currentTab), 0);
  const isValidTab = tabs.some((tab) => tab.id === currentTab);
  usePageMeta(`${t(tabs[tabIndex].label)} · ${title}`, description);
  const [visitedTabs, setVisitedTabs] = useState(() => (
    Object.fromEntries(tabs.map((tab) => [tab.id, tab.id === currentTab]))
  ));

  const handleTabChange = (event, newValue) => {
    setSearchParams({ tab: tabs[newValue].id });
  };

  useEffect(() => {
    if (isValidTab) {
      setVisitedTabs(prev => ({
        ...prev,
        [currentTab]: true
      }));
    }
  }, [currentTab, isValidTab]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [currentTab]);

  useEffect(() => {
    if (!isValidTab) {
      setSearchParams({ tab: tabs[0].id }, { replace: true });
    } else if (isAlias) {
      setSearchParams({ tab: currentTab }, { replace: true });
    }
  }, [isValidTab, isAlias, currentTab, tabs, setSearchParams]);

  return {
    currentTab,
    tabIndex,
    handleTabChange,
    visitedTabs,
  };
}
