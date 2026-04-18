// src/pages/admin/ReportDetailPage.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Loader2, TrendingUp, TrendingDown, Send } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/supabase/client';
import { cn } from '@/lib/utils';
import SendReportModal from '@/components/SendReportModal';
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
  service_delivery: 'Service Delivery',
  driver_quality: 'Driver Quality',
  overall: 'Overall Experience',
};

const sectionAppliesTo: Record<QuestionSection, string> = {
  service_initiation: 'New expats only',
  service_delivery: 'All respondents',
  driver_quality: 'All respondents',
  overall: 'All respondents',
};

const sectionColors: Record<QuestionSection, { bar: string; bg: string; text: string; ring: string }> = {
  service_initiation: { bar: '#6366f1', bg: 'bg-indigo-500/10', text: 'text-indigo-600', ring: 'ring-indigo-500/30' },
  service_delivery: { bar: '#0ea5e9', bg: 'bg-sky-500/10', text: 'text-sky-600', ring: 'ring-sky-500/30' },
  driver_quality: { bar: '#10b981', bg: 'bg-emerald-500/10', text: 'text-emerald-600', ring: 'ring-emerald-500/30' },
  overall: { bar: '#f59e0b', bg: 'bg-amber-500/10', text: 'text-amber-600', ring: 'ring-amber-500/30' },
};

const kpiTarget = 80;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getScoreColor(score: number) {
  if (score === 4) return 'bg-emerald-500';
  if (score === 3) return 'bg-blue-500';
  if (score === 2) return 'bg-amber-500';
  return 'bg-red-500';
}

function getOutcomeLabel(outcome: QuarterOutcome | string): string {
  switch (outcome) {
    case 'incentive': return 'Incentive';
    case 'on_target': return 'On Target';
    case 'below_target': return 'Below Target';
    case 'penalty': return 'Penalty';
    default: return outcome;
  }
}

function getOutcomeBadgeClasses(outcome: QuarterOutcome | string): string {
  switch (outcome) {
    case 'incentive': return 'bg-emerald-500/15 text-emerald-600';
    case 'on_target': return 'bg-blue-500/15 text-blue-600';
    case 'below_target': return 'bg-amber-500/15 text-amber-600';
    case 'penalty': return 'bg-red-500/15 text-red-600';
    default: return 'bg-muted text-muted-foreground';
  }
}

// ─── Mini SVG Charts ──────────────────────────────────────────────────────────

function DonutChart({ pct, color, size = 72 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={6} className="text-muted/40" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
}

function MiniRing({ pct, color, size = 52 }: { pct: number; color: string; size?: number }) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const cx = size / 2;
  const cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg] shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={5} className="text-muted/40" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
}

function RadarChart({ data }: { data: { label: string; pct: number; color: string }[] }) {
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 80;
  const n = data.length;

  const angle = (i: number) => (2 * Math.PI * i) / n - Math.PI / 2;
  const point = (i: number, r: number) => ({
    x: cx + r * Math.cos(angle(i)),
    y: cy + r * Math.sin(angle(i)),
  });

  const gridLevels = [25, 50, 75, 100];

  const polygonPoints = data
    .map((d, i) => {
      const p = point(i, (d.pct / 100) * radius);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {gridLevels.map(lvl => {
        const pts = Array.from({ length: n }, (_, i) => {
          const p = point(i, (lvl / 100) * radius);
          return `${p.x},${p.y}`;
        }).join(' ');
        return (
          <polygon key={lvl} points={pts} fill="none"
            stroke="currentColor" strokeWidth={0.5} className="text-border" />
        );
      })}
      {data.map((_, i) => {
        const p = point(i, radius);
        return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="currentColor" strokeWidth={0.5} className="text-border" />;
      })}
      <polygon
        points={polygonPoints}
        fill="rgba(99,102,241,0.15)"
        stroke="#6366f1"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {data.map((d, i) => {
        const p = point(i, (d.pct / 100) * radius);
        return <circle key={i} cx={p.x} cy={p.y} r={4} fill={d.color} stroke="white" strokeWidth={1.5} />;
      })}
      {data.map((d, i) => {
        const p = point(i, radius + 16);
        return (
          <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={9} fill="currentColor" className="text-muted-foreground font-medium">
            {d.label.split(' ')[0]}
          </text>
        );
      })}
    </svg>
  );
}

function ScoreDistBar({ scores }: { scores: number[] }) {
  const counts = [1, 2, 3, 4].map(s => scores.filter(x => x === s).length);
  const total = scores.length || 1;
  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
  const labels = ['1', '2', '3', '4'];

  return (
    <div className="flex flex-col gap-1">
      <div className="flex h-4 rounded-full overflow-hidden w-full">
        {counts.map((c, i) => {
          const pct = (c / total) * 100;
          return (
            <div
              key={i}
              className="h-full transition-all duration-700"
              style={{ width: `${pct}%`, backgroundColor: colors[i] }}
              title={`Score ${labels[i]}: ${c}`}
            />
          );
        })}
      </div>
      <div className="flex gap-2.5 flex-wrap">
        {counts.map((c, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: colors[i] }} />
            {labels[i]}: {c}
          </span>
        ))}
      </div>
    </div>
  );
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

  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    responses: true,
    sectionTotals: true,
    avgScores: true,
    kpiOutcomes: true,
    summary: true,
    questionRef: false,
  });

  const toggle = (key: string) =>
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  const [loading, setLoading] = useState(true);
  const [quarter, setQuarter] = useState<Quarter | null>(null);
  const [report, setReport] = useState<QuarterReport | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [respondents, setRespondents] = useState<Respondent[]>([]);

  const [sendModalOpen, setSendModalOpen] = useState(false);

  useEffect(() => {
    if (!quarterId) return;
    (async () => {
      setLoading(true);
      const [
        { data: quarterData },
        { data: reportData },
        { data: questionsData },
        { data: assignmentsData },
      ] = await Promise.all([
        (supabase as any).from('quarters').select('*').eq('id', quarterId).single(),
        (supabase as any).from('quarter_reports').select('*').eq('quarter_id', quarterId).single(),
        (supabase as any).from('questions').select('*').eq('is_active', true).order('question_number', { ascending: true }),
        (supabase as any).from('feedback_assignments').select('*').eq('quarter_id', quarterId).eq('status', 'submitted'),
      ]);

      setQuarter(quarterData as Quarter ?? null);
      setReport(reportData as QuarterReport ?? null);
      setQuestions((questionsData ?? []) as Question[]);

      const submitted = (assignmentsData ?? []) as FeedbackAssignment[];
      if (submitted.length === 0) { setLoading(false); return; }

      const customerIds = [...new Set(submitted.map(a => a.customer_id))];
      const assignmentIds = submitted.map(a => a.id);

      const [{ data: customersData }, { data: responsesData }] = await Promise.all([
        (supabase as any).from('customers').select('*').in('id', customerIds),
        (supabase as any).from('feedback_responses').select('*').in('assignment_id', assignmentIds),
      ]);

      const built: Respondent[] = submitted.map(a => {
        const customer = ((customersData ?? []) as Customer[]).find(c => c.id === a.customer_id)!;
        const isNew = customer?.expat_type === 'new';
        const responses = ((responsesData ?? []) as FeedbackResponse[]).filter(r => r.assignment_id === a.id);
        return { assignment: a, customer, isNew, responses };
      }).sort((a, b) => a.customer.name.localeCompare(b.customer.name));

      setRespondents(built);
      setLoading(false);
    })();
  }, [quarterId]);

  // ─── Derived ──────────────────────────────────────────────────────────────
  const sectionData = useMemo(() => {
    return sectionKeys.map(key => {
      const sectionQuestions = questions.filter(q => q.section === key);
      const qCount = sectionQuestions.length;
      const isNewOnly = key === 'service_initiation';
      const applicableRespondents = isNewOnly ? respondents.filter(r => r.isNew) : respondents;
      const respCount = applicableRespondents.length;

      let totalScore = 0;
      applicableRespondents.forEach(r => {
        sectionQuestions.forEach(q => {
          const resp = r.responses.find(res => res.question_id === q.id);
          if (resp) totalScore += resp.score;
        });
      });

      const maxPossible = respCount * qCount * 4;
      const divisor = respCount * qCount;
      const avg = divisor > 0 ? totalScore / divisor : 0;
      const pct = (avg / 4) * 100;

      const questionStats = sectionQuestions.map(q => {
        const scores = applicableRespondents
          .map(r => r.responses.find(res => res.question_id === q.id)?.score)
          .filter((s): s is 1 | 2 | 3 | 4 => s !== undefined);
        const qTotal = scores.reduce((a, b) => a + b, 0);
        const qAvg = scores.length > 0 ? qTotal / scores.length : 0;
        const qPct = (qAvg / 4) * 100;
        return { question: q, scores, avg: qAvg, pct: qPct };
      });

      return {
        key, label: sectionLabels[key], qCount, respCount,
        totalScore, maxPossible, divisor, avg, pct,
        colors: sectionColors[key],
        questionStats,
      };
    });
  }, [questions, respondents]);

  const strongest = useMemo(() => [...sectionData].sort((a, b) => b.pct - a.pct)[0], [sectionData]);
  const weakest = useMemo(() => [...sectionData].sort((a, b) => a.pct - b.pct)[0], [sectionData]);

  const allScores = useMemo(() =>
    respondents.flatMap(r => r.responses.map(res => res.score)),
    [respondents]
  );

  // ─── Send handler — builds the payload and calls the API ──────────────────
  const handleSendReport = async (recipients: string[]) => {
    const { data: { session } } = await (supabase as any).auth.getSession();
    if (!session?.access_token) {
      throw new Error('You are not authenticated. Please log in and try again.');
    }

    // Build payload from existing page state
    const overallPct = report ? Number(report.overall_pct) : 0;
    const outcomeLabel = report ? getOutcomeLabel(report.outcome) : '';

    const payload = {
      recipients,
      overview: {
        quarterLabel:     quarter!.label,
        outcome:          outcomeLabel,
        totalRespondents: report!.total_respondents,
        totalAssigned:    report!.total_assigned,
        newExpatCount:    respondents.filter(r => r.isNew).length,
        overallPct,
        sections: sectionData.map(s => ({
          label:     s.label,
          avg:       s.avg,
          pct:       s.pct,
          appliesTo: sectionAppliesTo[s.key as QuestionSection],
        })),
      },
      responses: [...respondents]
        .sort((a, b) => a.customer.name.localeCompare(b.customer.name))
        .map(r => ({
        customerName: r.customer.name,
        isNew:        r.isNew,
        answers:      Object.fromEntries(
          questions.map(q => {
            const resp = r.responses.find(res => res.question_id === q.id);
            return [`Q${q.question_number}`, resp ? resp.score : null];
          })
        ),
      })),
      questions: questions.map(q => ({
        number:  q.question_number,
        text:    q.text,
        section: q.section,
      })),
      kpiRows: sectionData.map(s => ({
        section: s.label,
        avg:     s.avg,
        pct:     s.pct,
        target:  kpiTarget,
        outcome: s.pct >= 85 ? 'Incentive' : s.pct >= 80 ? 'On Target' : s.pct >= 70 ? 'Below Target' : 'Penalty',
      })),
    };

    // Client-side 25s timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50_000);

    let response: Response;
    try {
      response = await fetch('/api/send-report-email', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body:   JSON.stringify(payload),
        signal: controller.signal,
      });
    } catch (fetchErr: any) {
      if (fetchErr.name === 'AbortError') {
        throw new Error('The request timed out. The server may be unreachable — please try again.');
      }
      throw new Error(`Network error: ${fetchErr.message}`);
    } finally {
      clearTimeout(timeoutId);
    }

    let body: any;
    try {
      body = await response.json();
    } catch {
      throw new Error(`Unexpected server response (HTTP ${response.status}).`);
    }

    if (!response.ok) {
      throw new Error(body?.detail || body?.error || `Server error (HTTP ${response.status})`);
    }

    // 207 = partial success
    if (response.status === 207) {
      const failed = (body.results as any[]).filter(r => !r.success);
      const failedList = failed.map(r => `${r.email}: ${r.error}`).join('; ');
      throw new Error(`Sent to ${body.sent}/${body.total} recipients. Failed: ${failedList}`);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

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

  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm -mx-6 px-6 py-3 border-b border-border -mt-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/reports')} className="text-muted-foreground">
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h1 className="text-xl font-semibold text-foreground">{quarter.label} — Report</h1>
          <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide',
            getOutcomeBadgeClasses(report.outcome)
          )}>
            {getOutcomeLabel(report.outcome)}
          </span>

          <Button
            size="sm"
            variant="outline"
            className="ml-auto shrink-0"
            onClick={() => setSendModalOpen(true)}
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            Send Report
          </Button>
        </div>
      </div>

      {/* ── OVERVIEW CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Respondents</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {report.total_respondents}
            <span className="text-sm font-normal text-muted-foreground ml-1">/ {report.total_assigned}</span>
          </p>
          <div className="w-full bg-muted rounded-full h-1 mt-2">
            <div
              className="h-1 rounded-full bg-primary"
              style={{ width: `${(report.total_respondents / report.total_assigned) * 100}%` }}
            />
          </div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Overall Satisfaction</p>
          <p className="text-2xl font-bold text-foreground mt-1">{Number(report.overall_pct).toFixed(1)}%</p>
          <p className="text-xs mt-1 text-muted-foreground">Target: 80%</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Strongest Section</p>
          <p className="text-lg font-bold text-foreground mt-1 leading-tight">{strongest?.label ?? '—'}</p>
          <p className="text-xs text-emerald-600 font-medium mt-0.5 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />{strongest?.pct.toFixed(1)}%
          </p>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">Weakest Section</p>
          <p className="text-lg font-bold text-foreground mt-1 leading-tight">{weakest?.label ?? '—'}</p>
          <p className="text-xs text-muted-foreground font-medium mt-0.5">
            {weakest?.pct.toFixed(1)}%
          </p>
        </div>
      </div>

      {/* ── VISUAL OVERVIEW: Radar + Score Dist + Section bars ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-foreground self-start">Section Overview</p>
          <RadarChart
            data={sectionData.map(s => ({
              label: s.label,
              pct: s.pct,
              color: s.colors.bar,
            }))}
          />
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 w-full">
            {sectionData.map(s => (
              <div key={s.key} className="flex items-center gap-1.5 text-xs">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: s.colors.bar }} />
                <span className="text-muted-foreground truncate">{s.label.split(' ')[0]}</span>
                <span className="font-semibold text-foreground ml-auto">{s.pct.toFixed(0)}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-4">
          <p className="text-sm font-semibold text-foreground">Overall Score Distribution</p>
          <ScoreDistBar scores={allScores} />
          <div className="mt-auto space-y-2.5">
            {[4, 3, 2, 1].map(score => {
              const count = allScores.filter(s => s === score).length;
              const pct = allScores.length > 0 ? (count / allScores.length) * 100 : 0;
              const labels = ['', 'Needs Improvement', 'Fair', 'Good', 'Excellence'];
              const colors = ['', '#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
              return (
                <div key={score} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-4">{score}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, backgroundColor: colors[score] }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground w-16 text-right">{labels[score]}</span>
                  <span className="text-xs font-semibold text-foreground w-6 text-right">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-5 shadow-sm flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground">Section Satisfaction</p>
          {sectionData.map(s => {
            const met = s.pct >= kpiTarget;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className="relative shrink-0">
                  <DonutChart pct={s.pct} color={s.colors.bar} size={48} />
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground">
                    {s.pct.toFixed(0)}%
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-foreground truncate">{s.label}</span>
                    <span className={cn('text-[10px] font-semibold ml-1 shrink-0', met ? 'text-emerald-600' : 'text-red-500')}>
                      {met ? '✓' : '✗'} {kpiTarget}%
                    </span>
                  </div>
                  <div className="mt-1 w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${s.pct}%`, backgroundColor: s.colors.bar }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{sectionAppliesTo[s.key]}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── KPI OUTCOMES TABLE ── */}
      <Collapsible open={openSections.kpiOutcomes} onOpenChange={() => toggle('kpiOutcomes')}>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors">
              <span className="text-sm font-semibold text-foreground">KPI Outcomes</span>
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', openSections.kpiOutcomes && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border">
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
                    const met = s.pct >= kpiTarget;
                    const badge = s.pct >= 85 ? 'incentive' : s.pct >= 80 ? 'on_target' : s.pct >= 70 ? 'below_target' : 'penalty';
                    return (
                      <TableRow key={s.key}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.colors.bar }} />
                            {s.label}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{s.avg.toFixed(2)}</TableCell>
                        <TableCell className="text-right">
                          <span className={cn('font-mono font-semibold', met ? 'text-emerald-600' : 'text-red-500')}>
                            {s.pct.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{kpiTarget}%</TableCell>
                        <TableCell>
                          <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', getOutcomeBadgeClasses(badge))}>
                            {getOutcomeLabel(badge)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground px-4 py-3 border-t border-border">
                Target: ≥80% · Below 70% → Penalty (−3%) · ≥85% → Incentive (+3%)
              </p>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* ── SECTION: per-question breakdown ── */}
      {sectionData.map(s => (
        <Collapsible key={s.key} open={openSections[`section_${s.key}`] ?? true}
          onOpenChange={() => toggle(`section_${s.key}`)}>
          <div className={cn('bg-card rounded-xl border shadow-sm overflow-hidden', s.colors.ring, 'ring-1')}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', s.colors.bg)}>
                    <span className="text-xs font-bold" style={{ color: s.colors.bar }}>
                      {s.pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{sectionAppliesTo[s.key]} · {s.respCount} respondent{s.respCount !== 1 ? 's' : ''} · {s.qCount} question{s.qCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-lg font-bold text-foreground">{s.avg.toFixed(2)}<span className="text-xs font-normal text-muted-foreground">/4</span></p>
                    <p className="text-xs text-muted-foreground">{s.totalScore} ÷ {s.divisor}</p>
                  </div>
                  {s.respCount > 0 && (
                    <span className={cn(
                      'text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide hidden sm:block',
                      s.pct >= 85 ? 'bg-emerald-500/15 text-emerald-600'
                        : s.pct >= 80 ? 'bg-blue-500/15 text-blue-600'
                          : s.pct >= 70 ? 'bg-amber-500/15 text-amber-600'
                            : 'bg-red-500/15 text-red-600'
                    )}>
                      {s.pct >= 85 ? 'Incentive' : s.pct >= 80 ? 'On Target' : s.pct >= 70 ? 'Below Target' : 'Penalty'}
                    </span>
                  )}
                  <ChevronDown className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform shrink-0',
                    (openSections[`section_${s.key}`] ?? true) && 'rotate-180'
                  )} />
                </div>
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="px-5 pb-5 border-t border-border pt-4">
                {s.respCount === 0 ? (
                  <p className="text-sm text-muted-foreground italic">No applicable respondents for this section.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                    {s.questionStats.map(qs => {
                      const counts = [1, 2, 3, 4].map(sc => qs.scores.filter(x => x === sc).length);
                      const scoreColors = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981'];
                      return (
                        <div
                          key={qs.question.id}
                          className="bg-muted/30 rounded-lg border border-border/60 p-3 flex items-start gap-3"
                        >
                          <div className="relative shrink-0">
                            <MiniRing pct={qs.pct} color={s.colors.bar} size={52} />
                            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                              {qs.pct.toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-start gap-1">
                              <span className="text-[10px] font-mono text-muted-foreground shrink-0 mt-0.5">Q{qs.question.question_number}</span>
                              <span className="text-[11px] text-foreground leading-snug line-clamp-3">{qs.question.text}</span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-bold text-foreground">{qs.avg.toFixed(2)}<span className="text-[10px] font-normal text-muted-foreground">/4</span></span>
                              <span className="text-muted-foreground/40 text-[10px]">·</span>
                              {counts.map((c, i) => c > 0 && (
                                <span key={i} className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: scoreColors[i] }} />
                                  {i + 1}:{c}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      ))}

      {/* ── INDIVIDUAL RESPONSES TABLE ── */}
      <Collapsible open={openSections.responses} onOpenChange={() => toggle('responses')}>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors">
              <div className="text-left">
                <span className="text-sm font-semibold text-foreground">Individual Responses</span>
                <p className="text-xs text-muted-foreground mt-0.5">{respondents.length} submitted</p>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', openSections.responses && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10 min-w-[160px]">Customer</TableHead>
                    <TableHead className="text-center min-w-[60px] text-xs">Type</TableHead>
                    {sectionKeys.flatMap(sectionKey =>
                      questions
                        .filter(q => q.section === sectionKey)
                        .map(q => (
                          <TableHead key={q.id} className="text-center min-w-[44px] text-xs px-1">
                            <div className="flex flex-col items-center gap-0.5">
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: sectionColors[sectionKey].bar }}
                              />
                              <span className="font-mono">Q{q.question_number}</span>
                            </div>
                          </TableHead>
                        ))
                    )}
                  </TableRow>
                  {/* Section label header row */}
                  <TableRow className="bg-muted/20">
                    <TableCell className="sticky left-0 bg-muted/20 text-[10px] text-muted-foreground py-1" colSpan={2} />
                    {sectionKeys.map(sectionKey => {
                      const count = questions.filter(q => q.section === sectionKey).length;
                      if (count === 0) return null;
                      return (
                        <TableCell
                          key={sectionKey}
                          colSpan={count}
                          className="text-center py-1 text-[10px] font-semibold uppercase tracking-wide"
                          style={{ color: sectionColors[sectionKey].bar, backgroundColor: `${sectionColors[sectionKey].bar}10` }}
                        >
                          {sectionLabels[sectionKey]}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {respondents.map(r => (
                    <TableRow key={r.assignment.id}>
                      <TableCell className="sticky left-0 bg-card z-10 text-xs font-medium">
                        {r.customer.name}
                      </TableCell>
                      <TableCell className="text-center">
                        {r.isNew
                          ? <span className="text-[9px] font-semibold text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">NEW</span>
                          : <span className="text-[9px] text-muted-foreground">Exist.</span>
                        }
                      </TableCell>
                      {sectionKeys.flatMap(sectionKey =>
                        questions
                          .filter(q => q.section === sectionKey)
                          .map(q => {
                            if (q.is_new_expat_only && !r.isNew) {
                              return (
                                <TableCell key={q.id} className="text-center px-1">
                                  <span className="text-muted-foreground/20 text-xs">—</span>
                                </TableCell>
                              );
                            }
                            const resp = r.responses.find(res => res.question_id === q.id);
                            if (!resp) return <TableCell key={q.id} className="text-center px-1 text-xs">—</TableCell>;
                            return (
                              <TableCell key={q.id} className="text-center px-1">
                                <span className={cn(
                                  'inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white',
                                  getScoreColor(resp.score)
                                )}>
                                  {resp.score}
                                </span>
                              </TableCell>
                            );
                          })
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* ── QUESTION REFERENCE ── */}
      <Collapsible open={openSections.questionRef} onOpenChange={() => toggle('questionRef')}>
        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/20 transition-colors">
              <span className="text-sm font-semibold text-foreground">Question Reference</span>
              <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', openSections.questionRef && 'rotate-180')} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="border-t border-border px-5 py-4 space-y-5">
              {sectionKeys.map(key => (
                <div key={key}>
                  <h4 className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: sectionColors[key].bar }}>
                    {sectionLabels[key]}
                  </h4>
                  <div className="space-y-2">
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
        </div>
      </Collapsible>

      {/* ── Send Report Modal ── */}
      <SendReportModal
        isOpen={sendModalOpen}
        onClose={() => setSendModalOpen(false)}
        quarterLabel={quarter.label}
        onSend={handleSendReport}
      />

    </div>
  );
}