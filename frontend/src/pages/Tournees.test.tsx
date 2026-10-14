import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import Tournees from './Tournees';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: '1', name: 'T' }, hasPermission: () => true }) }));
vi.mock('@/services/finishedProductService', () => ({
  fridgeTotal: () => 0,
  finishedProductService: { getAll: vi.fn().mockResolvedValue([]) },
}));
vi.mock('@/services/customerService', () => ({ customerService: { getAll: vi.fn().mockResolvedValue([]) } }));
vi.mock('@/services/orderService', () => ({ orderService: { getById: vi.fn(), delete: vi.fn() } }));
vi.mock('@/services/tourneeService', async (orig) => ({
  ...(await orig<any>()),
  tourneeService: {
    getAll: vi.fn().mockResolvedValue([{
      id: 1, worker_name: 'Ali', date: '2026-10-14', status: 'open', notes: null, orders: [],
      items: [{ id: 1, finished_product_id: 6, product_name: 'kroom 1.8', lot_id: 3, lot_code: 'TA261006KRO', lot_date: '2026-10-06',
        qty_loaded: 40, qty_delivered: 15, qty_returned: 0, qty_lost: 0, qty_remaining: 25 }],
    }]),
  },
}));

beforeAll(() => {
  (window as any).HTMLElement.prototype.scrollIntoView = vi.fn();
  (window as any).ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
});

it('shows a tournée with loaded, given and left, and its detail', async () => {
  render(<Tournees />);
  fireEvent.click(await screen.findByText('Ali'));
  expect(await screen.findByText('kroom 1.8')).toBeTruthy();
  expect(screen.getByText('Add a customer')).toBeTruthy();
  expect(screen.getByText('Close tournée')).toBeTruthy();
  expect(screen.getAllByText('25').length).toBeGreaterThan(0); // left with the worker
});
