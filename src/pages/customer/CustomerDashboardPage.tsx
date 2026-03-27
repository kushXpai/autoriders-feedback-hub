import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEMO_CUSTOMER_ID, customers, feedbackAssignments, customerQuarterProfiles,
  getFeedbackResponses, questions, sectionLabels,
} from '@/data/mockData';
import { cn } from '@/lib/utils';

const sectionKeys = ['service_initiation', 'service_delivery', 'driver_quality', 'overall'] as const;

export default function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const customer = customers.find(c => c.id === DEMO_CUSTOMER_ID)!;
  const currentAssignment = feedbackAssignments.find(a => a.customerId === DEMO_CUSTOMER_ID && a.quarterId === 'q1-2026');
  const currentProfile = customerQuarterProfiles.find(p => p.customerId === DEMO_CUSTOMER_ID && p.quarterId === 'q1-2026');

  // Find most recent submitted assignment for stats
  const submittedAssignments = feedbackAssignments
    .filter(a => a.customerId === DEMO_CUSTOMER_ID && a.status === 'submitted')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));
  const lastSubmitted = submittedAssignments[0];
  const lastProfile = lastSubmitted
    ? customerQuarterProfiles.find(p => p.customerId === DEMO_CUSTOMER_ID && p.quarterId === lastSubmitted.quarterId)
    : null;
  const lastResponses = lastSubmitted ? getFeedbackResponses(lastSubmitted.id) : [];
  const lastQuarterLabel = lastSubmitted
    ? (lastSubmitted.quarterId === 'q4-2025' ? 'Q4 2025' : lastSubmitted.quarterId === 'q3-2025' ? 'Q3 2025' : lastSubmitted.quarterId === 'q2-2025' ? 'Q2 2025' : lastSubmitted.quarterId)
    : '';

  const isNewLast = lastProfile?.expatType === 'new';

  // Compute section averages from last submission
  const sectionStats = sectionKeys.map(key => {
    if (key === 'service_initiation' && !isNewLast) return null;
    const sectionQuestions = questions.filter(q => q.section === key);
    const scores = sectionQuestions.map(q => {
      const r = lastResponses.find(res => res.questionId === q.id);
      return r?.score ?? 0;
    }).filter(s => s > 0);
    const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const pct = (avg / 4) * 100;
    return { key, label: sectionLabels[key], avg, pct };
  }).filter(Boolean) as { key: string; label: string; avg: number; pct: number }[];

  return (
    <div className="space-y-5 animate-fade-in-up max-w-lg mx-auto md:max-w-none">
      {/* Welcome */}
      <div className="bg-card rounded-xl border border-border p-5 md:p-6 shadow-sm">
        <h1 className="text-lg md:text-xl font-semibold text-foreground">Welcome back, {user?.name}</h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">{customer.email}</p>
      </div>

      {/* Current Quarter Status */}
      {!currentAssignment ? (
        <div className="rounded-xl p-5 bg-muted border border-border">
          <p className="text-sm text-muted-foreground">No feedback form has been sent for Q1 2026 yet.</p>
        </div>
      ) : currentAssignment.status === 'pending' ? (
        <div className="rounded-xl p-5 bg-accent/10 border border-accent/20">
          <p className="text-sm font-medium text-foreground">Your Q1 2026 feedback is pending</p>
          <p className="text-xs text-muted-foreground mt-1">
            {currentProfile?.expatType === 'new' ? 'New expat' : 'Existing expat'} · Please complete your feedback form
          </p>
          <Button onClick={() => navigate('/customer/feedback')} className="mt-3 bg-accent hover:bg-accent/90 text-accent-foreground" size="sm">
            Fill Form Now <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      ) : (
        <div className="rounded-xl p-5 bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-sm font-medium text-foreground">
            You submitted your Q1 2026 feedback on {new Date(currentAssignment.submittedAt!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
          <Button onClick={() => navigate('/customer/feedback')} variant="outline" size="sm" className="mt-3">
            <Eye className="w-3.5 h-3.5 mr-1" /> View Submission
          </Button>
        </div>
      )}

      {/* Last submission stats */}
      {lastSubmitted && sectionStats.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Your {lastQuarterLabel} Scores</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sectionStats.map(s => (
              <div key={s.key} className="bg-card rounded-xl border border-border p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{s.label}</span>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-semibold">{s.avg.toFixed(2)}/4</span>
                    <span className="text-muted-foreground">{s.pct.toFixed(0)}%</span>
                  </div>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full transition-all', s.pct >= 80 ? 'bg-emerald-500' : s.pct >= 70 ? 'bg-amber-500' : 'bg-red-500')}
                    style={{ width: `${s.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}