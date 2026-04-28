import prisma from '../lib/prisma';

export interface HeatmapCell {
  model: string;
  suffix: string;
  colour: string;
  open: number;
  total: number;
  level: 'green' | 'yellow' | 'red';
}

export async function getHeatmap(year?: number): Promise<HeatmapCell[]> {
  const where: Record<string, unknown> = {
    status: { not: 'DELIVERED' },
    hiddenFromHeatmap: false,
  };
  if (year) where.chassisYear = year;

  const vehicles = await prisma.vehicle.findMany({
    where,
    select: { model: true, suffix: true, colour: true, status: true },
  });

  const map = new Map<string, { open: number; total: number }>();
  for (const v of vehicles) {
    const key = `${v.model}||${v.suffix}||${v.colour}`;
    const existing = map.get(key) ?? { open: 0, total: 0 };
    existing.total++;
    if (v.status === 'OPEN') existing.open++;
    map.set(key, existing);
  }

  const cells: HeatmapCell[] = [];
  for (const [key, counts] of Array.from(map.entries())) {
    const [model, suffix, colour] = key.split('||');
    const ratio = counts.total === 0 ? 0 : counts.open / counts.total;
    const level: HeatmapCell['level'] = ratio >= 0.5 ? 'green' : ratio >= 0.2 ? 'yellow' : 'red';
    cells.push({ model, suffix, colour, open: counts.open, total: counts.total, level });
  }
  return cells;
}
