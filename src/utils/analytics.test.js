// Ad Umami non devono arrivare né la query (salvo UTM) né il fragment: il token di reset-password sta in uno dei due.
import { describe, it, expect } from 'vitest';
import { stripSearch } from './analytics';

describe('stripSearch', () => {
  it('toglie il fragment col token di reset', () => {
    expect(stripSearch('/reset-password#token=abc123')).toBe('/reset-password');
  });
  it('toglie il token nella query e tiene gli UTM', () => {
    expect(stripSearch('/reset-password?token=abc123&utm_source=mail')).toBe('/reset-password?utm_source=mail');
  });
});
