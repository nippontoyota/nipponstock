import cron from 'node-cron';
import prisma from '../lib/prisma';

// Must be kept in sync with the MTD Tally floor in frontend/src/pages/ceo/CEOPage.tsx (KPI cards).
export const MTD_TALLY_FLOOR = 1538;

export async function captureVisibilitySnapshot() {
  const baseHard = { blockType: 'HARD' as const, status: 'ACTIVE' as const };
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalBlockings, mtdTally] = await Promise.all([
    prisma.blockingRequest.count({ where: baseHard }),
    prisma.deliveryWorkflow.count({ where: { tallyDate: { gte: startOfMonth } } }),
  ]);

  const totalVisibility = Math.max(mtdTally, MTD_TALLY_FLOOR) + totalBlockings;

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
