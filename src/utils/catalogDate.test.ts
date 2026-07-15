import { describe, expect, it } from 'vitest';
import { formatCatalogUpdatedDate } from './catalogDate';

describe('catalog update date formatting', () => {
  it('uses the catalog generation calendar date without zero padding', () => {
    expect(formatCatalogUpdatedDate('2026-07-15T09:13:10Z')).toBe('2026.7.15');
    expect(formatCatalogUpdatedDate('2027-01-02')).toBe('2027.1.2');
  });

  it('uses the China calendar date for UTC timestamps near midnight', () => {
    expect(formatCatalogUpdatedDate('2026-07-14T17:00:00Z')).toBe('2026.7.15');
  });
});
