import { useState, useEffect, useMemo } from 'react'
import { API } from '../core/api.js'
import { PLATFORMS } from '../core/types.js'
import TrendChart from './TrendChart.jsx'

export default function FollowerGrowth({ days }) {
  const [data, setData] = useState({ handles: {}, snapshots: [] })

  useEffect(() => {
    (async () => {
      try { setData(await (await fetch(`${API}/metrics/followers?days=${days || 365}`)).json()) }
      catch (err) { console.error('Failed to load followers:', err) }
    })()
  }, [days])

  const perAccount = useMemo(() => {
    const byConn = {}
    for (const s of data.snapshots) {
      const d = new Date(s.taken_at); d.setHours(0, 0, 0, 0)
      const key = d.getTime()
      const acc = byConn[s.conn_id] || (byConn[s.conn_id] = {})
      acc[key] = { date: d, followers: s.followers }     // later row = latest that day
    }
    return Object.entries(byConn).map(([conn_id, days]) => {
      const series = Object.values(days).sort((a, b) => a.date - b.date).map((x) => ({
        label: x.date.toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
        value: x.followers,
      }))
      const platform = conn_id.split(':')[0]
      const first = series[0]?.value ?? 0
      const last = series[series.length - 1]?.value ?? 0
      return { conn_id, handle: data.handles[conn_id] || conn_id, platform, series, delta: last - first, latest: last }
    })
  }, [data])

  if (perAccount.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-6 text-center">
        <p className="text-sm text-muted">No follower history yet. The worker samples counts every few minutes — this fills in going forward.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {perAccount.map((a) => (
        <section key={a.conn_id} className="rounded-xl border border-line bg-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">{PLATFORMS[a.platform]?.short ?? a.platform}</span>
              <span className="font-mono text-xs text-fg">{a.handle}</span>
            </div>
            <div className="flex items-baseline gap-2 font-mono">
              <span className="text-lg text-fg">{a.latest.toLocaleString()}</span>
              <span className={`text-xs ${a.delta > 0 ? 'text-emerald-400' : a.delta < 0 ? 'text-red-400' : 'text-muted'}`}>
                {a.delta > 0 ? '+' : ''}{a.delta.toLocaleString()}
              </span>
            </div>
          </div>
          <TrendChart series={a.series} height={140} />
        </section>
      ))}
    </div>
  )
}