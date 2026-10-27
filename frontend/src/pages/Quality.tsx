import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, ChevronRight, CalendarDays } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { batchQualityService, QualityBatch } from '@/services/batchQualityService';
import { phStatus, productionDone } from '@/lib/batchQuality';
import { EmptyState, TableSkeleton } from '@/components/DataStates';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatDate';

// Stage chip: done (green), to do (amber), or not available yet (muted)
function Chip({ label, state, detail }: { label: string; state: 'done' | 'todo' | 'soon' | 'warn'; detail?: string }) {
  const cls = {
    done: 'bg-green-50 text-green-700 border-green-200',
    warn: 'bg-red-50 text-red-700 border-red-200',
    todo: 'bg-amber-50 text-amber-700 border-amber-200',
    soon: 'bg-muted text-muted-foreground border-dashed',
  }[state];
  return (
    <Badge variant="outline" className={`font-normal ${cls}`}>
      {label}{detail ? ` · ${detail}` : state === 'todo' ? ' · to do' : state === 'soon' ? ' · soon' : ''}
    </Badge>
  );
}

export default function Quality() {
  const [batches, setBatches] = useState<QualityBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState('');
  const [needsProduction, setNeedsProduction] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    batchQualityService.list({ date: date || undefined, needs: needsProduction ? 'production' : undefined })
      .then(rows => { if (!cancelled) setBatches(rows || []); })
      .catch((e: any) => toast({ title: 'Failed to load batches', description: e?.message, variant: 'destructive' }))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [date, needsProduction]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><ShieldCheck className="h-6 w-6" /> Quality</h1>
        <p className="text-sm text-muted-foreground">Production, output and tasting data for every batch</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <CalendarDays className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="date" className="pl-9 w-full sm:w-44" value={date} onChange={e => setDate(e.target.value)} aria-label="Production day" />
        </div>
        {date && <Button variant="ghost" size="sm" onClick={() => setDate('')}>All days</Button>}
        <Button variant={needsProduction ? 'default' : 'outline'} size="sm" onClick={() => setNeedsProduction(v => !v)}>
          Needs production
        </Button>
      </div>

      {loading ? <div className="shadow-card rounded-lg border p-4"><TableSkeleton /></div> : batches.length === 0 ? (
        <EmptyState title="No batches found" description="Try another day or clear the filters." icon="🧀" />
      ) : (
        <div className="space-y-2">
          {batches.map((b, idx) => {
            const q = b.quality;
            const flag = phStatus(q?.ph, b.recipe?.phMin, b.recipe?.phMax);
            return (
              <motion.div key={b.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(idx, 10) * 0.02 }}>
                <Link to={`/quality/${b.id}`} className="block">
                  <Card className="shadow-card hover:bg-accent/40 transition-colors">
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-medium truncate">{b.recipeName}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{formatDate(b.startedAt)}</span>
                        </div>
                        <p className="text-xs font-mono text-muted-foreground">{b.lot || `#${b.id}`}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {productionDone(q)
                            ? <Chip label="Production" state={flag === 'low' || flag === 'high' ? 'warn' : 'done'} detail={`pH ${q!.ph}`} />
                            : <Chip label="Production" state="todo" />}
                          <Chip label="Output" state="soon" />
                          <Chip label="Tasting" state="soon" />
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
