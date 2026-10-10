import { render, screen, fireEvent, within } from '@testing-library/react';
import { vi } from 'vitest';
import Finishing from './Finishing';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/apiClient', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue([
      { id: 11, recipeId: 1, recipeName: 'Kroom', batchCount: 3, targetWeight: 100, createdAt: '2026-08-06T10:00:00Z', batches: [{ startedAt: '2026-08-06' }] },
      { id: 12, recipeId: 1, recipeName: 'Kroom', batchCount: 3, targetWeight: 100, createdAt: '2026-08-07T10:00:00Z', batches: [{ startedAt: '2026-08-07' }] },
    ]),
  },
}));
vi.mock('@/services/finishingLogService', () => ({
  finishingLogService: { getAll: vi.fn().mockResolvedValue([]), create: vi.fn(), delete: vi.fn() },
}));
vi.mock('@/services/finishedProductService', () => ({
  finishedProductService: {
    getAll: vi.fn().mockResolvedValue([{
      id: 1, name: 'Kroom rectangulaire', type: 'piece', unit_price: 1, lot_prefix: 'TA', lot_letters: 'KRM',
      inputs: [{ recipe_id: 1, kg_per_piece: 0 }], materials: [], components: [], carton: null,
    }]),
  },
}));

beforeAll(() => {
  (window as any).HTMLElement.prototype.scrollIntoView = vi.fn();
  (window as any).HTMLElement.prototype.hasPointerCapture = vi.fn();
  (window as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

const pick = async (combo: HTMLElement, name: RegExp, index = 0) => {
  fireEvent.keyDown(combo, { key: 'Enter' });
  fireEvent.click((await screen.findAllByRole('option', { name }))[index]);
};

it('suggests the lot code: one batch -> its date, several -> today', async () => {
  render(<Finishing />);
  await pick((await screen.findAllByRole('combobox'))[0], /Kroom rectangulaire/);

  // one source batch group dated 6 Aug 2026
  await pick(screen.getAllByRole('combobox')[1], /Kroom — .*batches/);
  const input = (await screen.findByPlaceholderText('TA260806KRO')) as HTMLInputElement;
  expect(input.value).toBe('TA260806KRM');

  // a second source -> today's date
  fireEvent.click(screen.getByText('Add batch source'));
  await pick(screen.getAllByRole('combobox')[2], /Kroom — .*batches/, 1);
  const today = new Date().toLocaleDateString('sv');
  const expected = `TA${today.slice(2, 4)}${today.slice(5, 7)}${today.slice(8, 10)}KRM`;
  expect((screen.getByPlaceholderText('TA260806KRO') as HTMLInputElement).value).toBe(expected);

  // manual edit sticks even when sources change
  fireEvent.change(input, { target: { value: 'ta260101abc' } });
  expect(input.value).toBe('TA260101ABC');
});
