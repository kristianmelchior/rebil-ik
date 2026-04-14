// Types for the TL dashboard — completely separate from the IK dashboard types.

/** A deal row from the deals_current table (synced from HubSpot every 15 min). */
export interface Deal {
  deal_id:               string
  deal_name:             string | null
  owner_id:              string | null
  stage_id:              string | null
  stage_name:            string | null
  create_date:           string | null   // YYYY-MM-DD
  last_activity_at:      string | null   // ISO timestamp
  last_stage_change_at:  string | null   // ISO timestamp
  next_activity_date:    string | null   // YYYY-MM-DD
  fetched_at:            string          // ISO timestamp
}
