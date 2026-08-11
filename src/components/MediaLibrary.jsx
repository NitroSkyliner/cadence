import { useState, useEffect, useCallback } from 'react'
import { Trash2, Check, X, Film } from 'lucide-react'
import { API } from '../core/api.js'

function useLibrary() {
  const [items, setItems] = useState([])
  const load = useCallback(async () => {
    try { setItems(await (await fetch(`${API}/media`)).json()) }
    catch (err) { console.error('Failed to load media:', err) }
  }, [])
  useEffect(() => { load() }, [load])
  const remove = useCallback(async (id) => {
    await fetch(`${API}/media/${id}`, { method: 'DELETE' })
    await load()
  }, [load])
  return { items, reload: load, remove }
}

function Thumb({ m, children, onClick, selected }) {
  const isVideo = (m.content_type || '').startsWith('video/')
  return (
    <div onClick={onClick}
      className={`group relative aspect-square overflow-hidden rounded-lg border transition ${selected ? 'border-coral' : 'border-line'} ${onClick ? 'cursor-pointer hover:border-coral/40' : ''}`}>
      {isVideo
        ? <video src={`${API}/media/${m.id}`} className="h-full w-full object-cover" muted />
        : <img src={`${API}/media/${m.id}`} alt={m.alt || ''} className="h-full w-full object-cover" />}
      {isVideo && <Film size={14} strokeWidth={1.75} className="absolute left-1.5 top-1.5 text-white/80" />}
      {children}
    </div>
  )
}

// Standalone management view
export default function MediaLibrary() {
  const { items, remove } = useLibrary()
  return (
    <div className="mx-auto max-w-4xl">
      <p className="mb-4 font-mono text-xs tracking-wider text-muted">MEDIA LIBRARY · {items.length}</p>
      {items.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted">No media yet. Attach images or video in the composer and they'll collect here.</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
          {items.map((m) => (
            <Thumb key={m.id} m={m}>
              <button onClick={() => remove(m.id)}
                className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded bg-ink/80 text-muted opacity-0 transition hover:text-red-400 group-hover:opacity-100">
                <Trash2 size={13} strokeWidth={1.75} />
              </button>
            </Thumb>
          ))}
        </div>
      )}
    </div>
  )
}

// Modal picker used by the composer
export function MediaPicker({ onPick, onClose, disabledIds = [] }) {
  const { items } = useLibrary()
  const [sel, setSel] = useState({})
  const toggle = (id) => setSel((s) => ({ ...s, [id]: !s[id] }))
  const chosen = items.filter((m) => sel[m.id])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-6" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-surface p-5">
        <div className="mb-4 flex items-center justify-between">
          <p className="font-mono text-xs tracking-wider text-muted">PICK FROM LIBRARY</p>
          <button onClick={onClose} className="text-muted transition hover:text-fg"><X size={16} strokeWidth={2} /></button>
        </div>
        {items.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Library is empty — upload from the composer first.</p>
        ) : (
          <div className="grid grid-cols-4 gap-3 overflow-y-auto">
            {items.map((m) => {
              const disabled = disabledIds.includes(m.id)
              return (
                <Thumb key={m.id} m={m} selected={sel[m.id]} onClick={() => !disabled && toggle(m.id)}>
                  {disabled && <span className="absolute inset-0 grid place-items-center bg-ink/60 font-mono text-[10px] text-muted">added</span>}
                  {sel[m.id] && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-coral text-white"><Check size={12} strokeWidth={3} /></span>}
                </Thumb>
              )
            })}
          </div>
        )}
        <div className="mt-4 flex justify-end">
          <button onClick={() => { onPick(chosen); onClose() }} disabled={chosen.length === 0}
            className="rounded-lg bg-coral px-4 py-2 text-sm font-medium text-white transition duration-100 enabled:hover:-translate-y-1 disabled:cursor-not-allowed disabled:opacity-40">
            Add {chosen.length || ''} selected
          </button>
        </div>
      </div>
    </div>
  )
}