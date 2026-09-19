// Values are hydrated at runtime from GET /ceo/mtd-tally (admin-editable in
// Admin → MTD Tally). The 0 defaults here only matter before that fetch lands.
export const BRANCH_TARGETS = [
  { display: 'Muvattupuzha',  target: 0, codes: ['MV01A'],          mtdTallyHC: 0 },
  { display: 'Pathanamthitta',target: 0, codes: ['PH01A'],          mtdTallyHC: 0 },
  { display: 'Irinjalakuda',  target: 0, codes: ['IR01A'],          mtdTallyHC: 0 },
  { display: 'Enjakkal',      target: 0, codes: ['TR01C'],          mtdTallyHC: 0 },
  { display: 'Kottayam',      target: 0, codes: ['KT01A', 'KT01B'], mtdTallyHC: 0 },
  { display: 'Kollam',        target: 0, codes: ['KL01A'],          mtdTallyHC: 0 },
  { display: 'Thiruvalla',    target: 0, codes: ['TL01A'],          mtdTallyHC: 0 },
  { display: 'Kalamaserry',   target: 0, codes: ['CO01B'],          mtdTallyHC: 0 },
  { display: 'Kazhakoottam',  target: 0, codes: ['TR01A'],          mtdTallyHC: 0 },
  { display: 'Trichur',       target: 0, codes: ['TI01A'],          mtdTallyHC: 0 },
  { display: 'Kayamkulam',    target: 0, codes: ['KY01A'],          mtdTallyHC: 0 },
  { display: 'Nettoor',       target: 0, codes: ['CO01A'],          mtdTallyHC: 0 },
];

// Mutates BRANCH_TARGETS in place so every consumer (CEOPage, CEOMarketShareModal)
// sees the latest admin-entered values without needing its own fetch/state.
export function applyMtdTallyData(rows: { display: string; target: number; mtdTallyHC: number }[]) {
  for (const r of rows) {
    const entry = BRANCH_TARGETS.find((b) => b.display === r.display);
    if (entry) { entry.target = r.target; entry.mtdTallyHC = r.mtdTallyHC; }
  }
}

export function getSharedMtdTally(marketShareBranchName: string): number {
  if (marketShareBranchName === 'Kazhakoottam & Enjakkal') {
     const k = BRANCH_TARGETS.find(b => b.display === 'Kazhakoottam')?.mtdTallyHC || 0;
     const e = BRANCH_TARGETS.find(b => b.display === 'Enjakkal')?.mtdTallyHC || 0;
     return k + e;
  }
  if (marketShareBranchName === 'Kalamassery') {
     return BRANCH_TARGETS.find(b => b.display === 'Kalamaserry')?.mtdTallyHC || 0;
  }
  return BRANCH_TARGETS.find(b => b.display === marketShareBranchName)?.mtdTallyHC || 0;
}
