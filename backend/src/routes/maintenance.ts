import { Router, Response } from 'express';
import { z } from 'zod';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { isMaintenanceOn, setMaintenance, MAINTENANCE_ROLES } from '../services/maintenance';
import { logAudit } from '../services/audit';

const router = Router();

// Any logged-in user can read the state (the Sales screens poll it).
router.get('/', authenticate, async (_req: AuthRequest, res: Response) => {
  res.json({ enabled: await isMaintenanceOn(), roles: MAINTENANCE_ROLES });
});

// Only an admin can flip the switch.
router.put('/', authenticate, requireAdmin, async (req: AuthRequest, res: Response) => {
  const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const previous = await isMaintenanceOn();
  await setMaintenance(parsed.data.enabled, req.user!.userId);
  await logAudit({
    entityType: 'CONFIG',
    entityId: 'maintenance_mode',
    action: parsed.data.enabled ? 'MAINTENANCE_ON' : 'MAINTENANCE_OFF',
    performedById: req.user!.userId,
    previousValue: { enabled: previous },
    newValue: { enabled: parsed.data.enabled },
  });
  res.json({ enabled: parsed.data.enabled, roles: MAINTENANCE_ROLES });
});

export default router;
