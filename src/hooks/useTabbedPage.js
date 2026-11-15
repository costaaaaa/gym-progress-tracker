import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageMeta } from './usePageMeta';

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
 * - Al cambio tab la pagina torna in cima.
 * - `page`: `{ title, description }` già tradotti (le chiavi restano letterali nelle pagine,
 *   così i18n:check le vede); il titolo del documento è «tab · pagina».
 */
export function useTabbedPage(tabs, { title, description }) {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || tabs[0].id;
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
    }
  }, [isValidTab, tabs, setSearchParams]);

  return {
    currentTab,
    tabIndex,
    handleTabChange,
    visitedTabs,
  };
}
