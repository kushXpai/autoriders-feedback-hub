// src/pages/customer/CustomerFeedbackFormPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/supabase/client';
import { cn } from '@/lib/utils';
import type {
  FeedbackAssignment, Question, FeedbackResponse, QuestionSection,
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
  service_delivery:   'Service Delivery',
  driver_quality:     'Driver Quality',
  overall:            'Overall Experience',
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

interface PageData {
  assignment: FeedbackAssignment;
  isNew: boolean;         // expat_type === 'new' from customers table
  quarterLabel: string;
  questions: Question[];
  existingResponses: FeedbackResponse[];
  existingComment: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerFeedbackFormPage() {
  const [loading, setLoading]     = useState(true);
  const [pageData, setPageData]   = useState<PageData | null>(null);
  const [noForm, setNoForm]       = useState(false);

  // form state
  const [answers, setAnswers]     = useState<Record<number, 1 | 2 | 3 | 4>>({});
  const [comment, setComment]     = useState('');
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);

  // ─── Fetch everything on mount ──────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setLoading(true);

      // 1. Get logged-in user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setNoForm(true); setLoading(false); return; }

      // 2. Get customer record linked to this user
      const { data: customerRow } = await (supabase as any)
        .from('customers')
        .select('id, expat_type')
        .eq('user_id', user.id)
        .single();

      if (!customerRow) { setNoForm(true); setLoading(false); return; }

      // 3. Get the active quarter
      const { data: activeQuarter } = await (supabase as any)
        .from('quarters')
        .select('id, label')
        .eq('is_active', true)
        .single();

      if (!activeQuarter) { setNoForm(true); setLoading(false); return; }

      // 4. Find feedback assignment for this customer + active quarter
      const { data: assignment } = await (supabase as any)
        .from('feedback_assignments')
        .select('*')
        .eq('customer_id', customerRow.id)
        .eq('quarter_id', activeQuarter.id)
        .single();

      if (!assignment) { setNoForm(true); setLoading(false); return; }

      // 5. Determine if new expat — drives which questions to show
      const isNew = (customerRow.expat_type as string) === 'new';

      // 6. Fetch active questions from DB
      const { data: allQuestions } = await (supabase as any)
        .from('questions')
        .select('*')
        .eq('is_active', true)
        .order('question_number', { ascending: true });

      const questions = (allQuestions ?? []) as Question[];

      // 7. If already submitted, fetch existing responses + comment
      let existingResponses: FeedbackResponse[] = [];
      let existingComment: string | null = null;

      if ((assignment.status as string) === 'submitted') {
        const { data: responses } = await (supabase as any)
          .from('feedback_responses')
          .select('*')
          .eq('assignment_id', assignment.id);

        existingResponses = (responses ?? []) as FeedbackResponse[];

        const { data: commentRow } = await (supabase as any)
          .from('feedback_comments')
          .select('comment')
          .eq('assignment_id', assignment.id)
          .single();

        existingComment = (commentRow as any)?.comment ?? null;
      }

      setPageData({
        assignment: assignment as FeedbackAssignment,
        isNew,
        quarterLabel: activeQuarter.label as string,
        questions,
        existingResponses,
        existingComment,
      });

      setLoading(false);
    })();
  }, []);

  // ─── Derived ────────────────────────────────────────────────────────────────

  const applicableQuestions = useMemo(() => {
    if (!pageData) return [];
    return pageData.questions.filter(q =>
      pageData.isNew || !q.is_new_expat_only
    );
  }, [pageData]);

  // ─── Submit handler ─────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!pageData) return;

    const totalQuestions = applicableQuestions.length;
    const answeredCount  = Object.keys(answers).length;

    if (answeredCount < totalQuestions) {
      setAttempted(true);
      return;
    }

    setSubmitting(true);

    const assignmentId = pageData.assignment.id;

    // Insert all responses
    const responseRows = applicableQuestions.map(q => ({
      assignment_id: assignmentId,
      question_id:   q.id,
      score:         answers[q.id],
    }));

    const { error: respError } = await (supabase as any)
      .from('feedback_responses')
      .insert(responseRows);

    if (respError) {
      console.error('Error saving responses:', respError.message);
      setSubmitting(false);
      return;
    }

    // Insert comment if provided
    if (comment.trim()) {
      await (supabase as any).from('feedback_comments').insert({
        assignment_id: assignmentId,
        comment:       comment.trim(),
      });
    }

    // Update assignment status to submitted
    const now = new Date().toISOString();
    await (supabase.from('feedback_assignments') as any)
      .update({ status: 'submitted', submitted_at: now })
      .eq('id', assignmentId);

    setSubmittedAt(new Date());
    setSubmitting(false);
    setSubmitted(true);
  };

  // ─── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your feedback form…
      </div>
    );
  }

  // ─── No form assigned ───────────────────────────────────────────────────────

  if (noForm || !pageData) {
    return (
      <div className="animate-fade-in-up max-w-lg mx-auto md:max-w-2xl">
        <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
          <p className="text-muted-foreground">No feedback form has been sent to you for the current quarter.</p>
          <p className="text-sm text-muted-foreground mt-1">Please check back later.</p>
        </div>
      </div>
    );
  }

  const { assignment, isNew, quarterLabel, existingResponses, existingComment } = pageData;

  // ─── Just submitted — thank you screen ─────────────────────────────────────

  if (submitted && submittedAt) {
    return (
      <div className="animate-fade-in-up max-w-lg mx-auto md:max-w-2xl">
        <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-500" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Thank you for your feedback</h2>
          <p className="text-sm text-muted-foreground mt-2">
            Your {quarterLabel} form was submitted on{' '}
            {submittedAt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            {' '}at{' '}
            {submittedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.
          </p>
        </div>
      </div>
    );
  }

  // ─── Already submitted (from DB) — read-only view ──────────────────────────

  if (assignment.status === 'submitted') {
    return (
      <div className="animate-fade-in-up space-y-5 max-w-lg mx-auto md:max-w-2xl">
        <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/20 p-4">
          <p className="text-sm font-medium text-foreground">
            You have already submitted your {quarterLabel} feedback
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Submitted on{' '}
            {new Date(assignment.submitted_at!).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
        </div>

        {sectionKeys.map(sectionKey => {
          if (sectionKey === 'service_initiation' && !isNew) return null;
          const sectionQuestions = applicableQuestions.filter(q => q.section === sectionKey);
          if (sectionQuestions.length === 0) return null;
          return (
            <div key={sectionKey}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {sectionLabels[sectionKey]}
              </h3>
              <div className="space-y-3">
                {sectionQuestions.map(q => {
                  const resp = existingResponses.find(r => r.question_id === q.id);
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

        {existingComment && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Your Comment
            </h3>
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{existingComment}</p>
          </div>
        )}
      </div>
    );
  }

  // ─── Pending — fill the form ────────────────────────────────────────────────

  const answeredCount  = Object.keys(answers).length;
  const totalQuestions = applicableQuestions.length;
  const progress       = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
  const allAnswered    = answeredCount === totalQuestions;

  return (
    <div className="animate-fade-in-up space-y-4 max-w-lg mx-auto md:max-w-2xl">

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg sm:text-xl font-semibold text-foreground">{quarterLabel} Feedback Form</h1>
        <span className="text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-full bg-accent/15 text-accent whitespace-nowrap">
          {isNew ? 'New Expat' : 'Existing Expat'}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>{answeredCount} of {totalQuestions} answered</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="h-2 rounded-full bg-accent transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Questions by section */}
      {sectionKeys.map(sectionKey => {
        if (sectionKey === 'service_initiation' && !isNew) return null;
        const sectionQuestions = applicableQuestions.filter(q => q.section === sectionKey);
        if (sectionQuestions.length === 0) return null;
        return (
          <div key={sectionKey}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3 pb-2 border-b border-border">
              {sectionLabels[sectionKey]}
            </h2>
            <div className="space-y-4">
              {sectionQuestions.map(q => {
                const unanswered = attempted && !answers[q.id];
                return (
                  <div
                    key={q.id}
                    className={cn(
                      'bg-card rounded-xl border p-4 shadow-sm transition-colors',
                      unanswered ? 'border-red-400/60' : 'border-border'
                    )}
                  >
                    <div className="flex items-start gap-2 mb-3">
                      <span className="text-xs text-muted-foreground font-mono mt-0.5 shrink-0">
                        Q{q.question_number}
                      </span>
                      <p className="text-sm text-foreground leading-snug">{q.text}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                      {scoreOptions.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt.value as 1 | 2 | 3 | 4 }))}
                          className={cn(
                            'px-3 py-2.5 sm:py-2 rounded-full text-xs font-medium transition-all active:scale-[0.96] border text-center',
                            answers[q.id] === opt.value
                              ? 'bg-accent text-accent-foreground border-accent shadow-sm'
                              : 'bg-card text-foreground border-border hover:border-accent/40 hover:bg-accent/5'
                          )}
                        >
                          <span className="sm:hidden">{opt.value} — {opt.label.split(' ')[0]}</span>
                          <span className="hidden sm:inline">{opt.value} — {opt.label}</span>
                        </button>
                      ))}
                    </div>
                    {unanswered && (
                      <p className="text-xs text-red-500 mt-2">Please select a rating</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Comment */}
      <div>
        <label className="text-sm font-medium text-foreground block mb-2">
          Any additional feedback you would like to share
        </label>
        <Textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          placeholder="Optional — share any thoughts, suggestions, or concerns..."
          className="min-h-[100px] resize-y"
        />
      </div>

      {/* Submit */}
      <div className="pb-8">
        <Button
          onClick={handleSubmit}
          disabled={submitting}
          className={cn(
            'w-full py-3 text-sm font-semibold transition-all',
            allAnswered
              ? 'bg-accent hover:bg-accent/90 text-accent-foreground'
              : 'bg-muted text-muted-foreground'
          )}
          size="lg"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting…</>
          ) : allAnswered
            ? 'Submit Feedback'
            : `Answer all questions to submit (${totalQuestions - answeredCount} remaining)`
          }
        </Button>
      </div>
    </div>
  );
}