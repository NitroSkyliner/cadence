// The one shape every part of the app agrees on. Deliberately platform-agnostic:
// nothing here knows how any specific platform works.

export const STATUS = {
  DRAFT: 'draft', SCHEDULED: 'scheduled', PUBLISHING: 'publishing',
  PUBLISHED: 'published', FAILED: 'failed',
}

export const PLATFORMS = {
  bluesky:   { id: 'bluesky',   label: 'Bluesky',   short: 'BS', maxLen: 300 },
  mastodon:  { id: 'mastodon',  label: 'Mastodon',  short: 'MA', maxLen: 500 },
  instagram: { id: 'instagram', label: 'Instagram', short: 'IG', maxLen: 2200 },
  x:         { id: 'x',         label: 'X',         short: 'X',  maxLen: 280 },
  linkedin:  { id: 'linkedin',  label: 'LinkedIn',  short: 'LI', maxLen: 3000 },
}

let counter = 0
export function createPost({ text, platforms, scheduledAt }) {
  return {
    id: `post_${Date.now()}_${counter++}`,
    text, platforms, scheduledAt,
        status: STATUS.SCHEDULED, results: {}, metrics: {}, createdAt: Date.now(),
  }
}

/**
 * @typedef {Object} ScheduledPost
 * @property {string}   id
 * @property {string}   text
 * @property {string[]} platforms    platform ids this post targets
 * @property {string}   scheduledAt  ISO timestamp
 * @property {string}   status       one of STATUS
 * @property {Object}   results      per-platform publish result, keyed by platform id
 * @property {number}   createdAt
 */

export function allPlatforms() {
  return Object.values(PLATFORMS)
}
