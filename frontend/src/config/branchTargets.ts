export const BRANCH_TARGETS = [
  { display: 'Muvattupuzha',  target: 115, codes: ['MV01A'],          mtdTallyHC: 11 },
  { display: 'Pathanamthitta',target:  86, codes: ['PH01A'],          mtdTallyHC: 22 },
  { display: 'Irinjalakuda',  target:  85, codes: ['IR01A'],          mtdTallyHC: 26 },
  { display: 'Enjakkal',      target: 145, codes: ['TR01C'],          mtdTallyHC: 25 },
  { display: 'Kottayam',      target: 193, codes: ['KT01A', 'KT01B'], mtdTallyHC: 27 },
  { display: 'Kollam',        target: 185, codes: ['KL01A'],          mtdTallyHC: 23 },
  { display: 'Thiruvalla',    target:  66, codes: ['TL01A'],          mtdTallyHC: 18 },
  { display: 'Kalamaserry',   target: 199, codes: ['CO01B'],          mtdTallyHC: 37 },
  { display: 'Kazhakoottam',  target: 150, codes: ['TR01A'],          mtdTallyHC: 43 },
  { display: 'Trichur',       target: 150, codes: ['TI01A'],          mtdTallyHC: 38 },
  { display: 'Kayamkulam',    target: 116, codes: ['KY01A'],          mtdTallyHC: 19 },
  { display: 'Nettoor',       target: 160, codes: ['CO01A'],          mtdTallyHC: 16 },
];

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
