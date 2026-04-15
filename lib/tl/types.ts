// Types for the TL dashboard — completely separate from the IK dashboard types.

/** A deal row from the deals_current table (synced from HubSpot every 15 min). */
export interface Deal {
  deal_id:              string
  deal_name:            string | null
  owner_id:             string | null
  stage_id:             string | null
  stage_name:           string | null
  category:             string | null
  create_date:          string | null
  last_activity_at:     string | null
  last_modified_at:     string | null
  last_stage_change_at: string | null
  next_activity_date:   string | null
  innbytte_:            string | null
  type_lead:            string | null
}
