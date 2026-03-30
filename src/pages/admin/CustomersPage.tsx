// src/pages/admin/CustomersPage.tsx
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, Pencil, MoreVertical, Users, UserCheck, UserX, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/supabase/client';
import { cn } from '@/lib/utils';

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  employee_id: string;
  is_active: boolean;
  created_at: string;
  allocated_car: string | null;
  car_registration_number: string | null;
  start_date: string | null;
  end_date: string | null;
  user_id: string | null;
  expat_type: 'new' | 'existing';
}

interface FormData {
  name: string;
  email: string;
  phone: string;
  expat_type: 'new' | 'existing';
  is_active: boolean;
  allocated_car: string;
  car_registration_number: string;
  start_date: string;
  end_date: string;
}

const EMPTY_FORM: FormData = {
  name: '', email: '', phone: '', expat_type: 'existing',
  is_active: true, allocated_car: '', car_registration_number: '', start_date: '', end_date: '',
};

export default function CustomersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [activeQuarterId, setActiveQuarterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expatFilter, setExpatFilter] = useState<'all' | 'new' | 'existing'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ─── Fetch ────────────────────────────────────────────────────────────────────
  const fetchCustomers = async () => {
    setLoading(true);

    // Get active quarter
    const { data: quarterRaw } = await supabase
      .from('quarters')
      .select('id')
      .eq('is_active', true)
      .maybeSingle();
    const quarterId = (quarterRaw as any)?.id ?? null;
    setActiveQuarterId(quarterId);

    // Get all customers
    const { data: custRaw, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast({ title: 'Error', description: 'Failed to load customers.', variant: 'destructive' });
      setLoading(false);
      return;
    }

    setCustomers((custRaw ?? []) as Customer[]);
    setLoading(false);
  };

  useEffect(() => { fetchCustomers(); }, []);

  // ─── Stats ────────────────────────────────────────────────────────────────────
  const totalCount = customers.length;
  const activeCount = customers.filter(c => c.is_active).length;
  const inactiveCount = totalCount - activeCount;

  const filtered = useMemo(() => customers.filter(c => {
    const matchesSearch = !search ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? c.is_active : !c.is_active);
    const matchesExpat = expatFilter === 'all' || c.expat_type === expatFilter;
    return matchesSearch && matchesStatus && matchesExpat;
  }), [customers, search, statusFilter, expatFilter]);

  // ─── Toggle active ────────────────────────────────────────────────────────────
  const toggleActive = async (e: React.MouseEvent, c: Customer) => {
    e.stopPropagation();
    const newVal = !c.is_active;
    setCustomers(prev => prev.map(x => x.id === c.id ? { ...x, is_active: newVal } : x));
    const { error } = await (supabase.from('customers') as any)
      .update({ is_active: newVal })
      .eq('id', c.id);
    if (error) {
      setCustomers(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !newVal } : x));
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' });
    }
  };

  // ─── Delete ───────────────────────────────────────────────────────────────────
  const deleteCustomer = async () => {
    if (!deleteConfirm) return;

    // If customer has an auth user, delete via API (cleans up auth.users + profiles + user_roles)
    if (deleteConfirm.user_id) {
      const { data: { session } } = await supabase.auth.getSession();
      const apiRes = await fetch('/api/delete-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ userId: deleteConfirm.user_id }),
      });
      const result = await apiRes.json();
      if (!apiRes.ok) {
        toast({ title: 'Error', description: result.error || 'Failed to delete.', variant: 'destructive' });
        setDeleteConfirm(null);
        return;
      }
      // Also delete the customers row itself
      await supabase.from('customers').delete().eq('id', deleteConfirm.id);
    } else {
      // No auth user, just delete the customers row
      const { error } = await supabase.from('customers').delete().eq('id', deleteConfirm.id);
      if (error) {
        toast({ title: 'Error', description: 'Failed to delete.', variant: 'destructive' });
        setDeleteConfirm(null);
        return;
      }
    }

    setCustomers(prev => prev.filter(c => c.id !== deleteConfirm.id));
    toast({ title: 'Deleted', description: `${deleteConfirm.name} removed.` });
    setDeleteConfirm(null);
  };

  // ─── Drawer open ──────────────────────────────────────────────────────────────
  const openAdd = () => { setEditingCustomer(null); setFormData(EMPTY_FORM); setDrawerOpen(true); };
  const openEdit = (e: React.MouseEvent, c: Customer) => {
    e.stopPropagation();
    setEditingCustomer(c);
    setFormData({
      name: c.name, email: c.email, phone: c.phone ?? '',
      expat_type: c.expat_type ?? 'existing', is_active: c.is_active,
      allocated_car: c.allocated_car ?? '', car_registration_number: c.car_registration_number ?? '',
      start_date: c.start_date ?? '', end_date: c.end_date ?? '',
    });
    setDrawerOpen(true);
  };

  // ─── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      toast({ title: 'Validation', description: 'Name and email are required.', variant: 'destructive' });
      return;
    }
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone || null,
        is_active: formData.is_active,
        allocated_car: formData.allocated_car || null,
        car_registration_number: formData.car_registration_number || null,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
        expat_type: formData.expat_type,
      };

      if (editingCustomer) {
        const { error } = await (supabase.from('customers') as any)
          .update(payload)
          .eq('id', editingCustomer.id);
        if (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
          return;
        }
        toast({ title: 'Updated', description: `${formData.name} updated.` });

      } else {
        const { data: lastRaw } = await supabase
          .from('customers').select('employee_id').order('id', { ascending: false }).limit(1).maybeSingle();
        const lastNum = parseInt(((lastRaw as any)?.employee_id ?? 'EMP-0000').replace('EMP-', ''), 10) || 0;
        const newEmployeeId = `EMP-${String(lastNum + 1).padStart(4, '0')}`;

        const { data: { session } } = await supabase.auth.getSession();

        // ✅ Add a timeout so it can't hang forever
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000); // 15s

        let apiRes: Response;
        try {
          apiRes = await fetch('/api/create-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({ ...payload, employee_id: newEmployeeId }),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        const result = await apiRes.json();
        if (!apiRes.ok) {
          toast({ title: 'Error', description: result.error || 'Failed to create customer.', variant: 'destructive' });
          return;
        }

        toast({ title: 'Added', description: `${formData.name} added.` });
      }

      setDrawerOpen(false);
      await fetchCustomers();

    } catch (err: any) {
      const msg = err?.name === 'AbortError' ? 'Request timed out. Check your API.' : (err?.message ?? 'Something went wrong.');
      toast({ title: 'Error', description: msg, variant: 'destructive' });
    } finally {
      setSaving(false); // ✅ ALWAYS runs
    }
  };

  const statCards = [
    { label: 'Total', value: totalCount, icon: Users, bg: 'bg-primary/10', color: 'text-primary' },
    { label: 'Active', value: activeCount, icon: UserCheck, bg: 'bg-emerald-500/10', color: 'text-emerald-600' },
    { label: 'Inactive', value: inactiveCount, icon: UserX, bg: 'bg-muted', color: 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-foreground">Customers</h1>
        <Button onClick={openAdd} className="bg-accent hover:bg-accent/90 text-accent-foreground">
          <Plus className="w-4 h-4 mr-1.5" /> Add Customer
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-4">
        {statCards.map(s => (
          <div key={s.label} className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', s.bg)}>
              <s.icon className={cn('w-5 h-5', s.color)} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground tabular-nums">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <Filter className="w-3.5 h-3.5" /> Filter
              {(statusFilter !== 'all' || expatFilter !== 'all') && (
                <span className="ml-1 w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] font-bold flex items-center justify-center">
                  {(statusFilter !== 'all' ? 1 : 0) + (expatFilter !== 'all' ? 1 : 0)}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-4 space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Status</p>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'active', 'inactive'] as const).map(f => (
                  <button key={f} onClick={() => setStatusFilter(f)} className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all',
                    statusFilter === f ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                  )}>{f}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Expat Type</p>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'new', 'existing'] as const).map(f => (
                  <button key={f} onClick={() => setExpatFilter(f)} className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-all',
                    expatFilter === f ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                  )}>{f}</button>
                ))}
              </div>
            </div>
            {(statusFilter !== 'all' || expatFilter !== 'all') && (
              <button onClick={() => { setStatusFilter('all'); setExpatFilter('all'); }}
                className="text-xs text-destructive hover:underline w-full text-center pt-1">
                Clear all filters
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">Loading customers…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Added</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(c => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => navigate(`/admin/customers/${c.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                        {c.name.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{c.phone ?? '—'}</TableCell>
                  <TableCell>
                    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full capitalize',
                      c.expat_type === 'new' ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground')}>
                      {c.expat_type}
                    </span>
                  </TableCell>
                  <TableCell>
                    <button onClick={e => toggleActive(e, c)} className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      c.is_active ? 'bg-emerald-500' : 'bg-muted-foreground/30')}>
                      <span className={cn('inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                        c.is_active ? 'translate-x-6' : 'translate-x-1')} />
                    </button>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreVertical className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                        <DropdownMenuItem onClick={e => openEdit(e, c)}>
                          <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={e => { e.stopPropagation(); setDeleteConfirm(c); }}
                          className="text-destructive focus:text-destructive">
                          <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-12">No customers found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Delete Dialog */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteConfirm?.name}</span>? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteCustomer}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add / Edit Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</SheetTitle>
            <SheetDescription>{editingCustomer ? 'Update customer details.' : 'Fill in the details below.'}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="John Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="john@exxon.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+966 55 000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Expat Type</Label>
              <Select value={formData.expat_type} onValueChange={(v: 'new' | 'existing') => setFormData(p => ({ ...p, expat_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="existing">Existing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Allocated Car</Label>
              <Input value={formData.allocated_car} onChange={e => setFormData(p => ({ ...p, allocated_car: e.target.value }))} placeholder="e.g. Toyota Camry" />
            </div>
            <div className="space-y-1.5">
              <Label>Car Registration Number</Label>
              <Input value={formData.car_registration_number} onChange={e => setFormData(p => ({ ...p, car_registration_number: e.target.value }))} placeholder="e.g. ABC-1234" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={formData.start_date} onChange={e => setFormData(p => ({ ...p, start_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={formData.end_date} onChange={e => setFormData(p => ({ ...p, end_date: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active Status</Label>
              <Switch checked={formData.is_active} onCheckedChange={v => setFormData(p => ({ ...p, is_active: v }))} />
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} disabled={saving} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
                {saving ? 'Saving…' : editingCustomer ? 'Update' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setDrawerOpen(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}