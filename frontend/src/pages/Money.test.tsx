import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Recipes from './Recipes';
import Products from './Products';
import FinishedGoods from './FinishedGoods';

const state = vi.hoisted(() => ({ money: true }));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: '1', name: 'T', role: 'operator' },
    hasPermission: (p: string) => (p === 'money.read' ? state.money : true),
  }),
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

vi.mock('@/services/recipeService', () => ({
  recipeService: { getAll: vi.fn().mockResolvedValue([{
    id: 1, name: 'Kroom 100', target_weight: 100, description: '', steps: [''], version: 1,
    ingredients: [{ materialId: 7, materialName: 'Milk', quantity: 50, unit: 'kg', unitPrice: 2 }],
  }]) },
}));
vi.mock('@/services/inventoryService', () => ({
  inventoryService: { getAll: vi.fn().mockResolvedValue([{ id: 7, name: 'Milk', type: 'raw', quantity: 100, unit: 'kg', price: 2 }]) },
}));
vi.mock('@/services/customerService', () => ({ customerService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/orderService', () => ({ orderService: { create: vi.fn() } }));
vi.mock('@/services/finishedProductService', async () => {
  const actual: any = await vi.importActual('@/services/finishedProductService');
  const product = {
    id: 1, name: 'Kroom pot', type: 'piece', unit_price: 45, inputs: [], materials: [], components: [],
    stock: { quantity: 20 }, carton: null, available_lots: [],
  };
  return { ...actual, finishedProductService: { getAll: vi.fn().mockResolvedValue([product]), getStock: vi.fn() } };
});

const hasMoneyText = () => screen.queryAllByText(/DH|MAD|Unit Price|Total stock value|Cost/i).length > 0;

describe.each([[true], [false]])('money visible = %s', (visible) => {
  beforeEach(() => { state.money = visible; });

  it('Recipes: ingredient prices and cost', async () => {
    render(<Recipes />);
    fireEvent.click(await screen.findByText('Kroom 100'));
    await screen.findByText('Milk');
    expect(hasMoneyText()).toBe(visible);
  });

  it('Products: unit price column', async () => {
    render(<MemoryRouter><Products /></MemoryRouter>);
    await screen.findByText('Kroom pot');
    expect(hasMoneyText()).toBe(visible);
  });

  it('Finished Goods: card prices and stock value', async () => {
    render(<MemoryRouter><FinishedGoods /></MemoryRouter>);
    await screen.findByText('Kroom pot');
    expect(hasMoneyText()).toBe(visible);
  });
});
