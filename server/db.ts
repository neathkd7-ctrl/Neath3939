import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { DATA_DIR, ensureStorageDirs } from './storage.ts';

ensureStorageDirs();

const DB_PATH = path.resolve(DATA_DIR, 'dogmods.db');
export const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export interface UserRow {
  id: string;
  username: string;
  email: string;
  password_hash: string | null;
  role: 'user' | 'admin';
  bio: string;
  avatar_url: string;
  is_banned: number;
  created_at: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
  created_at: string;
}

export interface ModRow {
  id: string;
  title: string;
  slug: string;
  description: string;
  category_id: string;
  mc_version: string;
  creator_name: string;
  user_id: string | null;
  image_url: string;
  image_stored_name: string | null;
  file_stored_name: string;
  file_original_name: string;
  file_size: number;
  file_ext: string;
  downloads: number;
  status: 'pending' | 'approved' | 'rejected';
  moderation_note: string;
  is_featured: number;
  created_at: string;
  updated_at: string;
}

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      bio TEXT NOT NULL DEFAULT '',
      avatar_url TEXT NOT NULL DEFAULT '',
      is_banned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS mods (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT NOT NULL,
      category_id TEXT NOT NULL,
      mc_version TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      user_id TEXT,
      image_url TEXT NOT NULL,
      image_stored_name TEXT,
      file_stored_name TEXT NOT NULL,
      file_original_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_ext TEXT NOT NULL,
      downloads INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'approved',
      moderation_note TEXT NOT NULL DEFAULT '',
      is_featured INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_mods_status ON mods(status);
    CREATE INDEX IF NOT EXISTS idx_mods_category ON mods(category_id);
    CREATE INDEX IF NOT EXISTS idx_mods_featured ON mods(is_featured);
    CREATE INDEX IF NOT EXISTS idx_mods_downloads ON mods(downloads DESC);
    CREATE INDEX IF NOT EXISTS idx_mods_created ON mods(created_at DESC);
  `);

  seedInitialData();
}

function seedInitialData(): void {
  const categoryCount = (db.prepare('SELECT COUNT(*) as c FROM categories').get() as { c: number }).c;
  const now = new Date().toISOString();

  if (categoryCount === 0) {
    const insertCategory = db.prepare(`
      INSERT INTO categories (id, name, slug, description, sort_order, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    const defaultCategories = [
      ['cat_addons', 'Addons & Behaviors', 'addons-behaviors', 'Custom Bedrock entities, items, recipes, and Script API behaviors (.mcaddon)', 1],
      ['cat_textures', 'Texture Packs', 'texture-packs', 'High-resolution Bedrock resource packs, UI overhauls, and PBR materials (.mcpack)', 2],
      ['cat_shaders', 'Shaders & Visuals', 'shaders-visuals', 'Deferred Technical Preview and RenderDragon lighting enhancers', 3],
      ['cat_worlds', 'Worlds & Maps', 'worlds-maps', 'Survival spawns, adventure maps, skyblock islands, and mini-games (.mcworld)', 4],
      ['cat_redstone', 'Redstone & Tech', 'redstone-tech', 'Automated machinery, copper contraptions, and industrial Bedrock addons', 5],
      ['cat_skins', 'Skins & Cosmetics', 'skins-cosmetics', 'Custom character skin packs, capes, and wolf armor cosmetics', 6],
    ] as const;

    for (const [id, name, slug, desc, order] of defaultCategories) {
      insertCategory.run(id, name, slug, desc, order, now);
    }
  }
}

export function getUserById(id: string): UserRow | undefined {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function getUserByEmailOrUsername(identifier: string): UserRow | undefined {
  const normalized = identifier.trim().toLowerCase();
  return db
    .prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?')
    .get(normalized, normalized) as UserRow | undefined;
}

export function hasAnyAdminAccount(): boolean {
  const row = db
    .prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin' AND password_hash IS NOT NULL")
    .get() as { c: number };
  return row.c > 0;
}

export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || crypto.randomBytes(4).toString('hex')
  );
}
