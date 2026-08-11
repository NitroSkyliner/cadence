// export const API = 'http://localhost:8000'
export const API = import.meta.env.VITE_API_BASE ?? (import.meta.env.DEV ? 'http://localhost:8000' : '')

export async function waitForServer(tries = 20, delayMs = 400) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${API}/health`)
      if (res.ok) return true
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return false
}