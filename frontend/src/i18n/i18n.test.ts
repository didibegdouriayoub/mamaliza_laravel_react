import { describe, it, expect } from 'vitest';
import en from './en';
import fr from './fr';

// every text key of the English file, e.g. "nav.dashboard"
const keys = (o: Record<string, any>, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keys(v, `${p}${k}.`) : [`${p}${k}`]));

describe('translations', () => {
  it('French has every English key and nothing extra', () => {
    expect(keys(fr).sort()).toEqual(keys(en).sort());
  });

  it('no French text is left empty', () => {
    const empty = keys(fr).filter(k => !k.split('.').reduce((o: any, part) => o[part], fr));
    expect(empty).toEqual([]);
  });
});
