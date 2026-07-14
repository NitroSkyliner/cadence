import StatusPill from './StatusPill.jsx'
import { PLATFORMS } from '../core/types.js'

function fmtTime(iso) {
  const d = new Date(iso)
  const day = d.toLocaleDateString(undefined, { weekday: 'short' })
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day} ${time}`
}

export default function Queue({ posts }) {
  const sorted = [...posts].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt))

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <p className="mb-4 font-mono text-xs tracking-wider text-muted">
        QUEUE · {posts.length} {posts.length === 1 ? 'POST' : 'POSTS'}
      </p>

      {sorted.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">Nothing queued yet. Compose your first post.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((post) => (
            <li key={post.id}
              className="flex items-center gap-3 rounded-lg border border-line bg-elevated px-3 py-2.5">
              <span className="w-24 shrink-0 font-mono text-xs text-muted">{fmtTime(post.scheduledAt)}</span>
              <span className="flex-1 truncate text-sm text-fg">{post.text}</span>
              <span className="flex shrink-0 gap-1">
                {post.platforms.map((id) => (
                  <span key={id} className="rounded bg-ink px-1.5 py-0.5 font-mono text-[10px] text-muted">
                    {PLATFORMS[id]?.short ?? id}
                  </span>
                ))}
              </span>
              <StatusPill status={post.status} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}