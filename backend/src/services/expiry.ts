import cron from 'node-cron';
import prisma from '../lib/prisma';
import { emitHeatmapUpdate } from './events';

export function startExpiryJob() {
  // Run every minute
  cron.schedule('* * * * *', async () => {
    const now = new Date();

    // Expire soft blocks older than 5 minutes
    const expiredSoft = await prisma.blockingRequest.findMany({
      where: {
        blockType: 'SOFT',
        status: 'ACTIVE',
        softBlockAt: { lt: new Date(now.getTime() - 5 * 60 * 1000) },
      },
      select: { id: true, vehicleId: true },
    });

    for (const b of expiredSoft) {
      await prisma.$transaction([
        prisma.blockingRequest.update({
          where: { id: b.id },
          data: { status: 'EXPIRED' },
        }),
        prisma.vehicle.update({
          where: { id: b.vehicleId },
          data: { status: 'OPEN' },
        }),
      ]);
    }

    // Expire hard blocks past their expiryAt
    const expiredHard = await prisma.blockingRequest.findMany({
      where: {
        blockType: 'HARD',
        status: 'ACTIVE',
        expiryAt: { lt: now },
      },
      select: { id: true, vehicleId: true },
    });

    for (const b of expiredHard) {
      await prisma.$transaction([
        prisma.blockingRequest.update({
          where: { id: b.id },
          data: { status: 'EXPIRED' },
        }),
        prisma.vehicle.update({
          where: { id: b.vehicleId },
          data: { status: 'OPEN' },
        }),
      ]);
    }

    if (expiredSoft.length > 0 || expiredHard.length > 0) {
      emitHeatmapUpdate();
    }
  });

  console.log('Expiry job started');
}
