import { useState, useEffect, useCallback } from 'react'

import { API } from './api.js'
const POLL_MS = 3000

export function usePosts() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  const addPost = useCallback(async (post) => {
    setPosts((prev) => [...prev, post])           // optimistic
    try {
      await fetch(`${API}/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(post),
      })
    } catch (err) {
      console.error('Failed to save post:', err)
    }
  }, [])

  const refreshMetrics = useCallback(async () => {
    try {
      const res = await fetch(`${API}/metrics/refresh`, { method: 'POST' })
      setPosts(await res.json())
    } catch (err) {
      console.error('Failed to refresh metrics:', err)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const refresh = async () => {
      try {
        const res = await fetch(`${API}/posts`)
        const server = await res.json()
        if (cancelled) return
        setPosts((prev) => {
          // Server is source of truth; keep local-only posts still in flight.
          const ids = new Set(server.map((p) => p.id))
          const localOnly = prev.filter((p) => !ids.has(p.id))
          return [...server, ...localOnly]
        })
      } catch (err) {
        console.error('Failed to load posts:', err)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    refresh()
    const id = setInterval(refresh, POLL_MS)
    return () => { cancelled = true; clearInterval(id) }
  }, [])

  return { posts, addPost, refreshMetrics, loading }
}