import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const fire = vi.fn();
  const create = vi.fn(() => fire);
  const confetti = Object.assign(vi.fn(), { create });
  return { fire, create, confetti };
});
vi.mock('canvas-confetti', () => ({ default: mocks.confetti }));


describe('celebrate', () => {
  let celebrate;
  let celebratePR;
  // Modulo nuovo a ogni test: l'istanza si crea al primo lancio e poi resta
  beforeEach(async () => {
    vi.resetModules();
    ({ celebrate, celebratePR } = await import('./celebrate'));
    mocks.create.mockClear();
    mocks.fire.mockClear();
    mocks.confetti.mockClear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  // L'opzione useWorker vale solo alla creazione dell'istanza: passata al lancio della funzione predefinita
  // la libreria apre comunque un worker da blob:, che la CSP del sito blocca.
  it('lancia da un\'istanza creata senza worker, non dalla funzione predefinita', () => {
    celebrate();
    expect(mocks.create).toHaveBeenCalledWith(undefined, expect.objectContaining({ useWorker: false }));
    expect(mocks.fire).toHaveBeenCalledTimes(1);
    expect(mocks.confetti).not.toHaveBeenCalled();
  });

  it('crea l\'istanza una volta sola, non a ogni lancio', () => {
    celebrate();
    celebratePR();
    expect(mocks.create).toHaveBeenCalledTimes(1);
    expect(mocks.fire).toHaveBeenCalledTimes(2);
  });

  it('non fa nulla con il movimento ridotto', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    celebrate();
    expect(mocks.fire).not.toHaveBeenCalled();
  });
});
