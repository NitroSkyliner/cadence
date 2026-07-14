import { Adapter } from './Adapter.js'

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

export class MockAdapter extends Adapter {
  async publish(post) {
    await delay(600)                          // pretend network latency
    if (Math.random() < 0.1) {                // 10% failure to exercise the error path
      return { ok: false, error: 'Mock network error' }
    }
    return { ok: true, ref: `mock_${this.platformId}_${Date.now()}` }
  }

  async fetchMetrics(ref) {
    await delay(400)
    const n = () => Math.floor(Math.random() * 500)
    return { likes: n(), reposts: n(), replies: n(), views: n() * 10 }
  }
}