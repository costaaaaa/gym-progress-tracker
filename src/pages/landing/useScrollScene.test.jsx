// La scena a scorrimento resta fissa solo se lo schermo è abbastanza alto: a 320 x 256 (zoom 400%) e su
// finestre basse titolo, passi e card verrebbero tagliati dal palco (1.4.4, 1.4.10).
import { describe, it, expect, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { useScrollScene } from './useScrollScene';

const mockScreen = ({ reduced, tall }) => {
  window.matchMedia = (query) => ({
    matches: query.includes('prefers-reduced-motion') ? reduced : query.includes('min-height') ? tall : false,
    media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  });
};

let live;
const build = () => {};
const Probe = () => {
  ({ live } = useScrollScene(build));
  return null;
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
});
