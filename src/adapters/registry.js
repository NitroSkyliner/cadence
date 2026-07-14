import { MockAdapter } from './MockAdapter.js'
import { PLATFORMS } from '../core/types.js'

const registry = Object.fromEntries(
  Object.keys(PLATFORMS).map((id) => [id, new MockAdapter(id)])
)

export function getAdapter(platformId) {
  const a = registry[platformId]
  if (!a) throw new Error(`No adapter registered for "${platformId}"`)
  return a
}

export function allPlatforms() {
  return Object.values(PLATFORMS)
}