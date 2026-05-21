// Shared pipeline utility functions — used by both TL dash and IK dash.

export function cleanScore(totalRotten: number): number {
  if (totalRotten === 0)  return 100
  if (totalRotten < 5)   return 80
  if (totalRotten < 10)  return 60
  if (totalRotten < 15)  return 40
  if (totalRotten < 20)  return 20
  return 0
}

export function scoreStyle(score: number): string {
  if (score === 100) return 'bg-[#D1FAD1] text-[#276527]'
  if (score >= 80)   return 'bg-[#E8F5D1] text-[#4A7C20]'
  if (score >= 60)   return 'bg-[#FEF3E2] text-[#C2580A]'
  if (score >= 40)   return 'bg-[#FDDDC8] text-[#A84010]'
  if (score >= 20)   return 'bg-[#FCEBEB] text-[#A32D2D]'
  return 'bg-[#F5C2C2] text-[#7A1A1A]'
}

export function rottenBadgeClass(rottenCount: number): string {
  if (rottenCount >= 9) return 'bg-[#DC2626] text-white'
  if (rottenCount >= 5) return 'bg-[#F97316] text-white'
  if (rottenCount >= 1) return 'bg-[#FEF9C3] text-[#A16207]'
  return 'text-text-muted'
}
