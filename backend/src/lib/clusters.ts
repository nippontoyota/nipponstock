import prisma from './prisma';

// Cluster grouping — also used by the Cluster Manager role's own dashboard.
export const CLUSTER_BRANCHES: Record<number, string[]> = {
  1: ['CO01A', 'CO01B', 'KY01A'],
  2: ['TR01A', 'TR01C', 'KL01A'],
  3: ['IR01A', 'TI01A', 'MV01A'],
  4: ['KT01A', 'PH01A', 'TL01A', 'KT01B'],
};

const BRANCH_TO_CLUSTER: Record<string, number> = {};
for (const [num, codes] of Object.entries(CLUSTER_BRANCHES)) {
  for (const code of codes) BRANCH_TO_CLUSTER[code] = Number(num);
}

/**
 * Sales Manager / Team Leader accounts only see and block vehicles whose
 * stockyardLocation falls within their own branch's cluster.
 * Returns:
 *  - null      → role is not cluster-restricted (no filtering should be applied)
 *  - string[]  → the stockyard branch codes visible to this user (may be empty,
 *                meaning nothing is visible — e.g. branch not mapped to a cluster)
 */
export async function getClusterCodesForUser(role: string, branchId: string | null | undefined): Promise<string[] | null> {
  if (role !== 'SALES_MANAGER' && role !== 'TEAM_LEADER') return null;
  if (!branchId) return [];

  const branch = await prisma.branch.findUnique({ where: { id: branchId }, select: { branchCode: true } });
  const clusterNum = branch?.branchCode ? BRANCH_TO_CLUSTER[branch.branchCode] : undefined;
  if (!clusterNum) return [];

  return CLUSTER_BRANCHES[clusterNum];
}

/**
 * Builds a Prisma where-fragment matching vehicles whose stockyardLocation
 * belongs to one of the given branch codes. stockyardLocation values look like
 * "TR01A", "TR01A · Yard-1, Mess area, Kazhakkuttam", "In transit → CO01A · ...",
 * or "OUT · TI01A · ...". A prefix match on the bare code correctly matches the
 * first two forms while naturally excluding "In transit →" and "OUT ·" entries
 * (vehicles not physically present at that branch).
 */
export function stockyardClusterWhere(codes: string[]) {
  return { OR: codes.map((code) => ({ stockyardLocation: { startsWith: code } })) };
}
