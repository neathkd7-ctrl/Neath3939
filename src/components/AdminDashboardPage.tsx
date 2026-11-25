import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Star,
  Trash2,
  Users,
  FolderPlus,
  Layers,
  Ban,
  Eye,
  Pencil,
  Check,
} from 'lucide-react';
import type { AdminOverviewStats, AdminUserItem, Category, ModItem } from '../types';
import { formatBytes, formatDate, formatNumber } from '../types';
import {
  adminDeleteAllMods,
  adminDeleteMod,
  createCategory,
  deleteAdminUser,
  deleteCategory,
  fetchAdminMods,
  fetchAdminOverview,
  fetchAdminStatus,
  fetchAdminUsers,
  moderateMod,
  updateAdminUser,
  updateCategory,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface AdminDashboardPageProps {
  categories: Category[];
  onRefreshGlobalData: () => void;
  onSelectMod: (mod: ModItem) => void;
}

export function AdminDashboardPage({
  categories,
  onRefreshGlobalData,
  onSelectMod,
}: AdminDashboardPageProps) {
  const { user, token, claimAdmin, signInAdmin } = useAuth();

  // Admin auth setup state
  const [adminStatus, setAdminStatus] = useState<{
    adminConfigured: boolean;
    hasClaimedAdmin: boolean;
  } | null>(null);
  const [authError, setAuthError] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Claim / Login fields
  const [claimUsername, setClaimUsername] = useState('');
  const [claimEmail, setClaimEmail] = useState('');
  const [claimPassword, setClaimPassword] = useState('');
  const [passcodeInput, setPasscodeInput] = useState('');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Dashboard tabs & data
  const [activeTab, setActiveTab] = useState<'mods' | 'users' | 'categories'>('mods');
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [adminMods, setAdminMods] = useState<ModItem[]>([]);
  const [modStatusFilter, setModStatusFilter] = useState('all');
  const [modSearch, setModSearch] = useState('');
  const [adminUsers, setAdminUsers] = useState<AdminUserItem[]>([]);
  const [dashboardError, setDashboardError] = useState('');
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);

  // Category creation / editing
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatDesc, setEditCatDesc] = useState('');

  const isAdmin = user?.role === 'admin' && Boolean(token);

  useEffect(() => {
    if (!isAdmin) {
      fetchAdminStatus()
        .then(setAdminStatus)
        .catch(() => setAdminStatus({ adminConfigured: false, hasClaimedAdmin: false }));
    }
  }, [isAdmin]);

  const loadDashboard = useCallback(async () => {
    if (!token || user?.role !== 'admin') return;
    setDashboardError('');
    try {
      const [overviewRes, modsRes, usersRes] = await Promise.all([
        fetchAdminOverview(token),
        fetchAdminMods(token, { status: modStatusFilter, q: modSearch }),
        fetchAdminUsers(token),
      ]);
      setStats(overviewRes.stats);
      setAdminMods(modsRes.mods);
      setAdminUsers(usersRes.users);
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Failed to load admin data.');
    }
  }, [token, user?.role, modStatusFilter, modSearch]);

  useEffect(() => {
    if (isAdmin) {
      loadDashboard();
    }
  }, [isAdmin, loadDashboard]);

  async function handleClaimSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      await claimAdmin(claimUsername, claimEmail, claimPassword);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Failed to claim admin access.');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleAdminLoginSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthError('');
    setAuthSubmitting(true);
    try {
      if (adminStatus?.adminConfigured && passcodeInput.trim()) {
        await signInAdmin({ passcode: passcodeInput.trim() });
      } else {
        await signInAdmin({ identifier: loginIdentifier, password: loginPassword });
      }
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Admin authentication failed.');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleModerate(
    mod: ModItem,
    patch: { status?: 'approved' | 'rejected' | 'pending'; is_featured?: boolean }
  ) {
    if (!token) return;
    setDashboardError('');
    try {
      await moderateMod(mod.id, patch, token);
      await loadDashboard();
      onRefreshGlobalData();
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Moderation update failed.');
    }
  }

  async function handleDeleteMod(id: string) {
    if (!token) return;
    setDashboardError('');
    try {
      await adminDeleteMod(id, token);
      await loadDashboard();
      onRefreshGlobalData();
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Delete failed.');
    }
  }

  async function handleDeleteAllMods() {
    if (!token) return;
    setDashboardError('');
    try {
      await adminDeleteAllMods(token);
      setConfirmDeleteAll(false);
      await loadDashboard();
      onRefreshGlobalData();
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Failed to delete all mods.');
    }
  }

  async function handleToggleBan(target: AdminUserItem) {
    if (!token) return;
    setDashboardError('');
    try {
      await updateAdminUser(target.id, { is_banned: !target.is_banned }, token);
      await loadDashboard();
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Failed to update user.');
    }
  }

  async function handleToggleRole(target: AdminUserItem) {
    if (!token) return;
    setDashboardError('');
    try {
      const nextRole = target.role === 'admin' ? 'user' : 'admin';
      await updateAdminUser(target.id, { role: nextRole }, token);
      await loadDashboard();
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Failed to update role.');
    }
  }

  async function handleDeleteUser(id: string) {
    if (!token) return;
    setDashboardError('');
    try {
      await deleteAdminUser(id, token);
      await loadDashboard();
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Failed to delete user.');
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setDashboardError('');
    try {
      await createCategory({ name: newCatName, description: newCatDesc }, token);
      setNewCatName('');
      setNewCatDesc('');
      onRefreshGlobalData();
      await loadDashboard();
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Could not create category.');
    }
  }

  async function handleSaveCategory(id: string) {
    if (!token) return;
    setDashboardError('');
    try {
      await updateCategory(id, { name: editCatName, description: editCatDesc }, token);
      setEditingCatId(null);
      onRefreshGlobalData();
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Could not update category.');
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!token) return;
    setDashboardError('');
    try {
      await deleteCategory(id, token);
      onRefreshGlobalData();
      await loadDashboard();
    } catch (err) {
      setDashboardError(err instanceof Error ? err.message : 'Could not delete category.');
    }
  }

  // Gate: Non-admin view (Claim First-Run Admin OR Sign In as Admin)
  if (!isAdmin) {
    const showFirstRunClaim =
      adminStatus && !adminStatus.adminConfigured && !adminStatus.hasClaimedAdmin;

    return (
      <div className="mx-auto max-w-md px-4 py-14 sm:px-6">
        <div className="rounded-xl border border-[#24242D] bg-[#16161B] p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#F16436]/15 text-[#F16436]">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-white">
                {showFirstRunClaim ? 'Claim DOG MODS Admin' : 'Admin Dashboard Sign In'}
              </h1>
              <p className="text-xs text-zinc-400">
                {showFirstRunClaim
                  ? 'Set up the initial administrator account for this server.'
                  : 'Verify administrator credentials to moderate Bedrock mods.'}
              </p>
            </div>
          </div>

          {authError && (
            <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
              {authError}
            </div>
          )}

          {showFirstRunClaim ? (
            <form onSubmit={handleClaimSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Admin Username
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={claimUsername}
                  onChange={(e) => setClaimUsername(e.target.value)}
                  placeholder="AdminHandle"
                  className="min-h-11 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white focus:border-[#F16436] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={claimEmail}
                  onChange={(e) => setClaimEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="min-h-11 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white focus:border-[#F16436] focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                  Choose Admin Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={claimPassword}
                  onChange={(e) => setClaimPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="min-h-11 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white focus:border-[#F16436] focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={authSubmitting}
                className="min-h-11 w-full rounded-lg bg-[#F16436] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#FF7849] disabled:opacity-60"
              >
                {authSubmitting ? 'Claiming Admin...' : 'Claim Admin & Open Dashboard'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleAdminLoginSubmit} className="space-y-4">
              {adminStatus?.adminConfigured && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                    Admin Passcode
                  </label>
                  <input
                    type="password"
                    value={passcodeInput}
                    onChange={(e) => setPasscodeInput(e.target.value)}
                    placeholder="Enter server ADMIN_PASSCODE"
                    className="min-h-11 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white focus:border-[#F16436] focus:outline-none"
                  />
                </div>
              )}

              {(!adminStatus?.adminConfigured || adminStatus?.hasClaimedAdmin) && (
                <>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                      Admin Username or Email
                    </label>
                    <input
                      type="text"
                      required={!adminStatus?.adminConfigured}
                      value={loginIdentifier}
                      onChange={(e) => setLoginIdentifier(e.target.value)}
                      placeholder="admin@example.com"
                      className="min-h-11 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white focus:border-[#F16436] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                      Password
                    </label>
                    <input
                      type="password"
                      required={!adminStatus?.adminConfigured}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Admin password"
                      className="min-h-11 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white focus:border-[#F16436] focus:outline-none"
                    />
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={authSubmitting}
                className="min-h-11 w-full rounded-lg bg-[#F16436] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#FF7849] disabled:opacity-60"
              >
                {authSubmitting ? 'Verifying...' : 'Sign In to Admin Dashboard'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-[#24242D] pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wider text-[#F16436]">
            SITE ADMINISTRATION
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-white sm:text-3xl">
            DOG MODS Admin Dashboard
          </h1>
        </div>

        {/* Segmented Tab Switch */}
        <div className="flex items-center gap-1 rounded-lg border border-[#24242D] bg-[#16161B] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('mods')}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'mods' ? 'bg-[#F16436] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Mods</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'users' ? 'bg-[#F16436] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Users</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`inline-flex min-h-10 items-center gap-1.5 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'categories'
                ? 'bg-[#F16436] text-white'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <FolderPlus className="h-4 w-4" />
            <span>Categories</span>
          </button>
        </div>
      </div>

      {/* Overview Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <div className="rounded-xl border border-[#24242D] bg-[#16161B] p-4">
            <p className="text-xs text-zinc-400">Total Bedrock Mods</p>
            <p className="mt-1 font-display text-2xl font-bold text-white tabular-nums">
              {formatNumber(stats.totalMods)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 tabular-nums">
              {stats.featuredMods} featured on homepage
            </p>
          </div>
          <div className="rounded-xl border border-[#24242D] bg-[#16161B] p-4">
            <p className="text-xs text-zinc-400">Pending Review</p>
            <p className="mt-1 font-display text-2xl font-bold text-amber-400 tabular-nums">
              {formatNumber(stats.pendingMods)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 tabular-nums">
              {stats.approvedMods} approved · {stats.rejectedMods} rejected
            </p>
          </div>
          <div className="rounded-xl border border-[#24242D] bg-[#16161B] p-4">
            <p className="text-xs text-zinc-400">Total Downloads</p>
            <p className="mt-1 font-display text-2xl font-bold text-[#F16436] tabular-nums">
              {formatNumber(stats.totalDownloads)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Served from file storage</p>
          </div>
          <div className="rounded-xl border border-[#24242D] bg-[#16161B] p-4">
            <p className="text-xs text-zinc-400">Registered Users</p>
            <p className="mt-1 font-display text-2xl font-bold text-white tabular-nums">
              {formatNumber(stats.totalUsers)}
            </p>
            <p className="mt-1 text-xs text-zinc-500 tabular-nums">
              {stats.totalCategories} active categories
            </p>
          </div>
        </div>
      )}

      {dashboardError && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {dashboardError}
        </div>
      )}

      {/* TAB 1: MOD MODERATION */}
      {activeTab === 'mods' && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'pending', 'approved', 'rejected'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setModStatusFilter(st)}
                  className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    modStatusFilter === st
                      ? 'bg-[#F16436] text-white'
                      : 'border border-[#24242D] bg-[#16161B] text-zinc-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="search"
                value={modSearch}
                onChange={(e) => setModSearch(e.target.value)}
                placeholder="Filter mods by title or creator..."
                className="min-h-10 w-full rounded-lg border border-[#2A2A34] bg-[#16161B] px-3.5 text-sm text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none sm:w-64"
              />
              {adminMods.length > 0 && (
                confirmDeleteAll ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDeleteAllMods}
                      className="min-h-10 rounded-lg bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-500 whitespace-nowrap"
                    >
                      Confirm Delete All
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAll(false)}
                      className="min-h-10 rounded-lg border border-[#2A2A34] bg-[#16161B] px-3 text-xs text-zinc-300 whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteAll(true)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-3.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 whitespace-nowrap"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete All Mods</span>
                  </button>
                )
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-[#24242D] bg-[#16161B]">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-[#24242D] bg-[#111115] text-xs text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Mod</th>
                  <th className="px-4 py-3 font-medium">Creator</th>
                  <th className="px-4 py-3 font-medium">Package</th>
                  <th className="px-4 py-3 font-medium text-right">Downloads</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22222A]">
                {adminMods.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-zinc-400">
                      No mods match the selected filter.
                    </td>
                  </tr>
                ) : (
                  adminMods.map((mod) => (
                    <tr key={mod.id} className="hover:bg-[#1A1A21]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img
                            src={mod.image_url}
                            alt={mod.title}
                            referrerPolicy="no-referrer"
                            className="h-11 w-11 shrink-0 rounded-lg border border-[#2A2A34] object-cover bg-[#0E0E11]"
                          />
                          <div className="min-w-0">
                            <p className="max-w-[200px] truncate font-semibold text-white">
                              {mod.title}
                            </p>
                            <p className="text-xs text-zinc-400">
                              {mod.category_name} · MC {mod.mc_version}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-300">{mod.creator_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-zinc-400 tabular-nums">
                        <p className="max-w-[160px] truncate text-zinc-200">
                          {mod.file_original_name}
                        </p>
                        <p>{formatBytes(mod.file_size)}</p>
                      </td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-200">
                        {formatNumber(mod.downloads)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold capitalize ${
                            mod.status === 'approved'
                              ? 'text-emerald-400'
                              : mod.status === 'pending'
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        >
                          {mod.status}
                        </span>
                        {mod.is_featured && (
                          <span className="ml-2 text-xs font-medium text-[#F16436]">
                            · Featured
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onSelectMod(mod)}
                            title="View Mod"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2A2A34] bg-[#0E0E11] text-zinc-300 hover:text-white"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {mod.status !== 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleModerate(mod, { status: 'approved' })}
                              title="Approve Mod"
                              className="inline-flex h-9 items-center gap-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-2.5 text-xs font-medium text-emerald-300 hover:bg-emerald-600/30"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Approve</span>
                            </button>
                          )}
                          {mod.status !== 'rejected' && (
                            <button
                              type="button"
                              onClick={() => handleModerate(mod, { status: 'rejected', is_featured: false })}
                              title="Reject Mod"
                              className="inline-flex h-9 items-center gap-1 rounded-lg bg-amber-600/20 border border-amber-500/40 px-2.5 text-xs font-medium text-amber-300 hover:bg-amber-600/30"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              <span>Reject</span>
                            </button>
                          )}
                          {mod.status === 'approved' && (
                            <button
                              type="button"
                              onClick={() =>
                                handleModerate(mod, { is_featured: !mod.is_featured })
                              }
                              title={mod.is_featured ? 'Remove from Featured' : 'Feature on Homepage'}
                              className={`inline-flex h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium ${
                                mod.is_featured
                                  ? 'border-[#F16436] bg-[#F16436]/20 text-[#F16436]'
                                  : 'border-[#2A2A34] bg-[#0E0E11] text-zinc-300 hover:text-white'
                              }`}
                            >
                              <Star className="h-3.5 w-3.5" />
                              <span>{mod.is_featured ? 'Featured' : 'Feature'}</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteMod(mod.id)}
                            title="Delete Mod"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: MANAGE USERS */}
      {activeTab === 'users' && (
        <section className="overflow-x-auto rounded-xl border border-[#24242D] bg-[#16161B]">
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead className="border-b border-[#24242D] bg-[#111115] text-xs text-zinc-400">
              <tr>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium text-right">Mods</th>
                <th className="px-4 py-3 font-medium text-right">Downloads</th>
                <th className="px-4 py-3 font-medium">Joined</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22222A]">
              {adminUsers.map((u) => (
                <tr key={u.id} className="hover:bg-[#1A1A21]">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-white">{u.username}</p>
                    <p className="text-xs text-zinc-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-semibold capitalize ${
                        u.role === 'admin' ? 'text-[#F16436]' : 'text-zinc-300'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-200">
                    {u.mod_count}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-zinc-200">
                    {formatNumber(u.total_downloads)}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400 tabular-nums">
                    {formatDate(u.created_at)}
                  </td>
                  <td className="px-4 py-3 text-xs font-semibold">
                    {u.is_banned ? (
                      <span className="text-red-400">Banned</span>
                    ) : (
                      <span className="text-emerald-400">Active</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {u.id !== user?.id && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleToggleRole(u)}
                            className="min-h-9 rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-2.5 text-xs font-medium text-zinc-200 hover:border-[#F16436]/60"
                          >
                            {u.role === 'admin' ? 'Make User' : 'Make Admin'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleBan(u)}
                            className={`inline-flex min-h-9 items-center gap-1 rounded-lg border px-2.5 text-xs font-medium ${
                              u.is_banned
                                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                                : 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                            }`}
                          >
                            <Ban className="h-3.5 w-3.5" />
                            <span>{u.is_banned ? 'Unban' : 'Ban'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id)}
                            title="Delete User"
                            className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* TAB 3: MANAGE CATEGORIES */}
      {activeTab === 'categories' && (
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Add Category Form */}
          <form
            onSubmit={handleCreateCategory}
            className="space-y-4 rounded-xl border border-[#24242D] bg-[#16161B] p-6 lg:col-span-4 h-fit"
          >
            <h2 className="font-display text-lg font-bold text-white">Add Category</h2>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Category Name *
              </label>
              <input
                type="text"
                required
                minLength={2}
                maxLength={48}
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="e.g. PvP Arenas"
                className="min-h-11 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 text-sm text-white focus:border-[#F16436] focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                Description
              </label>
              <textarea
                rows={3}
                maxLength={200}
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Short summary for Bedrock players..."
                className="w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white focus:border-[#F16436] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="min-h-11 w-full rounded-lg bg-[#F16436] px-4 text-sm font-semibold text-white hover:bg-[#FF7849]"
            >
              Create Category
            </button>
          </form>

          {/* Existing Categories List */}
          <div className="space-y-3 lg:col-span-8">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="rounded-xl border border-[#24242D] bg-[#16161B] p-4"
              >
                {editingCatId === cat.id ? (
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={editCatName}
                      onChange={(e) => setEditCatName(e.target.value)}
                      className="min-h-10 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3 text-sm text-white focus:border-[#F16436] focus:outline-none"
                    />
                    <input
                      type="text"
                      value={editCatDesc}
                      onChange={(e) => setEditCatDesc(e.target.value)}
                      className="min-h-10 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3 text-sm text-white focus:border-[#F16436] focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveCategory(cat.id)}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#F16436] px-3 text-xs font-semibold text-white"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Save</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingCatId(null)}
                        className="min-h-9 rounded-lg border border-[#2A2A34] px-3 text-xs text-zinc-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-base font-bold text-white">{cat.name}</h3>
                        <span className="font-mono text-xs text-zinc-400 tabular-nums">
                          · {cat.mod_count ?? 0} mods
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-zinc-400">
                        {cat.description || 'No description'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCatId(cat.id);
                          setEditCatName(cat.name);
                          setEditCatDesc(cat.description || '');
                        }}
                        title="Edit Category"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2A2A34] bg-[#0E0E11] text-zinc-300 hover:text-white"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        title="Delete Category"
                        className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
