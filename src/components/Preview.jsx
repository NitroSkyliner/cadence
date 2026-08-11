import { MessageCircle } from 'lucide-react'

function MediaGrid({ media }) {
  if (!media?.length) return null
  const isVideo = (m) => (m.content_type || '').startsWith('video/')
  if (media.length === 1) {
    const m = media[0]
    return (
      <div className="mt-2 overflow-hidden rounded-lg border border-line">
        {isVideo(m)
          ? <video src={m.url} className="max-h-72 w-full object-cover" muted controls />
          : <img src={m.url} alt="" className="max-h-72 w-full object-cover" />}
      </div>
    )
  }
  return (
    <div className="mt-2 grid grid-cols-2 gap-1 overflow-hidden rounded-lg">
      {media.slice(0, 4).map((m, i) => (
        <div key={i} className="aspect-square overflow-hidden border border-line">
          {isVideo(m)
            ? <video src={m.url} className="h-full w-full object-cover" muted />
            : <img src={m.url} alt="" className="h-full w-full object-cover" />}
        </div>
      ))}
    </div>
  )
}

function Avatar({ label }) {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-elevated font-mono text-xs text-muted">
      {(label || '?')[0].toUpperCase()}
    </div>
  )
}

function PostCard({ handle, text, media, isReply }) {
  return (
    <div className={`rounded-xl border border-line bg-ink p-3 ${isReply ? 'ml-4' : ''}`}>
      <div className="flex items-center gap-2">
        <Avatar label={handle} />
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-fg">{handle}</div>
          <div className="font-mono text-[10px] text-muted">now</div>
        </div>
      </div>
      {text && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-fg">{text}</p>}
      <MediaGrid media={media} />
    </div>
  )
}

export default function Preview({ renders }) {
  if (!renders?.length) return null
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="mb-3 font-mono text-xs tracking-wider text-muted">PREVIEW</p>
      <div className="flex flex-col gap-5">
        {renders.map((r) => (
          <div key={r.platform}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="rounded bg-elevated px-1.5 py-0.5 font-mono text-[10px] text-muted">{r.short}</span>
              <span className="font-mono text-[11px] text-muted">{r.label}</span>
              {r.over && <span className="font-mono text-[10px] text-red-400">exceeds {r.charLimit} chars</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <PostCard handle={r.handle} text={r.text} media={r.media} />
              {r.thread.map((seg, i) => (
                <PostCard key={i} handle={r.handle} text={seg} media={[]} isReply />
              ))}
              {r.firstComment && (
                <div className="ml-4 flex items-start gap-2 rounded-xl border border-line bg-ink p-3">
                  <MessageCircle size={13} strokeWidth={1.75} className="mt-0.5 shrink-0 text-muted" />
                  <p className="whitespace-pre-wrap break-words text-sm text-muted">{r.firstComment}</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}