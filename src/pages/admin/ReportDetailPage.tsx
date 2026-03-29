// src/pages/admin/ReportDetailPage.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Loader2 } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/supabase/client';
import { cn } from '@/lib/utils';
import type {
  Quarter, QuarterReport, QuarterOutcome, Customer, Question,
  FeedbackAssignment, FeedbackResponse, QuestionSection,
} from '@/types/database.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const sectionKeys: QuestionSection[] = [
  'service_initiation',
  'service_delivery',
  'driver_quality',
  'overall',
];

const sectionLabels: Record<QuestionSection, string> = {
  service_initiation: 'Service Initiation',
  service_delivery:   'Service Delivery',
  driver_quality:     'Driver Quality',
  overall:            'Overall Experience',
};

const sectionAppliesTo: Record<QuestionSection, string> = {
  service_initiation: 'New expats only',
  service_delivery:   'All respondents',
  driver_quality:     'All respondents',
  overall:            'All respondents',
};

const kpiTargets: Record<QuestionSection, number> = {
  service_initiation: 80,
  service_delivery:   80,
  driver_quality:     80,
  overall:            80,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getScoreColor(score: number) {
  if (score === 4) return 'bg-emerald-500';
  if (score === 3) return 'bg-blue-500';
  if (score === 2) return 'bg-amber-500';
  return 'bg-red-500';
}

function getOutcomeLabel(outcome: QuarterOutcome | string): string {
  switch (outcome) {
    case 'incentive':    return 'Incentive';
    case 'on_target':    return 'On Target';
    case 'below_target': return 'Below Target';
    case 'penalty':      return 'Penalty';
    default:             return outcome;
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

// ─── Types ────────────────────────────────────────────────────────────────────

interface Respondent {
  assignment: FeedbackAssignment;
  customer: Customer;
  isNew: boolean;
  responses: FeedbackResponse[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportDetailPage() {
  const { quarterId } = useParams();
  const navigate = useNavigate();
  const [questionRefOpen, setQuestionRefOpen] = useState(false);

  const [loading, setLoading]         = useState(true);
  const [quarter, setQuarter]         = useState<Quarter | null>(null);
  const [report, setReport]           = useState<QuarterReport | null>(null);
  const [questions, setQuestions]     = useState<Question[]>([]);
  const [respondents, setRespondents] = useState<Respondent[]>([]);

  // ─── Fetch all data for this quarter ────────────────────────────────────────
  useEffect(() => {
    if (!quarterId) return;

    (async () => {
      setLoading(true);

      // 1. Quarter + report + questions (in parallel)
      const [
        { data: quarterData },
        { data: reportData },
        { data: questionsData },
        { data: assignmentsData },
      ] = await Promise.all([
        (supabase as any).from('quarters').select('*').eq('id', quarterId).single(),
        (supabase as any).from('quarter_reports').select('*').eq('quarter_id', quarterId).single(),
        (supabase as any).from('questions').select('*').eq('is_active', true).order('question_number', { ascending: true }),
        (supabase as any)
          .from('feedback_assignments')
          .select('*')
          .eq('quarter_id', quarterId)
          .eq('status', 'submitted'),
      ]);

      setQuarter(quarterData as Quarter ?? null);
      setReport(reportData as QuarterReport ?? null);
      setQuestions((questionsData ?? []) as Question[]);

      const submitted = (assignmentsData ?? []) as FeedbackAssignment[];

      if (submitted.length === 0) {
        setLoading(false);
        return;
      }

      // 2. Fetch customers + responses for submitted assignments
      const customerIds   = [...new Set(submitted.map(a => a.customer_id))];
      const assignmentIds = submitted.map(a => a.id);

      const [{ data: customersData }, { data: responsesData }] = await Promise.all([
        (supabase as any).from('customers').select('*').in('id', customerIds),
        (supabase as any).from('feedback_responses').select('*').in('assignment_id', assignmentIds),
      ]);

      const customersArr  = (customersData ?? []) as Customer[];
      const responsesArr  = (responsesData ?? []) as FeedbackResponse[];

      // 3. Build respondent list
      const built: Respondent[] = submitted.map(a => {
        const customer  = customersArr.find(c => c.id === a.customer_id)!;
        const isNew     = customer?.expat_type === 'new';
        const responses = responsesArr.filter(r => r.assignment_id === a.id);
        return { assignment: a, customer, isNew, responses };
      });

      setRespondents(built);
      setLoading(false);
    })();
  }, [quarterId]);

  // ─── Derived: section calculations ──────────────────────────────────────────
  const sectionData = useMemo(() => {
    return sectionKeys.map(key => {
      const sectionQuestions       = questions.filter(q => q.section === key);
      const qCount                 = sectionQuestions.length;
      const isNewOnly              = key === 'service_initiation';
      const applicableRespondents  = isNewOnly
        ? respondents.filter(r => r.isNew)
        : respondents;
      const respCount              = applicableRespondents.length;

      let totalScore = 0;
      applicableRespondents.forEach(r => {
        sectionQuestions.forEach(q => {
          const resp = r.responses.find(res => res.question_id === q.id);
          if (resp) totalScore += resp.score;
        });
      });

      const maxPossible = respCount * qCount * 4;
      const divisor     = respCount * qCount;
      const avg         = divisor > 0 ? totalScore / divisor : 0;
      const pct         = (avg / 4) * 100;

      return { key, label: sectionLabels[key], qCount, respCount, totalScore, maxPossible, divisor, avg, pct };
    });
  }, [questions, respondents]);

  const strongest = useMemo(() => [...sectionData].sort((a, b) => b.pct - a.pct)[0], [sectionData]);
  const weakest   = useMemo(() => [...sectionData].sort((a, b) => a.pct - b.pct)[0], [sectionData]);

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading report…
      </div>
    );
  }

  if (!quarter || !report) {
    return <div className="p-8 text-muted-foreground">Report not found.</div>;
  }

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 animate-fade-in-up">

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-border -mt-2">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/admin/reports')}
            className="text-muted-foreground"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-semibold text-foreground">{quarter.label} — Report</h1>
          <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide ml-auto',
            getOutcomeBadgeClasses(report.outcome)
          )}>
            {getOutcomeLabel(report.outcome)}
          </span>
        </div>
      </div>

      {/* SECTION A — Individual Response Table */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Individual Responses</h2>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card z-10 min-w-[180px]">Question</TableHead>
                {respondents.map(r => (
                  <TableHead key={r.assignment.id} className="text-center min-w-[60px] text-xs">
                    {r.customer.name.split(' ')[0]}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectionKeys.map(sectionKey => {
                const sectionQuestions = questions.filter(q => q.section === sectionKey);
                return (
                  <>
                    {/* Section header row */}
                    <TableRow key={`header-${sectionKey}`}>
                      <TableCell
                        colSpan={respondents.length + 1}
                        className="bg-muted/40 font-semibold text-xs uppercase tracking-wide text-muted-foreground py-2"
                      >
                        {sectionLabels[sectionKey]}
                      </TableCell>
                    </TableRow>

                    {sectionQuestions.map(q => (
                      <TableRow key={q.id}>
                        <TableCell className="sticky left-0 bg-card z-10 text-xs">
                          <span className="font-mono text-muted-foreground mr-1.5">Q{q.question_number}</span>
                          {q.text.length > 50 ? q.text.substring(0, 50) + '…' : q.text}
                        </TableCell>
                        {respondents.map(r => {
                          if (q.is_new_expat_only && !r.isNew) {
                            return (
                              <TableCell key={r.assignment.id} className="text-center">
                                <span className="text-muted-foreground/20">—</span>
                              </TableCell>
                            );
                          }
                          const resp = r.responses.find(res => res.question_id === q.id);
                          if (!resp) {
                            return (
                              <TableCell key={r.assignment.id} className="text-center">—</TableCell>
                            );
                          }
                          return (
                            <TableCell key={r.assignment.id} className="text-center">
                              <span className={cn(
                                'inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white',
                                getScoreColor(resp.score)
                              )}>
                                {resp.score}
                              </span>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* SECTION B — Question Reference */}
      <section>
        <Collapsible open={questionRefOpen} onOpenChange={setQuestionRefOpen}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-2 text-base font-semibold text-foreground hover:text-foreground/80 transition-colors">
              <ChevronDown className={cn('w-4 h-4 transition-transform', questionRefOpen && 'rotate-180')} />
              Question Reference
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-3 space-y-4">
              {sectionKeys.map(key => (
                <div key={key}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                    {sectionLabels[key]}
                  </h4>
                  <div className="space-y-1.5">
                    {questions.filter(q => q.section === key).map(q => (
                      <div key={q.id} className="flex gap-2 text-sm">
                        <span className="font-mono text-muted-foreground w-6 shrink-0">Q{q.question_number}</span>
                        <span className="text-foreground">{q.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      </section>

      {/* SECTION C — Section Totals */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Section Totals</h2>
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Section</TableHead>
                <TableHead>Applies To</TableHead>
                <TableHead className="text-right">Raw Total</TableHead>
                <TableHead className="text-right">Max Possible</TableHead>
                <TableHead>Divisor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectionData.map(s => (
                <TableRow key={s.key}>
                  <TableCell className="font-medium">{s.label}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{sectionAppliesTo[s.key]}</TableCell>
                  <TableCell className="text-right font-mono">{s.totalScore}</TableCell>
                  <TableCell className="text-right font-mono">{s.maxPossible}</TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">
                    {s.respCount} × {s.qCount} = {s.divisor}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      {/* SECTION D — Average Scores */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Average Scores</h2>
        <div className="space-y-3">
          {sectionData.map(s => (
            <div key={s.key} className="bg-card rounded-xl border border-border p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{s.label}</span>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground font-mono text-xs">{s.totalScore} ÷ {s.divisor}</span>
                  <span className="font-semibold">{s.avg.toFixed(2)}/4</span>
                  <span className="font-semibold text-foreground">{s.pct.toFixed(1)}%</span>
                </div>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-primary/50 transition-all"
                  style={{ width: `${s.pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION E — KPI Outcomes */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">KPI Outcomes</h2>
        <div className="bg-card rounded-xl border border-border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>KPI</TableHead>
                <TableHead className="text-right">Score /4</TableHead>
                <TableHead className="text-right">Satisfaction %</TableHead>
                <TableHead className="text-right">Target</TableHead>
                <TableHead>Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sectionData.map(s => {
                const target = kpiTargets[s.key];
                const met    = s.pct >= target;
                const outcomeBadge = met
                  ? (s.pct >= 85 ? 'incentive' : 'on_target')
                  : (s.pct < 70  ? 'penalty'   : 'below_target');
                return (
                  <TableRow key={s.key}>
                    <TableCell className="font-medium">{s.label}</TableCell>
                    <TableCell className="text-right font-mono">{s.avg.toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">{s.pct.toFixed(1)}%</TableCell>
                    <TableCell className="text-right font-mono">{target}%</TableCell>
                    <TableCell>
                      <span className={cn(
                        'text-xs font-semibold px-2 py-0.5 rounded-full',
                        getOutcomeBadgeClasses(outcomeBadge)
                      )}>
                        {getOutcomeLabel(outcomeBadge)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Target: ≥80%. Below 70% → Penalty (−3%). ≥85% → Incentive (+3%).
        </p>
      </section>

      {/* SECTION F — Summary */}
      <section>
        <h2 className="text-base font-semibold text-foreground mb-3">Summary</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Total Respondents</p>
            <p className="text-2xl font-bold text-foreground mt-1">{report.total_respondents}</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Overall Satisfaction</p>
            <p className="text-2xl font-bold text-foreground mt-1">{Number(report.overall_pct).toFixed(1)}%</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Strongest Section</p>
            <p className="text-lg font-bold text-foreground mt-1">{strongest?.label ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{strongest?.pct.toFixed(1)}%</p>
          </div>
          <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
            <p className="text-xs text-muted-foreground">Weakest Section</p>
            <p className="text-lg font-bold text-foreground mt-1">{weakest?.label ?? '—'}</p>
            <p className="text-xs text-muted-foreground">{weakest?.pct.toFixed(1)}%</p>
          </div>
        </div>

        {/* Section comparison bar chart */}
        <div className="bg-card rounded-xl border border-border p-5 shadow-sm">
          <h3 className="text-sm font-medium text-foreground mb-4">Section Comparison</h3>
          <div className="space-y-3">
            {sectionData.map(s => (
              <div key={s.key} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-32 shrink-0 text-right">{s.label}</span>
                <div className="flex-1 bg-muted rounded-full h-5 relative">
                  <div
                    className="h-5 rounded-full bg-primary/50 transition-all flex items-center justify-end pr-2"
                    style={{ width: `${s.pct}%` }}
                  >
                    <span className="text-[10px] font-bold text-primary-foreground">
                      {s.pct.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
}