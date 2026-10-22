import { describe, it, expect } from 'vitest';
import { buildPoints } from './ChartCard';
import { polylineX } from '../test/polyline';

const pts = (...pairs) => pairs.map(([x, value]) => ({ x, value }));

describe('buildPoints', () => {
  it('la distanza tra i punti segue la loro posizione nel dominio', () => {
    expect(polylineX(buildPoints(pts([0, 1], [1, 2], [10, 3]), [0, 10]))).toEqual([0, 22, 220]);
  });

  it('un solo punto: linea orizzontale a metà altezza su tutta la larghezza', () => {
    expect(buildPoints(pts([5, 80]), [0, 10])).toBe('0,36 220,36');
  });

  it('tutti i punti alla stessa x: a distanza uguale, non un segmento verticale', () => {
    expect(polylineX(buildPoints(pts([7, 1], [7, 2], [7, 3]), [7, 7]))).toEqual([0, 110, 220]);
  });
});
