import cron from 'node-cron';
import prisma from '../lib/prisma';
import { BRANCH_GROUPS } from '../lib/branchGroups';

export async function captureVisibilitySnapshot() {
  const baseHard = { blockType: 'HARD' as const, status: 'ACTIVE' as const };
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalBlockings, mtdTally, mtdTallyRows] = await Promise.all([
    prisma.blockingRequest.count({ where: baseHard }),
    prisma.deliveryWorkflow.count({ where: { tallyDate: { gte: startOfMonth } } }),
    prisma.branchMtdTally.findMany({ where: { branchCode: { in: BRANCH_GROUPS.map((g) => g.branchCode) } } }),
  ]);
  const mtdTallyFloor = mtdTallyRows.reduce((sum, r) => sum + r.mtdTally, 0);

  const totalVisibility = Math.max(mtdTally, mtdTallyFloor) + totalBlockings;

  await prisma.visibilitySnapshot.create({ data: { totalVisibility } });
}

export function startVisibilitySnapshotJob() {
  // Run every 15 minutes
  cron.schedule('*/15 * * * *', async () => {
    try {
      await captureVisibilitySnapshot();
    } catch (err) {
      console.error('Visibility snapshot failed:', err);
    }
  });

  console.log('Visibility snapshot job started');
}
