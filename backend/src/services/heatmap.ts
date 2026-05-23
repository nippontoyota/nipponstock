import prisma from '../lib/prisma';

export interface HeatmapCell {
  model: string;
  suffix: string;
  colour: string;
  open: number;
  total: number;
  level: 'green' | 'yellow' | 'red';
  hasPhysical: boolean; // true if any BND or CTDMS unit exists for this variant
}

export async function getHeatmap(year?: number): Promise<HeatmapCell[]> {
  const where: Record<string, unknown> = {
    status: { not: 'DELIVERED' },
    hiddenFromHeatmap: false,
  };
  if (year) where.chassisYear = year;

  const vehicles = await prisma.vehicle.findMany({
    where,
    select: { model: true, suffix: true, colour: true, status: true, stockStatus: true },
  });

  const map = new Map<string, { open: number; total: number; hasPhysical: boolean }>();
  for (const v of vehicles) {
    const key = `${v.model}||${v.suffix}||${v.colour}`;
    const existing = map.get(key) ?? { open: 0, total: 0, hasPhysical: false };
    existing.total++;
    if (v.status === 'OPEN') existing.open++;
    if (v.status === 'OPEN' && (v.stockStatus === 'BND' || v.stockStatus === 'CTDMS')) existing.hasPhysical = true;
    map.set(key, existing);
  }

  const cells: HeatmapCell[] = [];
  for (const [key, counts] of Array.from(map.entries())) {
    // Only show cells that have at least one open unit — fully blocked variants are hidden
    if (counts.open === 0) continue;
    const [model, suffix, colour] = key.split('||');
    // Count-based: ≤2 open = red, 3–4 open = yellow, ≥5 open = green
    const level: HeatmapCell['level'] = counts.open >= 5 ? 'green' : counts.open >= 3 ? 'yellow' : 'red';
    cells.push({ model, suffix, colour, open: counts.open, total: counts.total, level, hasPhysical: counts.hasPhysical });
  }
  return cells;
}
