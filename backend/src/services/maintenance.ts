import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { verifyToken } from '../lib/jwt';

const KEY = 'maintenance_mode';
const CACHE_MS = 5_000;

// Roles that are shown the "Under Maintenance" screen while the switch is on.
export const MAINTENANCE_ROLES = ['SALES_MANAGER', 'TEAM_LEADER'];

let cache: { enabled: boolean; at: number } | null = null;

export async function isMaintenanceOn(): Promise<boolean> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.enabled;
  const row = await prisma.globalConfig.findUnique({ where: { key: KEY } });
  const enabled = row?.value === 'true';
  cache = { enabled, at: Date.now() };
  return enabled;
}

export async function setMaintenance(enabled: boolean, userId: string): Promise<void> {
  await prisma.globalConfig.upsert({
    where: { key: KEY },
    update: { value: String(enabled), updatedById: userId },
    create: { key: KEY, value: String(enabled), updatedById: userId },
  });
  cache = { enabled, at: Date.now() };
}

// Express middleware: while the switch is on, Sales Managers and Team Leaders get a 503 on every
// API call except login/auth and the maintenance status endpoint itself (so they can still sign
// in, see the maintenance screen, and log out).
const ALWAYS_ALLOWED = ['/auth', '/maintenance', '/uploads', '/health'];

export async function maintenanceGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.method === 'OPTIONS' || ALWAYS_ALLOWED.some((p) => req.path === p || req.path.startsWith(p + '/'))) { next(); return; }
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) { next(); return; }
    const { role } = verifyToken(header.slice(7));
    if (MAINTENANCE_ROLES.includes(role) && await isMaintenanceOn()) {
      res.status(503).json({ error: 'The application is under maintenance. Please try again shortly.', maintenance: true });
      return;
    }
  } catch {
    // invalid token or a failed flag lookup: don't lock anyone out here, let normal auth handle it
  }
  next();
}
