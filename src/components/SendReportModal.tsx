// src/components/SendReportModal.tsx
import { useState, useRef, useCallback } from 'react';
import { X, Plus, Trash2, Send, Loader2, CheckCircle2, AlertCircle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/supabase/client';
import type {
  QuarterReport, Question, QuestionSection,
  Customer, FeedbackAssignment, FeedbackResponse,
} from '@/types/database.types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Respondent {
  assignment: FeedbackAssignment;
  customer: Customer;
  isNew: boolean;
  responses: FeedbackResponse[];
}

interface SendReportModalProps {
  open: boolean;
  onClose: () => void;
  quarterLabel: string;
  report: QuarterReport;
  questions: Question[];
  respondents: Respondent[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

const sectionKeys: QuestionSection[] = [
  'service_initiation',
  'service_delivery',
  'driver_quality',
  'overall',
];

function getOutcomeLabel(outcome: string): string {
  switch (outcome) {
    case 'incentive':    return 'Incentive';
    case 'on_target':    return 'On Target';
    case 'below_target': return 'Below Target';
    case 'penalty':      return 'Penalty';
    default: return outcome;
  }
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// ─── Build payload helpers ────────────────────────────────────────────────────

function buildOverview(
  quarterLabel: string,
  report: QuarterReport,
  questions: Question[],
  respondents: Respondent[],
) {
  const sections = sectionKeys.map(key => {
    const sQuestions = questions.filter(q => q.section === key);
    const isNewOnly = key === 'service_initiation';
    const applicable = isNewOnly ? respondents.filter(r => r.isNew) : respondents;

    let total = 0;
    applicable.forEach(r => {
      sQuestions.forEach(q => {
        const resp = r.responses.find(res => String(res.question_id) === String(q.id));
        if (resp) total += resp.score;
      });
    });

    const divisor = applicable.length * sQuestions.length;
    const avg = divisor > 0 ? total / divisor : 0;
    const pct = (avg / 4) * 100;

    return {
      label: sectionLabels[key],
      avg,
      pct,
      appliesTo: sectionAppliesTo[key],
    };
  });

  return {
    quarterLabel,
    outcome: getOutcomeLabel(report.outcome),
    totalRespondents: report.total_respondents,
    totalAssigned: report.total_assigned,
    newExpatCount: report.new_expat_count,
    overallPct: Number(report.overall_pct),
    sections,
  };
}

function buildResponses(questions: Question[], respondents: Respondent[]) {
  return respondents.map(r => {
    const answers: Record<string, number | null> = {};
    questions.forEach(q => {
      const resp = r.responses.find(res => String(res.question_id) === String(q.id));
      // N/A for new-expat-only questions on non-new respondents
      if (q.is_new_expat_only && !r.isNew) {
        answers[`Q${q.question_number}`] = null;
      } else {
        answers[`Q${q.question_number}`] = resp?.score ?? null;
      }
    });
    return { customerName: r.customer.name, isNew: r.isNew, answers };
  });
}

function buildQuestions(questions: Question[]) {
  return questions.map(q => ({
    number: q.question_number,
    text: q.text,
    section: q.section,
  }));
}

function buildKpiRows(
  report: QuarterReport,
  questions: Question[],
  respondents: Respondent[],
) {
  return sectionKeys.map(key => {
    const sQuestions = questions.filter(q => q.section === key);
    const isNewOnly = key === 'service_initiation';
    const applicable = isNewOnly ? respondents.filter(r => r.isNew) : respondents;

    let total = 0;
    applicable.forEach(r => {
      sQuestions.forEach(q => {
        const resp = r.responses.find(res => String(res.question_id) === String(q.id));
        if (resp) total += resp.score;
      });
    });

    const divisor = applicable.length * sQuestions.length;
    const avg = divisor > 0 ? total / divisor : 0;
    const pct = (avg / 4) * 100;

    const outcome =
      pct >= 85 ? 'Incentive'
      : pct >= 80 ? 'On Target'
      : pct >= 70 ? 'Below Target'
      : 'Penalty';

    return { section: sectionLabels[key], avg, pct, target: 80, outcome };
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

type SendState = 'idle' | 'sending' | 'success' | 'error';

export default function SendReportModal({
  open,
  onClose,
  quarterLabel,
  report,
  questions,
  respondents,
}: SendReportModalProps) {
  const [emails, setEmails] = useState<string[]>(['']);
  const [sendState, setSendState] = useState<SendState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [sentCount, setSentCount] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const reset = useCallback(() => {
    setEmails(['']);
    setSendState('idle');
    setErrorMsg('');
    setSentCount(0);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const updateEmail = (idx: number, value: string) => {
    setEmails(prev => prev.map((e, i) => (i === idx ? value : e)));
  };

  const addEmail = () => {
    setEmails(prev => [...prev, '']);
    // Focus the new input after render
    setTimeout(() => {
      inputRefs.current[emails.length]?.focus();
    }, 50);
  };

  const removeEmail = (idx: number) => {
    if (emails.length === 1) { setEmails(['']); return; }
    setEmails(prev => prev.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (idx === emails.length - 1) addEmail();
      else inputRefs.current[idx + 1]?.focus();
    }
  };

  const validEmails = emails.filter(e => isValidEmail(e));
  const canSend = validEmails.length > 0 && sendState === 'idle';

  const handleSend = async () => {
    setSendState('sending');
    setErrorMsg('');

    try {
      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not authenticated');

      const overview = buildOverview(quarterLabel, report, questions, respondents);
      const responses = buildResponses(questions, respondents);
      const builtQuestions = buildQuestions(questions);
      const kpiRows = buildKpiRows(report, questions, respondents);

      const res = await fetch('/api/send-report-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipients: validEmails,
          overview,
          responses,
          questions: builtQuestions,
          kpiRows,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to send');

      setSentCount(json.sent ?? validEmails.length);
      setSendState('success');
    } catch (err: any) {
      setErrorMsg(err.message ?? 'Something went wrong. Please try again.');
      setSendState('error');
    }
  };

  if (!open) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* Dim overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Panel */}
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-md animate-fade-in-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Send Report</p>
              <p className="text-xs text-muted-foreground">{quarterLabel}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">

          {/* Success state */}
          {sendState === 'success' && (
            <div className="flex flex-col items-center py-6 gap-3 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Report Sent!</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Successfully delivered to {sentCount} recipient{sentCount !== 1 ? 's' : ''}.
                  <br />The Excel report is attached to the email.
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={handleClose} className="mt-2">
                Close
              </Button>
            </div>
          )}

          {/* Default / Error state */}
          {sendState !== 'success' && (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2.5">
                  Recipients <span className="text-primary font-semibold">({validEmails.length} valid)</span>
                </p>

                <div className="space-y-2">
                  {emails.map((email, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className={cn(
                        'flex-1 flex items-center gap-2 rounded-lg border bg-background px-3 py-2 transition-colors',
                        email && !isValidEmail(email)
                          ? 'border-red-500/50 bg-red-500/5'
                          : 'border-border focus-within:border-primary/50',
                      )}>
                        <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <input
                          ref={el => { inputRefs.current[idx] = el; }}
                          type="email"
                          placeholder="email@example.com"
                          value={email}
                          onChange={e => updateEmail(idx, e.target.value)}
                          onKeyDown={e => handleKeyDown(e, idx)}
                          className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground/50"
                          disabled={sendState === 'sending'}
                        />
                        {email && isValidEmail(email) && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        )}
                      </div>
                      <button
                        onClick={() => removeEmail(idx)}
                        disabled={emails.length === 1 && email === ''}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addEmail}
                  disabled={sendState === 'sending'}
                  className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add another recipient
                </button>
              </div>

              {/* What's included note */}
              <div className="bg-muted/40 rounded-lg border border-border px-3.5 py-3 space-y-1.5">
                <p className="text-[11px] font-semibold text-foreground uppercase tracking-wide">What's included</p>
                <div className="space-y-1">
                  {[
                    'Excel file attached (3 sheets)',
                    'Sheet 1: Report overview & KPIs',
                    'Sheet 2: Individual responses table',
                    'Sheet 3: Full detailed breakdown',
                  ].map(line => (
                    <p key={line} className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/50 shrink-0" />
                      {line}
                    </p>
                  ))}
                </div>
              </div>

              {/* Error banner */}
              {sendState === 'error' && errorMsg && (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-600">{errorMsg}</p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {sendState !== 'success' && (
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
            <Button variant="ghost" size="sm" onClick={handleClose} disabled={sendState === 'sending'}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!canSend}
              className="min-w-[110px]"
            >
              {sendState === 'sending' ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
              ) : (
                <><Send className="w-4 h-4 mr-2" />Send Report</>
              )}
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}