import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Star, ExternalLink } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { batchQualityService, QualityBatch } from '@/services/batchQualityService';
import { rankBest, suggestedVerdict, finalVerdict, phStatus, tastingCriteria } from '@/lib/batchQuality';
import { EmptyState, TableSkeleton } from '@/components/DataStates';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/formatDate';

const RATINGS = [
  { value: '0', label: 'Any rating' },
  { value: '3', label: '3 and above' },
  { value: '3.5', label: '3.5 and above' },
  { value: '4', label: '4 and above' },
  { value: '4.5', label: '4.5 and above' },
];
const ALL = '__all__';
const VERDICT_CLS = {
  approved: 'bg-green-50 text-green-700 border-green-200',
  review: 'bg-amber-50 text-amber-700 border-amber-200',
  rejected: 'bg-red-50 text-red-700 border-red-200',
};

function Note({ title, text, by }: { title: string; text?: string | null; by?: string | null }) {
  if (!text) return null;
  return (
    <div className="text-sm">
      <p className="text-xs font-medium text-muted-foreground">{title}{by ? ` · ${by}` : ''}</p>
      <p className="whitespace-pre-wrap">{text}</p>
    </div>
  );
}

function Detail({ b }: { b: QualityBatch & { score: number } }) {
  const q = b.quality;
  const r = b.recipe;
  return (
    <div className="space-y-3 border-t pt-3">
      {(r?.steps?.length ?? 0) > 0 && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">Steps</p>
          <ol className="list-decimal pl-5 space-y-0.5 text-sm">{r!.steps!.map((s, i) => <li key={i}>{s}</li>)}</ol>
        </div>
      )}

      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1">Ingredients and water</p>
        <div className="text-sm divide-y rounded-md border">
          {(b.inputMaterials ?? []).map((m, i) => (
            <div key={i} className="flex justify-between gap-2 px-2 py-1.5">
              <span>{m.materialName}{m.lot ? <span className="text-xs text-muted-foreground"> · lot {m.lot}</span> : null}</span>
              <span className="font-medium shrink-0">{m.quantity} {m.unit || 'kg'}</span>
            </div>
          ))}
          <div className="flex justify-between gap-2 px-2 py-1.5 bg-muted/40">
            <span>Water</span>
            <span className="font-medium shrink-0">{q?.waterKg != null ? `${q.waterKg} kg` : '—'}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span>Final pH: <b>{q?.ph ?? '—'}</b></span>
        <span>Peak temperature: <b>{q?.peakTemp != null ? `${q.peakTemp} °C` : '—'}</b></span>
        {q?.outputKg != null && <span>Output: <b>{q.outputKg} kg</b></span>}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {tastingCriteria(r?.cheeseType).map(c => (
          <span key={c.key}>{c.label}: <b>{q?.tastingScores?.[c.key] ?? '—'}</b></span>
        ))}
      </div>

      <div className="space-y-2">
        <Note title="Production notes" text={q?.productionNotes} by={q?.productionByName} />
        <Note title="Output notes" text={q?.outputNotes} by={q?.outputByName} />
        <Note title="Tasting notes" text={q?.tastingNotes} by={q?.tastingByName} />
        {!q?.productionNotes && !q?.outputNotes && !q?.tastingNotes && <p className="text-xs text-muted-foreground">No notes for this batch.</p>}
      </div>

      <Button asChild variant="outline" size="sm">
        <Link to={`/quality/${b.id}`}><ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Open batch</Link>
      </Button>
    </div>
  );
}

export default function BestBatches() {
  const [batches, setBatches] = useState<QualityBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [minScore, setMinScore] = useState('0');
  const [recipe, setRecipe] = useState(ALL);
  const [open, setOpen] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    batchQualityService.list({ tasted: true, ingredients: true, limit: 1000 })
      .then(rows => setBatches(rows || []))
      .catch((e: any) => toast({ title: 'Failed to load batches', description: e?.message, variant: 'destructive' }))
      .finally(() => setLoading(false));
  }, []);

  const recipes = useMemo(() => [...new Set(batches.map(b => b.recipeName))].sort(), [batches]);
  const ranked = useMemo(
    () => rankBest(batches, Number(minScore), recipe === ALL ? undefined : recipe),
    [batches, minScore, recipe],
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={minScore} onValueChange={setMinScore}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Minimum rating"><SelectValue /></SelectTrigger>
          <SelectContent>{RATINGS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={recipe} onValueChange={setRecipe}>
          <SelectTrigger className="w-full sm:w-56" aria-label="Recipe"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All recipes</SelectItem>
            {recipes.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
        {!loading && <span className="text-xs text-muted-foreground">{ranked.length} batch{ranked.length === 1 ? '' : 'es'}, best first</span>}
      </div>

      {loading ? <div className="shadow-card rounded-lg border p-4"><TableSkeleton /></div> : ranked.length === 0 ? (
        <EmptyState title="No tasted batches match" description="Batches appear here once all their tasting scores are filled in." icon="⭐" />
      ) : (
        <div className="space-y-2">
          {ranked.map((b, idx) => {
            const flag = phStatus(b.quality?.ph, b.recipe?.phMin, b.recipe?.phMax);
            const verdict = finalVerdict(b.quality?.tastingVerdict, suggestedVerdict(b.score, flag));
            const isOpen = open === b.id;
            return (
              <Card key={b.id} className="shadow-card">
                <CardContent className="p-3">
                  <button type="button" className="w-full flex items-center gap-3 text-left" onClick={() => setOpen(isOpen ? null : b.id)} aria-expanded={isOpen}>
                    <span className="text-sm font-semibold text-muted-foreground w-6 shrink-0">#{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium truncate">{b.recipeName}</span>
                        <span className="text-xs text-muted-foreground shrink-0">{formatDate(b.startedAt)}</span>
                      </div>
                      <p className="text-xs font-mono text-muted-foreground">{b.lot || `#${b.id}`}</p>
                    </div>
                    <Badge variant="outline" className="gap-1 font-semibold shrink-0"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{b.score}</Badge>
                    {verdict && <Badge variant="outline" className={`font-normal capitalize hidden sm:inline-flex ${VERDICT_CLS[verdict]}`}>{verdict}</Badge>}
                    {isOpen ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
                  </button>
                  {isOpen && <div className="mt-3"><Detail b={b} /></div>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
