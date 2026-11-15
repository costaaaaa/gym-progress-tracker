import { describe, it, expect } from 'vitest';
import { legalPaths } from './paths';

describe('legalPaths', () => {
  it('in italiano punta alle pagine italiane', () => {
    expect(legalPaths('it')).toEqual({ privacy: '/privacy.html', terms: '/termini.html' });
  });

  it('in inglese punta alle pagine inglesi', () => {
    expect(legalPaths('en')).toEqual({ privacy: '/en/privacy.html', terms: '/en/terms.html' });
  });

  it('una lingua sconosciuta ricade sull\'italiano', () => {
    expect(legalPaths('fr')).toEqual(legalPaths('it'));
    expect(legalPaths(undefined)).toEqual(legalPaths('it'));
  });
});
