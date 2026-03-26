import { apiClient } from '../lib/apiClient';
import { Order } from '../models/types';

const toPayload = (o: Partial<Order>) => ({
  customer_id: o.customerId,
  customer_name: o.customerName,
  total_amount: o.totalAmount,
  amount_paid: o.amountPaid,
  amount_returned: o.amountReturned,
  status: o.status,
  paid_at: o.paidAt,
  items: o.items,
});

export const orderService = {
  getAll: () => apiClient.get('/orders'),
  getById: (id: string | number) => apiClient.get(`/orders/${id}`),
  create: (order: Partial<Order>) => apiClient.post('/orders', toPayload(order)),
  update: (id: string | number, order: Partial<Order>) => apiClient.put(`/orders/${id}`, toPayload(order)),
  delete: (id: string | number) => apiClient.delete(`/orders/${id}`),
  addPayment: (id: string | number, payment: any) => apiClient.post(`/orders/${id}/payments`, payment),
  addReturn: (id: string | number, ret: any) => apiClient.post(`/orders/${id}/returns`, ret),
  patchStatus: (id: string | number, status: string) => apiClient.patch(`/orders/${id}/status`, { status }),
};
