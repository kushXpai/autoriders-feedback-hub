// src/pages/customer/CustomerPreviousFeedbackPage.tsx
import { useState, useEffect } from 'react';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/supabase/client';
import { cn } from '@/lib/utils';
import type { FeedbackAssignment, FeedbackResponse, Question, QuestionSection } from '@/types/database.types';

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

const scoreOptions = [
  { value: 1, label: 'Needs Improvement' },
  { value: 2, label: 'Fair' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Excellence' },
] as const;

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

interface SubmittedAssignment extends FeedbackAssignment {
  quarter_label: string;
  is_new: boolean;
}

interface DetailData {
  assignment: SubmittedAssignment;
  responses: FeedbackResponse[];
  questions: Question[];
  comment: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerPreviousFeedbackPage() {
  const [loading, setLoading]                           = useState(true);
  const [submitted, setSubmitted]                       = useState<SubmittedAssignment[]>([]);
  const [allQuestions, setAllQuestions]                 = useState<Question[]>([]);
  const [viewingId, setViewingId]                       = useState<number | null>(null);
  const [detail, setDetail]                             = useState<DetailData | null>(null);
  const [detailLoading, setDetailLoading]               = useState(false);

  // ─── Fetch list of submitted assignments on mount ───────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);

      // Get logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      // Get customer record
      const { data: customerRow } = await (supabase as any)
        .from('customers')
        .select('id, expat_type')
        .eq('user_id', user.id)
        .single();

      if (!customerRow) { setLoading(false); return; }

      // Get all submitted assignments for this customer, newest first
      const { data: assignments } = await (supabase as any)
        .from('feedback_assignments')
        .select('*')
        .eq('customer_id', (customerRow as any).id)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false });

      if (!assignments || assignments.length === 0) { setLoading(false); return; }

      // Get quarter labels for all assignment quarter_ids
      const quarterIds = [...new Set((assignments as any[]).map((a) => a.quarter_id))];
      const { data: quarters } = await (supabase as any)
        .from('quarters')
        .select('id, label')
        .in('id', quarterIds);

      const quarterMap = Object.fromEntries(((quarters ?? []) as any[]).map((q) => [q.id, q.label]));

      // Build enriched list
      const enriched: SubmittedAssignment[] = (assignments as any[]).map(a => ({
        ...a,
        quarter_label: quarterMap[a.quarter_id] ?? a.quarter_id,
        is_new: (customerRow as any).expat_type === 'new',
      }));

      // Fetch all active questions once (used when viewing detail)
      const { data: questions } = await (supabase as any)
        .from('questions')
        .select('*')
        .eq('is_active', true)
        .order('question_number', { ascending: true });

      setAllQuestions((questions ?? []) as Question[]);
      setSubmitted(enriched);
      setLoading(false);
    })();
  }, []);

  // ─── Fetch detail when user clicks View ─────────────────────────────────────
  useEffect(() => {
    if (viewingId === null) { setDetail(null); return; }

    (async () => {
      setDetailLoading(true);

      const assignment = submitted.find(a => a.id === viewingId);
      if (!assignment) { setDetailLoading(false); return; }

      // Fetch responses for this assignment
      const { data: responses } = await (supabase as any)
        .from('feedback_responses')
        .select('*')
        .eq('assignment_id', viewingId);

      // Fetch comment
      const { data: commentRow } = await (supabase as any)
        .from('feedback_comments')
        .select('comment')
        .eq('assignment_id', viewingId)
        .single();

      // Filter questions relevant for this submission
      const applicableQuestions = allQuestions.filter(q =>
        assignment.is_new || !q.is_new_expat_only
      );

      setDetail({
        assignment,
        responses: (responses ?? []) as FeedbackResponse[],
        questions: applicableQuestions,
        comment: (commentRow as any)?.comment ?? null,
      });

      setDetailLoading(false);
    })();
  }, [viewingId]);

  // ─── Loading state ───────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading feedback history…
      </div>
    );
  }

  // ─── Detail view ─────────────────────────────────────────────────────────────

  if (viewingId !== null) {
    if (detailLoading || !detail) {
      return (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading submission…
        </div>
      );
    }

    const { assignment, responses, questions, comment } = detail;

    return (
      <div className="animate-fade-in-up space-y-5 max-w-lg mx-auto md:max-w-none">
        <Button
          variant="ghost"
          onClick={() => setViewingId(null)}
          className="text-muted-foreground -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to History
        </Button>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">{assignment.quarter_label} Feedback</h1>
          <span className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full capitalize',
            assignment.is_new ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
          )}>
            {assignment.is_new ? 'New' : 'Existing'} Expat
          </span>
        </div>

        {sectionKeys.map(sectionKey => {
          if (sectionKey === 'service_initiation' && !assignment.is_new) return null;
          const sectionQuestions = questions.filter(q => q.section === sectionKey);
          if (sectionQuestions.length === 0) return null;
          return (
            <div key={sectionKey}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {sectionLabels[sectionKey]}
              </h3>
              <div className="space-y-3">
                {sectionQuestions.map(q => {
                  const resp = responses.find(r => r.question_id === q.id);
                  if (!resp) return null;
                  return (
                    <div key={q.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-muted-foreground font-mono mt-0.5 w-6 shrink-0">
                          Q{q.question_number}
                        </span>
                        <div className="flex-1">
                          <p className="text-sm text-foreground leading-snug">{q.text}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={cn(
                              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white',
                              getScoreColor(resp.score)
                            )}>
                              {resp.score}
                            </span>
                            <span className="text-xs text-muted-foreground">{getScoreLabel(resp.score)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {comment && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Your Comment
            </h3>
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">
              {comment}
            </p>
          </div>
        )}
      </div>
    );
  }

  // ─── List view ───────────────────────────────────────────────────────────────

  return (
    <div className="animate-fade-in-up space-y-5 max-w-lg mx-auto md:max-w-none">
      <h1 className="text-xl font-semibold text-foreground">Previous Feedback</h1>

      {submitted.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
          <p className="text-muted-foreground">No previous submissions found.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {submitted.map(a => (
            <div
              key={a.id}
              className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{a.quarter_label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="capitalize">{a.is_new ? 'New' : 'Existing'} expat</span>
                  {' · '}
                  Submitted{' '}
                  {new Date(a.submitted_at!).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => setViewingId(a.id)}>
                View
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}