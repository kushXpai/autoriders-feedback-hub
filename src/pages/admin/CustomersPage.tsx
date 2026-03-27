import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Trash2, Pencil, MoreVertical, Users, UserCheck, UserX, Filter, Upload } from 'lucide-react';
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
import { customers as initialCustomers, customerQuarterProfiles, Customer } from '@/data/mockData';
import { cn } from '@/lib/utils';
import BulkImportDialog from '@/components/BulkImportDialog';

export default function CustomersPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [customerList, setCustomerList] = useState<Customer[]>(initialCustomers);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [expatFilter, setExpatFilter] = useState<'all' | 'new' | 'existing'>('all');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({
    name: '', email: '', phone: '', expatType: 'existing' as 'new' | 'existing', isActive: true,
    allocatedCar: '', startDate: '', endDate: '',
  });
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const handleBulkImport = (customers: Omit<Customer, 'id' | 'employeeId' | 'createdAt'>[]) => {
    const maxId = Math.max(...customerList.map(c => c.id), 0);
    const newCustomers: Customer[] = customers.map((c, i) => ({
      ...c,
      id: maxId + 1 + i,
      employeeId: `EMP-${1300 + maxId + 1 + i}`,
      createdAt: new Date().toISOString().split('T')[0],
      allocatedCar: c.allocatedCar || '',
      startDate: c.startDate || '',
      endDate: c.endDate || '',
    }));
    setCustomerList(prev => [...prev, ...newCustomers]);
  };

  const getExpatType = (customerId: number) => {
    const profile = customerQuarterProfiles.find(p => p.customerId === customerId && p.quarterId === 'q1-2026');
    return profile?.expatType ?? '—';
  };

  const filtered = useMemo(() => {
    return customerList.filter(c => {
      const matchesSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? c.isActive : !c.isActive);
      const type = getExpatType(c.id);
      const matchesExpat = expatFilter === 'all' || type === expatFilter;
      return matchesSearch && matchesStatus && matchesExpat;
    });
  }, [customerList, search, statusFilter, expatFilter]);

  const totalCount = customerList.length;
  const activeCount = customerList.filter(c => c.isActive).length;
  const inactiveCount = totalCount - activeCount;

  const toggleActive = (id: number) => {
    setCustomerList(prev => prev.map(c => c.id === id ? { ...c, isActive: !c.isActive } : c));
  };

  const deleteCustomer = () => {
    if (!deleteConfirm) return;
    setCustomerList(prev => prev.filter(c => c.id !== deleteConfirm.id));
    toast({ title: 'Customer deleted', description: `${deleteConfirm.name} has been removed.` });
    setDeleteConfirm(null);
  };

  const openAdd = () => {
    setEditingCustomer(null);
    setFormData({ name: '', email: '', phone: '', expatType: 'existing', isActive: true, allocatedCar: '', startDate: '', endDate: '' });
    setDrawerOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({ name: c.name, email: c.email, phone: c.phone, expatType: getExpatType(c.id) as 'new' | 'existing', isActive: c.isActive, allocatedCar: c.allocatedCar, startDate: c.startDate, endDate: c.endDate });
    setDrawerOpen(true);
  };

  const handleSave = () => {
    if (editingCustomer) {
      setCustomerList(prev => prev.map(c => c.id === editingCustomer.id ? { ...c, name: formData.name, email: formData.email, phone: formData.phone, isActive: formData.isActive, allocatedCar: formData.allocatedCar, startDate: formData.startDate, endDate: formData.endDate } : c));
      toast({ title: 'Customer updated', description: `${formData.name} has been updated.` });
    } else {
      const id = Math.max(...customerList.map(c => c.id), 0) + 1;
      setCustomerList(prev => [...prev, {
        id,
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        employeeId: `EMP-${1300 + id}`,
        isActive: formData.isActive,
        createdAt: new Date().toISOString().split('T')[0],
        allocatedCar: formData.allocatedCar,
        startDate: formData.startDate,
        endDate: formData.endDate,
      }]);
      toast({ title: 'Customer added', description: `${formData.name} has been added.` });
    }
    setDrawerOpen(false);
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
          <Button variant="outline" onClick={() => setBulkImportOpen(true)}>
            <Upload className="w-4 h-4 mr-1.5" /> Import
          </Button>
          <Button onClick={openAdd} className="bg-accent hover:bg-accent/90 text-accent-foreground">
            <Plus className="w-4 h-4 mr-1.5" /> Add Customer
          </Button>
        </div>
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
              <Filter className="w-3.5 h-3.5" />
              Filter
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
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.97] capitalize',
                      statusFilter === f
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Expat Type</p>
              <div className="flex flex-wrap gap-1.5">
                {(['all', 'new', 'existing'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setExpatFilter(f)}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-[0.97] capitalize',
                      expatFilter === f
                        ? 'bg-accent text-accent-foreground shadow-sm'
                        : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {f === 'all' ? 'All' : f}
                  </button>
                ))}
              </div>
            </div>
            {(statusFilter !== 'all' || expatFilter !== 'all') && (
              <button
                onClick={() => { setStatusFilter('all'); setExpatFilter('all'); }}
                className="text-xs text-destructive hover:underline w-full text-center pt-1"
              >
                Clear all filters
              </button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Active filter breadcrumbs */}
      {(statusFilter !== 'all' || expatFilter !== 'all') && (
        <div className="flex items-center gap-2 flex-wrap">
          {statusFilter !== 'all' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
              Status: <span className="capitalize">{statusFilter}</span>
              <button onClick={() => setStatusFilter('all')} className="ml-0.5 hover:text-destructive transition-colors">✕</button>
            </span>
          )}
          {expatFilter !== 'all' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent">
              Type: <span className="capitalize">{expatFilter}</span>
              <button onClick={() => setExpatFilter('all')} className="ml-0.5 hover:text-destructive transition-colors">✕</button>
            </span>
          )}
          <button
            onClick={() => { setStatusFilter('all'); setExpatFilter('all'); }}
            className="text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear all
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
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
              <TableRow
                key={c.id}
                className="cursor-pointer hover:bg-muted/30 transition-colors"
                onClick={() => navigate(`/admin/customers/${c.id}`)}
              >
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
                <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{c.phone}</TableCell>
                <TableCell>
                  <span className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full capitalize',
                    getExpatType(c.id) === 'new' ? 'bg-accent/15 text-accent' : 'bg-muted text-muted-foreground'
                  )}>
                    {getExpatType(c.id)}
                  </span>
                </TableCell>
                <TableCell>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleActive(c.id); }}
                    className={cn(
                      'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                      c.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                    )}
                  >
                    <span className={cn(
                      'inline-block h-4 w-4 rounded-full bg-white transition-transform shadow-sm',
                      c.isActive ? 'translate-x-6' : 'translate-x-1'
                    )} />
                  </button>
                </TableCell>
                <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                  {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                      <DropdownMenuItem onClick={() => openEdit(c)}>
                        <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setDeleteConfirm(c)} className="text-destructive focus:text-destructive">
                        <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                  No customers found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Customer</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <span className="font-medium text-foreground">{deleteConfirm?.name}</span>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteCustomer}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Customer Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</SheetTitle>
            <SheetDescription>{editingCustomer ? 'Update customer details below.' : 'Fill in the customer details below.'}</SheetDescription>
          </SheetHeader>
          <div className="space-y-5 mt-6">
            <div className="space-y-1.5">
              <Label>Full Name</Label>
              <Input value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} placeholder="John Smith" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} placeholder="john.smith@exxon.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} placeholder="+966 55 000 0000" />
            </div>
            {!editingCustomer && (
              <div className="space-y-1.5">
                <Label>Expat Type (Current Quarter)</Label>
                <Select value={formData.expatType} onValueChange={(v: 'new' | 'existing') => setFormData(p => ({ ...p, expatType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="existing">Existing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
             )}
            <div className="space-y-1.5">
              <Label>Allocated Car</Label>
              <Select value={formData.allocatedCar} onValueChange={(v) => setFormData(p => ({ ...p, allocatedCar: v }))}>
                <SelectTrigger><SelectValue placeholder="Select a car" /></SelectTrigger>
                <SelectContent>
                  {['Toyota Camry', 'Toyota Land Cruiser', 'Toyota Corolla', 'Honda Accord', 'Hyundai Sonata', 'Nissan Maxima', 'Nissan Patrol', 'GMC Yukon', 'Chevrolet Malibu', 'Kia K5'].map(car => (
                    <SelectItem key={car} value={car}>{car}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={formData.startDate} onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={formData.endDate} onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>Active Status</Label>
              <Switch checked={formData.isActive} onCheckedChange={v => setFormData(p => ({ ...p, isActive: v }))} />
            </div>
            <div className="flex gap-3 pt-4">
              <Button onClick={handleSave} className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground">
                {editingCustomer ? 'Update' : 'Save'}
              </Button>
              <Button variant="outline" onClick={() => setDrawerOpen(false)} className="flex-1">Cancel</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      {/* Bulk Import Dialog */}
      <BulkImportDialog
        open={bulkImportOpen}
        onOpenChange={setBulkImportOpen}
        onImport={handleBulkImport}
        existingEmails={customerList.map(c => c.email.toLowerCase())}
      />
    </div>
  );
}
