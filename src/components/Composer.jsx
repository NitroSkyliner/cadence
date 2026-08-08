import { useState, useEffect, useRef } from 'react'
import { Send, FileText, X, ImagePlus, Film, Loader2 } from 'lucide-react'
import { createPost, STATUS, REPEAT, PLATFORMS } from '../core/types.js'
import { API } from '../core/api.js'

function nowLocalInput() {
  const d = new Date(); d.setSeconds(0, 0)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
function isoToLocalInput(iso) {
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}

export default function Composer({ editing, onSchedule, onSaveDraft, onUpdate, onCancelEdit }) {
  const [text, setText] = useState('')
  const [selected, setSelected] = useState({})
  const [when, setWhen] = useState(nowLocalInput())
  const [repeat, setRepeat] = useState(REPEAT.NONE)
  const [media, setMedia] = useState([])        // [{ id, url, content_type, alt }]
  const [uploading, setUploading] = useState(false)
  const [accounts, setAccounts] = useState([])
  const imgRef = useRef(null)
  const vidRef = useRef(null)
  const isEditing = Boolean(editing)

  useEffect(() => {
    (async () => {
      try {
        const data = await (await fetch(`${API}/accounts`)).json()
        const flat = []
        for (const p of data)
          for (const c of (p.connections || []))
            flat.push({ id: c.id, handle: c.handle, platform: p.id,
              short: PLATFORMS[p.id]?.short ?? p.id, maxLen: PLATFORMS[p.id]?.maxLen ?? 500 })
        setAccounts(flat)
      } catch (err) { console.error('Failed to load accounts:', err) }
    })()
  }, [])

  useEffect(() => {
    if (editing) {
      setText(editing.text)
      setSelected(Object.fromEntries(editing.platforms.map((id) => [id, true])))
      setWhen(isoToLocalInput(editing.scheduledAt)); setRepeat(editing.repeat || REPEAT.NONE)
      ;(async () => {
        const items = await Promise.all((editing.media || []).map(async (id) => {
          try {
            const m = await (await fetch(`${API}/media/${id}/meta`)).json()
            return { id, url: `${API}/media/${id}`, content_type: m.content_type, alt: m.alt || '' }
          } catch { return { id, url: `${API}/media/${id}`, content_type: '', alt: '' } }
        }))
        setMedia(items)
      })()
    } else {
      setText(''); setSelected({}); setWhen(nowLocalInput()); setRepeat(REPEAT.NONE); setMedia([])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id])

  const chosen = accounts.filter((a) => selected[a.id])
  const limit = chosen.length ? Math.min(...chosen.map((a) => a.maxLen)) : null
  const over = limit != null && text.length > limit
  const hasContent = text.trim().length > 0
  const canSchedule = hasContent && chosen.length > 0 && !over && !uploading
  const canDraft = hasContent && !over && !uploading

  const hasVideo = media.some((m) => (m.content_type || '').startsWith('video/'))
  const imageCount = media.filter((m) => (m.content_type || '').startsWith('image/')).length
  const canAddImage = !hasVideo && imageCount < 4 && !uploading
  const canAddVideo = media.length === 0 && !uploading

  const toggle = (id) => setSelected((s) => ({ ...s, [id]: !s[id] }))
  const reset = () => { setText(''); setSelected({}); setWhen(nowLocalInput()); setRepeat(REPEAT.NONE); setMedia([]) }

  const onFiles = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = ''
    if (!files.length) return
    setUploading(true)
    try {
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file)
        const res = await fetch(`${API}/media`, { method: 'POST', body: fd })
        if (!res.ok) throw new Error('upload failed')
        const m = await res.json()
        setMedia((prev) => [...prev, { id: m.id, url: `${API}${m.url}`, content_type: m.content_type || file.type, alt: '' }])
      }
    } catch (err) { console.error('Media upload failed:', err) } finally { setUploading(false) }
  }

  const removeMedia = (id) => setMedia((prev) => prev.filter((m) => m.id !== id))
  const setAlt = (id, alt) => setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, alt } : m)))
  const saveAlt = (m) => fetch(`${API}/media/${m.id}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alt: m.alt }),
  }).catch(() => {})

  const payload = () => ({
    text: text.trim(), platforms: chosen.map((a) => a.id),
    scheduledAt: new Date(when).toISOString(), repeat, media: media.map((m) => m.id),
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

  const videoToBluesky = hasVideo && chosen.some((a) => a.platform === 'bluesky')

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="font-mono text-xs tracking-wider text-muted">{isEditing ? 'EDIT POST' : 'COMPOSER'}</p>
        {isEditing && (
          <button onClick={onCancelEdit} className="inline-flex items-center gap-1 font-mono text-[11px] text-muted transition hover:text-fg">
            <X size={12} strokeWidth={2} /> CANCEL
          </button>
        )}
      </div>

      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your caption…" rows={5}
        className="w-full resize-none rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-fg placeholder:text-muted outline-none transition focus:border-coral" />

      {media.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {media.map((m) => (
            <div key={m.id} className="flex items-start gap-3 rounded-lg border border-line bg-elevated p-2">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-line">
                {(m.content_type || '').startsWith('video/')
                  ? <video src={m.url} className="h-full w-full object-cover" muted />
                  : <img src={m.url} alt="" className="h-full w-full object-cover" />}
              </div>
              <input value={m.alt} onChange={(e) => setAlt(m.id, e.target.value)} onBlur={() => saveAlt(m)}
                placeholder="Alt text (accessibility)…"
                className="mt-1 flex-1 rounded-md border border-line bg-ink px-2 py-1.5 text-xs text-fg placeholder:text-muted outline-none transition focus:border-coral" />
              <button onClick={() => removeMedia(m.id)} className="mt-1 grid h-6 w-6 place-items-center rounded text-muted transition hover:text-red-400">
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          ))}
        </div>
      )}

      {videoToBluesky && (
        <p className="mt-2 font-mono text-[11px] text-muted">Bluesky video needs a verified-email account and has daily limits; processing may take a moment before it publishes.</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {accounts.length === 0 && <span className="font-mono text-[11px] text-muted">No accounts connected — see Accounts.</span>}
        {accounts.map((a) => (
          <button key={a.id} onClick={() => toggle(a.id)}
            className={`rounded-lg border px-2.5 py-1 font-mono text-xs transition ${selected[a.id] ? 'border-coral bg-coral/12 text-coral' : 'border-line text-muted hover:border-coral/40 hover:text-fg'}`}>
            {a.short}·{a.handle.replace(/^@/, '').split('.')[0].slice(0, 10)}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => imgRef.current?.click()} disabled={!canAddImage}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-mono text-xs text-muted transition enabled:hover:border-coral/40 enabled:hover:text-fg disabled:opacity-40">
            {uploading ? <Loader2 size={14} strokeWidth={1.75} className="animate-spin" /> : <ImagePlus size={14} strokeWidth={1.75} />} IMAGE
          </button>
          <button onClick={() => vidRef.current?.click()} disabled={!canAddVideo}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-mono text-xs text-muted transition enabled:hover:border-coral/40 enabled:hover:text-fg disabled:opacity-40">
            <Film size={14} strokeWidth={1.75} /> VIDEO
          </button>
        </div>
        <input ref={imgRef} type="file" accept="image/*" multiple onChange={onFiles} className="hidden" />
        <input ref={vidRef} type="file" accept="video/*" onChange={onFiles} className="hidden" />
      </div>

      <div className="mt-4 flex items-center gap-3">
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
          className="rounded-lg border border-line bg-elevated px-3 py-2 font-mono text-xs text-fg outline-none transition focus:border-coral [color-scheme:dark]" />
        <select value={repeat} onChange={(e) => setRepeat(e.target.value)}
          className="rounded-lg border border-line bg-elevated px-2 py-2 font-mono text-xs text-fg outline-none transition focus:border-coral [color-scheme:dark]">
          <option value="none">Once</option><option value="daily">Daily</option>
          <option value="weekly">Weekly</option><option value="monthly">Monthly</option>
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