import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Stato delle pagine "hub" a tab (Dashboard, Profilo, Allenamenti): la tab
 * attiva vive nell'URL (?tab=...) così i link diretti e il tasto indietro
 * funzionano.
 *
 * - `tabs`: chiavi in ordine (la prima è il default). Va passato un array
 *   statico definito fuori dal componente: una nuova identità a ogni render
 *   farebbe rieseguire gli effetti sotto a ogni render e non solo al cambio tab.
 * - `visitedTabs`: serve a montare (lazy) una tab solo alla prima visita e poi
 *   tenerla montata, nascosta, per non perderne lo stato.
 * - Una tab non valida nell'URL viene sostituita (replace) con quella di default.
 * - Al cambio tab la pagina torna in cima.
 */
export function useTabbedPage(tabs) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = searchParams.get('tab') || tabs[0];
  const isValidTab = tabs.includes(currentTab);
  const [visitedTabs, setVisitedTabs] = useState(() => (
    Object.fromEntries(tabs.map((tab) => [tab, tab === currentTab]))
  ));

  const handleTabChange = (event, newValue) => {
    setSearchParams({ tab: tabs[newValue] });
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
      setSearchParams({ tab: tabs[0] }, { replace: true });
    }
  }, [isValidTab, tabs, setSearchParams]);

  return {
    currentTab,
    tabIndex: Math.max(tabs.indexOf(currentTab), 0),
    handleTabChange,
    visitedTabs,
  };
}
