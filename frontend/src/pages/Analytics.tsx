import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Factory, ShoppingCart } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { KpiCard } from '@/components/KpiCard';
import { salesChartData, batchChartData } from '@/data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { useState, useEffect } from 'react';
import { batchService } from '@/services/batchService';
import { orderService } from '@/services/orderService';
import { recipeService } from '@/services/recipeService';

const COLORS = ['hsl(152, 45%, 42%)', 'hsl(38, 92%, 50%)', 'hsl(210, 70%, 52%)', 'hsl(0, 72%, 51%)'];

export default function Analytics() {
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [successRate, setSuccessRate] = useState(0);
  const [activeRecipes, setActiveRecipes] = useState(0);
  const [recipeUsage, setRecipeUsage] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [ord, bts, rec] = await Promise.all([
          orderService.getAll(),
          batchService.getAll(),
          recipeService.getAll()
        ]);
        const rev = (ord || []).reduce((s: number, o: any) => s + (Number(o.totalAmount) || 0), 0);
        setTotalRevenue(rev);
        const completed = (bts || []).filter((b: any) => b.status === 'completed').length;
        const sr = (bts || []).length > 0 ? Math.round((completed / bts.length) * 100) : 0;
        setSuccessRate(sr);
        setActiveRecipes((rec || []).length);
        
        const usage = (rec || []).map((r: any) => ({
          name: r.name,
          batches: (bts || []).filter((b: any) => String(b.recipeId) === String(r.id)).length,
        }));
        setRecipeUsage(usage);
      } catch (e) {}
    };
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><BarChart3 className="h-6 w-6" /> Analytics</h1>
        <p className="text-sm text-muted-foreground">Deep dive into your production and sales performance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KpiCard title="Total Revenue" value={`€${totalRevenue}`} icon={ShoppingCart} index={0} />
        <KpiCard title="Batch Success Rate" value={`${successRate}%`} icon={Factory} index={1} />
        <KpiCard title="Active Recipes" value={activeRecipes} icon={TrendingUp} index={2} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-base font-display">Revenue Trend</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={salesChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 18%, 89%)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(160, 8%, 48%)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="hsl(160, 8%, 48%)" />
                  <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(40, 18%, 89%)' }} />
                  <Line type="monotone" dataKey="sales" stroke="hsl(152, 32%, 38%)" strokeWidth={2} dot={{ fill: 'hsl(152, 32%, 38%)', r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-base font-display">Recipe Usage</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={recipeUsage} dataKey="batches" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, batches }) => `${name}: ${batches}`}>
                    {recipeUsage.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <Card className="shadow-card">
          <CardHeader className="pb-2"><CardTitle className="text-base font-display">Batch Performance by Month</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={batchChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(40, 18%, 89%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(160, 8%, 48%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(160, 8%, 48%)" />
                <Tooltip contentStyle={{ borderRadius: '0.75rem', border: '1px solid hsl(40, 18%, 89%)' }} />
                <Bar dataKey="completed" fill="hsl(152, 45%, 42%)" radius={[4, 4, 0, 0]} name="Completed" />
                <Bar dataKey="failed" fill="hsl(0, 72%, 51%)" radius={[4, 4, 0, 0]} name="Failed" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
