// NPS bonus lookup table — source: public.nps_bonus
// Format: [nps_threshold, bonus NOK]
// Lookup: floor npsScore to nearest 10, find last row where row[0] <= score
export const NPS_BONUS: [number, number][] = [
  [-40, 0],
  [-30, 0],
  [-20, 0],
  [-10, 0],
  [0,   250],
  [10,  500],
  [20,  750],
  [30,  1500],
  [40,  2250],
  [50,  3000],
  [60,  3750],
  [70,  4500],
  [80,  5000],
  [90,  5000],
]
