import prisma from '../lib/prisma';

const DEFAULT_DAYS = 7;

export async function getBlockingDays(model: string): Promise<number> {
  const config = await prisma.modelConfig.findUnique({ where: { modelName: model } });
  if (config) return config.blockingDurationDays;

  const global = await prisma.globalConfig.findUnique({ where: { key: 'default_blocking_days' } });
  return global ? parseInt(global.value) : DEFAULT_DAYS;
}
