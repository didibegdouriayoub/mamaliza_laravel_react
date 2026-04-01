import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Package, Factory, ShoppingCart, AlertTriangle, CalendarDays,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { KpiCard } from '@/components/KpiCard';
import { BatchStatusBadge } from '@/components/StatusBadge';
import { TableSkeleton } from '@/components/DataStates';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import { inventoryService } from '@/services/inventoryService';
import { batchService, batchGroupService } from '@/services/batchService';
import { orderService } from '@/services/orderService';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [totalSales, setTotalSales] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [completedBatches, setCompletedBatches] = useState(0);
  const [activeBatchesCount, setActiveBatchesCount] = useState(0);
  const [inventoryCount, setInventoryCount] = useState(0);
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  const [salesChartData, setSalesChartData] = useState<{ month: string; sales: number }[]>([]);
  const [batchChartData, setBatchChartData] = useState<{ month: string; completed: number; failed: number }[]>([]);
  const [lossDate, setLossDate] = useState(new Date().toISOString().split('T')[0]);
  const [lossChartData, setLossChartData] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [inv, bts, ord, grps] = await Promise.all([
          inventoryService.getAll(),
          batchService.getAll(),
          orderService.getAll(),
          batchGroupService.getAll(),
        ]);
        setGroups(grps || []);
        const sales = (ord || []).reduce((s: number, o: any) => s + (Number(o.totalAmount) || 0), 0);
        setTotalSales(sales);
        const low = (inv || []).filter((i: any) => i.quantity <= i.minStock).length;
        setLowStockCount(low);
        setInventoryCount((inv || []).length);
        const active = (bts || []).filter((b: any) => b.status === 'in_production').length;
        const comp = (bts || []).filter((b: any) => b.status === 'completed').length;
        setActiveBatchesCount(active);
        setCompletedBatches(comp);
        setRecentBatches((bts || []).slice(0, 4));

        // Build sales chart: last 6 months grouped by createdAt
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        const salesByMonth: Record<string, number> = {};
        (ord || []).forEach((o: any) => {
          const d = new Date(o.createdAt || o.created_at);
          if (!isNaN(d.getTime())) {
            const key = monthNames[d.getMonth()];
            salesByMonth[key] = (salesByMonth[key] || 0) + (Number(o.totalAmount) || 0);
          }
        });
        const last6 = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
          return monthNames[d.getMonth()];
        });
        setSalesChartData(last6.map(m => ({ month: m, sales: Math.round(salesByMonth[m] || 0) })));

        // Build batch chart: last 6 months grouped by startedAt
        const batchByMonth: Record<string, { completed: number; failed: number }> = {};
        (bts || []).forEach((b: any) => {
          const d = new Date(b.startedAt || b.started_at);
          if (!isNaN(d.getTime())) {
            const key = monthNames[d.getMonth()];
            if (!batchByMonth[key]) batchByMonth[key] = { completed: 0, failed: 0 };
            if (b.status === 'completed') batchByMonth[key].completed++;
            if (b.status === 'failed') batchByMonth[key].failed++;
          }
        });
        setBatchChartData(last6.map(m => ({ month: m, completed: batchByMonth[m]?.completed || 0, failed: batchByMonth[m]?.failed || 0 })));

      } catch (e) { console.error(e); }
      setLoading(false);
    };
    loadData();
  }, []);

  useEffect(() => {
    const dateGroups = (groups || []).filter((g: any) => {
      const d = (g.createdAt ?? g.created_at ?? '').split('T')[0];
      return d === lossDate;
    });
    const byRecipe: Record<string, { produced: number; leftover: number; loss: number }> = {};
    dateGroups.forEach((g: any) => {
      const recipe = g.recipeName ?? g.recipe_name ?? '';
      if (!byRecipe[recipe]) byRecipe[recipe] = { produced: 0, leftover: 0, loss: 0 };
      const produced = (g.piecesProduced ?? g.pieces_produced ?? 0) * (g.pieceWeightValue ?? g.piece_weight_value ?? 1);
      const leftover = g.leftoverQty ?? g.leftover_qty ?? 0;
      const expected = (g.targetWeight ?? g.target_weight ?? 0) * (g.batchCount ?? g.batch_count ?? 0);
      const loss = expected - produced + leftover;
      byRecipe[recipe].produced += produced;
      byRecipe[recipe].leftover += leftover;
      byRecipe[recipe].loss = Math.max(0, byRecipe[recipe].loss + loss);
    });
    setLossChartData(Object.entries(byRecipe).map(([recipe, v]) => ({ recipe, ...v })));
  }, [groups, lossDate]);

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
        <KpiCard title="Active Batches" value={activeBatchesCount} subtitle={`${completedBatches} completed this month`} icon={Factory} index={1} />
        <KpiCard title="Inventory Items" value={inventoryCount} icon={Package} index={2} />
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
              {recentBatches.map(batch => (
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

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
        <Card className="shadow-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Factory className="h-4 w-4" /> Production Loss by Recipe
              </CardTitle>
              <div className="relative">
                <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="date" className="pl-9 h-8 text-sm w-44" value={lossDate} onChange={e => setLossDate(e.target.value)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {lossChartData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">No batch groups found for {lossDate}. Create batches and fill their details to see loss data.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={lossChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="recipe" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                  <YAxis tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(var(--border))', background: 'hsl(var(--card))' }} />
                  <Legend />
                  <Bar dataKey="produced" name="Produced (kg)" fill="hsl(142, 45%, 42%)" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="leftover" name="Leftover (kg)" fill="hsl(45, 90%, 55%)" radius={[0, 0, 0, 0]} stackId="a" />
                  <Bar dataKey="loss" name="Loss (kg)" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
