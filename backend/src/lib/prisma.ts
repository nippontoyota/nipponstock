import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Auto-retry on P1017 (Supabase closes idle connections).
// Waits 1 s then retries the same query once before throwing.
prisma.$use(async (params, next) => {
  try {
    return await next(params);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P1017') {
      console.warn('[prisma] P1017 – reconnecting and retrying once');
      await new Promise((r) => setTimeout(r, 1000));
      return await next(params);
    }
    throw err;
  }
});

export default prisma;
