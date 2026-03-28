// DB column name constants — prevents typos in query builders and filter functions.
// Each constant is named COL_{TABLE}_{FIELD} and documents its table + purpose.

// public.sales
export const COL_SALES_HS_DEAL_ID  = 'hs_deal_id'   // sales — HubSpot deal ID for deal URL
export const COL_SALES_KODE        = 'kode'          // sales — rep UUID, joins to reps.kode
export const COL_SALES_DATO        = 'dato_kjopt'    // sales — date of purchase (YYYY-MM-DD)
export const COL_SALES_BILER       = 'biler'         // sales — car count: always SUM, never COUNT(*)
export const COL_SALES_BONUSSATS   = 'bonussats'     // sales — pre-calculated bonus NOK per row
export const COL_SALES_BRUTTO      = 'brutto'        // sales — gross sale price NOK
export const COL_SALES_PRISGRENSE  = 'prisgrense'    // sales — drives rabatt badge in CarsTable
export const COL_SALES_NAVN        = 'navn'          // sales — bil label in CarsTable

// public.leads
export const COL_LEADS_KODE        = 'kode'          // leads — rep UUID
export const COL_LEADS_DATE        = 'createdate'    // leads — creation date for period filtering
export const COL_LEADS_TELLER      = 'teller_lead'   // leads — boolean, filter true only before counting

// public.nps
export const COL_NPS_KODE          = 'kode'          // nps — rep UUID, may be null or 'zz_unknown'
export const COL_NPS_MONTH         = 'month'         // nps — first day of survey month (YYYY-MM-DD)
export const COL_NPS_ADJ_SCORE     = 'nps_adj_score' // nps — adjusted score, use for all calculations

// public.reps
export const COL_REPS_KODE         = 'kode'          // reps — primary key, httpOnly session cookie
