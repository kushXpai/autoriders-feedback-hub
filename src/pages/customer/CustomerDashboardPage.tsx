// src/pages/customer/CustomerDashboardPage.tsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/supabase/client';
import type {
  Customer,
  FeedbackAssignment,
  CustomerQuarterProfile,
  FeedbackResponse,
  Quarter,
  Question,
} from '@/types/database.types';
import { cn } from '@/lib/utils';

const SECTION_KEYS = ['service_initiation', 'service_delivery', 'driver_quality', 'overall'] as const;
type SectionKey = typeof SECTION_KEYS[number];

const SECTION_LABELS: Record<SectionKey, string> = {
  service_initiation: 'Service Initiation',
  service_delivery: 'Service Delivery',
  driver_quality: 'Driver Quality',
  overall: 'Overall Service',
};

interface SectionStat {
  key: SectionKey;
  label: string;
  avg: number;
  pct: number;
}

export default function CustomerDashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activeQuarter, setActiveQuarter] = useState<Quarter | null>(null);
  const [currentAssignment, setCurrentAssignment] = useState<FeedbackAssignment | null | undefined>(undefined);
  const [currentProfile, setCurrentProfile] = useState<CustomerQuarterProfile | null>(null);
  const [lastQuarterLabel, setLastQuarterLabel] = useState('');
  const [sectionStats, setSectionStats] = useState<SectionStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      setLoading(true);

      // 1. Resolve customer row linked to this auth user
      const { data: cust } = await supabase
        .from('customers')
        .select('*')
        .eq('user_id', user.id)
        
        .single();

      const customer_ = cust as Customer | null;
      if (!customer_) { setLoading(false); return; }
      setCustomer(customer_);

      // 2. Active quarter
      const { data: quarterRaw } = await supabase
        .from('quarters')
        .select('*')
        .eq('is_active', true)
        .single();

      const quarter = quarterRaw as Quarter | null;
      setActiveQuarter(quarter ?? null);

      if (quarter) {
        // 3. Current assignment
        const { data: assignmentRaw } = await supabase
          .from('feedback_assignments')
          .select('*')
          .eq('customer_id', customer_.id)
          .eq('quarter_id', quarter.id)
          .single();

        setCurrentAssignment((assignmentRaw as FeedbackAssignment | null) ?? null);

        // 4. Expat profile for current quarter
        const { data: profileRaw } = await supabase
          .from('customer_quarter_profiles')
          .select('*')
          .eq('customer_id', customer_.id)
          .eq('quarter_id', quarter.id)
          .single();

        setCurrentProfile((profileRaw as CustomerQuarterProfile | null) ?? null);
      } else {
        setCurrentAssignment(null);
      }

      // 5. Most recent submitted assignment for score display
      const { data: submittedRaw } = await supabase
        .from('feedback_assignments')
        .select('*')
        .eq('customer_id', customer_.id)
        .eq('status', 'submitted')
        .order('submitted_at', { ascending: false })
        .limit(1);

      const submitted = submittedRaw as FeedbackAssignment[] | null;
      const lastAssignment = submitted?.[0] ?? null;

      if (lastAssignment) {
        // Quarter label
        const { data: lastQtrRaw } = await supabase
          .from('quarters')
          .select('label')
          .eq('id', lastAssignment.quarter_id)
          .single();

        const lastQtr = lastQtrRaw as Pick<Quarter, 'label'> | null;
        setLastQuarterLabel(lastQtr?.label ?? lastAssignment.quarter_id);

        // Expat type
        const { data: lastProfileRaw } = await supabase
          .from('customer_quarter_profiles')
          .select('expat_type')
          .eq('customer_id', customer_.id)
          .eq('quarter_id', lastAssignment.quarter_id)
          .single();

        const lastProfile = lastProfileRaw as Pick<CustomerQuarterProfile, 'expat_type'> | null;
        const isNew = lastProfile?.expat_type === 'new';

        // Responses
        const { data: responsesRaw } = await supabase
          .from('feedback_responses')
          .select('question_id, score')
          .eq('assignment_id', lastAssignment.id);

        const responses = responsesRaw as { question_id: number; score: number }[] | null;

        // Questions
        const { data: questionsRaw } = await supabase
          .from('questions')
          .select('id, section, is_new_expat_only')
          .eq('is_active', true);

        const questions = questionsRaw as Pick<Question, 'id' | 'section' | 'is_new_expat_only'>[] | null;

        if (responses && questions) {
          const stats: SectionStat[] = SECTION_KEYS.flatMap(key => {
            if (key === 'service_initiation' && !isNew) return [];
            const sectionQs = questions.filter(q => q.section === key);
            const scores = sectionQs
              .map(q => responses.find(r => r.question_id === q.id)?.score ?? 0)
              .filter(s => s > 0);
            if (scores.length === 0) return [];
            const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
            return [{ key, label: SECTION_LABELS[key], avg, pct: (avg / 4) * 100 }];
          });

          setSectionStats(stats);
        }
      }

      setLoading(false);
    };

    load();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center text-sm text-muted-foreground">
        No customer record found for your account. Please contact an administrator.
      </div>
    );
  }

  const quarterLabel = activeQuarter?.label ?? 'current quarter';

  return (
    <div className="space-y-5 animate-fade-in-up max-w-lg mx-auto md:max-w-none">
      {/* Welcome */}
      <div className="bg-card rounded-xl border border-border p-5 md:p-6 shadow-sm">
        <h1 className="text-lg md:text-xl font-semibold text-foreground">
          Welcome back, {user?.name}
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">{customer.email}</p>
      </div>

      {/* Current Quarter Status */}
      {!activeQuarter || currentAssignment === null ? (
        <div className="rounded-xl p-5 bg-muted border border-border">
          <p className="text-sm text-muted-foreground">
            No feedback form has been sent for {quarterLabel} yet.
          </p>
        </div>
      ) : currentAssignment === undefined ? null : currentAssignment.status === 'pending' ? (
        <div className="rounded-xl p-5 bg-accent/10 border border-accent/20">
          <p className="text-sm font-medium text-foreground">
            Your {quarterLabel} feedback is pending
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {currentProfile?.expat_type === 'new' ? 'New expat' : 'Existing expat'} · Please complete your feedback form
          </p>
          <Button
            onClick={() => navigate('/customer/feedback')}
            className="mt-3 bg-accent hover:bg-accent/90 text-accent-foreground"
            size="sm"
          >
            Fill Form Now <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      ) : (
        <div className="rounded-xl p-5 bg-emerald-500/10 border border-emerald-500/20">
          <p className="text-sm font-medium text-foreground">
            You submitted your {quarterLabel} feedback on{' '}
            {new Date(currentAssignment.submitted_at!).toLocaleDateString('en-US', {
              month: 'long', day: 'numeric', year: 'numeric',
            })}
          </p>
          <Button
            onClick={() => navigate('/customer/feedback')}
            variant="outline"
            size="sm"
            className="mt-3"
          >
            <Eye className="w-3.5 h-3.5 mr-1" /> View Submission
          </Button>
        </div>
      )}

      {/* Last submission section scores */}
      {sectionStats.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">
            Your {lastQuarterLabel} Scores
          </h2>
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
                    className={cn(
                      'h-2 rounded-full transition-all',
                      s.pct >= 80 ? 'bg-emerald-500' : s.pct >= 70 ? 'bg-amber-500' : 'bg-red-500'
                    )}
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