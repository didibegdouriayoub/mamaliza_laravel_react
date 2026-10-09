import { splitKg } from './doughSplit';

describe('splitKg', () => {
  it('fills the oldest group first, the last takes the rest', () => {
    expect(splitKg(250, [{ id: 'a', capacity: 100 }, { id: 'b', capacity: 100 }, { id: 'c', capacity: 100 }]))
      .toEqual({ a: 100, b: 100, c: 50 });
  });
  it('allows going over the target on the last group (gain)', () => {
    expect(splitKg(130, [{ id: 'a', capacity: 100 }, { id: 'b', capacity: 20 }])).toEqual({ a: 100, b: 30 });
  });
  it('single group takes everything; zero when nothing needed', () => {
    expect(splitKg(80, [{ id: 'a', capacity: 100 }])).toEqual({ a: 80 });
    expect(splitKg(0, [{ id: 'a', capacity: 100 }])).toEqual({ a: 0 });
  });
});
