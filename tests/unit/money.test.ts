import { describe, it, expect } from 'vitest';
import { formatPesos } from '@/lib/domain/money';

describe('formatPesos', () => {
  it('formats 12550 centavos as ₱125.50', () => {
    expect(formatPesos(12550)).toBe('₱125.50');
  });
  it('formats 5 centavos as ₱0.05', () => {
    expect(formatPesos(5)).toBe('₱0.05');
  });
  it('formats negatives', () => {
    expect(formatPesos(-250)).toBe('-₱2.50');
  });
  it('rejects non-integer money', () => {
    expect(() => formatPesos(10.5)).toThrow();
  });
});
