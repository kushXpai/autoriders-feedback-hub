import { useState, useMemo } from 'react';
import { Send, CheckCircle2, ChevronLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import QuarterCard from '@/components/QuarterCard';

import { useToast } from '@/hooks/use-toast';
import {
  customers, customerQuarterProfiles, feedbackAssignments as initialAssignments,
  type FeedbackAssignment,
} from '@/data/mockData';
import { cn } from '@/lib/utils';

type ModalStep = 'quarter' | 'customers';

function generateAllQuarters() {
  const list: { id: string; label: string }[] = [];
  for (let year = 2026; year <= 2100; year++) {
    for (let q = 1; q <= 4; q++) {
      list.push({ id: `q${q}-${year}`, label: `Q${q} ${year}` });
    }
  }
  return list;
}

const allQuarters = generateAllQuarters();

export default function SendFeedbackPage() {
  const { toast } = useToast();
  const [assignments, setAssignments] = useState<FeedbackAssignment[]>([...initialAssignments]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('quarter');
  const [modalQuarter, setModalQuarter] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [quarterSearch, setQuarterSearch] = useState('');
  const [detailQuarter, setDetailQuarter] = useState<string | null>(null);

  const modalQuarterObj = allQuarters.find(q => q.id === modalQuarter);
  const activeCustomers = customers.filter(c => c.isActive);

  const modalAlreadySentIds = useMemo(() =>
    assignments.filter(a => a.quarterId === modalQuarter).map(a => a.customerId),
    [assignments, modalQuarter]
  );

  const filteredQuarters = useMemo(() => {
    if (!quarterSearch.trim()) return allQuarters.slice(0, 40);
    const s = quarterSearch.toLowerCase();
    return allQuarters.filter(q => q.label.toLowerCase().includes(s)).slice(0, 40);
  }, [quarterSearch]);

  const toggleId = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const selectableCustomers = activeCustomers.filter(c => !modalAlreadySentIds.includes(c.id));
  const allSelected = selectableCustomers.length > 0 && selectableCustomers.every(c => selectedIds.includes(c.id));

  const toggleAll = () => {
    if (allSelected) setSelectedIds([]);
    else setSelectedIds(selectableCustomers.map(c => c.id));
  };

  const openModal = () => {
    setModalStep('quarter');
    setModalQuarter('');
    setSelectedIds([]);
    setQuarterSearch('');
    setModalOpen(true);
  };

  const handleQuarterSelect = (qId: string) => {
    setModalQuarter(qId);
    setSelectedIds([]);
    setModalStep('customers');
  };

  const handleSend = () => {
    const newAssignments: FeedbackAssignment[] = selectedIds.map((custId, i) => ({
      id: Math.max(...assignments.map(a => a.id), 0) + i + 1,
      quarterId: modalQuarter,
      customerId: custId,
      status: 'pending' as const,
      submittedAt: null,
    }));
    setAssignments(prev => [...prev, ...newAssignments]);
    setModalOpen(false);
    toast({
      title: 'Feedback forms sent!',
      description: `${newAssignments.length} customer(s) assigned for ${modalQuarterObj?.label}.`,
    });
  };

  // Group assignments by quarter for cards
  const quarterCards = useMemo(() => {
    const map = new Map<string, FeedbackAssignment[]>();
    assignments.forEach(a => {
      if (!map.has(a.quarterId)) map.set(a.quarterId, []);
      map.get(a.quarterId)!.push(a);
    });
    // Sort quarters descending
    const sorted = Array.from(map.entries()).sort((a, b) => {
      const parse = (id: string) => {
        const m = id.match(/q(\d)-(\d+)/);
        return m ? parseInt(m[2]) * 10 + parseInt(m[1]) : 0;
      };
      return parse(b[0]) - parse(a[0]);
    });
    return sorted.map(([quarterId, qAssignments]) => {
      const label = allQuarters.find(q => q.id === quarterId)?.label ?? quarterId;
      const submitted = qAssignments.filter(a => a.status === 'submitted').length;
      const pending = qAssignments.filter(a => a.status === 'pending').length;
      const newExpats = qAssignments.filter(a => {
        const p = customerQuarterProfiles.find(cp => cp.customerId === a.customerId && cp.quarterId === quarterId);
        return p?.expatType === 'new';
      }).length;
      const firstSubmitted = qAssignments
        .filter(a => a.submittedAt)
        .sort((a, b) => (a.submittedAt! > b.submittedAt! ? 1 : -1))[0];
      const sentDate = firstSubmitted?.submittedAt
        ? new Date(new Date(firstSubmitted.submittedAt).getTime() - 7 * 86400000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return { quarterId, label, total: qAssignments.length, submitted, pending, newExpats, sentDate, assignments: qAssignments };
    });
  }, [assignments]);

  // Detail popup data
  const detailData = useMemo(() => {
    if (!detailQuarter) return null;
    const card = quarterCards.find(c => c.quarterId === detailQuarter);
    if (!card) return null;
    return card.assignments.map(a => {
      const customer = customers.find(c => c.id === a.customerId);
      const profile = customerQuarterProfiles.find(p => p.customerId === a.customerId && p.quarterId === detailQuarter);
      return { ...a, customer, expatType: profile?.expatType ?? 'existing' };
    });
  }, [detailQuarter, quarterCards]);

  const detailLabel = detailQuarter ? (allQuarters.find(q => q.id === detailQuarter)?.label ?? detailQuarter) : '';

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Send Feedback</h1>
        <Button onClick={openModal} className="bg-accent hover:bg-accent/90 text-accent-foreground" size="lg">
          <Send className="w-4 h-4 mr-2" /> Send Feedback Forms
        </Button>
      </div>

      {/* Send Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          {modalStep === 'quarter' ? (
            <>
              <DialogHeader>
                <DialogTitle>Select Quarter</DialogTitle>
                <DialogDescription>Choose which quarter to send the feedback form for.</DialogDescription>
              </DialogHeader>
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search quarters… e.g. Q3 2027"
                  value={quarterSearch}
                  onChange={e => setQuarterSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-0.5">
                {filteredQuarters.map(q => {
                  const sentCount = assignments.filter(a => a.quarterId === q.id).length;
                  return (
                    <button
                      key={q.id}
                      onClick={() => handleQuarterSelect(q.id)}
                      className="w-full flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors text-left active:scale-[0.98]"
                    >
                      <span className="text-sm font-medium text-foreground">{q.label}</span>
                      {sentCount > 0 && (
                        <span className="text-xs text-muted-foreground">{sentCount} sent</span>
                      )}
                    </button>
                  );
                })}
                {filteredQuarters.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No quarters match your search.</p>
                )}
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <button onClick={() => setModalStep('quarter')} className="p-1 rounded hover:bg-muted/50 transition-colors active:scale-95">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div>
                    <DialogTitle>Send {modalQuarterObj?.label} Feedback</DialogTitle>
                    <DialogDescription>Select customers to send the feedback form to.</DialogDescription>
                  </div>
                </div>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto -mx-6 px-6">
                <div className="flex items-center gap-2 py-2 border-b border-border mb-1">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} disabled={selectableCustomers.length === 0} />
                  <span className="text-sm font-medium">Select All</span>
                </div>
                <div className="space-y-0.5">
                  {activeCustomers.map(c => {
                    const alreadySent = modalAlreadySentIds.includes(c.id);
                    const profile = customerQuarterProfiles.find(p => p.customerId === c.id && p.quarterId === modalQuarter);
                    return (
                      <label
                        key={c.id}
                        className={cn(
                          'flex items-center gap-3 py-2.5 px-2 rounded-lg transition-colors',
                          alreadySent ? 'opacity-50' : 'hover:bg-muted/40 cursor-pointer'
                        )}
                      >
                        <Checkbox
                          checked={alreadySent || selectedIds.includes(c.id)}
                          onCheckedChange={() => !alreadySent && toggleId(c.id)}
                          disabled={alreadySent}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{c.name}</p>
                          <p className="text-xs text-muted-foreground">{c.email}</p>
                        </div>
                        <span className={cn(
                          'text-xs px-1.5 py-0.5 rounded capitalize',
                          profile?.expatType === 'new' ? 'bg-accent/15 text-accent font-medium' : 'text-muted-foreground'
                        )}>
                          {profile?.expatType ?? 'existing'}
                        </span>
                        {alreadySent && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600">
                            <CheckCircle2 className="w-3 h-3" /> Sent
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => setModalStep('quarter')}>Back</Button>
                <Button
                  onClick={handleSend}
                  disabled={selectedIds.length === 0}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  Send to {selectedIds.length} Customer{selectedIds.length !== 1 ? 's' : ''}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Quarter Cards */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Sent Feedback Forms</h2>
        {quarterCards.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">No feedback forms sent yet. Click the button above to get started.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {quarterCards.map(card => (
              <QuarterCard
                key={card.quarterId}
                label={card.label}
                rows={[
                  { label: 'Sent to', value: `${card.total} customers` },
                  { label: 'New Expats', value: card.newExpats },
                  { label: 'Sent on', value: card.sentDate },
                ]}
                progress={{ value: card.submitted, max: card.total }}
                onClick={() => setDetailQuarter(card.quarterId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Detail Popup */}
      <Dialog open={!!detailQuarter} onOpenChange={open => !open && setDetailQuarter(null)}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{detailLabel} — Recipients</DialogTitle>
            <DialogDescription>
              {detailData?.length ?? 0} customer(s) received the feedback form.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-1">
            {detailData?.map(a => (
              <div key={a.id} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/30 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{a.customer?.name}</p>
                  <p className="text-xs text-muted-foreground">{a.customer?.email}</p>
                </div>
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded capitalize',
                  a.expatType === 'new' ? 'bg-accent/15 text-accent font-medium' : 'text-muted-foreground'
                )}>
                  {a.expatType}
                </span>
                {a.status === 'submitted' ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" />
                    {a.submittedAt ? new Date(a.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Done'}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">Pending</span>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
