// Analytics rispettosi della privacy con Umami installato sui nostri server: niente cookie,
// nessun dato personale, nessun servizio di terzi. Lo script si carica solo se in fase di build
// sono impostate VITE_UMAMI_SRC (indirizzo dello script) e VITE_UMAMI_WEBSITE_ID; senza, non
// succede nulla (sviluppo locale, installazioni senza Umami).

const UTM_PARAMS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

// Dell'indirizzo inviato ad Umami teniamo solo i parametri UTM (allowlist): servono a capire
// da quale annuncio arriva la visita, mentre token di reset-password, codici di invito e
// click id delle piattaforme pubblicitarie non devono mai uscire dal browser.
export const stripSearch = (rawUrl) => {
  try {
    const url = new URL(rawUrl, window.location.origin);
    const kept = new URLSearchParams();
    UTM_PARAMS.forEach((name) => {
      const value = url.searchParams.get(name);
      if (value) kept.set(name, value.slice(0, 100));
    });
    const query = kept.toString();
    const clean = url.pathname + (query ? `?${query}` : '') + url.hash;
    return /^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? url.origin + clean : clean;
  } catch {
    // se l'indirizzo non e' interpretabile meglio non inviarne nessun parametro
    return String(rawUrl).split('?')[0];
  }
};

// Chiamata da Umami (data-before-send) prima di ogni invio.
const beforeSend = (type, payload) => {
  if (payload && typeof payload.url === 'string') payload.url = stripSearch(payload.url);
  return payload;
};

export const initAnalytics = () => {
  const src = import.meta.env.VITE_UMAMI_SRC;
  const websiteId = import.meta.env.VITE_UMAMI_WEBSITE_ID;
  if (!src || !websiteId || document.querySelector('script[data-website-id]')) return;

  const script = document.createElement('script');
  script.defer = true;
  script.src = src;
  script.dataset.websiteId = websiteId;
  // Il token di /reset-password?token=... sta nella query string: ad Umami passano solo gli UTM
  window.liftindexBeforeSend = beforeSend;
  script.dataset.beforeSend = 'liftindexBeforeSend';
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
