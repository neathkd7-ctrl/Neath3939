import React, { useEffect, useState } from 'react';
import {
  User as UserIcon,
  Calendar,
  Download,
  Pencil,
  Trash2,
  Upload,
  Check,
  Box,
} from 'lucide-react';
import type { ModItem, PublicProfile } from '../types';
import { formatBytes, formatDate, formatNumber, resolveAssetUrl } from '../types';
import { deleteMod, fetchMyMods, fetchPublicProfile, updateProfile } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ModCard } from './ModCard';

interface ProfilePageProps {
  mode: 'my-mods' | 'profile';
  username?: string;
  onSelectMod: (mod: ModItem) => void;
  onEditMod: (mod: ModItem) => void;
  onUploadClick: () => void;
  onModMutated: () => void;
}

export function ProfilePage({
  mode,
  username,
  onSelectMod,
  onEditMod,
  onUploadClick,
  onModMutated,
}: ProfilePageProps) {
  const { user, token, openAuthModal, setUser } = useAuth();

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [mods, setMods] = useState<ModItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Own profile bio editing
  const [editingBio, setEditingBio] = useState(false);
  const [bioDraft, setBioDraft] = useState('');
  const [savingBio, setSavingBio] = useState(false);

  // Delete confirmation per mod
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const isOwnMyMods = mode === 'my-mods';
  const isViewingSelf =
    isOwnMyMods || (Boolean(user) && username?.toLowerCase() === user?.username.toLowerCase());

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');

    if (isOwnMyMods) {
      if (!token) {
        setLoading(false);
        return;
      }
      fetchMyMods(token)
        .then((res) => {
          if (active) setMods(res.mods);
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : 'Failed to load your mods.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else if (username) {
      fetchPublicProfile(username)
        .then((res) => {
          if (!active) return;
          setProfile(res.profile);
          setMods(res.mods);
          setBioDraft(res.profile.bio || '');
        })
        .catch((err) => {
          if (active) setError(err instanceof Error ? err.message : 'Profile not found.');
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }

    return () => {
      active = false;
    };
  }, [isOwnMyMods, username, token]);

  async function handleSaveBio() {
    if (!token) return;
    setSavingBio(true);
    try {
      const res = await updateProfile({ bio: bioDraft }, token);
      setUser(res.user);
      setProfile((prev) => (prev ? { ...prev, bio: res.user.bio } : prev));
      setEditingBio(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update bio.');
    } finally {
      setSavingBio(false);
    }
  }

  async function handleDeleteOwnMod(id: string) {
    if (!token) return;
    try {
      await deleteMod(id, token);
      setMods((prev) => prev.filter((m) => m.id !== id));
      setConfirmDeleteId(null);
      onModMutated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete mod.');
    }
  }

  if (isOwnMyMods && !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center sm:px-6">
        <div className="rounded-xl border border-[#24242D] bg-[#16161B] p-8 sm:p-10">
          <UserIcon className="mx-auto h-11 w-11 text-[#F16436]" />
          <h1 className="mt-4 font-display text-2xl font-bold text-white">
            Sign In to Manage Your Bedrock Mods
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Create an account or sign in to view your uploaded mods, update versions, and track downloads.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="min-h-11 rounded-lg bg-[#F16436] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#FF7849]"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('register')}
              className="min-h-11 rounded-lg border border-[#2A2A34] bg-[#1D1D24] px-5 py-2.5 text-sm font-semibold text-white hover:border-[#F16436]/60"
            >
              Create Account
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-64 animate-pulse rounded-xl border border-[#24242D] bg-[#16161B]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Profile Header Card */}
      {!isOwnMyMods && profile && (
        <section className="rounded-xl border border-[#24242D] bg-[#16161B] p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#2A2A34] bg-[#0E0E11]">
                {profile.avatar_url ? (
                  <img
                    src={resolveAssetUrl(profile.avatar_url)}
                    alt={profile.username}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <UserIcon className="h-8 w-8 text-[#F16436]" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="font-display text-2xl font-extrabold text-white">
                    {profile.username}
                  </h1>
                  {profile.role === 'admin' && (
                    <span className="text-xs font-semibold text-[#F16436]">Admin</span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-3 text-xs text-zinc-400 tabular-nums">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined {formatDate(profile.created_at)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{profile.mod_count} mods</span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Download className="h-3.5 w-3.5 text-[#F16436]" />
                    {formatNumber(profile.total_downloads)} downloads
                  </span>
                </p>

                {editingBio ? (
                  <div className="mt-4 max-w-xl space-y-2.5">
                    <textarea
                      rows={3}
                      maxLength={400}
                      value={bioDraft}
                      onChange={(e) => setBioDraft(e.target.value)}
                      placeholder="Write a short creator bio..."
                      className="w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3 py-2 text-sm text-white focus:border-[#F16436] focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSaveBio}
                        disabled={savingBio}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-[#F16436] px-3.5 py-1.5 text-xs font-semibold text-white"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>{savingBio ? 'Saving...' : 'Save Bio'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingBio(false)}
                        className="min-h-9 rounded-lg border border-[#2A2A34] px-3.5 py-1.5 text-xs text-zinc-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-300">
                    {profile.bio || 'Minecraft Bedrock mod creator on DOG MODS.'}
                  </p>
                )}
              </div>
            </div>

            {isViewingSelf && !editingBio && (
              <button
                type="button"
                onClick={() => {
                  setBioDraft(profile.bio || '');
                  setEditingBio(true);
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#2A2A34] bg-[#1D1D24] px-4 py-2 text-sm font-medium text-zinc-200 hover:border-[#F16436]/60 shrink-0"
              >
                <Pencil className="h-4 w-4" />
                <span>Edit Bio</span>
              </button>
            )}
          </div>
        </section>
      )}

      {/* My Uploaded Mods Management View OR Creator's Public Mods */}
      {isOwnMyMods ? (
        <section className="space-y-5">
          <div className="flex flex-col gap-3 border-b border-[#24242D] pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="font-display text-2xl font-extrabold text-white">
                My Uploaded Mods
              </h1>
              <p className="mt-1 text-sm text-zinc-400">
                Manage your Minecraft Bedrock packages, edit descriptions, or update files.
              </p>
            </div>
            <button
              type="button"
              onClick={onUploadClick}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#F16436] px-4 py-2 text-sm font-semibold text-white hover:bg-[#FF7849] whitespace-nowrap shrink-0"
            >
              <Upload className="h-4 w-4" />
              <span>Upload New Mod</span>
            </button>
          </div>

          {mods.length === 0 ? (
            <div className="rounded-xl border border-[#24242D] bg-[#16161B] p-12 text-center">
              <Box className="mx-auto h-10 w-10 text-zinc-500" />
              <h2 className="mt-3 font-display text-lg font-bold text-white">
                You haven&apos;t uploaded any Bedrock mods yet
              </h2>
              <p className="mt-1 text-sm text-zinc-400">
                Share your .mcaddon, .mcpack, or .mcworld creations with the DOG MODS community.
              </p>
              <button
                type="button"
                onClick={onUploadClick}
                className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#F16436] px-4 py-2 text-sm font-semibold text-white"
              >
                Upload First Mod
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {mods.map((mod) => (
                <div
                  key={mod.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-[#24242D] bg-[#16161B] p-4 sm:flex-row sm:items-center"
                >
                  <div
                    onClick={() => onSelectMod(mod)}
                    className="flex items-center gap-4 min-w-0 cursor-pointer"
                  >
                    <img
                      src={resolveAssetUrl(mod.image_url)}
                      alt={mod.title}
                      referrerPolicy="no-referrer"
                      className="h-16 w-16 shrink-0 rounded-lg border border-[#2A2A34] object-cover bg-[#111115]"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                        <span
                          className={`font-semibold ${
                            mod.status === 'approved'
                              ? 'text-emerald-400'
                              : mod.status === 'pending'
                              ? 'text-amber-400'
                              : 'text-red-400'
                          }`}
                        >
                          {mod.status === 'approved'
                            ? 'Approved'
                            : mod.status === 'pending'
                            ? 'Pending Review'
                            : 'Rejected'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{mod.category_name}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">MC {mod.mc_version}</span>
                      </div>
                      <h3 className="mt-0.5 truncate font-display text-base font-bold text-white hover:text-[#F16436]">
                        {mod.title}
                      </h3>
                      <p className="mt-0.5 truncate font-mono text-xs text-zinc-400 tabular-nums">
                        {mod.file_original_name} · {formatBytes(mod.file_size)} ·{' '}
                        {formatNumber(mod.downloads)} downloads
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onEditMod(mod)}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#2A2A34] bg-[#1D1D24] px-3.5 py-2 text-xs font-medium text-zinc-200 hover:border-[#F16436]/60"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>

                    {confirmDeleteId === mod.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDeleteOwnMod(mod.id)}
                          className="min-h-10 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-500"
                        >
                          Confirm Delete
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          className="min-h-10 rounded-lg border border-[#2A2A34] px-3 py-2 text-xs text-zinc-300"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(mod.id)}
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="space-y-5">
          <h2 className="font-display text-xl font-bold text-white border-b border-[#24242D] pb-3">
            Published Bedrock Mods ({mods.length})
          </h2>
          {mods.length === 0 ? (
            <div className="rounded-xl border border-[#24242D] bg-[#16161B] p-10 text-center text-sm text-zinc-400">
              No published mods from this creator yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {mods.map((mod) => (
                <ModCard key={mod.id} mod={mod} onSelect={onSelectMod} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
