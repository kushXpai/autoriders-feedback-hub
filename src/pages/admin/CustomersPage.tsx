// src/pages/admin/CustomersPage.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, Pencil, MoreVertical, Users, UserCheck, UserX, Filter, Upload, Download, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
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

// ── Bulk upload row ───────────────────────────────────────────────────────────
interface BulkRow {
  name: string;
  email: string;
  phone: string;
  password: string;
  expat_type: 'new' | 'existing';
  allocated_car: string;
  car_registration_number: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  // validation state
  _rowNum: number;
  _errors: string[];
}

interface BulkResult {
  row: number;
  email: string;
  success: boolean;
  error?: string;
}

const EMPTY_FORM: FormData = {
  name: '', email: '', phone: '', expat_type: 'existing',
  is_active: true, allocated_car: '', car_registration_number: '', start_date: '', end_date: '',
};

// ── CSV column aliases (case-insensitive) ──────────────────────────────────
const COL_MAP: Record<string, keyof BulkRow> = {
  name: 'name', 'full name': 'name', fullname: 'name',
  email: 'email', 'e-mail': 'email',
  phone: 'phone', mobile: 'phone', 'phone number': 'phone',
  password: 'password', pass: 'password',
  expat: 'expat_type', 'expat type': 'expat_type', expattype: 'expat_type',
  'allocated car': 'allocated_car', allocatedcar: 'allocated_car', car: 'allocated_car',
  'registration number': 'car_registration_number', 'car registration number': 'car_registration_number',
  registration: 'car_registration_number', 'reg number': 'car_registration_number',
  'start date': 'start_date', startdate: 'start_date', start: 'start_date',
  'end date': 'end_date', enddate: 'end_date', end: 'end_date',
  'active status': 'is_active', active: 'is_active', status: 'is_active', isactive: 'is_active',
};

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { cell += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      row.push(cell); cell = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some(c => c.trim())) rows.push(row);
      row = [];
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) { row.push(cell); if (row.some(c => c.trim())) rows.push(row); }
  return rows;
}

function parseExcel(buffer: ArrayBuffer): Promise<string[][]> {
  // Minimal XLSX parser — reads the shared strings + first sheet
  // We use a dynamic import of the sheetjs-style parser embedded here
  // to avoid adding a dependency. For production, install 'xlsx' and use that.
  return new Promise((resolve, reject) => {
    try {
      // Try to use globally available XLSX (if loaded) otherwise fall back
      const XLSXLib = (window as any).XLSX;
      if (!XLSXLib) {
        reject(new Error('Please install the xlsx package or upload a CSV file instead.'));
        return;
      }
      const wb = XLSXLib.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data: string[][] = XLSXLib.utils.sheet_to_json(ws, { header: 1, defval: '' });
      resolve(data as string[][]);
    } catch (e: any) {
      reject(new Error(`Failed to parse Excel: ${e.message}`));
    }
  });
}

function parseBool(val: string): boolean {
  const v = val.trim().toLowerCase();
  return v === 'true' || v === '1' || v === 'yes' || v === 'active' || v === 'y';
}

function validateRow(row: BulkRow): string[] {
  const errs: string[] = [];
  if (!row.name?.trim()) errs.push('Name required');
  if (!row.email?.trim()) errs.push('Email required');
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) errs.push('Invalid email');
  if (!row.phone?.trim()) errs.push('Phone required');
  const pwd = row.password?.trim() || row.phone?.trim();
  if (!pwd || pwd.length < 6) errs.push('Password/phone must be ≥6 chars');
  return errs;
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expatFilter, setExpatFilter] = useState<'all' | 'new' | 'existing'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // ── Bulk upload state ─────────────────────────────────────────────────────
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkResult[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchCustomers = async () => {
    setLoading(true);
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

  // ─── Stats ────────────────────────────────────────────────────────────────
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

  // ─── Toggle active ────────────────────────────────────────────────────────
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

  // ─── Delete ───────────────────────────────────────────────────────────────
  const deleteCustomer = async () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.user_id) {
      const { data: { session } } = await supabase.auth.getSession();
      const apiRes = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ userId: deleteConfirm.user_id }),
      });
      const result = await apiRes.json();
      if (!apiRes.ok) {
        toast({ title: 'Error', description: result.error || 'Failed to delete.', variant: 'destructive' });
        setDeleteConfirm(null);
        return;
      }
      await supabase.from('customers').delete().eq('id', deleteConfirm.id);
    } else {
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

  // ─── Drawer open ──────────────────────────────────────────────────────────
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

  // ─── Save (single) ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      toast({
        title: 'Validation',
        description: 'Name and email are required.',
        variant: 'destructive'
      });
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

      console.log('STEP A: Payload prepared:', payload);

      if (editingCustomer) {
        console.log('STEP B: Updating existing customer');

        const { error } = await (supabase.from('customers') as any)
          .update(payload)
          .eq('id', editingCustomer.id);

        console.log('STEP C: Update result:', error);

        if (error) throw error;

        toast({
          title: 'Updated',
          description: `${formData.name} updated.`,
        });

      } else {
        console.log('STEP D: Creating new customer');

        // ✅ FIXED: no DB call → no RLS issue
        const newEmployeeId = `EMP-${Date.now()}`;
        console.log('STEP E: Generated employee ID:', newEmployeeId);

        // getSession() makes a network call which can hang.
        // Read the token directly from localStorage instead.
        const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
        const rawSession = storageKey ? JSON.parse(localStorage.getItem(storageKey) ?? '{}') : null;
        const accessToken = rawSession?.access_token ?? null;
        console.log('STEP F: Access token found:', !!accessToken);

        if (!accessToken) {
          throw new Error('No auth session found. Please sign out and sign in again.');
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => {
          console.error('⛔ Request timed out');
          controller.abort();
        }, 15000);

        let apiRes: Response;

        try {
          console.log('STEP G: Calling API');

          apiRes = await fetch('/api/create-user', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
              ...payload,
              employee_id: newEmployeeId,
            }),
            signal: controller.signal,
          });

        } catch (err: any) {
          console.error('STEP H: FETCH ERROR:', err);

          if (err.name === 'AbortError') {
            throw new Error('Request timed out. Backend not responding.');
          }

          throw err;
        } finally {
          clearTimeout(timeout);
        }

        console.log('STEP I: API status:', apiRes.status);

        let result;
        try {
          result = await apiRes.json();
        } catch {
          throw new Error('Invalid server response');
        }

        console.log('STEP J: API response:', result);

        if (!apiRes.ok) {
          throw new Error(result.error || 'Failed to create customer');
        }

        console.log('STEP K: SUCCESS');

        // Add the new customer to state directly instead of re-fetching
        // to avoid a second Supabase call that could hang.
        if (result.customer) {
          setCustomers(prev => [result.customer, ...prev]);
        }

        toast({
          title: 'Added',
          description: `${formData.name} added successfully`,
        });
      }

      setDrawerOpen(false);

    } catch (err: any) {
      console.error('FINAL ERROR:', err);

      toast({
        title: 'Error',
        description: err?.message || 'Something went wrong',
        variant: 'destructive'
      });

    } finally {
      setSaving(false);
      console.log('STEP Z: Done');
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
        <div className="flex items-center gap-2">
          <Button onClick={openAdd} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-4 h-4 mr-1.5" /> Add Customer
          </Button>
        </div>
      </div>

      {/* Parse error banner */}
      {parseError && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
          <XCircle className="w-4 h-4 shrink-0" />
          {parseError}
          <button onClick={() => setParseError(null)} className="ml-auto text-xs underline">Dismiss</button>
        </div>
      )}

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