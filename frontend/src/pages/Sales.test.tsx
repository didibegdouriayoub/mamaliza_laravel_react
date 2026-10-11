import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { vi } from 'vitest';
import Sales from './Sales';
import { orderService } from '@/services/orderService';
import { printDocument } from '@/lib/printDocument';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: '1', name: 'T' }, hasPermission: () => true }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/lib/printDocument', () => ({ printDocument: vi.fn(), fmtDate: (d: string) => String(d).slice(0, 10), fmtEur: (n: number) => String(n) }));
vi.mock('@/services/customerService', () => ({ customerService: { getAll: vi.fn().mockResolvedValue([{ id: 1, name: 'Hotel Atlas', address: 'Tanger' }]) } }));
vi.mock('@/services/finishedProductService', () => ({ finishedProductService: { getAll: vi.fn().mockResolvedValue([]) } }));

const item = { productName: 'Kroom pot', quantity: 6, unitPrice: 10, total: 60, finishedProductId: 3 };
const orders = [
  { id: 1, docNumber: 'FA-2026-0001', documentType: 'facture', customerId: 1, customerName: 'Hotel Atlas', totalAmount: 100, amountPaid: 0, amountReturned: 0, status: 'pending', createdAt: '2026-10-05', items: [item], payments: [], returns: [] },
  { id: 2, docNumber: 'FA-2026-0002', documentType: 'facture', customerId: 2, customerName: 'Cafe Paid', totalAmount: 50, amountPaid: 50, amountReturned: 0, status: 'paid', createdAt: '2026-10-06', items: [item], payments: [], returns: [] },
  { id: 3, docNumber: 'FA-2026-0003', documentType: 'facture', customerId: 1, customerName: 'Hotel Atlas', totalAmount: 40, amountPaid: 10, amountReturned: 0, status: 'partial', createdAt: '2026-10-07', items: [item], payments: [], returns: [] },
  { id: 4, docNumber: 'DV-2026-0001', documentType: 'devis', customerId: 5, customerName: 'Future Client', totalAmount: 80, amountPaid: 0, amountReturned: 0, status: 'pending', createdAt: '2026-10-08', items: [item], payments: [], returns: [] },
];

vi.mock('@/services/orderService', () => ({
  orderService: {
    getAll: vi.fn(),
    addPayment: vi.fn().mockResolvedValue({}),
    convert: vi.fn().mockResolvedValue({ id: 9, docNumber: 'FA-2026-0004' }),
    create: vi.fn(), delete: vi.fn(), addReturn: vi.fn(),
  },
}));

const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole('tab', { name }), { button: 0 });

beforeEach(() => {
  vi.clearAllMocks();
  (orderService.getAll as any).mockResolvedValue(orders);
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

it('keeps factures and devis in their own tabs', async () => {
  render(<Sales />);
  expect(await screen.findByText('FA-2026-0001')).toBeTruthy();
  expect(screen.queryByText('DV-2026-0001')).toBeNull();

  openTab(/Devis/);
  expect(await screen.findByText('DV-2026-0001')).toBeTruthy();
  expect(screen.queryByText('FA-2026-0001')).toBeNull();
  expect(screen.getByText('Open')).toBeTruthy();
});

it('lists who owes money, per customer, and pays a facture in full in one click', async () => {
  render(<Sales />);
  await screen.findByText('FA-2026-0001');
  openTab(/Who owes me/);

  // Hotel Atlas owes 100 + (40 - 10) = 130; the paid cafe and the devis are not listed
  const group = (await screen.findByText('Hotel Atlas')).closest('div.rounded-lg') as HTMLElement;
  expect(within(group).getByText(/DH130/)).toBeTruthy();
  expect(screen.queryByText('Cafe Paid')).toBeNull();
  expect(screen.queryByText('Future Client')).toBeNull();

  fireEvent.click(within(group).getAllByText('Paid in full')[0]);
  await waitFor(() => expect(orderService.addPayment).toHaveBeenCalledWith(1, expect.objectContaining({ amount: 100, method: 'Cash' })));
});

it('converts a devis to a facture', async () => {
  render(<Sales />);
  await screen.findByText('FA-2026-0001');
  openTab(/Devis/);
  fireEvent.click(await screen.findByText('DV-2026-0001'));
  fireEvent.click(await screen.findByText('Convert to facture'));
  await waitFor(() => expect(orderService.convert).toHaveBeenCalledWith(4));
});

it('prints a delivery note without prices and an invoice with them', async () => {
  render(<Sales />);
  fireEvent.click(await screen.findByText('FA-2026-0001'));

  fireEvent.click(await screen.findByText('Delivery note'));
  const bl = (printDocument as any).mock.calls[0][1] as string;
  expect(bl).toContain('FA-2026-0001');
  expect(bl).toContain('Kroom pot');
  expect(bl).not.toContain('Total HT');
  expect(bl).not.toContain('P.U. HT');

  fireEvent.click(screen.getByText('Print Invoice'));
  const fa = (printDocument as any).mock.calls[1][1] as string;
  expect(fa).toContain('Total TTC');
  expect(fa).toContain('FACTURE');
});
