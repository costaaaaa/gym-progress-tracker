import { useLayoutEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

// Altezza della Navbar sticky: il palco della scena resta fermo subito sotto.
export const NAVBAR_HEIGHT = 64;

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Scena a scorrimento: la sezione è alta (hold + 1) schermate, il palco `sticky` resta fermo per `hold`
// schermate e una timeline GSAP avanza con lo scroll nativo (nessuna cattura della rotella).
// Con movimento ridotto `live` è false: il componente mostra la composizione finita, senza timeline.
export function useScrollScene(build) {
  const ref = useRef(null);
  const [live] = useState(() => !reducedMotion());

  useLayoutEffect(() => {
    if (!live || !ref.current) return undefined;
    const ctx = gsap.context(() => {
      const q = gsap.utils.selector(ref.current);
      const tl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: ref.current,
          start: `top top+=${NAVBAR_HEIGHT}`,
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

  return { ref, live };
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
        top: NAVBAR_HEIGHT,
        height: `calc(100svh - ${NAVBAR_HEIGHT}px)`,
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
      }
    : { py: { xs: 6, md: 10 } };
