import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Altezza della Navbar sticky: il palco della scena resta fermo subito sotto. La Navbar pubblica l'altezza reale
// in --navbar-height (due righe con la spaziatura del testo); 64 è quella di una riga.
const NAVBAR_HEIGHT = 64;
const NAVBAR_VAR = `var(--navbar-height, ${NAVBAR_HEIGHT}px)`;
const navbarHeight = () =>
  parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')) || NAVBAR_HEIGHT;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Sotto questa altezza di finestra il palco fisso taglia titolo, passi e card (misurato a 320 x 568 e a 1280 x 500,
// dove le scene più alte arrivano a ~510 px): la scena si mostra come composizione statica. Letta una volta al montaggio, come il movimento ridotto:
// la barra del browser che si ritrae non deve far cambiare l'altezza della sezione durante lo scorrimento.
const SCENE_MIN_HEIGHT = 600;
const TALL_QUERY = `(min-height: ${SCENE_MIN_HEIGHT}px)`;

const tallScreen = () => typeof window !== 'undefined' && window.matchMedia(TALL_QUERY).matches;

// Spaziatura del testo WCAG 1.4.12 (interlinea 1,5, spazio fra i paragrafi, lettere e parole): si applica a pagina
// caricata e il testo può non entrare più nel palco. Un pixel di scarto è arrotondamento, non testo tagliato.
const CLIP_TOLERANCE = 1;
const textIsClipped = (text, stage) => text.top < stage.top - CLIP_TOLERANCE || text.bottom > stage.bottom + CLIP_TOLERANCE;

// Scena a scorrimento: la sezione è alta (hold + 1) schermate, il palco `sticky` resta fermo per `hold`
// schermate e una timeline GSAP avanza con lo scroll nativo (nessuna cattura della rotella).
// Con movimento ridotto o schermo basso `live` è false: il componente mostra la composizione finita, senza timeline.
// `stageRef` va sul palco e `textRef` sulla colonna del testo (non su telefono e grafico, che sono decorativi):
// se il testo esce dal palco la scena passa alla composizione statica e ci resta fino al ricaricamento.
export function useScrollScene(build) {
  const ref = useRef(null);
  const stageRef = useRef(null);
  const textRef = useRef(null);
  const [live, setLive] = useState(() => !reducedMotion() && tallScreen());

  useLayoutEffect(() => {
    if (!live || !stageRef.current || !textRef.current || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver(() => {
      if (textIsClipped(textRef.current.getBoundingClientRect(), stageRef.current.getBoundingClientRect())) setLive(false);
    });
    observer.observe(textRef.current);
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [live]);

  // La sezione passa da (hold + 1) schermate ad altezza automatica: le scene sotto hanno ancora le posizioni di prima.
  // GSAP le ricalcola da solo solo su resize e load, quindi lo si chiede qui, a layout già aggiornato.
  const wasLive = useRef(live);
  useLayoutEffect(() => {
    if (wasLive.current && !live) ScrollTrigger.refresh();
    wasLive.current = live;
  }, [live]);

  useLayoutEffect(() => {
    if (!live || !ref.current) return undefined;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(ref.current);
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: ref.current,
          start: () => `top top+=${navbarHeight()}`,
          end: 'bottom bottom',
          scrub: 0.5,
        },
      });
      build(tl, q);
    }, ref);
    return () => ctx.revert();
    // build è una funzione definita nel modulo della scena: non cambia fra i render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live]);

  return { ref, live, stageRef, textRef };
}

// Stile comune: sezione alta (hold + 1) schermate, palco sticky alto quanto lo schermo sotto la Navbar.
export const sceneSx = (live, hold, phoneHold = hold) => ({
  height: live ? { xs: `${(phoneHold + 1) * 100}svh`, md: `${(hold + 1) * 100}svh` } : 'auto',
  position: 'relative',
});

export const stageSx = (live) =>
  live
    ? {
        position: 'sticky',
        top: NAVBAR_VAR,
        height: `calc(100svh - ${NAVBAR_VAR})`,
        display: 'flex',
        alignItems: 'center',
        // "safe": se il contenuto è più alto del palco parte dall'alto invece di uscire da sopra e da sotto; dove non c'è (Safari < 17.6) resta "center"
        '@supports (align-items: safe center)': { alignItems: 'safe center' },
        overflow: 'hidden',
      }
    : { py: { xs: 6, md: 10 } };
