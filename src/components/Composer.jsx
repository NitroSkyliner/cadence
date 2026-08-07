import { useState, useEffect } from 'react'
import { Send, FileText, X } from 'lucide-react'
import { allPlatforms, createPost, STATUS, REPEAT } from '../core/types.js'

function nowLocalInput() {
  const d = new Date()
  d.setSeconds(0, 0)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

function isoToLocalInput(iso) {
  const d = new Date(iso)
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 16)
}

export default function Composer({ editing, onSchedule, onSaveDraft, onUpdate, onCancelEdit }) {
  const [text, setText] = useState('')
  const [selected, setSelected] = useState({})
  const [when, setWhen] = useState(nowLocalInput())
  const [repeat, setRepeat] = useState(REPEAT.NONE)

  const isEditing = Boolean(editing)

  useEffect(() => {
    if (editing) {
      setText(editing.text)
      setSelected(Object.fromEntries(editing.platforms.map((id) => [id, true])))
      setWhen(isoToLocalInput(editing.scheduledAt))
      setRepeat(editing.repeat || REPEAT.NONE)
    } else {
      setText(''); setSelected({}); setWhen(nowLocalInput()); setRepeat(REPEAT.NONE)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id])

  const platforms = allPlatforms()
  const chosen = platforms.filter((p) => selected[p.id])
  const limit = chosen.length ? Math.min(...chosen.map((p) => p.maxLen)) : null
  const over = limit != null && text.length > limit
  const hasContent = text.trim().length > 0
  const canSchedule = hasContent && chosen.length > 0 && !over
  const canDraft = hasContent && !over

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }))
  const reset = () => { setText(''); setSelected({}); setWhen(nowLocalInput()); setRepeat(REPEAT.NONE) }

  const payload = () => ({
    text: text.trim(),
    platforms: chosen.map((p) => p.id),
    scheduledAt: new Date(when).toISOString(),
    repeat,
  })

  const schedule = () => {
    if (!canSchedule) return
    if (isEditing) onUpdate(editing.id, { ...payload(), status: STATUS.SCHEDULED })
    else { onSchedule(createPost({ ...payload(), status: STATUS.SCHEDULED })); reset() }
  }

  const saveDraft = () => {
    if (!canDraft) return
    if (isEditing) onUpdate(editing.id, { ...payload(), status: STATUS.DRAFT })
    else { onSaveDraft(createPost({ ...payload(), status: STATUS.DRAFT })); reset() }
  }

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-xs tracking-wider text-muted">{isEditing ? 'EDIT POST' : 'COMPOSER'}</p>
        {isEditing && (
          <button onClick={onCancelEdit}
            className="inline-flex items-center gap-1 font-mono text-[11px] text-muted transition hover:text-fg">
            <X size={12} strokeWidth={2} /> CANCEL
          </button>
        )}
      </div>

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

      <div className="mt-4 flex items-center gap-3">
        <input type="datetime-local" value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="rounded-lg border border-line bg-elevated px-3 py-2 font-mono text-xs text-fg outline-none transition focus:border-coral [color-scheme:dark]" />
        <select value={repeat} onChange={(e) => setRepeat(e.target.value)}
          className="rounded-lg border border-line bg-elevated px-2 py-2 font-mono text-xs text-fg outline-none transition focus:border-coral [color-scheme:dark]">
          <option value="none">Once</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <span className={`ml-auto font-mono text-xs ${over ? 'text-red-400' : 'text-muted'}`}>
          {text.length}{limit != null ? ` / ${limit}` : ''}
        </span>
      </div>

      <div className="mt-4 flex gap-2">
        <button onClick={saveDraft} disabled={!canDraft}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-line px-4 py-2 text-sm text-muted transition enabled:hover:border-coral/40 enabled:hover:text-fg disabled:cursor-not-allowed disabled:opacity-40">
          <FileText size={16} strokeWidth={1.75} /> Save draft
        </button>
        <button onClick={schedule} disabled={!canSchedule}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition duration-100 enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40">
          <Send size={16} strokeWidth={2} /> {isEditing ? 'Update' : 'Schedule post'}
        </button>
      </div>
    </section>
  )
}