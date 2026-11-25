import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Download,
  FileArchive,
  Calendar,
  HardDrive,
  User as UserIcon,
  Pencil,
  Trash2,
  Box,
  CheckCircle2,
  AlertTriangle,
  Share2,
  Copy,
  Check,
  ExternalLink,
  X,
} from 'lucide-react';
import type { ModItem } from '../types';
import { formatBytes, formatDate, formatNumber, resolveAssetUrl } from '../types';
import { deleteMod, downloadModFile, fetchModById } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface ModDetailsPageProps {
  modId: string;
  onBack: () => void;
  onEdit: (mod: ModItem) => void;
  onDeleted: () => void;
  onSelectCreator: (username: string) => void;
}

export function ModDetailsPage({
  modId,
  onBack,
  onEdit,
  onDeleted,
  onSelectCreator,
}: ModDetailsPageProps) {
  const { user, token } = useAuth();
  const [mod, setMod] = useState<ModItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [copiedType, setCopiedType] = useState<'link' | 'discord' | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    fetchModById(modId, token)
      .then((res) => {
        if (active) setMod(res.mod);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load mod details.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [modId, token]);

  async function handleDownload() {
    if (!mod || downloading) return;
    setDownloading(true);
    setDownloadSuccess(false);
    try {
      await downloadModFile(mod, token);
      setMod((prev) => (prev ? { ...prev, downloads: prev.downloads + 1 } : prev));
      setDownloadSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleDelete() {
    if (!mod || !token) return;
    setDeleting(true);
    try {
      await deleteMod(mod.id, token);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete mod.');
      setDeleting(false);
    }
  }

  function getShareUrl(): string {
    if (typeof window === 'undefined' || !mod) return '';
    const base = import.meta.env.BASE_URL || '/';
    return `${window.location.origin}${base}?mod=${encodeURIComponent(mod.id)}`;
  }

  async function copyToClipboard(text: string, type: 'link' | 'discord') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
    setCopiedType(type);
    setTimeout(() => {
      setCopiedType((curr) => (curr === type ? null : curr));
    }, 2500);
  }

  async function handleNativeShare() {
    if (!mod) return;
    const shareUrl = getShareUrl();
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: `${mod.title} — DOG MODS`,
          text: `Check out ${mod.title} for Minecraft Bedrock ${mod.mc_version} by ${mod.creator_name} on DOG MODS!`,
          url: shareUrl,
        });
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
      }
    }
    setShareOpen(true);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-96 animate-pulse rounded-xl border border-[#24242D] bg-[#16161B]" />
      </div>
    );
  }

  if (error || !mod) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <div className="rounded-xl border border-[#24242D] bg-[#16161B] p-8">
          <AlertTriangle className="mx-auto h-10 w-10 text-[#F16436]" />
          <h1 className="mt-4 font-display text-xl font-bold text-white">
            {error || 'Mod not found'}
          </h1>
          <button
            type="button"
            onClick={onBack}
            className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#F16436] px-4 py-2 text-sm font-semibold text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Discover</span>
          </button>
        </div>
      </div>
    );
  }

  const canManage =
    Boolean(user) &&
    (user?.role === 'admin' || (mod.user_id !== null && user?.id === mod.user_id));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Bedrock Mods</span>
      </button>

      {mod.status !== 'approved' && (
        <div
          className={`mb-6 rounded-xl border px-4 py-3 text-sm ${
            mod.status === 'pending'
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
              : 'border-red-500/40 bg-red-500/10 text-red-200'
          }`}
        >
          <span className="font-semibold">
            Mod Status: {mod.status === 'pending' ? 'Pending Admin Approval' : 'Rejected'}
          </span>
          {mod.moderation_note ? ` — ${mod.moderation_note}` : ''}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Large Mod Image & Description */}
        <div className="space-y-6 lg:col-span-8">
          <div className="overflow-hidden rounded-xl border border-[#24242D] bg-[#16161B]">
            <div className="aspect-square max-h-[460px] w-full overflow-hidden bg-[#111115]">
              {!imgError && mod.image_url ? (
                <img
                  src={resolveAssetUrl(mod.image_url)}
                  alt={mod.title}
                  referrerPolicy="no-referrer"
                  onError={() => setImgError(true)}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-[#1C1C24] to-[#0E0E11] p-8">
                  <Box className="h-14 w-14 text-[#F16436]" />
                  <span className="font-display text-lg font-semibold text-zinc-300">
                    {mod.title}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Title & Description */}
          <div className="rounded-xl border border-[#24242D] bg-[#16161B] p-6 sm:p-8">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-400">
              <span className="font-medium text-[#F16436]">{mod.category_name}</span>
              <span aria-hidden="true">·</span>
              <span>Minecraft Bedrock Edition</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono uppercase">{mod.file_ext}</span>
            </div>

            <h1 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
              {mod.title}
            </h1>

            <div className="mt-3 flex items-center gap-2 text-sm text-zinc-300">
              <span>Created by</span>
              <button
                type="button"
                onClick={() => onSelectCreator(mod.creator_name)}
                className="inline-flex items-center gap-1.5 font-semibold text-[#F16436] hover:underline"
              >
                <UserIcon className="h-4 w-4" />
                <span>{mod.creator_name}</span>
              </button>
            </div>

            <div className="mt-6 border-t border-[#24242D] pt-6">
              <h2 className="mb-3 font-display text-lg font-bold text-white">Mod Description</h2>
              <div className="space-y-4 whitespace-pre-line text-sm leading-relaxed text-zinc-300 sm:text-base">
                {mod.description}
              </div>
            </div>
          </div>
        </div>

        {/* Right: Contiguous Download & Technical Details Panel */}
        <aside className="lg:col-span-4">
          <div className="sticky top-24 space-y-5 rounded-xl border border-[#24242D] bg-[#16161B] p-6">
            <div>
              <p className="text-xs font-medium text-zinc-400">Ready for Minecraft Bedrock</p>
              <p className="mt-1 truncate font-mono text-sm font-semibold text-white" title={mod.file_original_name}>
                {mod.file_original_name}
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={handleDownload}
                disabled={downloading}
                className="flex min-h-12 w-full items-center justify-center gap-2.5 rounded-lg bg-[#F16436] px-5 py-3 text-base font-bold text-white transition-colors hover:bg-[#FF7849] disabled:opacity-60"
              >
                <Download className="h-5 w-5" />
                <span>{downloading ? 'Downloading...' : 'Download Mod'}</span>
              </button>

              <button
                type="button"
                onClick={() => setShareOpen(true)}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#2E2E38] bg-[#1D1D24] px-4 py-2.5 text-sm font-semibold text-zinc-100 transition-colors hover:border-[#F16436]/60 hover:text-white"
              >
                <Share2 className="h-4 w-4 text-[#F16436]" />
                <span>Share Mod</span>
              </button>
            </div>

            {downloadSuccess && (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>Download started: {mod.file_original_name}</span>
              </div>
            )}

            {/* File & Compatibility Metadata Table */}
            <dl className="divide-y divide-[#24242D] border-t border-[#24242D] text-sm">
              <div className="flex items-center justify-between py-3">
                <dt className="flex items-center gap-2 text-zinc-400">
                  <FileArchive className="h-4 w-4 text-zinc-500" />
                  <span>File Name</span>
                </dt>
                <dd className="max-w-[175px] truncate font-mono text-xs text-zinc-200" title={mod.file_original_name}>
                  {mod.file_original_name}
                </dd>
              </div>

              <div className="flex items-center justify-between py-3">
                <dt className="flex items-center gap-2 text-zinc-400">
                  <HardDrive className="h-4 w-4 text-zinc-500" />
                  <span>File Size</span>
                </dt>
                <dd className="font-mono tabular-nums text-zinc-100">
                  {formatBytes(mod.file_size)}
                </dd>
              </div>

              <div className="flex items-center justify-between py-3">
                <dt className="text-zinc-400">Bedrock Version</dt>
                <dd className="font-mono tabular-nums font-medium text-[#F16436]">
                  {mod.mc_version}
                </dd>
              </div>

              <div className="flex items-center justify-between py-3">
                <dt className="flex items-center gap-2 text-zinc-400">
                  <Download className="h-4 w-4 text-zinc-500" />
                  <span>Downloads</span>
                </dt>
                <dd className="font-mono tabular-nums font-semibold text-white">
                  {formatNumber(mod.downloads)}
                </dd>
              </div>

              <div className="flex items-center justify-between py-3">
                <dt className="flex items-center gap-2 text-zinc-400">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  <span>Upload Date</span>
                </dt>
                <dd className="tabular-nums text-zinc-200">{formatDate(mod.created_at)}</dd>
              </div>
            </dl>

            {/* Owner / Admin Actions */}
            {canManage && (
              <div className="space-y-2.5 border-t border-[#24242D] pt-4">
                <button
                  type="button"
                  onClick={() => onEdit(mod)}
                  className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-[#2E2E38] bg-[#1D1D24] px-4 py-2 text-sm font-medium text-white transition-colors hover:border-[#F16436]/60"
                >
                  <Pencil className="h-4 w-4" />
                  <span>Edit Mod</span>
                </button>

                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Delete Mod</span>
                  </button>
                ) : (
                  <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3">
                    <p className="text-xs text-red-200">
                      Permanently delete this mod and its stored file?
                    </p>
                    <div className="mt-2.5 flex gap-2">
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="flex-1 rounded-md bg-red-600 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60"
                      >
                        {deleting ? 'Deleting...' : 'Confirm Delete'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="flex-1 rounded-md border border-[#2E2E38] bg-[#16161B] py-1.5 text-xs font-medium text-zinc-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Share Mod Dialog */}
      {shareOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="share-modal-title"
        >
          <div className="w-full max-w-md rounded-xl border border-[#2A2A34] bg-[#16161B] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Share2 className="h-5 w-5 text-[#F16436]" />
                <h2 id="share-modal-title" className="font-display text-lg font-bold text-white">
                  Share Bedrock Mod
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-[#1F1F26] hover:text-white"
                aria-label="Close share dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-zinc-400">
              Share <span className="font-semibold text-zinc-200">{mod.title}</span> with friends or
              your Minecraft Bedrock community.
            </p>

            {/* Copyable Direct URL */}
            <div className="mt-4">
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">
                Direct Mod Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={getShareUrl()}
                  onFocus={(e) => e.target.select()}
                  aria-label="Shareable mod link"
                  className="min-h-11 flex-1 rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3 font-mono text-xs text-zinc-200 focus:border-[#F16436] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(getShareUrl(), 'link')}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-[#F16436] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#FF7849] whitespace-nowrap shrink-0"
                >
                  {copiedType === 'link' ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Social Platform Share Actions */}
            <div className="mt-5 space-y-2.5 border-t border-[#24242D] pt-4">
              {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#2E2E38] bg-[#1D1D24] px-4 text-sm font-medium text-white transition-colors hover:border-[#F16436]/60"
                >
                  <Share2 className="h-4 w-4 text-[#F16436]" />
                  <span>Open Device Share Dialog</span>
                </button>
              )}

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    `Check out "${mod.title}" for Minecraft Bedrock ${mod.mc_version} by ${mod.creator_name} on DOG MODS!`
                  )}&url=${encodeURIComponent(getShareUrl())}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-4 text-sm font-medium text-zinc-100 transition-colors hover:border-sky-400/50 hover:text-white"
                >
                  <ExternalLink className="h-4 w-4 text-sky-400" />
                  <span>Share on Twitter / X</span>
                </a>

                <a
                  href="https://discord.com/channels/@me"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    copyToClipboard(
                      `**${mod.title}** (Minecraft Bedrock ${mod.mc_version}) by ${mod.creator_name}\n${getShareUrl()}`,
                      'discord'
                    );
                  }}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-4 text-sm font-medium text-zinc-100 transition-colors hover:border-indigo-400/50 hover:text-white"
                >
                  {copiedType === 'discord' ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-400" />
                      <span>Copied for Discord</span>
                    </>
                  ) : (
                    <>
                      <ExternalLink className="h-4 w-4 text-indigo-400" />
                      <span>Share on Discord</span>
                    </>
                  )}
                </a>
              </div>

              <p className="text-xs text-zinc-500">
                Clicking Share on Discord copies a formatted mod card snippet to your clipboard and
                opens Discord so you can paste it directly into a channel.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
