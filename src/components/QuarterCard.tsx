import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface QuarterCardRow {
  label: string;
  value: string | number;
}

interface QuarterCardProps {
  label: string;
  badge?: ReactNode;
  rows: QuarterCardRow[];
  progress?: { value: number; max: number };
  onClick?: () => void;
}

export default function QuarterCard({ label, badge, rows, progress, onClick }: QuarterCardProps) {
  const pct = progress && progress.max > 0 ? Math.round((progress.value / progress.max) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="bg-card rounded-2xl border border-border p-6 text-left transition-all hover:shadow-lg hover:border-accent/40 active:scale-[0.98] group w-full"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-foreground">{label}</h3>
        {badge}
      </div>
      <div className="space-y-2.5">
        {rows.map((row, i) => (
          <div key={i} className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <span className="text-sm font-semibold text-foreground tabular-nums">{row.value}</span>
          </div>
        ))}
      </div>
      {progress && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Response Rate</span>
            <span className="font-semibold text-foreground">{pct}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500 bg-primary/70')}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}
    </button>
  );
}
