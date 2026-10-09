import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Recipes from './Recipes';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: '1', name: 'T' }, hasPermission: () => true }) }));
vi.mock('@/services/recipeService', () => ({
  recipeService: { getAll: vi.fn().mockResolvedValue([{
    id: 1, name: 'Kroom', target_weight: 100, piece_weight: '1.8kg', description: '', steps: [''],
    // API returns numeric ids; one material is not a raw item
    ingredients: [
      { materialId: 7, materialName: 'Salt', quantity: 1, unit: 'kg', unitPrice: 2 },
      { materialId: 9, materialName: 'Old leftover', quantity: 2, unit: 'kg', unitPrice: 0 },
    ],
  }]) },
}));
vi.mock('@/services/inventoryService', () => ({
  inventoryService: { getAll: vi.fn().mockResolvedValue([
    { id: 7, name: 'Salt', type: 'raw', quantity: 5, unit: 'kg', price: 2 },
    { id: 9, name: 'Old leftover', type: 'leftover', quantity: 1, unit: 'kg', price: 0 },
  ]) },
}));

beforeAll(() => {
  (window as any).HTMLElement.prototype.scrollIntoView = vi.fn();
  (window as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

it('edit recipe shows ingredient names', async () => {
  render(<Recipes />);
  fireEvent.click(await screen.findByText('Kroom'));
  fireEvent.click(await screen.findByText('Edit'));
  const combos = await screen.findAllByRole('combobox');
  const texts = combos.map(c => c.textContent);
  expect(texts).toContain('Salt (DH2/kg)');
  expect(texts).toContain('Old leftover');
});
