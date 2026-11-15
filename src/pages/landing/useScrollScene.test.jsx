// La scena a scorrimento resta fissa solo se lo schermo è abbastanza alto: a 320 x 256 (zoom 400%) e su
// finestre basse titolo, passi e card verrebbero tagliati dal palco (1.4.4, 1.4.10).
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useScrollScene, stageSx } from './useScrollScene';

const mockScreen = ({ reduced, tall }) => {
  window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion') ? reduced : query.includes('min-height') ? tall : false,
    media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
};

let live;
const build = () => {};
const Probe = () => {
  const scene = useScrollScene(build);
  live = scene.live;
  return (
    <div ref={scene.ref}>
      <div ref={scene.stageRef} data-testid="stage">
        <div ref={scene.textRef} data-testid="text" />
      </div>
    </div>
  );
};

afterEach(() => { live = undefined; });

describe('scena a scorrimento', () => {
  it('schermo alto e movimento normale: scena animata', () => {
    mockScreen({ reduced: false, tall: true });
    render(<Probe />);
    expect(live).toBe(true);
  });

  it('schermo basso: composizione statica', () => {
    mockScreen({ reduced: false, tall: false });
    render(<Probe />);
    expect(live).toBe(false);
  });

  it('movimento ridotto: composizione statica anche su schermo alto', () => {
    mockScreen({ reduced: true, tall: true });
    render(<Probe />);
    expect(live).toBe(false);
  });

  it('il palco fisso sta sotto la barra con l\'altezza che la Navbar pubblica (64 px se non la pubblica)', () => {
    const stage = stageSx(true);
    expect(stage.top).toBe('var(--navbar-height, 64px)');
    expect(stage.height).toBe('calc(100svh - var(--navbar-height, 64px))');
  });

  // 1.4.12: con la spaziatura del testo il contenuto supera il palco; centrato "e basta" esce sia sopra sia sotto
  // e il titolo viene tagliato. Con "safe" in quel caso parte dall'alto; dove "safe" non c'è resta "center".
  it('il contenuto del palco è centrato, e "safe center" solo dove il browser lo capisce', () => {
    const stage = stageSx(true);
    expect(stage.alignItems).toBe('center');
    expect(stage['@supports (align-items: safe center)']).toEqual({ alignItems: 'safe center' });
  });
});

// 1.4.12: la spaziatura del testo si applica a pagina caricata. Se il testo della scena non entra nel palco,
// la scena passa alla composizione statica e ci resta (nessun andirivieni).
describe('scena a scorrimento: testo che non entra nel palco', () => {
  let observers;
  let rects;

  beforeEach(() => {
    observers = [];
    rects = { stage: { top: 64, bottom: 640 }, text: { top: 100, bottom: 500 } };
    window.ResizeObserver = class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {}
      disconnect() {}
    };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function rect() {
      return rects[this.dataset.testid] ?? { top: 0, bottom: 0, height: 0 };
    });
    mockScreen({ reduced: false, tall: true });
  });

  afterEach(() => { vi.restoreAllMocks(); delete window.ResizeObserver; });

  const resize = () => act(() => { observers.forEach((o) => o.callback([])); });

  it('il testo entra: la scena resta animata', () => {
    render(<Probe />);
    resize();
    expect(live).toBe(true);
  });

  it('il testo esce dal palco in basso: la scena diventa statica', () => {
    render(<Probe />);
    rects.text = { top: 100, bottom: 700 };
    resize();
    expect(live).toBe(false);
  });

  it('il testo esce dal palco in alto: la scena diventa statica', () => {
    render(<Probe />);
    rects.text = { top: 20, bottom: 500 };
    resize();
    expect(live).toBe(false);
  });

  it('il testo già troppo alto al montaggio: statica subito', () => {
    rects.text = { top: 100, bottom: 700 };
    render(<Probe />);
    resize();
    expect(live).toBe(false);
  });

  it('una volta statica non torna animata, anche se il testo poi rientra', () => {
    render(<Probe />);
    rects.text = { top: 100, bottom: 700 };
    resize();
    rects.text = { top: 100, bottom: 500 };
    resize();
    expect(live).toBe(false);
  });

  it('un pixel di scarto per arrotondamento non conta', () => {
    render(<Probe />);
    rects.text = { top: 100, bottom: 640.6 };
    resize();
    expect(live).toBe(true);
  });

  // Una scena che passa a statica cambia l'altezza della sua sezione: le altre, più in basso, hanno ancora le posizioni
  // di prima e la loro timeline andrebbe sfasata. GSAP ricalcola da solo solo su resize e load.
  describe('posizioni delle altre scene', () => {
    it('quando una scena diventa statica, ScrollTrigger ricalcola dopo che il layout è aggiornato', () => {
      const refresh = vi.spyOn(ScrollTrigger, 'refresh').mockImplementation(() => {
        refreshedWhileStatic = document.querySelector('[data-testid="stage"]').dataset.static;
      });
      let refreshedWhileStatic;
      const StaticAware = () => {
        const scene = useScrollScene(build);
        return (
          <div ref={scene.ref}>
            <div ref={scene.stageRef} data-testid="stage" data-static={String(!scene.live)}>
              <div ref={scene.textRef} data-testid="text" />
            </div>
          </div>
        );
      };
      render(<StaticAware />);
      expect(refresh).not.toHaveBeenCalled();
      rects.text = { top: 100, bottom: 700 };
      resize();
      expect(refresh).toHaveBeenCalledTimes(1);
      expect(refreshedWhileStatic).toBe('true');
    });

    it('la scena che resta animata, o nasce statica, non ricalcola nulla', () => {
      const refresh = vi.spyOn(ScrollTrigger, 'refresh');
      render(<Probe />);
      resize();
      mockScreen({ reduced: true, tall: true });
      render(<Probe />);
      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
