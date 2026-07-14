import { describe, it, expect } from 'vitest';
import { formatAed, formatNumber, formatDate } from '../formats';
import { getDirection, isLocale, defaultLocale, localeDirection } from '../config';

describe('AED + locale formatting', () => {
  it('formats AED for English', () => {
    const s = formatAed(2650000, 'en');
    expect(s).toMatch(/AED/);
    expect(s.replace(/[^0-9]/g, '')).toBe('2650000');
  });
  it('formats AED for Arabic without throwing', () => {
    expect(() => formatAed(2650000, 'ar')).not.toThrow();
  });
  it('falls back for an unknown locale', () => {
    expect(formatNumber(1000, 'zz')).toBe('1,000');
  });
  it('formats a date deterministically', () => {
    const s = formatDate('2026-03-01T00:00:00.000Z', 'en', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      timeZone: 'UTC',
    });
    expect(s).toContain('2026');
  });
});

describe('locale config', () => {
  it('knows direction', () => {
    expect(getDirection('en')).toBe('ltr');
    expect(getDirection('ar')).toBe('rtl');
    expect(getDirection('zz')).toBe('ltr');
    expect(localeDirection.ar).toBe('rtl');
  });
  it('validates locales', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ar')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(defaultLocale).toBe('en');
  });
});
