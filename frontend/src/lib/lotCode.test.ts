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

import { extractLotCodes } from './lotCode';

describe('extractLotCodes', () => {
  const box = `FROMAGERIE MAMALIZA
MOZZARELLA 500g  NET WT 0.5 KG
BEST BEFORE 06/09/2026   PROD 06/08/2026
TA260806KP
Lot no: made in Morocco`;

  it('isolates the lot code and ignores dates and weights', () => {
    const r = extractLotCodes(box);
    expect(r.map(c => c.code)).toEqual(['TA260806KP']);
    expect(r[0].date).toBe('2026-08-06');
  });
  it('tolerates spaces and look-alike characters from OCR', () => {
    expect(extractLotCodes('TA 26O8O6 KP')[0].code).toBe('TA260806KP');
    expect(extractLotCodes('batch TA2608061 KRM ok')[0].code).toBe('TA2608061KRM');
  });
  it('ranks codes that match a known product first and drops impossible dates', () => {
    const r = extractLotCodes('XY260101AB\nTA260806KRM\nTA261399ZZ', [{ prefix: 'TA', letters: 'KRM' }]);
    expect(r.map(c => c.code)).toEqual(['TA260806KRM', 'XY260101AB']);
  });
  it('returns nothing when there is no code', () => {
    expect(extractLotCodes('MOZZARELLA 500g EXP 06/09/2026')).toEqual([]);
  });
});
