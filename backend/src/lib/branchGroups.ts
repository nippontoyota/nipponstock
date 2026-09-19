// Fixed business grouping for the CEO "Branch Performance — MTD" table and the
// Admin "MTD Tally" editor. Pala (KT01B) is folded into Kottayam (KT01A).
// branchCode is the key used to store/read each group's target + MTD tally
// in the BranchMtdTally table — it's the group's representative branch code,
// not necessarily the only branchCode in that group (see `codes`).
export const BRANCH_GROUPS = [
  { display: 'Muvattupuzha',   branchCode: 'MV01A', codes: ['MV01A'] },
  { display: 'Pathanamthitta', branchCode: 'PH01A', codes: ['PH01A'] },
  { display: 'Irinjalakuda',   branchCode: 'IR01A', codes: ['IR01A'] },
  { display: 'Enjakkal',       branchCode: 'TR01C', codes: ['TR01C'] },
  { display: 'Kottayam',       branchCode: 'KT01A', codes: ['KT01A', 'KT01B'] },
  { display: 'Kollam',         branchCode: 'KL01A', codes: ['KL01A'] },
  { display: 'Thiruvalla',     branchCode: 'TL01A', codes: ['TL01A'] },
  { display: 'Kalamaserry',    branchCode: 'CO01B', codes: ['CO01B'] },
  { display: 'Kazhakoottam',   branchCode: 'TR01A', codes: ['TR01A'] },
  { display: 'Trichur',        branchCode: 'TI01A', codes: ['TI01A'] },
  { display: 'Kayamkulam',     branchCode: 'KY01A', codes: ['KY01A'] },
  { display: 'Nettoor',        branchCode: 'CO01A', codes: ['CO01A'] },
];
