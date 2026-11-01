import { describe, it, expect } from 'vitest';
import { phStatus, productionDone, tastingCriteria, tastingScore, suggestedVerdict, finalVerdict, tastingDone, rankBest } from './batchQuality';

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

describe('tasting', () => {
  it('has type specific criteria and taste counts double', () => {
    expect(tastingCriteria('mozzarella').map(c => c.key)).toEqual(['taste', 'texture', 'stretch', 'melt']);
    expect(tastingCriteria('fondue').map(c => c.key)).toEqual(['taste', 'texture', 'creaminess', 'smoothness']);
    expect(tastingCriteria(null).map(c => c.key)).toEqual(['taste', 'texture']);
    expect(tastingCriteria('mozzarella')[0].weight).toBe(2);
  });

  it('weights taste x2 and waits for every score', () => {
    // (5*2 + 3 + 4 + 4) / 5 = 4.2
    expect(tastingScore({ taste: 5, texture: 3, stretch: 4, melt: 4 }, 'mozzarella')).toBe(4.2);
    expect(tastingScore({ taste: 5, texture: 3, stretch: 4 }, 'mozzarella')).toBeNull();
    expect(tastingScore({ taste: 4, texture: 2 }, null)).toBe(3.33);
    expect(tastingScore(null, 'fondue')).toBeNull();
  });

  it('suggests a verdict from the score', () => {
    expect(suggestedVerdict(4.2, 'ok')).toBe('approved');
    expect(suggestedVerdict(4, 'none')).toBe('approved');
    expect(suggestedVerdict(3.5, 'ok')).toBe('review');
    expect(suggestedVerdict(2.9, 'ok')).toBe('rejected');
    expect(suggestedVerdict(null, 'ok')).toBeNull();
  });

  it('never approves with the pH out of range', () => {
    expect(suggestedVerdict(4.8, 'high')).toBe('review');
    expect(suggestedVerdict(2, 'low')).toBe('rejected');
  });

  it('lets the taster override the suggestion', () => {
    expect(finalVerdict('rejected', 'approved')).toBe('rejected');
    expect(finalVerdict(null, 'approved')).toBe('approved');
  });

  it('is done when all criteria are scored', () => {
    expect(tastingDone({ tastingScores: { taste: 4, texture: 4 } }, null)).toBe(true);
    expect(tastingDone({ tastingScores: { taste: 4 } }, null)).toBe(false);
    expect(tastingDone(null, null)).toBe(false);
  });
});

describe('rankBest', () => {
  const mk = (id: number, recipeName: string, startedAt: string, taste: number | null, texture = 4) => ({
    id, recipeName, startedAt, recipe: { cheeseType: null as null }, quality: { tastingScores: taste == null ? null : { taste, texture } },
  });
  const rows = [mk(1, 'A', '2026-10-01', 3), mk(2, 'B', '2026-10-02', 5), mk(3, 'A', '2026-10-03', 5), mk(4, 'A', '2026-10-04', null), mk(5, 'B', '2026-10-05', 4)];

  it('ranks by rating then newest, and skips untasted batches', () => {
    expect(rankBest(rows).map(b => b.id)).toEqual([3, 2, 5, 1]);
  });

  it('filters by minimum rating and recipe', () => {
    expect(rankBest(rows, 4.5).map(b => b.id)).toEqual([3, 2]);
    expect(rankBest(rows, 0, 'B').map(b => b.id)).toEqual([2, 5]);
    expect(rankBest(rows, 4.5, 'B').map(b => b.id)).toEqual([2]);
  });
});
