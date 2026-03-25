import { Order, Payment, ReturnItem } from '@/models/types';
import { mockOrders } from '@/data/mockData';

let orders = [...mockOrders];
const delay = (ms = 300) => new Promise(r => setTimeout(r, ms));

export const orderService = {
  async getAll(): Promise<Order[]> { await delay(); return [...orders]; },
  async getById(id: string): Promise<Order | undefined> { await delay(); return orders.find(o => o.id === id); },
  async addPayment(orderId: string, payment: Omit<Payment, 'id'>): Promise<void> {
    await delay();
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('Order not found');
    const newPayment: Payment = { ...payment, id: `p${Date.now()}` };
    order.payments.push(newPayment);
    order.amountPaid += payment.amount;
    if (order.amountPaid >= order.totalAmount) {
      order.status = 'paid';
      order.paidAt = new Date().toISOString().split('T')[0];
    } else {
      order.status = 'partial';
    }
  },
  async addReturn(orderId: string, ret: Omit<ReturnItem, 'id'>): Promise<void> {
    await delay();
    const order = orders.find(o => o.id === orderId);
    if (!order) throw new Error('Order not found');
    const newReturn: ReturnItem = { ...ret, id: `ret${Date.now()}` };
    order.returns.push(newReturn);
    order.amountReturned += ret.refundAmount;
  },
};
