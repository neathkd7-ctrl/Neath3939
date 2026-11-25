import React, { useEffect, useState } from 'react';
import {
  Upload,
  Image as ImageIcon,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import type { Category, ModItem } from '../types';
import {
  ALLOWED_MOD_FORMATS,
  BEDROCK_VERSIONS,
  MAX_IMAGE_BYTES,
  MAX_MOD_BYTES,
  formatBytes,
  resolveAssetUrl,
} from '../types';
import { fetchModById, uploadModWithProgress } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface UploadModPageProps {
  categories: Category[];
  editModId?: string;
  onCancel: () => void;
  onSuccess: (mod: ModItem) => void;
}

export function UploadModPage({
  categories,
  editModId,
  onCancel,
  onSuccess,
}: UploadModPageProps) {
  const { user, token, openAuthModal } = useAuth();
  const isEditing = Boolean(editModId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [mcVersion, setMcVersion] = useState<string>(BEDROCK_VERSIONS[0]);
  const [creatorName, setCreatorName] = useState(user?.username || '');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [modFile, setModFile] = useState<File | null>(null);
  const [existingModMeta, setExistingModMeta] = useState<ModItem | null>(null);

  const [loadingExisting, setLoadingExisting] = useState(isEditing);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!categoryId && categories.length > 0 && !isEditing) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId, isEditing]);

  useEffect(() => {
    if (user?.username && !creatorName && !isEditing) {
      setCreatorName(user.username);
    }
  }, [user, creatorName, isEditing]);

  useEffect(() => {
    if (!editModId) return;
    let active = true;
    setLoadingExisting(true);
    fetchModById(editModId, token)
      .then((res) => {
        if (!active) return;
        const m = res.mod;
        setExistingModMeta(m);
        setTitle(m.title);
        setDescription(m.description);
        setCategoryId(m.category_id);
        setMcVersion(m.mc_version);
        setCreatorName(m.creator_name);
        setImagePreview(resolveAssetUrl(m.image_url));
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Failed to load mod for editing.');
      })
      .finally(() => {
        if (active) setLoadingExisting(false);
      });
    return () => {
      active = false;
    };
  }, [editModId, token]);

  function handleImageSelect(file: File | null) {
    if (!file) return;
    setError('');
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
      setError('Unsupported image format. Please choose a PNG, JPG, WEBP, or GIF file.');
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(`Mod image exceeds 5 MB limit (${formatBytes(file.size)}).`);
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }

  function handleModFileSelect(file: File | null) {
    if (!file) return;
    setError('');
    const dotIndex = file.name.lastIndexOf('.');
    const ext = dotIndex >= 0 ? file.name.slice(dotIndex).toLowerCase() : '';
    if (!(ALLOWED_MOD_FORMATS as readonly string[]).includes(ext)) {
      setError(
        `Unsupported file "${file.name}". Only Minecraft Bedrock formats (.mcaddon, .mcpack, .mcworld, .zip) are allowed.`
      );
      setModFile(null);
      return;
    }
    if (file.size > MAX_MOD_BYTES) {
      setError(`Mod file is too large (${formatBytes(file.size)}). Maximum allowed size is 50 MB.`);
      setModFile(null);
      return;
    }
    setModFile(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (title.trim().length < 3) {
      setError('Mod Name must be at least 3 characters.');
      return;
    }
    if (description.trim().length < 10) {
      setError('Mod Description must be at least 10 characters.');
      return;
    }
    if (!creatorName.trim()) {
      setError('Creator Name is required.');
      return;
    }
    if (!categoryId) {
      setError('Please select a category.');
      return;
    }
    if (!isEditing && !modFile) {
      setError('Please select a Minecraft Bedrock mod file (.mcaddon, .mcpack, .mcworld, .zip).');
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('description', description.trim());
    formData.append('category_id', categoryId);
    formData.append('mc_version', mcVersion);
    formData.append('creator_name', creatorName.trim());
    if (imageFile) formData.append('imageFile', imageFile);
    if (modFile) formData.append('modFile', modFile);

    setUploading(true);
    setProgress(0);
    try {
      const endpoint = isEditing && editModId ? `/api/mods/${encodeURIComponent(editModId)}` : '/api/mods';
      const method = isEditing ? 'PATCH' : 'POST';
      const res = await uploadModWithProgress(method, endpoint, formData, token, setProgress);
      onSuccess(res.mod);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  if (loadingExisting) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="h-96 animate-pulse rounded-xl border border-[#24242D] bg-[#16161B]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onCancel}
        className="mb-6 inline-flex min-h-10 items-center gap-2 text-sm font-medium text-zinc-400 transition-colors hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back</span>
      </button>

      <div className="rounded-xl border border-[#24242D] bg-[#16161B] p-6 sm:p-8">
        <div className="border-b border-[#24242D] pb-5">
          <p className="text-xs font-semibold tracking-wider text-[#F16436]">
            MINECRAFT BEDROCK EDITION ONLY
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-white sm:text-3xl">
            {isEditing ? `Edit "${existingModMeta?.title}"` : 'Upload a Minecraft Bedrock Mod'}
          </h1>
          <p className="mt-1.5 text-sm text-zinc-400">
            Supported packages: <span className="font-mono text-zinc-200">.mcaddon</span>,{' '}
            <span className="font-mono text-zinc-200">.mcpack</span>,{' '}
            <span className="font-mono text-zinc-200">.mcworld</span>,{' '}
            <span className="font-mono text-zinc-200">.zip</span> (max 50 MB).
          </p>

          {!user && !isEditing && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#2A2A34] bg-[#111115] px-4 py-3 text-xs text-zinc-300">
              <span>
                Sign in to link this upload to your Creator Profile so you can edit or delete it anytime.
              </span>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="font-semibold text-[#F16436] hover:underline whitespace-nowrap"
              >
                Sign In / Register
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-6">
          {/* Mod Image + Core Fields */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
            {/* Image Picker (400x400 recommended) */}
            <div className="md:col-span-4">
              <label className="mb-2 block text-sm font-medium text-zinc-200">
                Mod Image <span className="text-xs font-normal text-zinc-400">(400×400 recommended)</span>
              </label>
              <label className="group relative flex aspect-square cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border border-dashed border-[#343442] bg-[#0E0E11] transition-colors hover:border-[#F16436]">
                {imagePreview ? (
                  <>
                    <img
                      src={imagePreview}
                      alt="Mod preview"
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="rounded-lg bg-[#16161B] px-3 py-1.5 text-xs font-medium text-white border border-[#2A2A34]">
                        Replace Image
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center p-4 text-center">
                    <ImageIcon className="mb-2 h-8 w-8 text-zinc-500 group-hover:text-[#F16436]" />
                    <span className="text-sm font-medium text-zinc-300">Select Thumbnail</span>
                    <span className="mt-1 text-xs text-zinc-500">PNG, JPG, WEBP · Max 5 MB</span>
                  </div>
                )}
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.gif,image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                  onChange={(e) => handleImageSelect(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            {/* Name, Creator, Category, Version */}
            <div className="space-y-4 md:col-span-8">
              <div>
                <label htmlFor="mod-title" className="mb-1.5 block text-sm font-medium text-zinc-200">
                  Mod Name *
                </label>
                <input
                  id="mod-title"
                  type="text"
                  required
                  minLength={3}
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Armored Wolf Companions+"
                  className="min-h-11 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="creator-name" className="mb-1.5 block text-sm font-medium text-zinc-200">
                  Creator Name *
                </label>
                <input
                  id="creator-name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={50}
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  placeholder="Your creator handle"
                  className="min-h-11 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="mod-category" className="mb-1.5 block text-sm font-medium text-zinc-200">
                    Category *
                  </label>
                  <select
                    id="mod-category"
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white focus:border-[#F16436] focus:outline-none"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="mc-version" className="mb-1.5 block text-sm font-medium text-zinc-200">
                    Minecraft Bedrock Version *
                  </label>
                  <select
                    id="mc-version"
                    required
                    value={mcVersion}
                    onChange={(e) => setMcVersion(e.target.value)}
                    className="min-h-11 w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-2.5 text-sm text-white focus:border-[#F16436] focus:outline-none"
                  >
                    {BEDROCK_VERSIONS.map((v) => (
                      <option key={v} value={v}>
                        Bedrock {v}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="mod-description" className="mb-1.5 block text-sm font-medium text-zinc-200">
              Mod Description *
            </label>
            <textarea
              id="mod-description"
              required
              minLength={10}
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what your Bedrock mod adds, installation notes, and experimental toggles if needed..."
              className="w-full rounded-lg border border-[#2A2A34] bg-[#0E0E11] px-3.5 py-3 text-sm leading-relaxed text-white placeholder-zinc-500 focus:border-[#F16436] focus:outline-none"
            />
          </div>

          {/* Mod File Upload */}
          <div>
            <label className="mb-2 block text-sm font-medium text-zinc-200">
              Upload Mod File {isEditing ? '(Optional — leave empty to keep current file)' : '*'}
            </label>
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#343442] bg-[#0E0E11] px-6 py-7 text-center transition-colors hover:border-[#F16436]">
              <FileArchive className="mb-2.5 h-8 w-8 text-[#F16436]" />
              {modFile ? (
                <div className="space-y-1">
                  <p className="flex items-center justify-center gap-1.5 font-mono text-sm font-semibold text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{modFile.name}</span>
                  </p>
                  <p className="font-mono text-xs text-zinc-400 tabular-nums">
                    {formatBytes(modFile.size)} · Ready to upload
                  </p>
                </div>
              ) : existingModMeta ? (
                <div className="space-y-1">
                  <p className="font-mono text-sm font-medium text-zinc-200">
                    Current file: {existingModMeta.file_original_name}
                  </p>
                  <p className="text-xs text-zinc-400">
                    {formatBytes(existingModMeta.file_size)} · Click to replace with a newer Bedrock package
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-zinc-200">
                    Choose a Minecraft Bedrock mod package
                  </p>
                  <p className="font-mono text-xs text-zinc-500">
                    .mcaddon · .mcpack · .mcworld · .zip (Max 50 MB)
                  </p>
                </div>
              )}
              <input
                type="file"
                accept=".mcaddon,.mcpack,.mcworld,.zip"
                className="sr-only"
                onChange={(e) => handleModFileSelect(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {/* Progress Bar */}
          {uploading && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-zinc-300">
                <span>Uploading mod package to storage...</span>
                <span className="font-mono tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[#0E0E11]">
                <div
                  className="h-full bg-[#F16436] transition-all duration-150"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col-reverse gap-3 border-t border-[#24242D] pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              disabled={uploading}
              className="min-h-11 rounded-lg border border-[#2A2A34] bg-[#1D1D24] px-5 py-2.5 text-sm font-medium text-zinc-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#F16436] px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#FF7849] disabled:opacity-60"
            >
              <Upload className="h-4 w-4" />
              <span>
                {uploading
                  ? 'Uploading...'
                  : isEditing
                  ? 'Save Changes'
                  : 'Publish Mod'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
