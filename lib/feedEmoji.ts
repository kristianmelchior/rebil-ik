/** Emojis allowed on feed reactions (client + server). */
export const FEED_ALLOWED_EMOJIS = ['🔥', '👏', '😮', '💪', '🏆', '😂', '❤️', '👀'] as const

export function isAllowedFeedEmoji(s: string): s is (typeof FEED_ALLOWED_EMOJIS)[number] {
  return (FEED_ALLOWED_EMOJIS as readonly string[]).includes(s)
}
