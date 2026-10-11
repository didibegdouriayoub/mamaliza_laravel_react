import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import ByProduct from './ByProduct';

vi.mock('@/lib/printDocument', () => ({ printDocument: vi.fn(), fmtDate: (d: string) => d, fmtEur: (n: number) => String(n) }));
vi.mock('@/services/recipeService', () => ({
  recipeService: { getAll: vi.fn().mockResolvedValue([{
    id: 1, name: 'Kroom 100', target_weight: 100,
    ingredients: [{ materialId: 7, materialName: 'Milk', quantity: 50, unit: 'kg', unitPrice: 2 }],
  }]) },
}));
vi.mock('@/services/inventoryService', () => ({
  inventoryService: { getAll: vi.fn().mockResolvedValue([
    { id: 7, name: 'Milk', unit: 'kg', quantity: 80, price: 2, supplier: 'Laiterie', leadTimeDays: 2 },
    { id: 8, name: 'Lid', unit: 'pc', quantity: 1000, price: 0.5, supplier: 'Pack', leadTimeDays: 0 },
  ]) },
}));
vi.mock('@/services/finishedProductService', async () => {
  const actual: any = await vi.importActual('@/services/finishedProductService');
  const products = [
    { id: 1, name: 'Kroom pot', type: 'piece', unit_price: 45, stock: { quantity: 0 }, available_lots: [], carton: { box_id: 2, box_name: 'caisse', qty_per_box: 6, sealed: 0 },
      inputs: [{ recipe_id: 1, kg_per_piece: 0.4 }], materials: [{ inventory_item_id: 8, qty_per_piece: 1, inventory_item: { name: 'Lid', unit: 'pc' } }], components: [] },
    { id: 2, name: 'caisse', type: 'box', unit_price: 240, stock: { quantity: 0 }, available_lots: [], carton: null, inputs: [], materials: [], components: [{ component_id: 1, qty_per_box: 6 }] },
  ];
  return { ...actual, finishedProductService: { getAll: vi.fn().mockResolvedValue(products) } };
});

beforeAll(() => {
  (window as any).HTMLElement.prototype.scrollIntoView = vi.fn();
  (window as any).HTMLElement.prototype.hasPointerCapture = vi.fn();
  (window as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

it('product + quantity -> dough, whole batches, ingredients, packaging and what to buy', async () => {
  render(<ByProduct />);

  // pick the product (its only recipe is chosen for you)
  fireEvent.keyDown((await screen.findAllByRole('combobox'))[0], { key: 'Enter' });
  fireEvent.click(await screen.findByRole('option', { name: 'Kroom pot' }));
  await waitFor(() => expect(screen.getAllByRole('combobox')[2].textContent).toMatch(/Kroom 100/));

  fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '450' } });

  expect(await screen.findByText(/Wanted/)).toBeTruthy();
  const line = screen.getByText(/Wanted/).textContent!;
  expect(line).toMatch(/make 450 pcs/);
  expect(line).toMatch(/dough 180 kg/);

  // batches table: 2 whole batches of 100 kg, 20 kg surplus
  const batches = (await screen.findByText('Batches to make')).closest('div.rounded-lg, div[class*="card"]') as HTMLElement;
  expect(within(batches).getByText('2')).toBeTruthy();
  expect(within(batches).getByText(/20 kg/)).toBeTruthy();

  // what to buy: milk is short by 20 kg, from its supplier
  const buy = (await screen.findByText('What to buy')).closest('div[class*="border-amber"]') as HTMLElement;
  expect(within(buy).getByText('Milk')).toBeTruthy();
  expect(within(buy).getByText('Laiterie')).toBeTruthy();
  expect(within(buy).getByText(/^20 kg$/)).toBeTruthy();

  // packaging comes from the product: 450 lids
  expect(screen.getByText('450 pc')).toBeTruthy();
});
