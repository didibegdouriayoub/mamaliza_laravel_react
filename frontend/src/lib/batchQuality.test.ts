import { describe, it, expect } from 'vitest';
import { phStatus, productionDone } from './batchQuality';

describe('phStatus', () => {
  it('is ok inside the range, edges included', () => {
    expect(phStatus(5.3, 5.1, 5.4)).toBe('ok');
    expect(phStatus(5.1, 5.1, 5.4)).toBe('ok');
    expect(phStatus(5.4, 5.1, 5.4)).toBe('ok');
  });

  it('flags low and high', () => {
    expect(phStatus(4.9, 5.1, 5.4)).toBe('low');
    expect(phStatus(5.6, 5.1, 5.4)).toBe('high');
  });

  it('has nothing to say without a pH or without a range', () => {
    expect(phStatus(null, 5.1, 5.4)).toBe('none');
    expect(phStatus(undefined, 5.1, 5.4)).toBe('none');
    expect(phStatus(5.3, null, null)).toBe('none');
  });

  it('works with only one side of the range', () => {
    expect(phStatus(5.0, 5.1, null)).toBe('low');
    expect(phStatus(7, 5.1, null)).toBe('ok');
    expect(phStatus(7, null, 5.4)).toBe('high');
  });
});

describe('productionDone', () => {
  it('needs the final pH', () => {
    expect(productionDone({ ph: 5.2 })).toBe(true);
    expect(productionDone({ ph: 0 })).toBe(true);
    expect(productionDone({ ph: null })).toBe(false);
    expect(productionDone(null)).toBe(false);
  });
});
