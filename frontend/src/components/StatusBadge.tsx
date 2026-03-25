import { Badge } from '@/components/ui/badge';
import { BatchStatus, OrderStatus } from '@/models/types';

const batchStatusConfig: Record<BatchStatus, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-muted text-muted-foreground' },
  in_production: { label: 'In Production', className: 'bg-info text-info-foreground' },
  completed: { label: 'Completed', className: 'bg-success text-success-foreground' },
  failed: { label: 'Failed', className: 'bg-destructive text-destructive-foreground' },
};

const orderStatusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-warning text-warning-foreground' },
  partial: { label: 'Partial', className: 'bg-info text-info-foreground' },
  paid: { label: 'Paid', className: 'bg-success text-success-foreground' },
  shipped: { label: 'Shipped', className: 'bg-info text-info-foreground' },
  cancelled: { label: 'Cancelled', className: 'bg-destructive text-destructive-foreground' },
};

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const config = batchStatusConfig[status];
  return <Badge className={config.className}>{config.label}</Badge>;
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const config = orderStatusConfig[status];
  return <Badge className={config.className}>{config.label}</Badge>;
}

export function StockBadge({ quantity, minStock }: { quantity: number; minStock: number }) {
  const isLow = quantity <= minStock;
  return (
    <Badge className={isLow ? 'bg-warning text-warning-foreground' : 'bg-success/10 text-success'}>
      {isLow ? '⚠ Low' : 'OK'}
    </Badge>
  );
}
