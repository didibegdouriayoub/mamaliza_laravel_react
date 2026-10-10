import { defaultLotLetters, suggestLotCode, lotCodeDate, isValidLotCode } from './lotCode';

describe('lotCode', () => {
  it('builds a suggestion from prefix, date and letters', () => {
    expect(suggestLotCode('ta', '2026-08-06', 'krm')).toBe('TA260806KRM');
    expect(defaultLotLetters('Kroom rectangulaire')).toBe('KRO');
  });
  it('reads the production date from the first 6 digits after the prefix', () => {
    expect(lotCodeDate('TA260806KP')).toBe('2026-08-06');
    expect(lotCodeDate('ta2608061 krm')).toBe('2026-08-06'); // extra digits ignored, spaces/case normalised
  });
  it('rejects malformed codes and impossible dates', () => {
    expect(isValidLotCode('T260806KP')).toBe(false);
    expect(isValidLotCode('TA26080KP')).toBe(false);
    expect(isValidLotCode('TA261306KP')).toBe(false); // month 13
    expect(isValidLotCode('TA260230KP')).toBe(false); // 30 Feb
  });
});
