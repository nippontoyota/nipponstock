import prisma from '../lib/prisma';

const DEFAULT_DAYS = 7;
const MDDP_DAYS = 30;

// MDDP stock always gets 30 days; BND and CTDMS use model/global config (default 7)
export async function getBlockingDays(model: string, stockStatus?: string | null): Promise<number> {
  if (stockStatus === 'MDDP') return MDDP_DAYS;

  const config = await prisma.modelConfig.findUnique({ where: { modelName: model } });
  if (config) return config.blockingDurationDays;

  const global = await prisma.globalConfig.findUnique({ where: { key: 'default_blocking_days' } });
  return global ? parseInt(global.value) : DEFAULT_DAYS;
}
