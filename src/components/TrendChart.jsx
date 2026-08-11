export default function TrendChart({ series, height = 160 }) {
  // series: [{ label, value }]
  if (!series || series.length < 2) {
    return <p className="py-10 text-center text-sm text-muted">Not enough history yet — the trend fills in as snapshots collect.</p>
  }
  const w = 640, h = height, pad = 28
  const max = Math.max(1, ...series.map((d) => d.value))
  const stepX = (w - pad * 2) / (series.length - 1)
  const x = (i) => pad + i * stepX
  const y = (v) => h - pad - (v / max) * (h - pad * 2)

  const line = series.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.value)}`).join(' ')
  const area = `${line} L ${x(series.length - 1)} ${h - pad} L ${x(0)} ${h - pad} Z`
  const ticks = [0, 0.5, 1].map((f) => Math.round(max * f))

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none" style={{ height }}>
      {ticks.map((t, i) => {
        const gy = y(t)
        return (
          <g key={i}>
            <line x1={pad} x2={w - pad} y1={gy} y2={gy} stroke="var(--color-line)" strokeWidth="1" />
            <text x={4} y={gy + 3} fontSize="9" fill="var(--color-muted)" fontFamily="monospace">{t}</text>
          </g>
        )
      })}
      <path d={area} fill="var(--color-coral)" opacity="0.12" />
      <path d={line} fill="none" stroke="var(--color-coral)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {series.map((d, i) => (
        (i === 0 || i === series.length - 1 || i % Math.ceil(series.length / 6) === 0) && (
          <text key={i} x={x(i)} y={h - 8} fontSize="9" fill="var(--color-muted)" fontFamily="monospace" textAnchor="middle">{d.label}</text>
        )
      ))}
    </svg>
  )
}