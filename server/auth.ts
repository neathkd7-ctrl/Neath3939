import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';
import { getUserById } from './db.ts';

const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const TOKEN_TTL = '7d';

export interface AuthTokenPayload {
  userId: string;
  role: 'user' | 'admin';
}

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: 'user' | 'admin';
    bio: string;
    avatar_url: string;
    is_banned: number;
    created_at: string;
  };
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string | null): boolean {
  if (!hash) return false;
  return bcrypt.compareSync(password, hash);
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthTokenPayload;
    if (!decoded || typeof decoded.userId !== 'string') return null;
    return decoded;
  } catch {
    return null;
  }
}

export function isEnvAdminPasscodeConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSCODE && process.env.ADMIN_PASSCODE.trim().length > 0);
}

export function verifyEnvAdminPasscode(input: string): boolean {
  const configured = process.env.ADMIN_PASSCODE;
  if (!configured || !configured.trim()) return false;

  const expectedDigest = crypto.createHash('sha256').update(configured.trim()).digest();
  const actualDigest = crypto.createHash('sha256').update(input || '').digest();
  return crypto.timingSafeEqual(expectedDigest, actualDigest);
}

export function attachUser(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return next();
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyAuthToken(token);
  if (!payload) {
    return next();
  }
  const user = getUserById(payload.userId);
  if (user && !user.is_banned) {
    req.user = user;
  }
  next();
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }
  if (req.user.is_banned) {
    res.status(403).json({ error: 'Your account has been suspended.' });
    return;
  }
  next();
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Admin authentication required.' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Administrator privileges required.' });
    return;
  }
  next();
}
