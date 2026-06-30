import prisma from '../lib/prisma';

export interface HeatmapYearBreakdown {
  chassisYear: number;
  open: number;
  total: number;
  level: 'green' | 'yellow' | 'red';
  hasPhysical: boolean;
}

export interface HeatmapCell {
  model: string;
  suffix: string;
  colour: string;
  open: number;
  total: number;
  level: 'green' | 'yellow' | 'red';
  hasPhysical: boolean; // true if any BND or CTDMS unit exists for this variant
  chassisYears: number[]; // distinct chassis years contributing to this cell
  yearBreakdown: HeatmapYearBreakdown[]; // per-chassis-year counts within this cell
}

function levelFor(open: number): 'green' | 'yellow' | 'red' {
  // Count-based: ≤2 open = red, 3–4 open = yellow, ≥5 open = green
  return open >= 5 ? 'green' : open >= 3 ? 'yellow' : 'red';
}

export async function getHeatmap(year?: number): Promise<HeatmapCell[]> {
  const where: Record<string, unknown> = {
    status: { not: 'DELIVERED' },
    hiddenFromHeatmap: false,
  };
  if (year) where.chassisYear = year;

  const vehicles = await prisma.vehicle.findMany({
    where,
    select: { model: true, suffix: true, colour: true, status: true, stockStatus: true, chassisYear: true },
  });

  const map = new Map<string, { open: number; total: number; hasPhysical: boolean }>();
  const yearMap = new Map<string, { open: number; total: number; hasPhysical: boolean }>();
  for (const v of vehicles) {
    const key = `${v.model}||${v.suffix}||${v.colour}`;
    const existing = map.get(key) ?? { open: 0, total: 0, hasPhysical: false };
    existing.total++;
    if (v.status === 'OPEN') existing.open++;
    if (v.status === 'OPEN' && (v.stockStatus === 'BND' || v.stockStatus === 'CTDMS')) existing.hasPhysical = true;
    map.set(key, existing);

    const yKey = `${key}||${v.chassisYear}`;
    const yExisting = yearMap.get(yKey) ?? { open: 0, total: 0, hasPhysical: false };
    yExisting.total++;
    if (v.status === 'OPEN') yExisting.open++;
    if (v.status === 'OPEN' && (v.stockStatus === 'BND' || v.stockStatus === 'CTDMS')) yExisting.hasPhysical = true;
    yearMap.set(yKey, yExisting);
  }

  const cells: HeatmapCell[] = [];
  for (const [key, counts] of Array.from(map.entries())) {
    // Only show cells that have at least one open unit — fully blocked variants are hidden
    if (counts.open === 0) continue;
    const [model, suffix, colour] = key.split('||');
    const level = levelFor(counts.open);

    const yearBreakdown: HeatmapYearBreakdown[] = [];
    for (const [yKey, yCounts] of Array.from(yearMap.entries())) {
      if (!yKey.startsWith(`${key}||`) || yCounts.open === 0) continue;
      const chassisYear = Number(yKey.slice(key.length + 2));
      yearBreakdown.push({ chassisYear, open: yCounts.open, total: yCounts.total, level: levelFor(yCounts.open), hasPhysical: yCounts.hasPhysical });
    }
    yearBreakdown.sort((a, b) => a.chassisYear - b.chassisYear);

    cells.push({
      model, suffix, colour, open: counts.open, total: counts.total, level, hasPhysical: counts.hasPhysical,
      chassisYears: yearBreakdown.map((y) => y.chassisYear),
      yearBreakdown,
    });
  }
  return cells;
}
