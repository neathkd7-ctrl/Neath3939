import type {
  AdminOverviewStats,
  AdminUserItem,
  Category,
  ModItem,
  ModStatus,
  PublicProfile,
  User,
} from '../types';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export function fetchCategories(): Promise<{ categories: Category[] }> {
  return apiRequest('/api/categories');
}

export function fetchMods(params?: {
  q?: string;
  category?: string;
  version?: string;
  sort?: 'latest' | 'popular' | 'featured';
  featured?: boolean;
}): Promise<{ mods: ModItem[] }> {
  const sp = new URLSearchParams();
  if (params?.q) sp.set('q', params.q);
  if (params?.category && params.category !== 'all') sp.set('category', params.category);
  if (params?.version && params.version !== 'all') sp.set('version', params.version);
  if (params?.sort) sp.set('sort', params.sort);
  if (params?.featured) sp.set('featured', 'true');
  const query = sp.toString();
  return apiRequest(`/api/mods${query ? `?${query}` : ''}`);
}

export function fetchModById(id: string, token?: string | null): Promise<{ mod: ModItem }> {
  return apiRequest(`/api/mods/${encodeURIComponent(id)}`, {}, token);
}

export function uploadModWithProgress(
  method: 'POST' | 'PATCH',
  url: string,
  formData: FormData,
  token: string | null,
  onProgress?: (percent: number) => void
): Promise<{ mod: ModItem }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, `${API_BASE}${url}`, true);
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(data as { mod: ModItem });
        } else {
          reject(new Error(data.error || `Upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Upload failed (${xhr.status})`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error occurred while uploading mod files.'));
    };

    xhr.send(formData);
  });
}

export function deleteMod(id: string, token: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/mods/${encodeURIComponent(id)}`, { method: 'DELETE' }, token);
}

export async function downloadModFile(
  mod: ModItem,
  token?: string | null
): Promise<void> {
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}/api/mods/${encodeURIComponent(mod.id)}/download`, {
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to download mod file.');
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = mod.file_original_name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(blobUrl), 2500);
}

// Auth & User Profile
export function registerUser(payload: {
  username: string;
  email: string;
  password: string;
}): Promise<{ token: string; user: User }> {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginUser(payload: {
  identifier: string;
  password: string;
}): Promise<{ token: string; user: User }> {
  return apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchCurrentUser(token: string): Promise<{ user: User }> {
  return apiRequest('/api/auth/me', {}, token);
}

export function updateProfile(
  payload: { bio: string; avatar_url?: string },
  token: string
): Promise<{ user: User }> {
  return apiRequest(
    '/api/auth/profile',
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    token
  );
}

export function fetchPublicProfile(
  username: string
): Promise<{ profile: PublicProfile; mods: ModItem[] }> {
  return apiRequest(`/api/users/${encodeURIComponent(username)}`);
}

export function fetchMyMods(token: string): Promise<{ mods: ModItem[] }> {
  return apiRequest('/api/my-mods', {}, token);
}

// Admin APIs
export function fetchAdminStatus(): Promise<{
  adminConfigured: boolean;
  hasClaimedAdmin: boolean;
}> {
  return apiRequest('/api/admin/status');
}

export function claimAdminAccount(payload: {
  username: string;
  email: string;
  password: string;
}): Promise<{ token: string; user: User }> {
  return apiRequest('/api/admin/claim', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function loginAdmin(
  payload: { passcode?: string; identifier?: string; password?: string },
  token?: string | null
): Promise<{ token: string; user: User }> {
  return apiRequest(
    '/api/admin/login',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token
  );
}

export function fetchAdminOverview(token: string): Promise<{ stats: AdminOverviewStats }> {
  return apiRequest('/api/admin/overview', {}, token);
}

export function fetchAdminMods(
  token: string,
  params?: { status?: string; q?: string }
): Promise<{ mods: ModItem[] }> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set('status', params.status);
  if (params?.q) sp.set('q', params.q);
  const query = sp.toString();
  return apiRequest(`/api/admin/mods${query ? `?${query}` : ''}`, {}, token);
}

export function moderateMod(
  id: string,
  payload: { status?: ModStatus; is_featured?: boolean; moderation_note?: string },
  token: string
): Promise<{ mod: ModItem }> {
  return apiRequest(
    `/api/admin/mods/${encodeURIComponent(id)}/moderate`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    token
  );
}

export function adminDeleteMod(id: string, token: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/admin/mods/${encodeURIComponent(id)}`, { method: 'DELETE' }, token);
}

export function adminDeleteAllMods(token: string): Promise<{ ok: boolean; deletedCount: number }> {
  return apiRequest('/api/admin/mods', { method: 'DELETE' }, token);
}

export function fetchAdminUsers(token: string): Promise<{ users: AdminUserItem[] }> {
  return apiRequest('/api/admin/users', {}, token);
}

export function updateAdminUser(
  id: string,
  payload: { role?: 'user' | 'admin'; is_banned?: boolean },
  token: string
): Promise<{ user: User }> {
  return apiRequest(
    `/api/admin/users/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    token
  );
}

export function deleteAdminUser(id: string, token: string): Promise<{ ok: boolean }> {
  return apiRequest(`/api/admin/users/${encodeURIComponent(id)}`, { method: 'DELETE' }, token);
}

export function createCategory(
  payload: { name: string; description: string },
  token: string
): Promise<{ category: Category }> {
  return apiRequest(
    '/api/admin/categories',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
    token
  );
}

export function updateCategory(
  id: string,
  payload: { name: string; description: string },
  token: string
): Promise<{ category: Category }> {
  return apiRequest(
    `/api/admin/categories/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
    token
  );
}

export function deleteCategory(id: string, token: string): Promise<{ ok: boolean }> {
  return apiRequest(
    `/api/admin/categories/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
    token
  );
}
