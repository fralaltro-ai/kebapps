import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('cn utility', () => {
  it('should merge basic class names', () => {
    expect(cn('class1', 'class2')).toBe('class1 class2');
  });

  it('should handle conditional classes', () => {
    expect(cn('class1', { class2: true, class3: false })).toBe('class1 class2');
  });

  it('should handle arrays of classes', () => {
    expect(cn(['class1', 'class2'])).toBe('class1 class2');
  });

  it('should resolve tailwind conflicts correctly using tailwind-merge', () => {
    // px-2 and p-4 conflict (both set padding), p-4 should win as it comes later
    expect(cn('px-2 py-2', 'p-4')).toBe('p-4');

    // text-red-500 and text-blue-500 conflict, text-blue-500 should win
    expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
  });

  it('should ignore falsy values', () => {
    expect(cn('class1', null, undefined, false, 0, '', 'class2')).toBe('class1 class2');
  });

  it('should handle complex nested combinations', () => {
    expect(cn(
      'base-class',
      ['array-class-1', { 'conditional-true': true, 'conditional-false': false }],
      undefined,
      'text-sm p-2',
      'text-lg' // overrides text-sm
    )).toBe('base-class array-class-1 conditional-true p-2 text-lg');
  });
});
