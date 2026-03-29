// src/pages/admin/ReportsPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, FileBarChart2 } from 'lucide-react';
import { supabase } from '@/supabase/client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import QuarterCard from '@/components/QuarterCard';
import type {
  Quarter, QuarterReport, QuarterOutcome, Customer, Question,
  FeedbackAssignment, FeedbackResponse, QuestionSection,
} from '@/types/database.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getOutcomeLabel(outcome: QuarterOutcome): string {
  switch (outcome) {
    case 'incentive':    return 'Incentive';
    case 'on_target':    return 'On Target';
    case 'below_target': return 'Below Target';
    case 'penalty':      return 'Penalty';
  }
}

function getOutcomeBadgeClasses(outcome: QuarterOutcome | string): string {
  switch (outcome) {
    case 'incentive':    return 'bg-emerald-500/15 text-emerald-600';
    case 'on_target':    return 'bg-blue-500/15 text-blue-600';
    case 'below_target': return 'bg-amber-500/15 text-amber-600';
    case 'penalty':      return 'bg-red-500/15 text-red-600';
    default:             return 'bg-muted text-muted-foreground';
  }
}

// ─── Report computation ───────────────────────────────────────────────────────

function computeReport(
  quarterId: string,
  assignments: FeedbackAssignment[],
  customers: Customer[],
  questions: Question[],
  responses: FeedbackResponse[],
): Omit<QuarterReport, 'id' | 'created_at' | 'updated_at'> {
  const submitted         = assignments.filter(a => a.status === 'submitted');
  const total_respondents = submitted.length;
  const total_assigned    = assignments.length;

  const respondents = submitted.map(a => {
    const customer = customers.find(c => c.id === a.customer_id);
    const isNew    = customer?.expat_type === 'new';
    const resps    = responses.filter(r => r.assignment_id === a.id);
    return { isNew, responses: resps };
  });

  const newExpats       = respondents.filter(r => r.isNew);
  const new_expat_count = newExpats.length;

  const sectionKeys: QuestionSection[] = [
    'service_initiation',
    'service_delivery',
    'driver_quality',
    'overall',
  ];

  const sectionStats: Record<QuestionSection, { avg: number; pct: number }> = {} as any;

  for (const key of sectionKeys) {
    const sectionQuestions = questions.filter(q => q.section === key);
    const isNewOnly        = key === 'service_initiation';
    const applicable       = isNewOnly ? newExpats : respondents;
    const respCount        = applicable.length;
    const qCount           = sectionQuestions.length;

    let totalScore = 0;
    applicable.forEach(r => {
      sectionQuestions.forEach(q => {
        const resp = r.responses.find(res => res.question_id === q.id);
        if (resp) totalScore += resp.score;
      });
    });

    const divisor = respCount * qCount;
    const avg     = divisor > 0 ? totalScore / divisor : 0;
    const pct     = (avg / 4) * 100;
    sectionStats[key] = { avg, pct };
  }

  const sectionsForOverall = new_expat_count > 0
    ? sectionKeys
    : sectionKeys.filter(k => k !== 'service_initiation');

  const overall_pct =
    sectionsForOverall.reduce((sum, k) => sum + sectionStats[k].pct, 0) /
    sectionsForOverall.length;

  let outcome: QuarterOutcome;
  if      (overall_pct >= 85) outcome = 'incentive';
  else if (overall_pct >= 80) outcome = 'on_target';
  else if (overall_pct >= 70) outcome = 'below_target';
  else                        outcome = 'penalty';

  return {
    quarter_id: quarterId,
    total_respondents,
    total_assigned,
    new_expat_count,
    si_avg:  sectionStats.service_initiation.avg,
    si_pct:  sectionStats.service_initiation.pct,
    sd_avg:  sectionStats.service_delivery.avg,
    sd_pct:  sectionStats.service_delivery.pct,
    dq_avg:  sectionStats.driver_quality.avg,
    dq_pct:  sectionStats.driver_quality.pct,
    os_avg:  sectionStats.overall.avg,
    os_pct:  sectionStats.overall.pct,
    overall_pct,
    outcome,
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const navigate = useNavigate();

  const [loading, setLoading]               = useState(true);
  const [quarters, setQuarters]             = useState<Quarter[]>([]);
  const [quarterReports, setQuarterReports] = useState<QuarterReport[]>([]);
  const [pendingQuarterIds, setPendingQuarterIds] = useState<string[]>([]);
  const [staleQuarterIds, setStaleQuarterIds]     = useState<string[]>([]);
  const [generating, setGenerating]         = useState<string | null>(null);
  const [error, setError]                   = useState<string | null>(null);

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchAll = async () => {
    setLoading(true);
    setError(null);

    const [
      { data: quartersData },
      { data: reportsData },
      { data: assignmentsData },
    ] = await Promise.all([
      (supabase as any)
        .from('quarters')
        .select('*')
        .order('year',           { ascending: false })
        .order('quarter_number', { ascending: false }),
      (supabase as any).from('quarter_reports').select('*'),
      (supabase as any).from('feedback_assignments').select('quarter_id, status'),
    ]);

    const qs: Quarter[]         = quartersData  ?? [];
    const reps: QuarterReport[] = reportsData   ?? [];
    const assigns: Pick<FeedbackAssignment, 'quarter_id' | 'status'>[] = assignmentsData ?? [];

    setQuarters(qs);
    setQuarterReports(reps);

    // Build submitted-count map
    const submittedCount = new Map<string, number>();
    assigns.forEach(a => {
      if (a.status === 'submitted') {
        submittedCount.set(a.quarter_id, (submittedCount.get(a.quarter_id) ?? 0) + 1);
      }
    });

    const reportedIds = new Set(reps.map(r => r.quarter_id));

    // Quarters with submissions but no report yet
    setPendingQuarterIds(
      [...submittedCount.keys()].filter(id => !reportedIds.has(id))
    );

    // Quarters whose report is outdated (more submissions came in after generation)
    setStaleQuarterIds(
      reps
        .filter(r => (submittedCount.get(r.quarter_id) ?? 0) > r.total_respondents)
        .map(r => r.quarter_id)
    );

    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // ─── Generate / Regenerate ────────────────────────────────────────────────
  const handleGenerate = async (quarterId: string) => {
    setGenerating(quarterId);
    setError(null);

    try {
      const [
        { data: assignmentsData, error: aErr },
        { data: questionsData,   error: qErr },
      ] = await Promise.all([
        (supabase as any).from('feedback_assignments').select('*').eq('quarter_id', quarterId),
        (supabase as any).from('questions').select('*').eq('is_active', true),
      ]);

      if (aErr || qErr) throw aErr ?? qErr;

      const assignments: FeedbackAssignment[] = assignmentsData ?? [];
      const questions: Question[]             = questionsData   ?? [];
      const submittedIds = assignments.filter(a => a.status === 'submitted').map(a => a.id);
      const customerIds  = [...new Set(assignments.map(a => a.customer_id))];

      const [
        { data: customersData, error: cErr },
        { data: responsesData, error: rErr },
      ] = await Promise.all([
        (supabase as any).from('customers').select('*').in('id', customerIds),
        (supabase as any).from('feedback_responses').select('*').in('assignment_id', submittedIds),
      ]);

      if (cErr || rErr) throw cErr ?? rErr;

      const payload = computeReport(
        quarterId,
        assignments,
        customersData ?? [],
        questions,
        responsesData ?? [],
      );

      const { error: upsertErr } = await (supabase as any)
        .from('quarter_reports')
        .upsert(payload, { onConflict: 'quarter_id' });

      if (upsertErr) throw upsertErr;

      await fetchAll();
    } catch (err: any) {
      console.error('Report generation failed:', err);
      setError(err?.message ?? 'Failed to generate report. Please try again.');
    } finally {
      setGenerating(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading reports…
      </div>
    );
  }

  const quartersWithReports = quarters.filter(q => quarterReports.some(r => r.quarter_id === q.id));
  const pendingQuarters     = quarters.filter(q => pendingQuarterIds.includes(q.id));
  const nothingAtAll        = quartersWithReports.length === 0 && pendingQuarters.length === 0;

  return (
    <div className="space-y-8 animate-fade-in-up">

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Reports</h1>
        <Button variant="ghost" size="sm" onClick={fetchAll} disabled={loading} className="text-muted-foreground">
          <RefreshCw className="w-4 h-4 mr-1.5" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-600 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {nothingAtAll && (
        <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
          <p className="text-muted-foreground">No reports available yet.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Reports appear here once feedback has been submitted for a quarter.
          </p>
        </div>
      )}

      {/* ── Quarters with submissions but no report yet ── */}
      {pendingQuarters.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Ready to Generate</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              These quarters have submitted feedback but no report has been generated yet.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingQuarters.map(q => (
              <div key={q.id} className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{q.label}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 font-semibold uppercase tracking-wide">
                    No Report
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Feedback has been submitted for this quarter. Click below to compute and save the report.
                </p>
                <Button size="sm" onClick={() => handleGenerate(q.id)} disabled={generating === q.id} className="w-full">
                  {generating === q.id
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
                    : <><FileBarChart2 className="w-4 h-4 mr-2" />Generate Report</>
                  }
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Generated reports ── */}
      {quartersWithReports.length > 0 && (
        <section className="space-y-3">
          {pendingQuarters.length > 0 && (
            <h2 className="text-base font-semibold text-foreground">Generated Reports</h2>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {quartersWithReports.map(q => {
              const report  = quarterReports.find(r => r.quarter_id === q.id)!;
              const isStale = staleQuarterIds.includes(q.id);
              return (
                <div key={q.id}>
                  <QuarterCard
                    label={q.label}
                    badge={
                      <span className={cn(
                        'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide',
                        getOutcomeBadgeClasses(report.outcome)
                      )}>
                        {getOutcomeLabel(report.outcome)}
                      </span>
                    }
                    rows={[
                      { label: 'Overall Satisfaction', value: `${Number(report.overall_pct).toFixed(1)}%` },
                    ]}
                    progress={{ value: report.total_respondents, max: report.total_assigned }}
                    onClick={() => navigate(`/admin/reports/${q.id}`)}
                  />

                  {/*
                    Stale banner — shown when total submitted in DB is higher than
                    what was recorded when the report was last generated.
                  */}
                  {isStale && (
                    <div className="mt-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center justify-between gap-3">
                      <p className="text-xs text-amber-700 leading-snug">
                        New submissions since last report.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs shrink-0 border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
                        onClick={() => handleGenerate(q.id)}
                        disabled={generating === q.id}
                      >
                        {generating === q.id
                          ? <Loader2 className="w-3 h-3 animate-spin" />
                          : <><RefreshCw className="w-3 h-3 mr-1" />Regenerate</>
                        }
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

    </div>
  );
}