import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import { createServer as createViteServer } from 'vite';
import {
  db,
  initDatabase,
  getUserByEmailOrUsername,
  hasAnyAdminAccount,
  slugify,
  type UserRow,
  type ModRow,
} from './server/db.ts';
import {
  ensureStorageDirs,
  MOD_FILES_DIR,
  MOD_IMAGES_DIR,
  MAX_MOD_FILE_SIZE,
  MAX_IMAGE_FILE_SIZE,
  isAllowedModExtension,
  isAllowedImageExtension,
  sanitizeFilename,
  resolveSafePath,
  removeStoredFile,
} from './server/storage.ts';
import {
  attachUser,
  requireAuth,
  requireAdmin,
  hashPassword,
  verifyPassword,
  signAuthToken,
  isEnvAdminPasscodeConfigured,
  verifyEnvAdminPasscode,
  type AuthenticatedRequest,
} from './server/auth.ts';

ensureStorageDirs();
initDatabase();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(attachUser);

// Multer configuration for mod packages & mod thumbnails
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.fieldname === 'imageFile') {
      cb(null, MOD_IMAGES_DIR);
    } else {
      cb(null, MOD_FILES_DIR);
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${crypto.randomUUID()}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_MOD_FILE_SIZE,
    files: 2,
  },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'modFile') {
      if (!isAllowedModExtension(file.originalname)) {
        return cb(
          new Error(
            'Unsupported mod file format. Only Minecraft Bedrock files (.mcaddon, .mcpack, .mcworld, .zip) are allowed.'
          )
        );
      }
      return cb(null, true);
    }
    if (file.fieldname === 'imageFile') {
      if (!isAllowedImageExtension(file.originalname)) {
        return cb(
          new Error('Unsupported image format. Please upload a PNG, JPG, WEBP, or GIF image.')
        );
      }
      return cb(null, true);
    }
    return cb(new Error('Unexpected upload field.'));
  },
});

const uploadModFields = upload.fields([
  { name: 'modFile', maxCount: 1 },
  { name: 'imageFile', maxCount: 1 },
]);

function cleanupUploadedFiles(files?: Record<string, Express.Multer.File[]>): void {
  if (!files) return;
  for (const fieldFiles of Object.values(files)) {
    for (const f of fieldFiles) {
      if (fs.existsSync(f.path)) {
        try {
          fs.unlinkSync(f.path);
        } catch {
          // ignore
        }
      }
    }
  }
}

function formatPublicUser(u: Omit<UserRow, 'password_hash'>) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    role: u.role,
    bio: u.bio,
    avatar_url: u.avatar_url,
    is_banned: Boolean(u.is_banned),
    created_at: u.created_at,
  };
}

function hydrateModRow(row: ModRow & { category_name?: string; category_slug?: string }) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    category_id: row.category_id,
    category_name: row.category_name || 'Uncategorized',
    category_slug: row.category_slug || 'uncategorized',
    mc_version: row.mc_version,
    creator_name: row.creator_name,
    user_id: row.user_id,
    image_url: row.image_url,
    file_original_name: row.file_original_name,
    file_size: row.file_size,
    file_ext: row.file_ext,
    downloads: row.downloads,
    status: row.status,
    moderation_note: row.moderation_note,
    is_featured: Boolean(row.is_featured),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// ---------- Health ----------
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, edition: 'Minecraft Bedrock' });
});

// ---------- Serve Uploaded Mod Images Safely ----------
app.get('/api/uploads/images/:filename', (req, res) => {
  const safePath = resolveSafePath(MOD_IMAGES_DIR, req.params.filename);
  if (!safePath || !fs.existsSync(safePath)) {
    res.status(404).json({ error: 'Image not found' });
    return;
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(safePath);
});

// ---------- Categories ----------
app.get('/api/categories', (_req, res) => {
  const rows = db
    .prepare(
      `
      SELECT c.*, COUNT(m.id) as mod_count
      FROM categories c
      LEFT JOIN mods m ON m.category_id = c.id AND m.status = 'approved'
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.name ASC
    `
    )
    .all();
  res.json({ categories: rows });
});

// ---------- Auth & User System ----------
app.post('/api/auth/register', (req, res) => {
  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (username.length < 3 || username.length > 32 || !/^[a-zA-Z0-9_.-]+$/.test(username)) {
    res.status(400).json({
      error: 'Username must be 3–32 characters using letters, numbers, underscores, dots, or hyphens.',
    });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Please enter a valid email address.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)')
    .get(username, email);
  if (existing) {
    res.status(409).json({ error: 'An account with that username or email already exists.' });
    return;
  }

  const id = `usr_${crypto.randomUUID().slice(0, 12)}`;
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);

  db.prepare(
    `
    INSERT INTO users (id, username, email, password_hash, role, bio, avatar_url, is_banned, created_at)
    VALUES (?, ?, ?, ?, 'user', '', '', 0, ?)
  `
  ).run(id, username, email, passwordHash, now);

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
  const token = signAuthToken({ userId: user.id, role: user.role });

  res.status(201).json({
    token,
    user: formatPublicUser(user),
  });
});

app.post('/api/auth/login', (req, res) => {
  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!identifier || !password) {
    res.status(400).json({ error: 'Please enter your username/email and password.' });
    return;
  }

  const user = getUserByEmailOrUsername(identifier);
  if (!user || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid username/email or password.' });
    return;
  }
  if (user.is_banned) {
    res.status(403).json({ error: 'This account has been suspended by an administrator.' });
    return;
  }

  const token = signAuthToken({ userId: user.id, role: user.role });
  res.json({
    token,
    user: formatPublicUser(user),
  });
});

app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: formatPublicUser(req.user!) });
});

app.patch('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res) => {
  const bio = typeof req.body?.bio === 'string' ? req.body.bio.trim().slice(0, 400) : req.user!.bio;
  const avatarUrl =
    typeof req.body?.avatar_url === 'string' ? req.body.avatar_url.trim() : req.user!.avatar_url;

  if (avatarUrl && !avatarUrl.startsWith('/src/assets/images/') && !avatarUrl.startsWith('/api/uploads/images/')) {
    res.status(400).json({ error: 'Invalid avatar selection.' });
    return;
  }

  db.prepare('UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?').run(
    bio,
    avatarUrl,
    req.user!.id
  );
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user!.id) as UserRow;
  res.json({ user: formatPublicUser(updated) });
});

app.get('/api/users/:username', (req, res) => {
  const username = req.params.username.trim();
  const user = db
    .prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)')
    .get(username) as UserRow | undefined;

  if (!user) {
    res.status(404).json({ error: 'Creator profile not found.' });
    return;
  }

  const mods = db
    .prepare(
      `
      SELECT m.*, c.name as category_name, c.slug as category_slug
      FROM mods m
      JOIN categories c ON c.id = m.category_id
      WHERE (m.user_id = ? OR LOWER(m.creator_name) = LOWER(?))
        AND m.status = 'approved'
      ORDER BY m.created_at DESC
    `
    )
    .all(user.id, user.username) as Array<ModRow & { category_name: string; category_slug: string }>;

  const totalDownloads = mods.reduce((sum, m) => sum + (m.downloads || 0), 0);

  res.json({
    profile: {
      id: user.id,
      username: user.username,
      role: user.role,
      bio: user.bio,
      avatar_url: user.avatar_url,
      created_at: user.created_at,
      total_downloads: totalDownloads,
      mod_count: mods.length,
    },
    mods: mods.map(hydrateModRow),
  });
});

app.get('/api/my-mods', requireAuth, (req: AuthenticatedRequest, res) => {
  const rows = db
    .prepare(
      `
      SELECT m.*, c.name as category_name, c.slug as category_slug
      FROM mods m
      JOIN categories c ON c.id = m.category_id
      WHERE m.user_id = ?
      ORDER BY m.created_at DESC
    `
    )
    .all(req.user!.id) as Array<ModRow & { category_name: string; category_slug: string }>;

  res.json({ mods: rows.map(hydrateModRow) });
});

// ---------- Mods Catalog & CRUD ----------
app.get('/api/mods', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const category = typeof req.query.category === 'string' ? req.query.category.trim() : '';
  const version = typeof req.query.version === 'string' ? req.query.version.trim() : '';
  const sort = typeof req.query.sort === 'string' ? req.query.sort : 'latest';
  const featured = req.query.featured === 'true';

  const whereClauses: string[] = ["m.status = 'approved'"];
  const params: unknown[] = [];

  if (q) {
    whereClauses.push(
      '(LOWER(m.title) LIKE ? OR LOWER(m.description) LIKE ? OR LOWER(m.creator_name) LIKE ?)'
    );
    const term = `%${q.toLowerCase()}%`;
    params.push(term, term, term);
  }

  if (category && category !== 'all') {
    whereClauses.push('(c.slug = ? OR m.category_id = ?)');
    params.push(category, category);
  }

  if (version && version !== 'all') {
    whereClauses.push('m.mc_version = ?');
    params.push(version);
  }

  if (featured) {
    whereClauses.push('m.is_featured = 1');
  }

  let orderBy = 'm.created_at DESC';
  if (sort === 'popular') {
    orderBy = 'm.downloads DESC, m.created_at DESC';
  } else if (sort === 'featured') {
    orderBy = 'm.is_featured DESC, m.downloads DESC';
  }

  const sql = `
    SELECT m.*, c.name as category_name, c.slug as category_slug
    FROM mods m
    JOIN categories c ON c.id = m.category_id
    WHERE ${whereClauses.join(' AND ')}
    ORDER BY ${orderBy}
  `;

  const rows = db.prepare(sql).all(...params) as Array<
    ModRow & { category_name: string; category_slug: string }
  >;

  res.json({ mods: rows.map(hydrateModRow) });
});

app.get('/api/mods/:id', (req: AuthenticatedRequest, res) => {
  const row = db
    .prepare(
      `
      SELECT m.*, c.name as category_name, c.slug as category_slug
      FROM mods m
      JOIN categories c ON c.id = m.category_id
      WHERE m.id = ? OR m.slug = ?
    `
    )
    .get(req.params.id, req.params.id) as
    | (ModRow & { category_name: string; category_slug: string })
    | undefined;

  if (!row) {
    res.status(404).json({ error: 'Minecraft Bedrock mod not found.' });
    return;
  }

  const isOwner = req.user && row.user_id && req.user.id === row.user_id;
  const isAdmin = req.user?.role === 'admin';
  if (row.status !== 'approved' && !isOwner && !isAdmin) {
    res.status(403).json({ error: 'This mod is currently under moderation review.' });
    return;
  }

  res.json({ mod: hydrateModRow(row) });
});

app.post('/api/mods', (req: AuthenticatedRequest, res) => {
  uploadModFields(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File is too large. Maximum mod package size is 50 MB.' });
        return;
      }
      res.status(400).json({ error: err.message || 'File upload failed.' });
      return;
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const modFile = files?.modFile?.[0];
    const imageFile = files?.imageFile?.[0];

    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const description =
      typeof req.body?.description === 'string' ? req.body.description.trim() : '';
    const categoryId =
      typeof req.body?.category_id === 'string' ? req.body.category_id.trim() : '';
    const mcVersion =
      typeof req.body?.mc_version === 'string' ? req.body.mc_version.trim() : '';
    const creatorNameRaw =
      typeof req.body?.creator_name === 'string' ? req.body.creator_name.trim() : '';
    const creatorName = creatorNameRaw || req.user?.username || '';

    if (!title || title.length < 3 || title.length > 100) {
      cleanupUploadedFiles(files);
      res.status(400).json({ error: 'Mod Name must be between 3 and 100 characters.' });
      return;
    }
    if (!description || description.length < 10) {
      cleanupUploadedFiles(files);
      res.status(400).json({ error: 'Mod Description must be at least 10 characters.' });
      return;
    }
    if (!creatorName || creatorName.length < 2) {
      cleanupUploadedFiles(files);
      res.status(400).json({ error: 'Creator Name is required.' });
      return;
    }
    if (!mcVersion) {
      cleanupUploadedFiles(files);
      res.status(400).json({ error: 'Please select a Minecraft Bedrock Version.' });
      return;
    }
    if (!modFile) {
      cleanupUploadedFiles(files);
      res.status(400).json({
        error: 'Please upload a Minecraft Bedrock mod file (.mcaddon, .mcpack, .mcworld, or .zip).',
      });
      return;
    }

    if (imageFile && imageFile.size > MAX_IMAGE_FILE_SIZE) {
      cleanupUploadedFiles(files);
      res.status(400).json({ error: 'Mod image must be 5 MB or smaller.' });
      return;
    }

    const category = db
      .prepare('SELECT id FROM categories WHERE id = ? OR slug = ?')
      .get(categoryId, categoryId) as { id: string } | undefined;
    if (!category) {
      cleanupUploadedFiles(files);
      res.status(400).json({ error: 'Selected category does not exist.' });
      return;
    }

    const modId = `mod_${crypto.randomUUID().slice(0, 12)}`;
    const baseSlug = slugify(title);
    const slug = `${baseSlug}-${modId.slice(-4)}`;
    const now = new Date().toISOString();
    const originalFileName = sanitizeFilename(modFile.originalname);
    const fileExt = path.extname(originalFileName).toLowerCase();

    const imageUrl = imageFile
      ? `/api/uploads/images/${imageFile.filename}`
      : '/src/assets/images/mod_wolf_companions_1795564652609.jpg';
    const imageStoredName = imageFile ? imageFile.filename : null;

    db.prepare(
      `
      INSERT INTO mods (
        id, title, slug, description, category_id, mc_version, creator_name, user_id,
        image_url, image_stored_name, file_stored_name, file_original_name, file_size,
        file_ext, downloads, status, moderation_note, is_featured, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'approved', '', 0, ?, ?)
    `
    ).run(
      modId,
      title,
      slug,
      description,
      category.id,
      mcVersion,
      creatorName,
      req.user ? req.user.id : null,
      imageUrl,
      imageStoredName,
      modFile.filename,
      originalFileName,
      modFile.size,
      fileExt,
      now,
      now
    );

    const created = db
      .prepare(
        `
        SELECT m.*, c.name as category_name, c.slug as category_slug
        FROM mods m
        JOIN categories c ON c.id = m.category_id
        WHERE m.id = ?
      `
      )
      .get(modId) as ModRow & { category_name: string; category_slug: string };

    res.status(201).json({ mod: hydrateModRow(created) });
  });
});

app.patch('/api/mods/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const existing = db.prepare('SELECT * FROM mods WHERE id = ?').get(req.params.id) as
    | ModRow
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Mod not found.' });
    return;
  }

  const isOwner = existing.user_id && existing.user_id === req.user!.id;
  const isAdmin = req.user!.role === 'admin';
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'You do not have permission to edit this mod.' });
    return;
  }

  uploadModFields(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
        res.status(400).json({ error: 'File is too large. Maximum mod package size is 50 MB.' });
        return;
      }
      res.status(400).json({ error: err.message || 'Update upload failed.' });
      return;
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    const modFile = files?.modFile?.[0];
    const imageFile = files?.imageFile?.[0];

    const title =
      typeof req.body?.title === 'string' && req.body.title.trim()
        ? req.body.title.trim()
        : existing.title;
    const description =
      typeof req.body?.description === 'string' && req.body.description.trim()
        ? req.body.description.trim()
        : existing.description;
    const categoryId =
      typeof req.body?.category_id === 'string' && req.body.category_id.trim()
        ? req.body.category_id.trim()
        : existing.category_id;
    const mcVersion =
      typeof req.body?.mc_version === 'string' && req.body.mc_version.trim()
        ? req.body.mc_version.trim()
        : existing.mc_version;
    const creatorName =
      typeof req.body?.creator_name === 'string' && req.body.creator_name.trim()
        ? req.body.creator_name.trim()
        : existing.creator_name;

    if (title.length < 3 || title.length > 100) {
      cleanupUploadedFiles(files);
      res.status(400).json({ error: 'Mod Name must be between 3 and 100 characters.' });
      return;
    }
    if (description.length < 10) {
      cleanupUploadedFiles(files);
      res.status(400).json({ error: 'Mod Description must be at least 10 characters.' });
      return;
    }
    if (imageFile && imageFile.size > MAX_IMAGE_FILE_SIZE) {
      cleanupUploadedFiles(files);
      res.status(400).json({ error: 'Mod image must be 5 MB or smaller.' });
      return;
    }

    const category = db
      .prepare('SELECT id FROM categories WHERE id = ? OR slug = ?')
      .get(categoryId, categoryId) as { id: string } | undefined;
    if (!category) {
      cleanupUploadedFiles(files);
      res.status(400).json({ error: 'Selected category does not exist.' });
      return;
    }

    let fileStoredName = existing.file_stored_name;
    let fileOriginalName = existing.file_original_name;
    let fileSize = existing.file_size;
    let fileExt = existing.file_ext;

    if (modFile) {
      removeStoredFile(MOD_FILES_DIR, existing.file_stored_name);
      fileStoredName = modFile.filename;
      fileOriginalName = sanitizeFilename(modFile.originalname);
      fileSize = modFile.size;
      fileExt = path.extname(fileOriginalName).toLowerCase();
    }

    let imageUrl = existing.image_url;
    let imageStoredName = existing.image_stored_name;
    if (imageFile) {
      removeStoredFile(MOD_IMAGES_DIR, existing.image_stored_name);
      imageStoredName = imageFile.filename;
      imageUrl = `/api/uploads/images/${imageFile.filename}`;
    }

    const now = new Date().toISOString();
    db.prepare(
      `
      UPDATE mods
      SET title = ?, description = ?, category_id = ?, mc_version = ?, creator_name = ?,
          image_url = ?, image_stored_name = ?, file_stored_name = ?, file_original_name = ?,
          file_size = ?, file_ext = ?, updated_at = ?
      WHERE id = ?
    `
    ).run(
      title,
      description,
      category.id,
      mcVersion,
      creatorName,
      imageUrl,
      imageStoredName,
      fileStoredName,
      fileOriginalName,
      fileSize,
      fileExt,
      now,
      existing.id
    );

    const updated = db
      .prepare(
        `
        SELECT m.*, c.name as category_name, c.slug as category_slug
        FROM mods m
        JOIN categories c ON c.id = m.category_id
        WHERE m.id = ?
      `
      )
      .get(existing.id) as ModRow & { category_name: string; category_slug: string };

    res.json({ mod: hydrateModRow(updated) });
  });
});

app.delete('/api/mods/:id', requireAuth, (req: AuthenticatedRequest, res) => {
  const existing = db.prepare('SELECT * FROM mods WHERE id = ?').get(req.params.id) as
    | ModRow
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Mod not found.' });
    return;
  }

  const isOwner = existing.user_id && existing.user_id === req.user!.id;
  const isAdmin = req.user!.role === 'admin';
  if (!isOwner && !isAdmin) {
    res.status(403).json({ error: 'You do not have permission to delete this mod.' });
    return;
  }

  removeStoredFile(MOD_FILES_DIR, existing.file_stored_name);
  removeStoredFile(MOD_IMAGES_DIR, existing.image_stored_name);
  db.prepare('DELETE FROM mods WHERE id = ?').run(existing.id);

  res.json({ ok: true });
});

app.get('/api/mods/:id/download', (req: AuthenticatedRequest, res) => {
  const mod = db.prepare('SELECT * FROM mods WHERE id = ? OR slug = ?').get(req.params.id, req.params.id) as
    | ModRow
    | undefined;
  if (!mod) {
    res.status(404).json({ error: 'Mod not found.' });
    return;
  }

  const isOwner = req.user && mod.user_id && req.user.id === mod.user_id;
  const isAdmin = req.user?.role === 'admin';
  if (mod.status !== 'approved' && !isOwner && !isAdmin) {
    res.status(403).json({ error: 'This mod is not approved for public download.' });
    return;
  }

  const filePath = resolveSafePath(MOD_FILES_DIR, mod.file_stored_name);
  if (!filePath || !fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Mod package file could not be located on storage.' });
    return;
  }

  db.prepare('UPDATE mods SET downloads = downloads + 1 WHERE id = ?').run(mod.id);

  const safeDownloadName = sanitizeFilename(mod.file_original_name);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.download(filePath, safeDownloadName);
});

// ---------- Admin System ----------
app.get('/api/admin/status', (_req, res) => {
  res.json({
    adminConfigured: isEnvAdminPasscodeConfigured(),
    hasClaimedAdmin: hasAnyAdminAccount(),
  });
});

app.post('/api/admin/claim', (req, res) => {
  if (isEnvAdminPasscodeConfigured() || hasAnyAdminAccount()) {
    res.status(403).json({ error: 'Admin access has already been claimed or configured.' });
    return;
  }

  const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (username.length < 3 || username.length > 32) {
    res.status(400).json({ error: 'Admin username must be 3–32 characters.' });
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'Please enter a valid admin email address.' });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: 'Admin password must be at least 6 characters.' });
    return;
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)')
    .get(username, email);
  if (existing) {
    res.status(409).json({ error: 'That username or email is already registered.' });
    return;
  }

  const id = `usr_admin_${crypto.randomUUID().slice(0, 8)}`;
  const now = new Date().toISOString();
  const passwordHash = hashPassword(password);

  db.prepare(
    `
    INSERT INTO users (id, username, email, password_hash, role, bio, avatar_url, is_banned, created_at)
    VALUES (?, ?, ?, ?, 'admin', 'Site Administrator for DOG MODS', '', 0, ?)
  `
  ).run(id, username, email, passwordHash, now);

  const adminUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
  const token = signAuthToken({ userId: adminUser.id, role: 'admin' });

  res.status(201).json({
    token,
    user: formatPublicUser(adminUser),
  });
});

app.post('/api/admin/login', (req: AuthenticatedRequest, res) => {
  const passcode = typeof req.body?.passcode === 'string' ? req.body.passcode : '';
  const identifier = typeof req.body?.identifier === 'string' ? req.body.identifier.trim() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  // Option A: Server-configured ADMIN_PASSCODE
  if (passcode && isEnvAdminPasscodeConfigured()) {
    if (!verifyEnvAdminPasscode(passcode)) {
      res.status(401).json({ error: 'Invalid admin passcode.' });
      return;
    }

    if (req.user) {
      db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(req.user.id);
      const promoted = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id) as UserRow;
      const token = signAuthToken({ userId: promoted.id, role: 'admin' });
      res.json({ token, user: formatPublicUser(promoted) });
      return;
    }

    let adminUser = db
      .prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1")
      .get() as UserRow | undefined;

    if (!adminUser) {
      const id = `usr_admin_${crypto.randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      db.prepare(
        `
        INSERT INTO users (id, username, email, password_hash, role, bio, avatar_url, is_banned, created_at)
        VALUES (?, 'SiteAdmin', 'admin@dogmods.local', NULL, 'admin', 'DOG MODS Administrator', '', 0, ?)
      `
      ).run(id, now);
      adminUser = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow;
    }

    const token = signAuthToken({ userId: adminUser.id, role: 'admin' });
    res.json({ token, user: formatPublicUser(adminUser) });
    return;
  }

  // Option B: Existing Admin account username/email + password
  if (!identifier || !password) {
    res.status(400).json({ error: 'Admin credentials are required.' });
    return;
  }

  const user = getUserByEmailOrUsername(identifier);
  if (!user || user.role !== 'admin' || !verifyPassword(password, user.password_hash)) {
    res.status(401).json({ error: 'Invalid administrator credentials.' });
    return;
  }

  const token = signAuthToken({ userId: user.id, role: 'admin' });
  res.json({ token, user: formatPublicUser(user) });
});

app.get('/api/admin/overview', requireAdmin, (_req, res) => {
  const stats = {
    totalMods: (db.prepare('SELECT COUNT(*) as c FROM mods').get() as { c: number }).c,
    approvedMods: (
      db.prepare("SELECT COUNT(*) as c FROM mods WHERE status = 'approved'").get() as { c: number }
    ).c,
    pendingMods: (
      db.prepare("SELECT COUNT(*) as c FROM mods WHERE status = 'pending'").get() as { c: number }
    ).c,
    rejectedMods: (
      db.prepare("SELECT COUNT(*) as c FROM mods WHERE status = 'rejected'").get() as { c: number }
    ).c,
    featuredMods: (
      db.prepare('SELECT COUNT(*) as c FROM mods WHERE is_featured = 1').get() as { c: number }
    ).c,
    totalDownloads: (
      db.prepare('SELECT COALESCE(SUM(downloads), 0) as s FROM mods').get() as { s: number }
    ).s,
    totalUsers: (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c,
    totalCategories: (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c,
  };
  res.json({ stats });
});

app.get('/api/admin/mods', requireAdmin, (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : 'all';
  const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

  const where: string[] = [];
  const params: unknown[] = [];

  if (status && status !== 'all') {
    where.push('m.status = ?');
    params.push(status);
  }
  if (q) {
    where.push('(LOWER(m.title) LIKE ? OR LOWER(m.creator_name) LIKE ?)');
    params.push(`%${q}%`, `%${q}%`);
  }

  const sql = `
    SELECT m.*, c.name as category_name, c.slug as category_slug
    FROM mods m
    JOIN categories c ON c.id = m.category_id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY
      CASE WHEN m.status = 'pending' THEN 0 ELSE 1 END,
      m.created_at DESC
  `;

  const rows = db.prepare(sql).all(...params) as Array<
    ModRow & { category_name: string; category_slug: string }
  >;
  res.json({ mods: rows.map(hydrateModRow) });
});

app.patch('/api/admin/mods/:id/moderate', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM mods WHERE id = ?').get(req.params.id) as
    | ModRow
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Mod not found.' });
    return;
  }

  const status = req.body?.status;
  const isFeatured =
    typeof req.body?.is_featured === 'boolean'
      ? req.body.is_featured
        ? 1
        : 0
      : existing.is_featured;
  const moderationNote =
    typeof req.body?.moderation_note === 'string'
      ? req.body.moderation_note.trim().slice(0, 300)
      : existing.moderation_note;

  let nextStatus = existing.status;
  if (status === 'approved' || status === 'rejected' || status === 'pending') {
    nextStatus = status;
  }

  const now = new Date().toISOString();
  db.prepare(
    `
    UPDATE mods
    SET status = ?, is_featured = ?, moderation_note = ?, updated_at = ?
    WHERE id = ?
  `
  ).run(nextStatus, nextStatus === 'approved' ? isFeatured : 0, moderationNote, now, existing.id);

  const updated = db
    .prepare(
      `
      SELECT m.*, c.name as category_name, c.slug as category_slug
      FROM mods m
      JOIN categories c ON c.id = m.category_id
      WHERE m.id = ?
    `
    )
    .get(existing.id) as ModRow & { category_name: string; category_slug: string };

  res.json({ mod: hydrateModRow(updated) });
});

app.delete('/api/admin/mods', requireAdmin, (_req, res) => {
  const allMods = db
    .prepare('SELECT file_stored_name, image_stored_name FROM mods')
    .all() as Array<{ file_stored_name: string; image_stored_name: string | null }>;

  for (const m of allMods) {
    removeStoredFile(MOD_FILES_DIR, m.file_stored_name);
    removeStoredFile(MOD_IMAGES_DIR, m.image_stored_name);
  }

  db.prepare('DELETE FROM mods').run();
  res.json({ ok: true, deletedCount: allMods.length });
});

app.delete('/api/admin/mods/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM mods WHERE id = ?').get(req.params.id) as
    | ModRow
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Mod not found.' });
    return;
  }

  removeStoredFile(MOD_FILES_DIR, existing.file_stored_name);
  removeStoredFile(MOD_IMAGES_DIR, existing.image_stored_name);
  db.prepare('DELETE FROM mods WHERE id = ?').run(existing.id);

  res.json({ ok: true });
});

app.get('/api/admin/users', requireAdmin, (_req, res) => {
  const users = db
    .prepare(
      `
      SELECT u.*, COUNT(m.id) as mod_count, COALESCE(SUM(m.downloads), 0) as total_downloads
      FROM users u
      LEFT JOIN mods m ON m.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `
    )
    .all() as Array<UserRow & { mod_count: number; total_downloads: number }>;

  res.json({
    users: users.map((u) => ({
      ...formatPublicUser(u),
      mod_count: u.mod_count,
      total_downloads: u.total_downloads,
    })),
  });
});

app.patch('/api/admin/users/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
    | UserRow
    | undefined;
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  if (target.id === req.user!.id && req.body?.is_banned === true) {
    res.status(400).json({ error: 'You cannot ban your own active admin account.' });
    return;
  }
  if (target.id === req.user!.id && req.body?.role === 'user') {
    res.status(400).json({ error: 'You cannot demote your own active admin account.' });
    return;
  }

  const nextRole =
    req.body?.role === 'admin' || req.body?.role === 'user' ? req.body.role : target.role;
  const nextBanned =
    typeof req.body?.is_banned === 'boolean' ? (req.body.is_banned ? 1 : 0) : target.is_banned;

  db.prepare('UPDATE users SET role = ?, is_banned = ? WHERE id = ?').run(
    nextRole,
    nextBanned,
    target.id
  );
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(target.id) as UserRow;
  res.json({ user: formatPublicUser(updated) });
});

app.delete('/api/admin/users/:id', requireAdmin, (req: AuthenticatedRequest, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id) as
    | UserRow
    | undefined;
  if (!target) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }
  if (target.id === req.user!.id) {
    res.status(400).json({ error: 'You cannot delete your own active admin account.' });
    return;
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  res.json({ ok: true });
});

app.post('/api/admin/categories', requireAdmin, (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const description =
    typeof req.body?.description === 'string' ? req.body.description.trim().slice(0, 200) : '';

  if (name.length < 2 || name.length > 48) {
    res.status(400).json({ error: 'Category name must be 2–48 characters.' });
    return;
  }

  const slug = slugify(name);
  const existing = db
    .prepare('SELECT id FROM categories WHERE LOWER(name) = LOWER(?) OR slug = ?')
    .get(name, slug);
  if (existing) {
    res.status(409).json({ error: 'A category with that name already exists.' });
    return;
  }

  const id = `cat_${crypto.randomUUID().slice(0, 8)}`;
  const maxOrder = (
    db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM categories').get() as { m: number }
  ).m;
  const now = new Date().toISOString();

  db.prepare(
    `
    INSERT INTO categories (id, name, slug, description, sort_order, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  ).run(id, name, slug, description, maxOrder + 1, now);

  const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  res.status(201).json({ category: created });
});

app.patch('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id) as
    | { id: string; name: string; slug: string; description: string }
    | undefined;
  if (!existing) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }

  const name =
    typeof req.body?.name === 'string' && req.body.name.trim()
      ? req.body.name.trim()
      : existing.name;
  const description =
    typeof req.body?.description === 'string'
      ? req.body.description.trim().slice(0, 200)
      : existing.description;

  if (name.length < 2 || name.length > 48) {
    res.status(400).json({ error: 'Category name must be 2–48 characters.' });
    return;
  }

  const slug = slugify(name);
  const duplicate = db
    .prepare('SELECT id FROM categories WHERE (LOWER(name) = LOWER(?) OR slug = ?) AND id != ?')
    .get(name, slug, existing.id);
  if (duplicate) {
    res.status(409).json({ error: 'Another category already uses that name.' });
    return;
  }

  db.prepare('UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?').run(
    name,
    slug,
    description,
    existing.id
  );
  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(existing.id);
  res.json({ category: updated });
});

app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) {
    res.status(404).json({ error: 'Category not found.' });
    return;
  }

  const linkedMods = (
    db.prepare('SELECT COUNT(*) as c FROM mods WHERE category_id = ?').get(req.params.id) as {
      c: number;
    }
  ).c;
  if (linkedMods > 0) {
    res.status(400).json({
      error: `Cannot delete category while ${linkedMods} mod(s) are assigned to it. Reassign or delete those mods first.`,
    });
    return;
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ---------- Vite / Production Static Setup ----------
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api/')) {
        return next();
      }
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`DOG MODS Bedrock server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
