// Pill colours keyed by sales.prisgrense raw value ('Pris' | 'Rabatt 1' | 'Rabatt 2' | 'Minstepris').

export const RABATT_BADGE: Record<string, { label: string; cls: string }> = {
  'Pris':       { label: 'Ingen rabatt', cls: 'bg-flag-ok-bg text-flag-ok-text'     },
  'Rabatt 1':   { label: 'Lav rabatt',   cls: 'bg-flag-warn-bg text-flag-warn-text' },
  'Rabatt 2':   { label: 'Høy rabatt',   cls: 'bg-flag-red-bg text-flag-red-text'   },
  'Minstepris': { label: 'Minstepris',   cls: 'bg-flag-red-bg text-flag-red-text'   },
}

/** CSS classes for a prisgrense chip — show `prisgrense` text as-is in the UI. */
export function prisgrenseChipClass(prisgrense: string | null | undefined): string {
  if (!prisgrense) return 'bg-bg border border-border text-text-secondary'
  return RABATT_BADGE[prisgrense]?.cls ?? 'bg-bg border border-border text-text-secondary'
}

export const HUBSPOT_SALES_DEAL_BASE =
  'https://app-eu1.hubspot.com/contacts/25445101/record/0-3'
