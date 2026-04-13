// src/pages/admin/SendFeedbackPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { Send, CheckCircle2, ChevronLeft, Search, Loader2, CalendarCheck, BellRing } from 'lucide-react';
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

  // ─── Customer search (inside send modal) ─────────────────────────────────
  const [customerSearch, setCustomerSearch] = useState('');

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
  // Filtered by search
  const filteredSelectableCustomers = useMemo(() => {
    if (!customerSearch.trim()) return selectableCustomers;
    const s = customerSearch.toLowerCase();
    return selectableCustomers.filter(c => c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s));
  }, [selectableCustomers, customerSearch]);
  const allSelected = filteredSelectableCustomers.length > 0 && filteredSelectableCustomers.every(c => selectedIds.includes(c.id));

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
    setSelectedIds(allSelected ? [] : filteredSelectableCustomers.map(c => c.id));

  const openModal = () => {
    setModalStep('quarter');
    setModalQuarter('');
    setSelectedIds([]);
    setQuarterSearch('');
    setCustomerSearch('');
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

      const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      const rawSession = storageKey ? JSON.parse(localStorage.getItem(storageKey) ?? '{}') : null;
      const accessToken = rawSession?.access_token ?? null;

      const emailRes = await fetch('/api/send-feedback-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
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

        // Mark email_sent = true for customers whose email succeeded
        if (emailData.results && data) {
          const successEmails = new Set(
            (emailData.results as { email: string; success: boolean }[])
              .filter(r => r.success)
              .map(r => r.email)
          );
          const successfulAssignmentIds = (data as FeedbackAssignment[])
            .filter(a => {
              const customer = customers.find(c => c.id === a.customer_id);
              return customer && successEmails.has(customer.email);
            })
            .map(a => a.id);

          if (successfulAssignmentIds.length > 0) {
            await (supabase.from('feedback_assignments') as any)
              .update({ email_sent: true })
              .in('id', successfulAssignmentIds);

            setAssignments(prev => prev.map(a =>
              successfulAssignmentIds.includes(a.id) ? { ...a, email_sent: true } : a
            ));
          }
        }

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

  // ─── Resend reminder state ────────────────────────────────────────────────
  const [resending, setResending] = useState(false);
  const [resendSelectedIds, setResendSelectedIds] = useState<number[]>([]);

  const toggleResendId = (id: number) =>
    setResendSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  // ─── Resend reminder to selected or all pending customers for a quarter ────
  const handleResendReminders = async (quarterId: string, specificIds?: number[]) => {
    const allPending = assignments.filter(
      a => a.quarter_id === quarterId && a.status === 'pending'
    );
    const pendingAssignments = specificIds && specificIds.length > 0
      ? allPending.filter(a => specificIds.includes(a.customer_id))
      : allPending;

    if (pendingAssignments.length === 0) {
      toast({ title: 'No pending customers', description: 'All customers have already submitted their feedback.' });
      return;
    }

    setResending(true);

    try {
      const pendingCustomers = pendingAssignments
        .map(a => customers.find(c => c.id === a.customer_id))
        .filter(Boolean)
        .map(c => ({ name: c!.name, email: c!.email, phone: c!.phone ?? null }));

      const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
      const rawSession = storageKey ? JSON.parse(localStorage.getItem(storageKey) ?? '{}') : null;
      const accessToken = rawSession?.access_token ?? null;

      const quarterLabel = quarters.find(q => q.id === quarterId)?.label ?? quarterId;

      const emailRes = await fetch('/api/send-reminder-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          quarterLabel,
          appUrl: window.location.origin,
          customers: pendingCustomers,
        }),
      });

      const emailData = await emailRes.json();

      if (emailRes.ok) {
        toast({
          title: 'Reminders sent!',
          description: `${emailData.sent} reminder(s) sent to pending customers for ${quarterLabel}.`,
        });
      } else {
        toast({
          title: 'Failed to send reminders',
          description: emailData.error ?? 'Could not send reminder emails.',
          variant: 'destructive',
        });
      }
    } catch (err: any) {
      toast({
        title: 'Error sending reminders',
        description: err.message ?? 'An unexpected error occurred.',
        variant: 'destructive',
      });
    }

    setResending(false);
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

        const emailSent = qAssignments.filter(a => (a as any).email_sent).length;
        return { quarterId, label, total: qAssignments.length, submitted, newExpats, sentDate, emailSent, assignments: qAssignments };
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
              {/* Search bar */}
              <div className="relative mb-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search customers…"
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex-1 overflow-y-auto -mx-6 px-6">
                <div className="flex items-center justify-between py-2 border-b border-border mb-1">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      disabled={filteredSelectableCustomers.length === 0}
                    />
                    <span className="text-sm font-medium">Select All</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedIds(selectableCustomers.map(c => c.id))}
                    className="text-xs text-accent hover:underline font-medium"
                  >
                    Send All ({selectableCustomers.length})
                  </button>
                </div>
                <div className="space-y-0.5">
                  {filteredSelectableCustomers.length === 0 && !customerSearch && (
                    <p className="text-sm text-muted-foreground text-center py-6">All customers already have forms for this quarter.</p>
                  )}
                  {filteredSelectableCustomers.length === 0 && customerSearch && (
                    <p className="text-sm text-muted-foreground text-center py-6">No customers match your search.</p>
                  )}
                  {filteredSelectableCustomers.map(c => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedIds.includes(c.id)}
                        onCheckedChange={() => toggleId(c.id)}
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
                    </label>
                  ))}
                  {/* Already-sent customers shown greyed out at bottom */}
                  {customers.filter(c => alreadySentIds.includes(c.id)).map(c => (
                    <label
                      key={c.id}
                      className="flex items-center gap-3 py-2.5 px-2 rounded-lg opacity-40 cursor-not-allowed"
                    >
                      <Checkbox checked disabled />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.email}</p>
                      </div>
                      <span className="flex items-center gap-1 text-xs text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" /> Sent
                      </span>
                    </label>
                  ))}
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
                    : `Send to ${selectedIds.length} Client${selectedIds.length !== 1 ? 's' : ''}`
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
                  { label: 'Emails Delivered', value: `${card.emailSent} / ${card.total}` },
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
      <Dialog open={!!detailQuarter} onOpenChange={open => { if (!open) { setDetailQuarter(null); setResendSelectedIds([]); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden">

          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle className="text-base font-semibold text-foreground">{detailLabel} — Recipients</DialogTitle>
            {detailQuarter && (() => {
              const submittedCount = assignments.filter(a => a.quarter_id === detailQuarter && a.status === 'submitted').length;
              const pendingCount = assignments.filter(a => a.quarter_id === detailQuarter && a.status === 'pending').length;
              const total = submittedCount + pendingCount;
              return (
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: total ? `${(submittedCount / total) * 100}%` : '0%' }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    <span className="font-semibold text-emerald-600">{submittedCount}</span> of {total} submitted
                  </span>
                </div>
              );
            })()}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {detailData?.filter(a => a.customer?.name).map(a => {
              const isSubmitted = a.status === 'submitted';
              const customerId = a.customer_id;
              return (
                <div
                  key={a.id}
                  className={cn(
                    'flex items-center gap-3 py-2.5 px-3 rounded-xl transition-colors',
                    isSubmitted ? 'hover:bg-emerald-50/60' : 'hover:bg-muted/40 cursor-pointer'
                  )}
                  onClick={() => !isSubmitted && toggleResendId(customerId)}
                >
                  {/* Checkbox for pending, checkmark for submitted */}
                  {isSubmitted ? (
                    <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                  ) : (
                    <Checkbox
                      checked={resendSelectedIds.includes(customerId)}
                      onCheckedChange={() => toggleResendId(customerId)}
                      onClick={e => e.stopPropagation()}
                      className="shrink-0"
                    />
                  )}

                  {/* Avatar circle */}
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                    isSubmitted
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-muted text-muted-foreground'
                  )}>
                    {a.customer?.name?.charAt(0).toUpperCase() ?? '?'}
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium truncate', isSubmitted ? 'text-foreground' : 'text-foreground/70')}>
                      {a.customer?.name ?? '—'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{a.customer?.email ?? '—'}</p>
                  </div>

                  {/* Expat badge */}
                  {a.customer?.expat_type === 'new' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent font-semibold uppercase tracking-wide shrink-0">
                      New
                    </span>
                  )}

                  {/* Status */}
                  {isSubmitted ? (
                    <span className="text-xs font-medium text-emerald-600 shrink-0">
                      {a.submitted_at
                        ? new Date(a.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        : 'Done'}
                    </span>
                  ) : (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-semibold shrink-0">
                      Pending
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          {detailQuarter && (() => {
            const pendingAssignments = assignments.filter(
              a => a.quarter_id === detailQuarter && a.status === 'pending'
            );
            const pendingCount = pendingAssignments.length;
            const pendingCustomerIds = pendingAssignments.map(a => a.customer_id);
            const selectedPending = resendSelectedIds.filter(id => pendingCustomerIds.includes(id));
            const sendCount = selectedPending.length > 0 ? selectedPending.length : pendingCount;
            return (
              <div className="px-6 py-4 border-t border-border bg-muted/30 space-y-2">
                {pendingCount > 0 ? (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-semibold text-amber-600">{pendingCount}</span> client{pendingCount !== 1 ? 's' : ''} yet to submit
                        {selectedPending.length > 0 && (
                          <span className="ml-1 text-accent font-semibold">· {selectedPending.length} selected</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2">
                        {selectedPending.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setResendSelectedIds([])}
                            className="text-xs text-muted-foreground hover:text-foreground underline"
                          >
                            Clear
                          </button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => {
                            handleResendReminders(detailQuarter, selectedPending.length > 0 ? selectedPending : undefined);
                            setResendSelectedIds([]);
                          }}
                          disabled={resending}
                          className="bg-amber-500 hover:bg-amber-600 text-white h-8 text-xs"
                        >
                          {resending
                            ? <><Loader2 className="w-3 h-3 mr-1.5 animate-spin" />Sending…</>
                            : <><BellRing className="w-3 h-3 mr-1.5" />
                                {selectedPending.length > 0
                                  ? `Resend to ${selectedPending.length} Selected`
                                  : `Resend All (${pendingCount})`}
                              </>
                          }
                        </Button>
                      </div>
                    </div>
                    {pendingCount > 1 && (
                      <p className="text-[11px] text-muted-foreground">
                        Tick individual clients above to send only to them, or use Resend All.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-emerald-600 font-medium w-full text-center">
                    ✅ All clients have submitted their feedback
                  </p>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

    </div>
  );
}