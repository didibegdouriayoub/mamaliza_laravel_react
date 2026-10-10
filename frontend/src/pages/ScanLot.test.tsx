import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ScanLot from './ScanLot';
import { lotTraceService } from '@/services/lotTraceService';

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/services/finishedProductService', () => ({
  finishedProductService: { getAll: vi.fn().mockResolvedValue([{ lot_prefix: 'TA', lot_letters: 'KRM' }]) },
}));
vi.mock('@/services/lotTraceService', () => ({ lotTraceService: { get: vi.fn() } }));

const trace = {
  lot_code: 'TA260806KRM', production_date: '2026-08-06', products: ['Kroom rectangulaire'], traceable: true,
  runs: [{
    id: 1, date: '2026-08-06', product: 'Kroom rectangulaire', pieces: 40, operator: 'ayoub',
    sources: [
      { batch_group_id: 1, recipe: 'Kroom 100', date: '2026-08-05', kg_used: 60, share_percent: 75,
        batches: [{ id: 1, lot: 'KRO-05082026-001', status: 'completed', started_at: '2026-08-05', output: '100', output_unit: 'kg',
          ingredients: [{ name: 'Milk', quantity: 50, unit: 'kg', lot: 'M-1' }] }] },
      { batch_group_id: 2, recipe: 'Kroom 150', date: '2026-08-06', kg_used: 20, share_percent: 25, batches: [] },
    ],
  }],
  buyers: [{ order_id: 9, date: '2026-08-10', customer: 'Hotel Atlas', phone: '0600', items: [{ product: 'Kroom rectangulaire', quantity: 12 }] }],
};

it('rejects an invalid code without calling the backend', () => {
  render(<ScanLot />);
  fireEvent.change(screen.getByPlaceholderText('TA260806KP'), { target: { value: 'T123' } });
  fireEvent.click(screen.getByText('Look up'));
  expect(lotTraceService.get).not.toHaveBeenCalled();
});

it('shows the result screen for a found lot', async () => {
  (lotTraceService.get as any).mockResolvedValueOnce(trace);
  render(<ScanLot />);
  fireEvent.change(screen.getByPlaceholderText('TA260806KP'), { target: { value: 'ta 260806 krm' } });
  fireEvent.click(screen.getByText('Look up'));
  expect(await screen.findByText('TA260806KRM')).toBeTruthy();
  expect(lotTraceService.get).toHaveBeenCalledWith('TA260806KRM');
  expect(screen.getByText('06-08-2026')).toBeTruthy();          // production date
  expect(screen.getByText('Milk')).toBeTruthy();                // ingredient
  expect(screen.getByText('M-1')).toBeTruthy();                 // its supplier lot
  expect(screen.getByText(/Kroom 150/)).toBeTruthy();           // second source batch
  expect(screen.getByText(/Hotel Atlas/)).toBeTruthy();         // buyer
});

it('shows the backend message when nothing is found', async () => {
  (lotTraceService.get as any).mockRejectedValueOnce(new Error('No production found for this lot code.'));
  render(<ScanLot />);
  fireEvent.change(screen.getByPlaceholderText('TA260806KP'), { target: { value: 'TA260806KRM' } });
  fireEvent.click(screen.getByText('Look up'));
  await waitFor(() => expect(screen.getByText('No production found for this lot code.')).toBeTruthy());
});
