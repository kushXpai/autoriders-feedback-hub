// src/pages/admin/SendFeedbackPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { Send, CheckCircle2, ChevronLeft, Search, Loader2, CalendarCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import QuarterCard from '@/components/QuarterCard';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/supabase/client';
import { cn } from '@/lib/utils';
import type { Customer, Quarter, FeedbackAssignment } from '@/types/database.types';

type ModalStep = 'quarter' | 'customers';

interface AssignmentWithCustomer extends FeedbackAssignment {
  customer: Customer | null;
}


export default function SendFeedbackPage() {
  const { toast } = useToast();

  // ─── Data state ───────────────────────────────────────────────────────────
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [assignments, setAssignments] = useState<FeedbackAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── Modal state ──────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<ModalStep>('quarter');
  const [modalQuarter, setModalQuarter] = useState('');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [quarterSearch, setQuarterSearch] = useState('');
  const [sending, setSending] = useState(false);
  const [emailResults, setEmailResults] = useState<{ sent: number; failed: number } | null>(null);

  // ─── Activate quarter state ───────────────────────────────────────────────
  const [activating, setActivating] = useState(false);
  const [activateModalOpen, setActivateModalOpen] = useState(false);
  const [pendingActivateId, setPendingActivateId] = useState<string | null>(null);

  // ─── Detail popup state ───────────────────────────────────────────────────
  const [detailQuarter, setDetailQuarter] = useState<string | null>(null);

  // ─── Fetch all data ───────────────────────────────────────────────────────
  const fetchData = async () => {
    setLoading(true);

    const [{ data: quartersData }, { data: customersData }, { data: assignmentsData }] =
      await Promise.all([
        supabase.from('quarters').select('*').order('year', { ascending: true }).order('quarter_number', { ascending: true }),
        supabase.from('customers').select('*').eq('is_active', true).order('name'),
        supabase.from('feedback_assignments').select('*').order('created_at', { ascending: false }),
      ]);

    setQuarters((quartersData ?? []) as Quarter[]);
    setCustomers((customersData ?? []) as Customer[]);
    setAssignments((assignmentsData ?? []) as FeedbackAssignment[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // ─── Derived: current active quarter ─────────────────────────────────────
  const activeQuarter = quarters.find(q => q.is_active);
  const pendingActivateQuarter = quarters.find(q => q.id === pendingActivateId);

  // ─── Activate quarter handler ─────────────────────────────────────────────
  const handleActivateQuarter = async () => {
    if (!pendingActivateId) return;
    setActivating(true);
    setActivateModalOpen(false);

    // Step 1: Deactivate current active quarter
    const { error: deactivateError } = await (supabase
      .from('quarters') as any)
      .update({ is_active: false })
      .eq('is_active', true);

    if (deactivateError) {
      toast({ title: 'Error deactivating quarter', description: deactivateError.message, variant: 'destructive' });
      setActivating(false);
      return;
    }

    // Step 2: Activate the selected quarter
    const { error: activateError } = await (supabase
      .from('quarters') as any)
      .update({ is_active: true })
      .eq('id', pendingActivateId);

    if (activateError) {
      toast({ title: 'Error activating quarter', description: activateError.message, variant: 'destructive' });
      setActivating(false);
      return;
    }

    toast({
      title: 'Quarter activated!',
      description: `${pendingActivateQuarter?.label} is now the active quarter.`,
    });

    setPendingActivateId(null);
    await fetchData();
    setActivating(false);
  };

  // ─── Modal helpers ────────────────────────────────────────────────────────
  const modalQuarterObj = quarters.find(q => q.id === modalQuarter);

  const alreadySentIds = useMemo(() =>
    assignments.filter(a => a.quarter_id === modalQuarter).map(a => a.customer_id),
    [assignments, modalQuarter]
  );

  const selectableCustomers = customers.filter(c => !alreadySentIds.includes(c.id));
  const allSelected = selectableCustomers.length > 0 && selectableCustomers.every(c => selectedIds.includes(c.id));

  // Quarters in ascending order for the send modal (Q1 2025 → Q4 2050)
  const filteredQuarters = useMemo(() => {
    const sorted = [...quarters].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.quarter_number - b.quarter_number
    );
    if (!quarterSearch.trim()) return sorted;
    const s = quarterSearch.toLowerCase();
    return sorted.filter(q => q.label.toLowerCase().includes(s));
  }, [quarters, quarterSearch]);

  const toggleId = (id: number) =>
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const toggleAll = () =>
    setSelectedIds(allSelected ? [] : selectableCustomers.map(c => c.id));

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

  // ─── Send feedback assignments + trigger emails ──────────────────────────
  const handleSend = async () => {
    if (selectedIds.length === 0) return;
    setSending(true);
    setEmailResults(null);

    // Step 1: Insert feedback_assignments rows
    const rows = selectedIds.map(customerId => ({
      quarter_id: modalQuarter,
      customer_id: customerId,
      status: 'pending' as const,
    }));

    const { data, error } = await (supabase.from('feedback_assignments') as any)
      .insert(rows)
      .select();

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
      setSending(false);
      return;
    }

    setAssignments(prev => [...prev, ...((data ?? []) as FeedbackAssignment[])]);

    // Step 2: Fire emails to selected customers
    try {
      const selectedCustomers = customers
        .filter(c => selectedIds.includes(c.id))
        .map(c => ({ name: c.name, email: c.email, phone: c.phone ?? null }));

      const { data: { session } } = await supabase.auth.getSession();

      const emailRes = await fetch('/api/send-feedback-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          quarterLabel: modalQuarterObj?.label ?? modalQuarter,
          appUrl: window.location.origin,
          customers: selectedCustomers,
        }),
      });

      const emailData = await emailRes.json();

      if (emailRes.ok) {
        setEmailResults({ sent: emailData.sent ?? 0, failed: (emailData.total ?? 0) - (emailData.sent ?? 0) });
        toast({
          title: 'Forms assigned & emails sent!',
          description: `${rows.length} customer(s) assigned. ${emailData.sent} email(s) delivered for ${modalQuarterObj?.label}.`,
        });
      } else {
        // Assignments succeeded but emails failed — still a partial success
        toast({
          title: 'Assigned, but email failed',
          description: emailData.error ?? 'Could not send notification emails. Assignments were saved.',
          variant: 'destructive',
        });
      }
    } catch (emailErr: any) {
      // Don't block the user — assignments are saved, emails just didn't fire
      toast({
        title: 'Assigned, but email error',
        description: 'Feedback forms were assigned. Email notifications could not be sent.',
        variant: 'destructive',
      });
    }

    setModalOpen(false);
    setSending(false);
  };

  // ─── Quarter cards ────────────────────────────────────────────────────────
  const quarterCards = useMemo(() => {
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
        const newExpats = qAssignments.filter(a =>
          customers.find(c => c.id === a.customer_id)?.expat_type === 'new'
        ).length;
        const sentDate = new Date(
          [...qAssignments].sort((a, b) => a.created_at > b.created_at ? 1 : -1)[0].created_at
        ).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

        return { quarterId, label, total: qAssignments.length, submitted, newExpats, sentDate, assignments: qAssignments };
      });
  }, [assignments, quarters, customers]);

  // ─── Detail popup ─────────────────────────────────────────────────────────
  const detailData: AssignmentWithCustomer[] | null = useMemo(() => {
    if (!detailQuarter) return null;
    const card = quarterCards.find(c => c.quarterId === detailQuarter);
    if (!card) return null;
    return card.assignments.map(a => ({
      ...a,
      customer: customers.find(c => c.id === a.customer_id) ?? null,
    }));
  }, [detailQuarter, quarterCards, customers]);

  const detailLabel = detailQuarter
    ? (quarters.find(q => q.id === detailQuarter)?.label ?? detailQuarter)
    : '';

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in-up">

      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Send Feedback</h1>
        <div className="flex items-center gap-2">

          {/* Activate Quarter Button */}
          <Button
            onClick={() => { setPendingActivateId(null); setActivateModalOpen(true); }}
            disabled={activating}
            variant="outline"
            size="lg"
            className="border border-amber-400 text-amber-600 hover:bg-amber-50"
          >
            {activating
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Activating…</>
              : <><CalendarCheck className="w-4 h-4 mr-2" />
                  {activeQuarter ? `Active: ${activeQuarter.label}` : 'Set Active Quarter'}
                </>
            }
          </Button>

          {/* Send Feedback Button */}
          <Button onClick={openModal} className="bg-accent hover:bg-accent/90 text-accent-foreground" size="lg">
            <Send className="w-4 h-4 mr-2" /> Send Feedback Forms
          </Button>
        </div>
      </div>

      {/* ── Activate Quarter Modal ── */}
      <Dialog open={activateModalOpen} onOpenChange={setActivateModalOpen}>
        <DialogContent className="max-w-sm flex flex-col max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Set Active Quarter</DialogTitle>
            <DialogDescription>
              Currently active: <strong>{activeQuarter?.label ?? 'None'}</strong>.
              Select the quarter you want to make active.
            </DialogDescription>
          </DialogHeader>

          {/* Quarter list — ascending */}
          <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-0.5 mt-1">
            {quarters
              .slice()
              .sort((a, b) => a.year !== b.year ? a.year - b.year : a.quarter_number - b.quarter_number)
              .map(q => (
                <button
                  key={q.id}
                  onClick={() => setPendingActivateId(prev => prev === q.id ? null : q.id)}
                  className={cn(
                    'w-full flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors text-left text-sm',
                    q.is_active
                      ? 'bg-emerald-50 text-emerald-700 font-medium'
                      : pendingActivateId === q.id
                        ? 'bg-accent/15 text-accent font-medium'
                        : 'hover:bg-muted/50 text-foreground'
                  )}
                >
                  <span>{q.label}</span>
                  {q.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Current</span>
                  )}
                  {pendingActivateId === q.id && !q.is_active && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/20 text-accent font-medium">Selected</span>
                  )}
                </button>
              ))}
          </div>

          <div className="flex justify-end gap-2 mt-4 border-t pt-4">
            <Button variant="outline" onClick={() => { setActivateModalOpen(false); setPendingActivateId(null); }}>
              Cancel
            </Button>
            <Button
              onClick={handleActivateQuarter}
              disabled={!pendingActivateId || pendingActivateId === activeQuarter?.id}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <CalendarCheck className="w-4 h-4 mr-2" />
              Activate {pendingActivateQuarter?.label ?? '…'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Send Modal ── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          {modalStep === 'quarter' ? (
            <>
              <DialogHeader>
                <DialogTitle>Select a Quarter</DialogTitle>
                <DialogDescription>Choose which quarter to send feedback forms for.</DialogDescription>
              </DialogHeader>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search quarters…"
                  value={quarterSearch}
                  onChange={e => setQuarterSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-0.5">
                {filteredQuarters.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No quarters found.</p>
                ) : filteredQuarters.map(q => {
                  const sentCount = assignments.filter(a => a.quarter_id === q.id).length;
                  return (
                    <button
                      key={q.id}
                      onClick={() => handleQuarterSelect(q.id)}
                      className="w-full flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/50 transition-colors text-left active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{q.label}</span>
                        {q.is_active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-medium">Active</span>
                        )}
                      </div>
                      {sentCount > 0 && (
                        <span className="text-xs text-muted-foreground">{sentCount} sent</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setModalStep('quarter')}
                    className="p-1 rounded hover:bg-muted/50 transition-colors active:scale-95"
                  >
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
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    disabled={selectableCustomers.length === 0}
                  />
                  <span className="text-sm font-medium">Select All</span>
                </div>
                <div className="space-y-0.5">
                  {customers.map(c => {
                    const alreadySent = alreadySentIds.includes(c.id);
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
                          c.expat_type === 'new'
                            ? 'bg-accent/15 text-accent font-medium'
                            : 'text-muted-foreground'
                        )}>
                          {c.expat_type}
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
                  disabled={selectedIds.length === 0 || sending}
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                >
                  {sending
                    ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</>
                    : `Send to ${selectedIds.length} Customer${selectedIds.length !== 1 ? 's' : ''}`
                  }
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Quarter Cards ── */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Sent Feedback Forms</h2>
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Loading…
          </div>
        ) : quarterCards.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            No feedback forms sent yet. Click the button above to get started.
          </p>
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

      {/* ── Detail Popup ── */}
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
              <div
                key={a.id}
                className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{a.customer?.name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{a.customer?.email ?? '—'}</p>
                </div>
                <span className={cn(
                  'text-xs px-1.5 py-0.5 rounded capitalize',
                  a.customer?.expat_type === 'new'
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-muted-foreground'
                )}>
                  {a.customer?.expat_type ?? 'existing'}
                </span>
                {a.status === 'submitted' ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600">
                    <CheckCircle2 className="w-3 h-3" />
                    {a.submitted_at
                      ? new Date(a.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'Done'}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">
                    Pending
                  </span>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}