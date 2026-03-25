import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: string; positive: boolean };
  index?: number;
}

export function KpiCard({ title, value, subtitle, icon: Icon, trend, index = 0 }: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.3 }}
    >
      <Card className="shadow-card hover:shadow-elevated transition-shadow">
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{title}</p>
              <p className="text-2xl font-display font-bold">{value}</p>
              {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
              {trend && (
                <p className={`text-xs font-medium ${trend.positive ? 'text-success' : 'text-destructive'}`}>
                  {trend.positive ? '↑' : '↓'} {trend.value}
                </p>
              )}
            </div>
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
