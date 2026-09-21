// Analytics rispettosi della privacy con Umami installato sui nostri server: niente cookie,
// nessun dato personale, nessun servizio di terzi. Lo script si carica solo se in fase di build
// sono impostate VITE_UMAMI_SRC (indirizzo dello script) e VITE_UMAMI_WEBSITE_ID; senza, non
// succede nulla (sviluppo locale, installazioni senza Umami).

export const initAnalytics = () => {
  const src = import.meta.env.VITE_UMAMI_SRC;
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  if (!src || !websiteId || document.querySelector('script[data-website-id]')) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = src;
  script.dataset.websiteId = websiteId;
  // Il token di /reset-password?token=... sta nella query string: non deve mai arrivare ad Umami
  script.dataset.excludeSearch = 'true';
  script.dataset.doNotTrack = 'true';
  document.head.appendChild(script);
};

// Registra un evento (per esempio 'signup'). Non fa nulla se Umami non e' caricato.
export const track = (name, data) => {
  try {
    if (window.umami && typeof window.umami.track === 'function') {
      window.umami.track(name, data);
    }
  } catch {
    // le statistiche non devono mai rompere l'app
  }
};
