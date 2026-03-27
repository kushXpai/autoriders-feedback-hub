import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import QuarterCard from '@/components/QuarterCard';
import {
  customers, customerQuarterProfiles, feedbackAssignments, quarters, questions,
  getFeedbackResponses, getFeedbackComment, getScoreLabel, getScoreColor, sectionLabels,
} from '@/data/mockData';
import { cn } from '@/lib/utils';

type StatusFilter = 'all' | 'submitted' | 'pending';

export default function FeedbackPage() {
  const [selectedQuarter, setSelectedQuarter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedAssignment, setSelectedAssignment] = useState<number | null>(null);

  // Build quarter cards from assignments
  const quarterCards = useMemo(() => {
    const map = new Map<string, typeof feedbackAssignments>();
    feedbackAssignments.forEach(a => {
      if (!map.has(a.quarterId)) map.set(a.quarterId, []);
      map.get(a.quarterId)!.push(a);
    });
    const sorted = Array.from(map.entries()).sort((a, b) => {
      const parse = (id: string) => {
        const m = id.match(/q(\d)-(\d+)/);
        return m ? parseInt(m[2]) * 10 + parseInt(m[1]) : 0;
      };
      return parse(b[0]) - parse(a[0]);
    });
    return sorted.map(([quarterId, qAssignments]) => {
      const label = quarters.find(q => q.id === quarterId)?.label ?? quarterId;
      const submitted = qAssignments.filter(a => a.status === 'submitted').length;
      const pending = qAssignments.filter(a => a.status === 'pending').length;
      const total = qAssignments.length;
      return { quarterId, label, total, submitted, pending };
    });
  }, []);

  const filtered = useMemo(() => {
    if (!selectedQuarter) return [];
    return feedbackAssignments
      .filter(a => a.quarterId === selectedQuarter)
      .filter(a => statusFilter === 'all' || a.status === statusFilter);
  }, [selectedQuarter, statusFilter]);

  const selectedAsgn = feedbackAssignments.find(a => a.id === selectedAssignment);
  const selectedCustomer = selectedAsgn ? customers.find(c => c.id === selectedAsgn.customerId) : null;
  const selectedProfile = selectedAsgn
    ? customerQuarterProfiles.find(p => p.customerId === selectedAsgn.customerId && p.quarterId === selectedAsgn.quarterId)
    : null;
  const selectedResponses = selectedAssignment ? getFeedbackResponses(selectedAssignment) : [];
  const selectedComment = selectedAssignment ? getFeedbackComment(selectedAssignment) : null;
  const isNewExpat = selectedProfile?.expatType === 'new';

  const sections = ['service_initiation', 'service_delivery', 'driver_quality', 'overall'] as const;
  const statusFilters: { value: StatusFilter; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'pending', label: 'Pending' },
  ];

  // Cards view
  if (!selectedQuarter) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <h1 className="text-2xl font-semibold text-foreground">Feedback</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quarterCards.map(card => (
            <QuarterCard
              key={card.quarterId}
              label={card.label}
              rows={[
                { label: 'Total Sent', value: card.total },
              ]}
              progress={{ value: card.submitted, max: card.total }}
              onClick={() => { setSelectedQuarter(card.quarterId); setStatusFilter('all'); }}
            />
          ))}
        </div>
      </div>
    );
  }

  const quarterLabel = quarters.find(q => q.id === selectedQuarter)?.label ?? selectedQuarter;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header with back */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setSelectedQuarter(null)} className="shrink-0">
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

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 bg-card z-10">Customer</TableHead>
              <TableHead>Expat</TableHead>
              {questions.map(q => (
                <TableHead key={q.id} className="text-center px-1 w-8">Q{q.number}</TableHead>
              ))}
              <TableHead>Comment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(a => {
              const customer = customers.find(c => c.id === a.customerId);
              const profile = customerQuarterProfiles.find(p => p.customerId === a.customerId && p.quarterId === a.quarterId);
              const responses = a.status === 'submitted' ? getFeedbackResponses(a.id) : [];
              const comment = a.status === 'submitted' ? getFeedbackComment(a.id) : null;
              const isNew = profile?.expatType === 'new';

              return (
                <TableRow
                  key={a.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => a.status === 'submitted' && setSelectedAssignment(a.id)}
                >
                  <TableCell className="sticky left-0 bg-card z-10 font-medium">
                    <div>
                      <p className="text-sm">{customer?.name}</p>
                      <p className="text-xs text-muted-foreground">{customer?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      'text-xs px-1.5 py-0.5 rounded capitalize',
                      isNew ? 'bg-accent/15 text-accent font-medium' : 'text-muted-foreground'
                    )}>
                      {profile?.expatType ?? '—'}
                    </span>
                  </TableCell>
                  {questions.map(q => {
                    if (a.status !== 'submitted') return <TableCell key={q.id} className="text-center px-1"><span className="text-muted-foreground/30">—</span></TableCell>;
                    if (q.isNewExpatOnly && !isNew) return <TableCell key={q.id} className="text-center px-1"><span className="text-muted-foreground/20">·</span></TableCell>;
                    const resp = responses.find(r => r.questionId === q.id);
                    if (!resp) return <TableCell key={q.id} className="text-center px-1">—</TableCell>;
                    return (
                      <TableCell key={q.id} className="text-center px-1">
                        <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white', getScoreColor(resp.score))}>
                          {resp.score}
                        </span>
                      </TableCell>
                    );
                  })}
                  <TableCell className="max-w-[120px]">
                    {comment ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-xs text-muted-foreground truncate block max-w-[120px]">{comment}</span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs"><p className="text-xs">{comment}</p></TooltipContent>
                      </Tooltip>
                    ) : <span className="text-muted-foreground/30">—</span>}
                  </TableCell>
                  <TableCell>
                    <span className={cn(
                      'text-xs font-medium px-2.5 py-1 rounded-full',
                      a.status === 'submitted' ? 'bg-emerald-500/15 text-emerald-600' : 'bg-accent/15 text-accent'
                    )}>
                      {a.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={22} className="text-center text-muted-foreground py-8">No feedback found for this quarter.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Slide-over */}
      <Sheet open={selectedAssignment !== null} onOpenChange={() => setSelectedAssignment(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedCustomer?.name}</SheetTitle>
            <SheetDescription>
              {quarters.find(q => q.id === selectedAsgn?.quarterId)?.label} · {selectedProfile?.expatType === 'new' ? 'New' : 'Existing'} Expat
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            {sections.map(section => {
              if (section === 'service_initiation' && !isNewExpat) return null;
              const sectionQuestions = questions.filter(q => q.section === section);
              return (
                <div key={section}>
                  <h3 className="text-sm font-semibold text-foreground mb-3 uppercase tracking-wide">{sectionLabels[section]}</h3>
                  <div className="space-y-3">
                    {sectionQuestions.map(q => {
                      const resp = selectedResponses.find(r => r.questionId === q.id);
                      if (!resp) return null;
                      return (
                        <div key={q.id} className="flex items-start gap-3">
                          <span className="text-xs text-muted-foreground font-mono mt-0.5 w-6 shrink-0">Q{q.number}</span>
                          <div className="flex-1">
                            <p className="text-sm text-foreground leading-snug">{q.text}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white', getScoreColor(resp.score))}>
                                {resp.score}
                              </span>
                              <span className="text-xs text-muted-foreground">{getScoreLabel(resp.score)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {selectedComment && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2 uppercase tracking-wide">Comments</h3>
                <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3 leading-relaxed">{selectedComment}</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
