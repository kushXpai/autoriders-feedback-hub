// src/pages/admin/FeedbackPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QuarterCard from '@/components/QuarterCard';
import { supabase } from '@/supabase/client';
import { cn } from '@/lib/utils';
import type {
  Customer, Quarter, Question, FeedbackAssignment, FeedbackResponse, QuestionSection,
} from '@/types/database.types';

// ─── Constants ────────────────────────────────────────────────────────────────

const scoreOptions = [
  { value: 1, label: 'Needs Improvement' },
  { value: 2, label: 'Fair' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Excellence' },
] as const;

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

function getScoreColor(score: number) {
  if (score === 4) return 'bg-emerald-500';
  if (score === 3) return 'bg-blue-500';
  if (score === 2) return 'bg-amber-500';
  return 'bg-red-500';
}

function getScoreLabel(score: number) {
  return scoreOptions.find(o => o.value === score)?.label ?? '';
}

// ─── Types ────────────────────────────────────────────────────────────────────

type StatusFilter = 'all' | 'submitted' | 'pending';

interface EnrichedAssignment extends FeedbackAssignment {
  customer: Customer | null;
  isNew: boolean;
  responses: FeedbackResponse[];
  comment: string | null;
}

interface QuarterCardData {
  quarterId: string;
  label: string;
  total: number;
  submitted: number;
  pending: number;
  sentDate: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const [loading, setLoading] = useState(true);
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [assignments, setAssignments] = useState<FeedbackAssignment[]>([]);

  // Responses + comments keyed by assignment id — loaded lazily per quarter
  const [responseMap, setResponseMap] = useState<Record<number, FeedbackResponse[]>>({});
  const [commentMap, setCommentMap] = useState<Record<number, string | null>>({});
  const [detailLoading, setDetailLoading] = useState(false);

  // Navigation / filter state
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);

  // ─── Initial fetch ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);

      const [
        { data: quartersData },
        { data: customersData },
        { data: questionsData },
        { data: assignmentsData },
      ] = await Promise.all([
        (supabase as any).from('quarters').select('*').order('year').order('quarter_number'),
        (supabase as any).from('customers').select('*').eq('is_active', true).order('name'),
        (supabase as any).from('questions').select('*').eq('is_active', true).order('question_number', { ascending: true }),
        (supabase as any).from('feedback_assignments').select('*').order('created_at', { ascending: false }),
      ]);

      setQuarters((quartersData ?? []) as Quarter[]);
      setCustomers((customersData ?? []) as Customer[]);
      setQuestions((questionsData ?? []) as Question[]);
      setAssignments((assignmentsData ?? []) as FeedbackAssignment[]);
      setLoading(false);
    })();
  }, []);

  // ─── Load responses + comments when a quarter is selected ───────────────────
  useEffect(() => {
    if (!selectedQuarter) return;

    (async () => {
      setDetailLoading(true);

      // Only fetch for submitted assignments we don't already have
      const submittedIds = assignments
        .filter(a => a.quarter_id === selectedQuarter && a.status === 'submitted')
        .filter(a => !responseMap[a.id])
        .map(a => a.id);

      if (submittedIds.length === 0) {
        setDetailLoading(false);
        return;
      }

      const [{ data: responsesData }, { data: commentsData }] = await Promise.all([
        (supabase as any)
          .from('feedback_responses')
          .select('*')
          .in('assignment_id', submittedIds),
        (supabase as any)
          .from('feedback_comments')
          .select('assignment_id, comment')
          .in('assignment_id', submittedIds),
      ]);

      // Group responses by assignment_id
      const newResponseMap: Record<number, FeedbackResponse[]> = {};
      for (const r of (responsesData ?? []) as FeedbackResponse[]) {
        if (!newResponseMap[r.assignment_id]) newResponseMap[r.assignment_id] = [];
        newResponseMap[r.assignment_id].push(r);
      }

      // Map comments by assignment_id
      const newCommentMap: Record<number, string | null> = {};
      for (const c of (commentsData ?? []) as { assignment_id: number; comment: string }[]) {
        newCommentMap[c.assignment_id] = c.comment;
      }

      setResponseMap(prev => ({ ...prev, ...newResponseMap }));
      setCommentMap(prev => ({ ...prev, ...newCommentMap }));
      setDetailLoading(false);
    })();
  }, [selectedQuarter, assignments]);

  // ─── Derived: quarter cards ──────────────────────────────────────────────────
  const quarterCards = useMemo<QuarterCardData[]>(() => {
    const map = new Map<string, FeedbackAssignment[]>();
    assignments.forEach(a => {
      if (!map.has(a.quarter_id)) map.set(a.quarter_id, []);
      map.get(a.quarter_id)!.push(a);
    });

    return Array.from(map.entries())
      .sort((a, b) => {
        const parse = (id: string) => {
          const m = id.match(/q(\d)-(\d+)/);
          return m ? parseInt(m[2]) * 10 + parseInt(m[1]) : 0;
        };
        return parse(b[0]) - parse(a[0]);
      })
      .map(([quarterId, qAssignments]) => {
        const label = quarters.find(q => q.id === quarterId)?.label ?? quarterId;
        const submitted = qAssignments.filter(a => a.status === 'submitted').length;
        const pending = qAssignments.filter(a => a.status === 'pending').length;
        const total = qAssignments.length;
        const earliest = qAssignments
          .map(a => new Date(a.created_at).getTime())
          .sort((a, b) => a - b)[0];
        const sentDate = earliest
          ? new Date(earliest).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          : '—';
        return { quarterId, label, total, submitted, pending, sentDate };
      });
  }, [assignments, quarters]);

  // ─── Derived: enriched rows for selected quarter ─────────────────────────────
  const filteredRows = useMemo<EnrichedAssignment[]>(() => {
    if (!selectedQuarter) return [];

    return assignments
      .filter(a => a.quarter_id === selectedQuarter)
      .filter(a => statusFilter === 'all' || a.status === statusFilter)
      .map(a => {
        const customer = customers.find(c => c.id === a.customer_id) ?? null;
        const isNew = customer?.expat_type === 'new';
        return {
          ...a,
          customer,
          isNew,
          responses: responseMap[a.id] ?? [],
          comment: commentMap[a.id] ?? null,
        };
      });
  }, [selectedQuarter, statusFilter, assignments, customers, responseMap, commentMap]);

  // ─── Detail slide-over data ──────────────────────────────────────────────────
  const selectedRow = filteredRows.find(r => r.id === selectedAssignmentId) ?? null;
  const selectedQuarterLabel = quarters.find(q => q.id === selectedRow?.quarter_id)?.label ?? '';

  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'pending', label: 'Pending' },
  ];

  // ─── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading feedback…
      </div>
    );
  }

  // ─── Quarter cards view ──────────────────────────────────────────────────────
  if (!selectedQuarter) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <h1 className="text-2xl font-semibold text-foreground">Feedback</h1>
        {quarterCards.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
            <p className="text-muted-foreground">No feedback forms have been sent yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quarterCards.map(card => (
              <QuarterCard
                key={card.quarterId}
                label={card.label}
                rows={[
                  { label: 'Total Sent', value: `${card.total} customers` },
                  { label: 'Sent on', value: card.sentDate },
                ]}
                progress={{ value: card.submitted, max: card.total }}
                onClick={() => { setSelectedQuarter(card.quarterId); setStatusFilter('all'); }}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const quarterLabel = quarters.find(q => q.id === selectedQuarter)?.label ?? selectedQuarter;

  // ─── Quarter detail — table view ─────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { setSelectedQuarter(null); setSelectedAssignmentId(null); }}
          className="shrink-0"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-semibold text-foreground">{quarterLabel} — Feedback</h1>
      </div>

      {/* Status filter pills */}
      <div className="flex gap-1.5">
        {statusFilters.map(f => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={cn(
              'px-3.5 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.97]',
              statusFilter === f.value
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Responses loading indicator */}
      {detailLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading responses…
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10">Customer</TableHead>
              <TableHead>Expat</TableHead>
              {questions.map(q => (
                <TableHead key={q.id} className="text-center px-1 w-8">
                  Q{q.question_number}
                </TableHead>
              ))}
              <TableHead>Comment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map(row => (
              <TableRow
                key={row.id}
                className={cn(
                  'transition-colors',
                  row.status === 'submitted'
                    ? 'cursor-pointer hover:bg-muted/30'
                    : 'opacity-60'
                )}
                onClick={() => row.status === 'submitted' && setSelectedAssignmentId(row.id)}
              >
                {/* Customer name + email */}
                <TableCell className="sticky left-0 bg-card z-10 font-medium">
                  <div>
                    <p className="text-sm">{row.customer?.name ?? '—'}</p>
                    <p className="text-xs text-muted-foreground">{row.customer?.email ?? '—'}</p>
                  </div>
                </TableCell>

                {/* Expat type badge */}
                <TableCell>
                  <span className={cn(
                    'text-xs px-1.5 py-0.5 rounded capitalize',
                    row.isNew
                      ? 'bg-accent/15 text-accent font-medium'
                      : 'text-muted-foreground'
                  )}>
                    {row.customer?.expat_type ?? '—'}
                  </span>
                </TableCell>

                {/* Score cells per question */}
                {questions.map(q => {
                  if (row.status !== 'submitted') {
                    return (
                      <TableCell key={q.id} className="text-center px-1">
                        <span className="text-muted-foreground/30">—</span>
                      </TableCell>
                    );
                  }
                  if (q.is_new_expat_only && !row.isNew) {
                    return (
                      <TableCell key={q.id} className="text-center px-1">
                        <span className="text-muted-foreground/20">·</span>
                      </TableCell>
                    );
                  }
                  const resp = row.responses.find(r => r.question_id === q.id);
                  if (!resp) {
                    return (
                      <TableCell key={q.id} className="text-center px-1">
                        <span className="text-muted-foreground/30">—</span>
                      </TableCell>
                    );
                  }
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
                })}

                {/* Comment */}
                <TableCell className="max-w-[120px]">
                  {row.comment ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground truncate block max-w-[120px]">
                          {row.comment}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">{row.comment}</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-muted-foreground/30">—</span>
                  )}
                </TableCell>

                {/* Status badge */}
                <TableCell>
                  <span className={cn(
                    'text-xs font-medium px-2.5 py-1 rounded-full',
                    row.status === 'submitted'
                      ? 'bg-emerald-500/15 text-emerald-600'
                      : 'bg-accent/15 text-accent'
                  )}>
                    {row.status}
                  </span>
                </TableCell>

                {/* Submitted date */}
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {row.submitted_at
                    ? new Date(row.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : '—'}
                </TableCell>
              </TableRow>
            ))}

            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={questions.length + 6}
                  className="text-center text-muted-foreground py-8"
                >
                  No feedback found for this quarter.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Detail Slide-over ── */}
      <Sheet open={selectedAssignmentId !== null} onOpenChange={() => setSelectedAssignmentId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedRow && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedRow.customer?.name ?? '—'}</SheetTitle>
                <SheetDescription>
                  {selectedQuarterLabel} · {selectedRow.isNew ? 'New' : 'Existing'} Expat
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {sectionKeys.map(sectionKey => {
                  if (sectionKey === 'service_initiation' && !selectedRow.isNew) return null;

                  const sectionQuestions = questions.filter(q => q.section === sectionKey);
                  if (sectionQuestions.length === 0) return null;

                  return (
                    <div key={sectionKey}>
                      <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">
                        {sectionLabels[sectionKey]}
                      </h3>
                      <div className="space-y-3">
                        {sectionQuestions.map(q => {
                          const resp = selectedRow.responses.find(r => r.question_id === q.id);
                          if (!resp) return null;
                          return (
                            <div key={q.id} className="flex items-start gap-3">
                              <span className="text-xs text-muted-foreground font-mono mt-0.5 w-6 shrink-0">
                                Q{q.question_number}
                              </span>
                              <div className="flex-1">
                                <p className="text-sm text-foreground leading-snug">
                                  {q.text}
                                </p>

                                <div className="flex items-center gap-2 mt-1.5">
                                  <span
                                    className={cn(
                                      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white',
                                      getScoreColor(resp.score)
                                    )}
                                  >
                                    {resp.score}
                                  </span>

                                  {/* ✅ UPDATED: Bold + black label */}
                                  <span className="text-xs font-semibold text-foreground">
                                    {getScoreLabel(resp.score)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {selectedRow.comment && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wide">
                      Comments
                    </h3>

                    <p className="text-sm text-foreground bg-muted/50 rounded-lg p-3 leading-relaxed font-medium">
                      {selectedRow.comment}
                    </p>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}