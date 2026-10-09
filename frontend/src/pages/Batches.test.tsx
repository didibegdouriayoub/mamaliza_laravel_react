import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import Batches from './Batches';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: '1', name: 'T' }, hasPermission: () => true }),
}));
vi.mock('@/services/batchService', () => ({
  batchService: { create: vi.fn(), addNote: vi.fn() },
  batchGroupService: { getAll: vi.fn().mockResolvedValue([]), create: vi.fn() },
}));
vi.mock('@/services/qualityService', () => ({ qualityService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/recipeService', () => ({
  recipeService: { getAll: vi.fn().mockResolvedValue([{
    id: 1, name: 'Cheese', target_weight: 10, piece_weight: '500g', recipeStatus: 'final', version: 1, steps: [],
    ingredients: [{ materialId: '1', materialName: 'Milk', quantity: 5, unit: 'kg', unitPrice: 1 }],
  }]) },
}));
vi.mock('@/services/inventoryService', () => ({
  inventoryService: { getAll: vi.fn().mockResolvedValue([
    { id: 1, name: 'Milk', type: 'raw', quantity: 100, unit: 'kg', price: 1, lot: 'L1' },
    { id: 2, name: 'Zinc', type: 'raw', quantity: 3, unit: 'kg', price: 2, lot: 'L9' },
    { id: 3, name: 'Box', type: 'Box', quantity: 50, unit: 'pc', price: 1 },
    { id: 4, name: 'Apple', type: 'raw', quantity: 7, unit: 'kg', price: 1, lot: 'A1' },
  ]) },
}));

beforeAll(() => {
  // jsdom gaps for radix
  (window as any).HTMLElement.prototype.scrollIntoView = vi.fn();
  (window as any).HTMLElement.prototype.hasPointerCapture = vi.fn();
  (window as any).HTMLElement.prototype.releasePointerCapture = vi.fn();
  (window as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

it('batch creation flow', async () => {
  render(<Batches />);
  fireEvent.click(await screen.findByText('New Batch'));

  // recipe select
  fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter' });
  fireEvent.click(await screen.findByRole('option', { name: /Cheese/ }));

  // T22.1: clear and retype
  const count = screen.getByRole('spinbutton') as HTMLInputElement;
  fireEvent.change(count, { target: { value: '' } });
  expect(count.value).toBe('');
  fireEvent.change(count, { target: { value: '3' } });
  expect(count.value).toBe('3');
  fireEvent.click(screen.getByText(/Next/));

  // step 2: 3 batches
  expect(await screen.findByText('Batch #3')).toBeTruthy();

  // T22.4: add ingredient to all batches
  fireEvent.click(screen.getByText(/Add ingredient \(all batches\)/));
  const combos = () => screen.getAllByRole('combobox');
  fireEvent.keyDown(combos()[0], { key: 'Enter' });
  const opts = await screen.findAllByRole('option');
  // T22.2: raw only, A→Z, lot + stock
  expect(opts.map(o => o.textContent)).toEqual([
    expect.stringContaining('Apple · Lot A1 — 7 kg in stock'),
    expect.stringContaining('Milk · Lot L1 — 100 kg in stock'),
    expect.stringContaining('Zinc · Lot L9 — 3 kg in stock'),
  ]);
  fireEvent.click(opts[2]);

  // Zinc row exists in batch 1; type qty 4 -> should propagate
  const zincRow = () => screen.getAllByText('Zinc').map(el => el.closest('div.grid') as HTMLElement);
  const qtyOf = (row: HTMLElement) => row.querySelector('input[type=number]') as HTMLInputElement;
  fireEvent.change(qtyOf(zincRow()[0]), { target: { value: '4' } });

  // open batch 3: Zinc present with qty 4 (propagated)
  fireEvent.click(screen.getByText('Batch #3'));
  await waitFor(() => expect(screen.getAllByText('Zinc').length).toBe(1));
  expect(qtyOf(zincRow()[0]).value).toBe('4');

  // adjust batch 3 to 9 (independent), then batch 1 -> 6: batch 3 stays 9, batch 2 follows 6
  fireEvent.change(qtyOf(zincRow()[0]), { target: { value: '9' } });
  fireEvent.click(screen.getByText('Batch #1'));
  await waitFor(() => expect(qtyOf(zincRow()[0]).value).toBe('4'));
  fireEvent.change(qtyOf(zincRow()[0]), { target: { value: '6' } });
  fireEvent.click(screen.getByText('Batch #3'));
  await waitFor(() => expect(qtyOf(zincRow()[0]).value).toBe('9'));
  fireEvent.click(screen.getByText('Batch #2'));
  await waitFor(() => expect(qtyOf(zincRow()[0]).value).toBe('6'));
});
