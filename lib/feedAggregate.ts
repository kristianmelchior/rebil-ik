// Shape DB rows into API payloads for feed social.

import type { FeedReactionRow, FeedCommentRow } from '@/lib/db'
import type { FeedReactionsMap, FeedCommentsMap, FeedCommentPublic } from '@/lib/types'

export function aggregateFeedReactions(
  rows: FeedReactionRow[],
  saleIds: number[],
  viewerKode: string
): FeedReactionsMap {
  const out: FeedReactionsMap = {}
  for (const sid of saleIds) {
    const saleRows = rows.filter(r => r.sale_id === sid)
    const emojiKeys = [...new Set(saleRows.map(r => r.emoji))]
    const reactions = emojiKeys.map(emoji => {
      const forEmoji = saleRows.filter(r => r.emoji === emoji)
      const repNames = [...new Set(forEmoji.map(r => r.rep_name))]
      return { emoji, count: forEmoji.length, repNames }
    })
    reactions.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji))
    const myReactions = [...new Set(saleRows.filter(r => r.kode === viewerKode).map(r => r.emoji))]
    out[String(sid)] = { reactions, myReactions }
  }
  return out
}

export function aggregateFeedComments(rows: FeedCommentRow[], saleIds: number[]): FeedCommentsMap {
  const out: FeedCommentsMap = {}
  for (const sid of saleIds) {
    out[String(sid)] = []
  }
  for (const r of rows) {
    const k = String(r.sale_id)
    if (!out[k]) out[k] = []
    const pub: FeedCommentPublic = {
      id: r.id,
      sale_id: r.sale_id,
      rep_name: r.rep_name,
      body: r.body,
      created_at: r.created_at,
    }
    out[k].push(pub)
  }
  return out
}
