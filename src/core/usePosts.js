import { useState, useEffect, useRef, useCallback } from 'react'
import { STATUS } from './types.js'
import { getAdapter } from '../adapters/registry.js'

export function usePosts() {
  const [posts, setPosts] = useState([])

  // A ref mirror so async/interval code can read current posts without stale closures.
  const postsRef = useRef(posts)
  useEffect(() => { postsRef.current = posts }, [posts])

  const patchPost = useCallback((id, changes) => {
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)))
  }, [])

  const addPost = useCallback((post) => {
    setPosts((prev) => [...prev, post])
  }, [])

  // Run one post through ALL its platform adapters, threading it through the lifecycle.
  const publishPost = useCallback(async (id) => {
    const post = postsRef.current.find((p) => p.id === id)
    if (!post || post.status === STATUS.PUBLISHING || post.status === STATUS.PUBLISHED) return

    patchPost(id, { status: STATUS.PUBLISHING })

    const results = {}
    for (const platformId of post.platforms) {
      try {
        results[platformId] = await getAdapter(platformId).publish(post)
      } catch (err) {
        results[platformId] = { ok: false, error: err.message }
      }
    }

    const allOk = Object.values(results).every((r) => r.ok)
    patchPost(id, { status: allOk ? STATUS.PUBLISHED : STATUS.FAILED, results })
  }, [patchPost])

  // Client-side due-checker: fires posts whose time has arrived.
  // This is a STAND-IN for Phase 3's real always-on backend worker — it only
  // runs while the app is open. Same lifecycle, throwaway trigger.
  useEffect(() => {
    const tick = setInterval(() => {
      const now = Date.now()
      for (const p of postsRef.current) {
        if (p.status === STATUS.SCHEDULED && new Date(p.scheduledAt).getTime() <= now) {
          publishPost(p.id)
        }
      }
    }, 3000)
    return () => clearInterval(tick)
  }, [publishPost])

  return { posts, addPost, publishPost }
}