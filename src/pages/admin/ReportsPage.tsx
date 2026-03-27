import { useNavigate } from 'react-router-dom';
import { quarters, quarterReports, getOutcomeLabel, getOutcomeBadgeClasses } from '@/data/mockData';
import { cn } from '@/lib/utils';
import QuarterCard from '@/components/QuarterCard';

export default function ReportsPage() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6 animate-fade-in-up">
      <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {quarters.map(q => {
          const report = quarterReports.find(r => r.quarterId === q.id);
          if (!report) return null;
          return (
            <QuarterCard
              key={q.id}
              label={q.label}
              badge={
                <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide', getOutcomeBadgeClasses(report.outcome))}>
                  {getOutcomeLabel(report.outcome)}
                </span>
              }
              rows={[
                { label: 'Overall Satisfaction', value: `${report.overallPct.toFixed(1)}%` },
              ]}
              progress={{ value: report.totalRespondents, max: report.totalAssigned }}
              onClick={() => navigate(`/admin/reports/${q.id}`)}
            />
          );
        })}
      </div>
    </div>
  );
}
