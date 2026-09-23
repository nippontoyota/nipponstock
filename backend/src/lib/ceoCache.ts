import prisma from './prisma';

const TTL_MS = 10_000;

export interface ActiveHardBlocking {
  id: string;
  paymentStatus: string | null;
  hardBlockAt: Date | null;
  expectedBillingDate: Date | null;
  fullPaymentAt: Date | null;
  branch: { name: string; branchCode: string | null };
  vehicle: { model: string; stockStatus: string | null; assignmentDate: Date | null; createdAt: Date };
  financeRecord: { purchaseMode: string | null; financeStatus: string | null; bankName: string | null } | null;
}

let cache: { data: ActiveHardBlocking[]; expiresAt: number } | null = null;

// The CEO dashboard fires ~20 requests in one burst on every page load, and
// roughly a dozen of them independently re-query the exact same "active hard
// blockings" row set with different field subsets. Sharing one short-lived
// cache across them collapses that back down to a single DB round trip per
// dashboard load instead of ~10.
export async function getActiveHardBlockings(): Promise<ActiveHardBlocking[]> {
  if (cache && cache.expiresAt > Date.now()) return cache.data;

  const data = await prisma.blockingRequest.findMany({
    where: { blockType: 'HARD', status: 'ACTIVE' },
    select: {
      id: true,
      paymentStatus: true,
      hardBlockAt: true,
      expectedBillingDate: true,
      fullPaymentAt: true,
      branch: { select: { name: true, branchCode: true } },
      vehicle: { select: { model: true, stockStatus: true, assignmentDate: true, createdAt: true } },
      financeRecord: { select: { purchaseMode: true, financeStatus: true, bankName: true } },
    },
  });

  cache = { data, expiresAt: Date.now() + TTL_MS };
  return data;
}
