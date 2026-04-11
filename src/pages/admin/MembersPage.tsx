// src/pages/admin/MembersPage.tsx
import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Trash2, KeyRound, ChevronDown, Shield, UserCog, Users, Eye, EyeOff, Loader2, X, MoreHorizontal } from 'lucide-react';
import { supabase } from '@/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type AppRole = 'superadmin' | 'admin' | 'manager' | 'user' | 'vendor_admin';

interface Member {
  user_id: string;
  name: string;
  email: string;
  role: AppRole;
  created_at: string;
}

// ─── Role Config ──────────────────────────────────────────────────────────────

const ROLE_OPTIONS: { value: AppRole; label: string; color: string }[] = [
  { value: 'superadmin', label: 'Super Admin', color: 'bg-rose-100 text-rose-700 border-rose-200' },
  { value: 'admin',      label: 'Admin',       color: 'bg-violet-100 text-violet-700 border-violet-200' },
  { value: 'manager',    label: 'Manager',     color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'user',       label: 'User',        color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'vendor_admin', label: 'Client',    color: 'bg-amber-100 text-amber-700 border-amber-200' },
];

function getRoleConfig(role: AppRole) {
  return ROLE_OPTIONS.find(r => r.value === role) ?? ROLE_OPTIONS[3];
}

// ─── Modal: Add Member ────────────────────────────────────────────────────────

interface AddMemberModalProps {
  onClose: () => void;
  onSuccess: () => void;
  token: string;
}

function AddMemberModal({ onClose, onSuccess, token }: AddMemberModalProps) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' as AppRole });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  async function handleSubmit() {
    setError('');
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setError('All fields are required.');
      return;
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/create-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create member');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Add Member</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Create a new system member account</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Full Name</label>
            <input
              type="text"
              value={form.name}
              onChange={set('name')}
              placeholder="John Smith"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>

          {/* Email */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="john@company.com"
              className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Password</label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={form.password}
                onChange={set('password')}
                placeholder="Min. 6 characters"
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
              <button
                type="button"
                onClick={() => setShowPass(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Role */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Role</label>
            <div className="relative">
              <select
                value={form.role}
                onChange={set('role')}
                className="w-full px-3 py-2.5 rounded-lg border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring transition cursor-pointer"
              >
                {ROLE_OPTIONS.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {loading ? 'Creating…' : 'Create Member'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Reset Password ────────────────────────────────────────────────────

interface ResetPasswordModalProps {
  member: Member;
  onClose: () => void;
  token: string;
}

function ResetPasswordModal({ member, onClose, token }: ResetPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleReset() {
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ userId: member.user_id, newPassword: password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update password');
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Reset Password</h2>
            <p className="text-sm text-muted-foreground mt-0.5 truncate max-w-[220px]">{member.name}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <p className="text-sm text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-center">
            ✓ Password updated successfully
          </p>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password (min. 6 chars)"
                className="w-full px-3 py-2.5 pr-10 rounded-lg border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
              />
              <button type="button" onClick={() => setShowPass(p => !p)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-all">Cancel</button>
              <button onClick={handleReset} disabled={loading} className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                {loading ? 'Saving…' : 'Update'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Confirm Delete ───────────────────────────────────────────────────────────

interface ConfirmDeleteProps {
  member: Member;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}

function ConfirmDelete({ member, onClose, onConfirm, loading }: ConfirmDeleteProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-fade-in">
        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
          <Trash2 className="w-5 h-5 text-destructive" />
        </div>
        <h2 className="text-base font-semibold text-foreground text-center">Delete Member?</h2>
        <p className="text-sm text-muted-foreground text-center mt-1.5 mb-5">
          <span className="font-medium text-foreground">{member.name}</span> will be permanently removed. This cannot be undone.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-all">Cancel</button>
          <button onClick={onConfirm} disabled={loading} className="flex-1 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MembersPage() {
  const [token, setToken] = useState('');

    useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
        setToken(`Bearer ${data.session?.access_token ?? ''}`);
    });
    }, []);

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState<AppRole | 'all'>('all');

  const [showAdd, setShowAdd] = useState(false);
  const [resetTarget, setResetTarget] = useState<Member | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // ── Fetch members (profiles joined with user_roles, exclude 'customer') ─────
  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rolesData, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .neq('role', 'customer');

      if (rolesError) throw rolesError;

      const userIds = (rolesData ?? []).map((r: any) => r.user_id);

      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email, created_at')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      const profileMap = Object.fromEntries(
        (profilesData ?? []).map((p: any) => [p.id, p])
      );

      const rows: Member[] = (rolesData ?? [])
        .filter((r: any) => profileMap[r.user_id])
        .map((r: any) => ({
          user_id: r.user_id,
          role: r.role as AppRole,
          name: profileMap[r.user_id].name,
          email: profileMap[r.user_id].email,
          created_at: profileMap[r.user_id].created_at,
        }))
        .sort((a: Member, b: Member) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

      setMembers(rows);
    } catch (err) {
      console.error('Failed to fetch members:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ userId: deleteTarget.user_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDeleteTarget(null);
      fetchMembers();
    } catch (err: any) {
      console.error(err);
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = members.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    const matchRole = filterRole === 'all' || m.role === filterRole;
    return matchSearch && matchRole;
  });

  // ── Role counts ───────────────────────────────────────────────────────────
  const counts = members.reduce((acc, m) => {
    acc[m.role] = (acc[m.role] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Members</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage system members and their access roles</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-all shadow-sm active:scale-[0.97]"
        >
          <Plus className="w-4 h-4" />
          Add Member
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {ROLE_OPTIONS.map(r => (
          <button
            key={r.value}
            onClick={() => setFilterRole(prev => prev === r.value ? 'all' : r.value)}
            className={cn(
              'bg-card border rounded-xl p-3 text-left transition-all hover:shadow-sm active:scale-[0.98]',
              filterRole === r.value ? 'border-primary ring-1 ring-primary' : 'border-border'
            )}
          >
            <p className="text-2xl font-bold text-foreground">{counts[r.value] ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{r.label}</p>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition"
          />
        </div>
        <div className="relative">
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value as AppRole | 'all')}
            className="pl-3 pr-8 py-2.5 rounded-xl border border-input bg-background text-sm appearance-none focus:outline-none focus:ring-2 focus:ring-ring transition cursor-pointer"
          >
            <option value="all">All Roles</option>
            {ROLE_OPTIONS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading members…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Users className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No members found</p>
            <p className="text-xs mt-1 opacity-60">
              {search || filterRole !== 'all' ? 'Try adjusting your filters' : 'Add your first member to get started'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Member</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Role</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden sm:table-cell">Joined</th>
                  <th className="px-5 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(member => {
                  const rc = getRoleConfig(member.role);
                  return (
                    <tr key={member.user_id} className="hover:bg-muted/30 transition-colors group">
                      {/* Member */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-semibold text-primary">
                              {member.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{member.name}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                          </div>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="px-5 py-3.5">
                        <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border', rc.color)}>
                          <Shield className="w-3 h-3" />
                          {rc.label}
                        </span>
                      </td>

                      {/* Joined */}
                      <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">
                        {new Date(member.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 relative">
                        <button
                          onClick={() => setOpenMenuId(prev => prev === member.user_id ? null : member.user_id)}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </button>

                        {openMenuId === member.user_id && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                            <div className="absolute right-4 top-full mt-1 z-20 bg-popover border border-border rounded-xl shadow-lg py-1 min-w-[160px] animate-fade-in">
                              <button
                                onClick={() => { setResetTarget(member); setOpenMenuId(null); }}
                                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                              >
                                <KeyRound className="w-3.5 h-3.5 text-muted-foreground" />
                                Reset Password
                              </button>
                              <button
                                onClick={() => { setDeleteTarget(member); setOpenMenuId(null); }}
                                className="flex items-center gap-2.5 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete Member
                              </button>
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer count */}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Showing {filtered.length} of {members.length} member{members.length !== 1 ? 's' : ''}
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAdd && <AddMemberModal token={token} onClose={() => setShowAdd(false)} onSuccess={fetchMembers} />}
      {resetTarget && <ResetPasswordModal member={resetTarget} token={token} onClose={() => setResetTarget(null)} />}
      {deleteTarget && (
        <ConfirmDelete
          member={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          loading={deleteLoading}
        />
      )}
    </div>
  );
}