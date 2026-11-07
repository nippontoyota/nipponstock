import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

let tableChecked = false;
async function ensureTable() {
  if (tableChecked) return;
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "sales_referrals" (
        id TEXT PRIMARY KEY,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        interested_model TEXT,
        referring_employee_id TEXT,
        referring_employee_name TEXT,
        referring_employee_phone TEXT,
        referring_employee_dept TEXT,
        referring_employee_branch TEXT,
        branch_id TEXT,
        branch_name TEXT,
        sales_manager_id TEXT,
        sales_manager_name TEXT,
        status TEXT NOT NULL DEFAULT 'PENDING',
        notes TEXT,
        submitted_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    tableChecked = true;
  } catch (err) {
    console.error('[Webhooks] Failed to ensure sales_referrals table:', err);
    throw err;
  }
}

// POST /webhooks/sales-referral — Public Webhook from WhatsApp Bot
router.post('/sales-referral', async (req: Request, res: Response) => {
  try {
    await ensureTable();

    const {
      customer_name,
      customer_phone,
      interested_model,
      referring_employee_id,
      referring_employee_name,
      referring_employee_phone,
      referring_employee_dept,
      referring_employee_branch,
      submitted_at,
    } = req.body;

    console.log('[Webhooks] Received NICE Sales Referral:', req.body);

    if (!customer_name || !customer_phone) {
      res.status(400).json({ ok: false, error: 'customer_name and customer_phone are required' });
      return;
    }

    // Try to auto-match branch and Sales Manager
    let matchedBranchId: string | null = null;
    let matchedBranchName: string | null = null;
    let matchedSmId: string | null = null;
    let matchedSmName: string | null = null;

    if (referring_employee_branch) {
      try {
        const branchInput = String(referring_employee_branch).trim().toLowerCase();
        const branches = await prisma.branch.findMany({ select: { id: true, name: true, branchCode: true } });
        
        const found = branches.find((b) => {
          const bName = b.name.toLowerCase();
          const bCode = (b.branchCode || '').toLowerCase();
          const normInput = branchInput.replace(/ss/g, 's');
          const normBName = bName.replace(/ss/g, 's');
          return bName.includes(branchInput) || 
                 branchInput.includes(bName) || 
                 normBName.includes(normInput) ||
                 normInput.includes(normBName) ||
                 (bCode && branchInput.includes(bCode));
        });

        if (found) {
          matchedBranchId = found.id;
          matchedBranchName = found.name;

          const sm = await prisma.user.findFirst({
            where: { branchId: found.id, role: 'SALES_MANAGER', isActive: true },
            select: { id: true, fullName: true },
          });
          if (sm) {
            matchedSmId = sm.id;
            matchedSmName = sm.fullName;
          }
        }
      } catch (e) {
        console.warn('[Webhooks] Branch/SM lookup warning:', e);
      }
    }

    const id = crypto.randomUUID();
    const subTime = submitted_at ? new Date(submitted_at) : new Date();

    await prisma.$executeRawUnsafe(
      `INSERT INTO "sales_referrals" (
        id,
        customer_name,
        customer_phone,
        interested_model,
        referring_employee_id,
        referring_employee_name,
        referring_employee_phone,
        referring_employee_dept,
        referring_employee_branch,
        branch_id,
        branch_name,
        sales_manager_id,
        sales_manager_name,
        status,
        submitted_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'PENDING', $14)`,
      id,
      String(customer_name || ''),
      String(customer_phone || ''),
      String(interested_model || ''),
      String(referring_employee_id || ''),
      String(referring_employee_name || ''),
      referring_employee_phone ? String(referring_employee_phone) : null,
      referring_employee_dept ? String(referring_employee_dept) : null,
      referring_employee_branch ? String(referring_employee_branch) : null,
      matchedBranchId,
      matchedBranchName,
      matchedSmId,
      matchedSmName,
      subTime
    );

    res.status(200).json({ ok: true, id, message: 'Sales referral received successfully' });
  } catch (err) {
    console.error('[Webhooks] Error saving sales referral:', err);
    res.status(500).json({ ok: false, error: 'Internal server error', detail: String(err) });
  }
});

// GET /webhooks/sales-referrals — Authenticated query for Sales Manager dashboard
router.get('/sales-referrals', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const { role, branchId, userId } = req.user!;

    let rows: any[];
    if ((role === 'SALES_MANAGER' || role === 'TEAM_LEADER') && branchId) {
      rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM "sales_referrals" 
         WHERE branch_id = $1 OR sales_manager_id = $2 OR branch_id IS NULL 
         ORDER BY submitted_at DESC LIMIT 100`,
        branchId,
        userId
      );
    } else {
      // Admin / CEO / Global view
      rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM "sales_referrals" ORDER BY submitted_at DESC LIMIT 200`
      );
    }

    res.json(rows);
  } catch (err) {
    console.error('[Webhooks] Error fetching sales referrals:', err);
    res.status(500).json({ error: 'Failed to fetch referrals' });
  }
});

// PATCH /webhooks/sales-referrals/:id — Update status / notes
router.patch('/sales-referrals/:id', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    await ensureTable();
    const { id } = req.params;
    const { status, notes } = req.body;

    if (status) {
      await prisma.$executeRawUnsafe(
        `UPDATE "sales_referrals" SET status = $1, notes = COALESCE($2, notes) WHERE id = $3`,
        status,
        notes !== undefined ? notes : null,
        id
      );
    } else if (notes !== undefined) {
      await prisma.$executeRawUnsafe(
        `UPDATE "sales_referrals" SET notes = $1 WHERE id = $2`,
        notes,
        id
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[Webhooks] Error updating sales referral:', err);
    res.status(500).json({ error: 'Failed to update referral' });
  }
});

export default router;
