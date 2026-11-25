import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import AdmZip from 'adm-zip';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');
export const MOD_FILES_DIR = path.resolve(UPLOADS_DIR, 'mods');
export const MOD_IMAGES_DIR = path.resolve(UPLOADS_DIR, 'images');

export const ALLOWED_MOD_EXTENSIONS = ['.mcaddon', '.mcpack', '.mcworld', '.zip'] as const;
export const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'] as const;

export const MAX_MOD_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
export const MAX_IMAGE_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export function ensureStorageDirs(): void {
  for (const dir of [DATA_DIR, UPLOADS_DIR, MOD_FILES_DIR, MOD_IMAGES_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

export function sanitizeFilename(name: string): string {
  const base = path.basename(name || 'mod-file')
    .replace(/[\x00-\x1f\x7f"\\/:*?<>|]/g, '_')
    .trim();
  return base || 'bedrock-mod.mcaddon';
}

export function resolveSafePath(baseDir: string, filename: string): string | null {
  if (!filename) return null;
  const safeName = path.basename(filename);
  const resolved = path.resolve(baseDir, safeName);
  if (!resolved.startsWith(baseDir + path.sep)) {
    return null;
  }
  return resolved;
}

export function removeStoredFile(baseDir: string, filename: string | null | undefined): void {
  if (!filename) return;
  const target = resolveSafePath(baseDir, filename);
  if (target && fs.existsSync(target)) {
    try {
      fs.unlinkSync(target);
    } catch {
      // Ignore cleanup errors
    }
  }
}

export function isAllowedModExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return (ALLOWED_MOD_EXTENSIONS as readonly string[]).includes(ext);
}

export function isAllowedImageExtension(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  return (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Generates a valid Minecraft Bedrock .mcaddon / .mcpack / .mcworld / .zip archive
 * on disk for initial showcase mods so downloads serve real, valid Bedrock packages.
 */
export function createSeedBedrockArchive(
  storedFilename: string,
  modName: string,
  description: string,
  ext: string,
  mcVersion: string
): number {
  ensureStorageDirs();
  const targetPath = resolveSafePath(MOD_FILES_DIR, storedFilename);
  if (!targetPath) {
    throw new Error('Invalid storage path');
  }

  if (fs.existsSync(targetPath)) {
    return fs.statSync(targetPath).size;
  }

  const zip = new AdmZip();
  const versionParts = mcVersion
    .split('.')
    .slice(0, 3)
    .map((n) => parseInt(n, 10) || 0);
  while (versionParts.length < 3) versionParts.push(0);

  const manifest = {
    format_version: 2,
    header: {
      name: modName,
      description: description.slice(0, 180),
      uuid: crypto.randomUUID(),
      version: [1, 0, 0],
      min_engine_version: versionParts,
    },
    modules: [
      {
        description: `${modName} Bedrock Module`,
        type: ext === '.mcpack' ? 'resources' : 'data',
        uuid: crypto.randomUUID(),
        version: [1, 0, 0],
      },
    ],
  };

  if (ext === '.mcaddon') {
    zip.addFile(
      'behavior_pack/manifest.json',
      Buffer.from(JSON.stringify(manifest, null, 2), 'utf8')
    );
    const resManifest = {
      ...manifest,
      header: { ...manifest.header, uuid: crypto.randomUUID() },
      modules: [
        {
          description: `${modName} Resource Pack`,
          type: 'resources',
          uuid: crypto.randomUUID(),
          version: [1, 0, 0],
        },
      ],
    };
    zip.addFile(
      'resource_pack/manifest.json',
      Buffer.from(JSON.stringify(resManifest, null, 2), 'utf8')
    );
  } else if (ext === '.mcworld') {
    zip.addFile('levelname.txt', Buffer.from(modName, 'utf8'));
    zip.addFile(
      'world_behavior_packs.json',
      Buffer.from(JSON.stringify([{ pack_id: manifest.header.uuid, version: [1, 0, 0] }], null, 2), 'utf8')
    );
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
  } else {
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
  }

  const readmeContent = [
    `==============================================`,
    `DOG MODS — Minecraft Bedrock Edition Package`,
    `==============================================`,
    `Mod Name: ${modName}`,
    `Target Bedrock Version: ${mcVersion}`,
    `Package Format: ${ext}`,
    ``,
    `Description:`,
    description,
    ``,
    `Installation:`,
    `Open this ${ext} file directly with Minecraft Bedrock Edition`,
    `on Windows, Android, or iOS to import automatically.`,
  ].join('\n');

  zip.addFile('README_DOGMODS.txt', Buffer.from(readmeContent, 'utf8'));
  zip.writeZip(targetPath);

  return fs.statSync(targetPath).size;
}
