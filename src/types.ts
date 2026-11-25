export type ModStatus = 'pending' | 'approved' | 'rejected';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
  bio: string;
  avatar_url: string;
  is_banned: boolean;
  created_at: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  role: 'user' | 'admin';
  bio: string;
  avatar_url: string;
  created_at: string;
  total_downloads: number;
  mod_count: number;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  mod_count?: number;
  created_at: string;
}

export interface ModItem {
  id: string;
  title: string;
  slug: string;
  description: string;
  category_id: string;
  category_name: string;
  category_slug: string;
  mc_version: string;
  creator_name: string;
  user_id: string | null;
  image_url: string;
  file_original_name: string;
  file_size: number;
  file_ext: string;
  downloads: number;
  status: ModStatus;
  moderation_note: string;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface AdminOverviewStats {
  totalMods: number;
  approvedMods: number;
  pendingMods: number;
  rejectedMods: number;
  featuredMods: number;
  totalDownloads: number;
  totalUsers: number;
  totalCategories: number;
}

export interface AdminUserItem extends User {
  mod_count: number;
  total_downloads: number;
}

export const BEDROCK_VERSIONS = [
  '1.21.50',
  '1.21.40',
  '1.21.30',
  '1.21.20',
  '1.21.0',
  '1.20.80',
  '1.20.50',
  '1.20.0',
  '1.19.80',
] as const;

export const ALLOWED_MOD_FORMATS = ['.mcaddon', '.mcpack', '.mcworld', '.zip'] as const;
export const MAX_MOD_BYTES = 50 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${value >= 10 || i === 0 ? value.toFixed(0) : value.toFixed(2)} ${units[i]}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n || 0);
}

export function formatDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
