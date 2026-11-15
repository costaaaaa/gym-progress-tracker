import { describe, it, expect } from 'vitest';
import { legalPaths, blogPaths } from './paths';

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

describe('blogPaths', () => {
  it('in italiano punta alle pagine italiane del blog', () => {
    expect(blogPaths('it')).toEqual({ calculator: '/blog/calcolatore-1rm/', mcp: '/blog/mcp/' });
  });

  it('in inglese punta alle pagine inglesi', () => {
    expect(blogPaths('en')).toEqual({ calculator: '/en/blog/1rm-calculator/', mcp: '/en/blog/mcp/' });
  });

  it('una lingua sconosciuta ricade sull\'italiano', () => {
    expect(blogPaths('fr')).toEqual(blogPaths('it'));
    expect(blogPaths(undefined)).toEqual(blogPaths('it'));
  });
});
