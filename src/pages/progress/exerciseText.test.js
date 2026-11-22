// Testi condivisi della pagina dei Progressi e dell'esercizio: valori, «N giorni fa», nome del gruppo, posizione.
import { describe, it, expect } from 'vitest';
import i18n from '../../i18n';
import { formatValue, formatDaysAgo, groupLabel, positionLabel } from './exerciseText';

const t = i18n.t.bind(i18n);

describe('formatValue', () => {
  it('il 1RM stimato ha al massimo un decimale, in lb al quarto di libbra', () => {
    expect(formatValue((k) => k, 'oneRM', 101.33)).toBe('101,3 kg');
    expect(formatValue((k) => k, 'oneRM', 100, 'lb')).toBe('220,5 lb');
  });
  it('le ripetizioni massime hanno l\'unità «rip.»', () => {
    expect(formatValue(t, 'maxReps', 12)).toMatch(/^12 /);
  });
});

describe('formatDaysAgo', () => {
  it('oggi, ieri, N giorni fa', () => {
    expect(formatDaysAgo(t, 0)).toBe(t('progress.today'));
    expect(formatDaysAgo(t, 1)).toBe(t('progress.yesterday'));
    expect(formatDaysAgo(t, 4)).toBe(t('progress.days_ago', { count: 4 }));
  });
});

describe('groupLabel', () => {
  it('il gruppo muscolare tradotto', () => {
    expect(groupLabel(t, 'chest')).toBe('Petto');
  });
  it('senza gruppo, o «other», è «Altro»', () => {
    expect(groupLabel(t, null)).toBe('Altro');
    expect(groupLabel(t, 'other')).toBe('Altro');
  });
});

describe('positionLabel', () => {
  it('c\'è solo con la posizione nella seduta', () => {
    expect(positionLabel(t, null)).toBeNull();
    expect(positionLabel(t, 1)).toMatch(/1/);
  });
});
