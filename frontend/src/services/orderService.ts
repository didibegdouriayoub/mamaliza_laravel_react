import { apiClient } from '../lib/apiClient';
import { Order } from '../models/types';

const toPayload = (o: Partial<Order> & { document_type?: string }) => ({
  customer_id: o.customerId,
  customer_name: o.customerName,
  total_amount: o.totalAmount,
  amount_paid: o.amountPaid,
  amount_returned: o.amountReturned,
  status: o.status,
  document_type: o.document_type,
  paid_at: o.paidAt,
  items: o.items,
});

export const orderService = {
  getAll: () => apiClient.get('/orders'),
  getById: (id: string | number) => apiClient.get(`/orders/${id}`),
  create: (order: Partial<Order>) => apiClient.post('/orders', toPayload(order)),
  update: (id: string | number, order: Partial<Order>) => apiClient.put(`/orders/${id}`, toPayload(order)),
  delete: (id: string | number) => apiClient.delete(`/orders/${id}`),
  // T12.7.3+T12.7.4: normalise method to lowercase enum and use correct field names
  addPayment: (id: string | number, payment: { amount: number; method: string; date: string }) =>
    apiClient.post(`/orders/${id}/payments`, {
      amount: payment.amount,
      method: payment.method.toLowerCase().replace(' ', '_'),
      paid_at: payment.date,
    }),
  addReturn: (id: string | number, ret: any) =>
    apiClient.post(`/orders/${id}/returns`, {
      product_name: ret.productName,
      order_item_id: ret.orderItemId ?? null,
      finished_product_id: ret.finishedProductId ?? null,
      quantity: ret.quantity,
      reason: ret.reason,
      refund_amount: ret.refundAmount,
      disposition: ret.disposition ?? null,
    }),
  patchStatus: (id: string | number, status: string) => apiClient.patch(`/orders/${id}/status`, { status }),
};
