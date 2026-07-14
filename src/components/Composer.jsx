import { useState } from 'react'
import { Send } from 'lucide-react'
import { allPlatforms } from '../adapters/registry.js'
import { createPost } from '../core/types.js'

// "YYYY-MM-DDTHH:mm" in LOCAL wall-clock time, for <input type="datetime-local">.
function nowLocalInput() {
  const d = new Date()
  d.setSeconds(0, 0)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default function Composer({ onSchedule }) {
  const [text, setText] = useState('')
  const [selected, setSelected] = useState({})
  const [when, setWhen] = useState(nowLocalInput())

  const platforms = allPlatforms()
  const chosen = platforms.filter((p) => selected[p.id])
  const limit = chosen.length ? Math.min(...chosen.map((p) => p.maxLen)) : null
  const over = limit != null && text.length > limit
  const canSchedule = text.trim() && chosen.length > 0 && !over

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }))

  const submit = () => {
    if (!canSchedule) return
    onSchedule(createPost({
      text: text.trim(),
      platforms: chosen.map((p) => p.id),
      scheduledAt: new Date(when).toISOString(),
    }))
    setText(''); setSelected({}); setWhen(nowLocalInput())
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <p className="mb-4 font-mono text-xs tracking-wider text-muted">COMPOSER</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your caption…"
        rows={5}
        className="w-full resize-none rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-coral"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        {platforms.map((p) => (
          <button key={p.id} onClick={() => toggle(p.id)}
            className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition
              ${selected[p.id]
                ? 'border-coral bg-coral/12 text-coral'
                : 'border-line text-muted hover:border-coral/40 hover:text-fg'}`}>
            {p.short}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <input type="datetime-local" value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="rounded-lg border border-line bg-elevated px-3 py-2 font-mono text-xs text-fg outline-none transition focus:border-coral [color-scheme:dark]" />
        <span className={`font-mono text-xs ${over ? 'text-red-400' : 'text-muted'}`}>
          {text.length}{limit != null ? ` / ${limit}` : ''}
        </span>
      </div>

      <button onClick={submit} disabled={!canSchedule}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition duration-100 enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40">
        <Send size={16} strokeWidth={2} /> Schedule post
      </button>
    </section>
  )
}