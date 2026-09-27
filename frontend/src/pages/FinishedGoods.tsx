import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Warehouse } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { TableSkeleton, EmptyState } from '@/components/DataStates';
import { finishedProductService, FinishedProduct } from '@/services/finishedProductService';

export default function FinishedGoods() {
  const [products, setProducts] = useState<FinishedProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    finishedProductService.getAll()
      .then(data => setProducts(data || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Warehouse className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-display font-bold">Finished Goods Stock</h1>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? <TableSkeleton cols={5} rows={4} /> : products.length === 0 ? (
            <EmptyState title="No products defined" description="Create products first in the Products page." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Unit Price</TableHead>
                  <TableHead>Stock (pcs)</TableHead>
                  <TableHead>Stock Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map(p => {
                  const qty = p.stock?.quantity ?? 0;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>
                        <Badge variant={p.type === 'box' ? 'default' : 'secondary'}>{p.type}</Badge>
                      </TableCell>
                      <TableCell>{p.unit_price.toFixed(2)} DH</TableCell>
                      <TableCell>
                        <span className={`font-semibold ${qty === 0 ? 'text-destructive' : qty < 10 ? 'text-amber-600' : 'text-green-600'}`}>
                          {qty}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {(qty * p.unit_price).toFixed(2)} DH
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Total row */}
      {products.length > 0 && (
        <div className="text-right text-sm text-muted-foreground pr-4">
          Total stock value:{' '}
          <strong className="text-foreground text-base">
            {products.reduce((sum, p) => sum + (p.stock?.quantity ?? 0) * p.unit_price, 0).toFixed(2)} DH
          </strong>
        </div>
      )}
    </motion.div>
  );
}
