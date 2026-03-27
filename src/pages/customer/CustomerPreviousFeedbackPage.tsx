import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DEMO_CUSTOMER_ID, feedbackAssignments, customerQuarterProfiles, quarters,
  getFeedbackResponses, getFeedbackComment, questions, sectionLabels,
  getScoreLabel, getScoreColor,
} from '@/data/mockData';
import { cn } from '@/lib/utils';

const sectionKeys = ['service_initiation', 'service_delivery', 'driver_quality', 'overall'] as const;

export default function CustomerPreviousFeedbackPage() {
  const [viewingAssignmentId, setViewingAssignmentId] = useState<number | null>(null);

  const submitted = feedbackAssignments
    .filter(a => a.customerId === DEMO_CUSTOMER_ID && a.status === 'submitted')
    .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''));

  if (viewingAssignmentId !== null) {
    const assignment = feedbackAssignments.find(a => a.id === viewingAssignmentId)!;
    const quarter = quarters.find(q => q.id === assignment.quarterId);
    const profile = customerQuarterProfiles.find(p => p.customerId === DEMO_CUSTOMER_ID && p.quarterId === assignment.quarterId);
    const isNew = profile?.expatType === 'new';
    const responses = getFeedbackResponses(viewingAssignmentId);
    const comment = getFeedbackComment(viewingAssignmentId);

    return (
      <div className="animate-fade-in-up space-y-5 max-w-lg mx-auto md:max-w-none">
        <Button variant="ghost" onClick={() => setViewingAssignmentId(null)} className="text-muted-foreground -ml-2">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to History
        </Button>

        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-foreground">{quarter?.label} Feedback</h1>
          <span className={cn(
            'text-xs font-medium px-2.5 py-1 rounded-full capitalize',
            isNew ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
          )}>
            {profile?.expatType} Expat
          </span>
        </div>

        {sectionKeys.map(sectionKey => {
          if (sectionKey === 'service_initiation' && !isNew) return null;
          const sectionQuestions = questions.filter(q => q.section === sectionKey);
          return (
            <div key={sectionKey}>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                {sectionLabels[sectionKey]}
              </h3>
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

        {comment && (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-2">Your Comment</h3>
            <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">{comment}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in-up space-y-5 max-w-lg mx-auto md:max-w-none">
      <h1 className="text-xl font-semibold text-foreground">Previous Feedback</h1>

      {submitted.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-8 text-center shadow-sm">
          <p className="text-muted-foreground">No previous submissions found.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {submitted.map(a => {
            const quarter = quarters.find(q => q.id === a.quarterId);
            const profile = customerQuarterProfiles.find(p => p.customerId === DEMO_CUSTOMER_ID && p.quarterId === a.quarterId);
            return (
              <div key={a.id} className="bg-card rounded-xl border border-border p-4 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow">
                <div>
                  <p className="text-sm font-medium text-foreground">{quarter?.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    <span className="capitalize">{profile?.expatType ?? 'existing'} expat</span>
                    {' · '}
                    Submitted {new Date(a.submittedAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setViewingAssignmentId(a.id)}>
                  View
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}