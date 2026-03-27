import { useState, useMemo } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  DEMO_CUSTOMER_ID, feedbackAssignments, customerQuarterProfiles,
  questions, sectionLabels, getFeedbackResponses, getFeedbackComment,
  getScoreLabel, getScoreColor,
} from '@/data/mockData';
import { cn } from '@/lib/utils';

const scoreOptions = [
  { value: 1, label: 'Needs Improvement' },
  { value: 2, label: 'Fair' },
  { value: 3, label: 'Good' },
  { value: 4, label: 'Excellence' },
] as const;

const sectionKeys = ['service_initiation', 'service_delivery', 'driver_quality', 'overall'] as const;

export default function CustomerFeedbackFormPage() {
  const assignment = feedbackAssignments.find(a => a.customerId === DEMO_CUSTOMER_ID && a.quarterId === 'q1-2026');
  const profile = customerQuarterProfiles.find(p => p.customerId === DEMO_CUSTOMER_ID && p.quarterId === 'q1-2026');
  const isNew = profile?.expatType === 'new';

  const applicableQuestions = useMemo(
    () => questions.filter(q => isNew || !q.isNewExpatOnly),
    [isNew]
  );

  const [answers, setAnswers] = useState<Record<number, 1 | 2 | 3 | 4>>({});
  const [comment, setComment] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<Date | null>(null);

  if (!assignment) {
    return (
      <div className="animate-fade-in-up max-w-lg mx-auto md:max-w-2xl">
        <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
          <p className="text-muted-foreground">No feedback form has been sent to you for the current quarter.</p>
          <p className="text-sm text-muted-foreground mt-1">Please check back later.</p>
        </div>
      </div>
    );
  }

  // Already submitted — read-only view
  if (assignment.status === 'submitted' || submitted) {
    const responses = submitted ? applicableQuestions.map(q => ({ assignmentId: assignment.id, questionId: q.id, score: answers[q.id] ?? 3 as 1|2|3|4 })) : getFeedbackResponses(assignment.id);
    const existingComment = submitted ? comment : getFeedbackComment(assignment.id);
    const displayDate = submitted && submittedAt ? submittedAt : assignment.submittedAt ? new Date(assignment.submittedAt) : new Date();

    if (submitted) {
      return (
        <div className="animate-fade-in-up max-w-lg mx-auto md:max-w-2xl">
          <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">Thank you for your feedback</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Your Q1 2026 form has been submitted on {displayDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {displayDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="animate-fade-in-up space-y-5 max-w-lg mx-auto md:max-w-2xl">
        <div className="bg-emerald-500/10 rounded-xl border border-emerald-500/20 p-4">
          <p className="text-sm font-medium text-foreground">You have already submitted your Q1 2026 feedback</p>
          <p className="text-xs text-muted-foreground mt-1">
            Submitted on {new Date(displayDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        {sectionKeys.map(sectionKey => {
          if (sectionKey === 'service_initiation' && !isNew) return null;
          const sectionQuestions = questions.filter(q => q.section === sectionKey);
          return (
            <div key={sectionKey}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">{sectionLabels[sectionKey]}</h3>
              <div className="space-y-3">
                {sectionQuestions.map(q => {
                  const resp = responses.find(r => r.questionId === q.id);
                  if (!resp) return null;
                  return (
                    <div key={q.id} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <span className="text-xs text-muted-foreground font-mono mt-0.5 w-6 shrink-0">Q{q.number}</span>
                        <div className="flex-1">
                          <p className="text-sm text-foreground leading-snug">{q.text}</p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white', getScoreColor(resp.score))}>
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
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Your Comment</h3>
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">{existingComment}</p>
          </div>
        )}
      </div>
    );
  }

  // Pending — fill form
  const answeredCount = Object.keys(answers).length;
  const totalQuestions = applicableQuestions.length;
  const progress = (answeredCount / totalQuestions) * 100;
  const allAnswered = answeredCount === totalQuestions;

  const handleSubmit = () => {
    if (!allAnswered) {
      setAttempted(true);
      return;
    }
    setSubmitted(true);
    setSubmittedAt(new Date());
  };

  return (
    <div className="animate-fade-in-up space-y-4 max-w-lg mx-auto md:max-w-2xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg sm:text-xl font-semibold text-foreground">Q1 2026 Feedback Form</h1>
        <span className="text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-full bg-accent/15 text-accent whitespace-nowrap">
          {profile?.expatType === 'new' ? 'New Expat' : 'Existing Expat'}
        </span>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
          <span>{answeredCount} of {totalQuestions} answered</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div className="h-2 rounded-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Questions by section */}
      {sectionKeys.map(sectionKey => {
        if (sectionKey === 'service_initiation' && !isNew) return null;
        const sectionQuestions = questions.filter(q => q.section === sectionKey);
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
                      <span className="text-xs text-muted-foreground font-mono mt-0.5 shrink-0">Q{q.number}</span>
                      <p className="text-sm text-foreground leading-snug">{q.text}</p>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
                      {scoreOptions.map(opt => (
                        <button
                          key={opt.value}
                          onClick={() => setAnswers(prev => ({ ...prev, [q.id]: opt.value as 1|2|3|4 }))}
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
          disabled={false}
          className={cn(
            'w-full py-3 text-sm font-semibold transition-all',
            allAnswered
              ? 'bg-accent hover:bg-accent/90 text-accent-foreground'
              : 'bg-muted text-muted-foreground'
          )}
          size="lg"
        >
          {allAnswered ? 'Submit Feedback' : `Answer all questions to submit (${totalQuestions - answeredCount} remaining)`}
        </Button>
      </div>
    </div>
  );
}