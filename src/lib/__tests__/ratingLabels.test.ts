import { describe, it, expect } from 'vitest';
import { 
  getLevelByValue, 
  getShortLabel, 
  getComponentDescriptor, 
  ratingToExperienceLevel 
} from '../ratingLabels';

describe('ratingLabels', () => {
  describe('getLevelByValue', () => {
    it('returns correct levels for integers 1-5', () => {
      expect(getLevelByValue(5).value).toBe(5);
      expect(getLevelByValue(4).value).toBe(4);
      expect(getLevelByValue(3).value).toBe(3);
      expect(getLevelByValue(2).value).toBe(2);
      expect(getLevelByValue(1).value).toBe(1);
    });

    it('handles rounding correctly', () => {
      expect(getLevelByValue(4.7).value).toBe(5);
      expect(getLevelByValue(4.2).value).toBe(4);
      expect(getLevelByValue(2.5).value).toBe(3);
    });

    it('returns default for out of bounds', () => {
      expect(getLevelByValue(0).value).toBe(3); 
    });
  });

  describe('getShortLabel', () => {
    it('returns the short version of the label', () => {
      expect(getShortLabel(5)).toBe('Da Sogno');
      expect(getShortLabel(4)).toBe('Garanzia');
      expect(getShortLabel(3)).toBe('Buon Alleato');
      expect(getShortLabel(2)).toBe('Spuntino Smart');
      expect(getShortLabel(1)).toBe('In Esplorazione');
    });
  });

  describe('getComponentDescriptor', () => {
    it('returns correct meat descriptors', () => {
      expect(getComponentDescriptor('meat', 5)).toBe('Succulenta, perfettamente speziata');
      expect(getComponentDescriptor('meat', 1)).toBe('Non mi ha convinto');
    });

    it('returns correct value descriptors', () => {
      expect(getComponentDescriptor('value', 5)).toBe('Un affare incredibile per quello che offre');
      expect(getComponentDescriptor('value', 3)).toBe('Nella norma');
    });
  });

  describe('ratingToExperienceLevel', () => {
    it('maps average ratings to experience buckets', () => {
      expect(ratingToExperienceLevel(4.8).value).toBe(5);
      expect(ratingToExperienceLevel(3.2).value).toBe(3);
    });
  });
});
