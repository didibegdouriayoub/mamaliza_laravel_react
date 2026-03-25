import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Package, Factory, ShoppingCart, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/KpiCard';
import { BatchStatusBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/DataStates';
import {
  mockInventory, mockBatches, mockOrders, salesChartData, batchChartData,
} from '@/data/mockData';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 600);
    return () => clearTimeout(t);
  }, []);

  const totalSales = mockOrders.reduce((s, o) => s + o.totalAmount, 0);
  const lowStockCount = mockInventory.filter(i => i.quantity <= i.minStock).length;
  const completedBatches = mockBatches.filter(b => b.status === 'completed').length;
  const activeBatches = mockBatches.filter(b => b.status === 'in_production').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><TableSkeleton rows={1} cols={1} /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Overview of your cheese factory operations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Total Sales" value={`€${totalSales.toLocaleString()}`} icon={ShoppingCart} trend={{ value: '12% vs last month', positive: true }} index={0} />
        <KpiCard title="Active Batches" value={activeBatches} subtitle={`${completedBatches} completed this month`} icon={Factory} index={1} />
        <KpiCard title="Inventory Items" value={mockInventory.length} icon={Package} index={2} />
        <KpiCard title="Low Stock Alerts" value={lowStockCount} subtitle="Items need restocking" icon={AlertTriangle} index={3} trend={lowStockCount > 0 ? { value: `${lowStockCount} items`, positive: false } : undefined} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Sales Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Line type="monotone" dataKey="sales" stroke="hsl(0, 72%, 51%)" strokeWidth={2} dot={{ fill: 'hsl(0, 72%, 51%)', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          <Card className="shadow-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-display">Batch Performance</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={batchChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Bar dataKey="completed" fill="hsl(142, 45%, 42%)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="failed" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Factory className="h-4 w-4" /> Recent Batches
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockBatches.slice(0, 4).map(batch => (
                <div key={batch.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{batch.recipeName}</p>
                    <p className="text-xs text-muted-foreground">Started {batch.startedAt}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    {batch.qualityScore && <span className="text-sm font-medium">⭐ {batch.qualityScore}</span>}
                    <BatchStatusBadge status={batch.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
