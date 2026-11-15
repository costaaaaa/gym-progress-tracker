import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import confetti from 'canvas-confetti';
import { celebrate } from './celebrate';

describe('celebrate', () => {
  beforeEach(() => {
    confetti.mockClear();
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
  });

  it('non usa un worker: la CSP del sito blocca i worker da blob:', () => {
    celebrate();
    expect(confetti).toHaveBeenCalledWith(expect.objectContaining({ useWorker: false }));
  });

  it('non fa nulla con il movimento ridotto', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true });
    celebrate();
    expect(confetti).not.toHaveBeenCalled();
  });
});
