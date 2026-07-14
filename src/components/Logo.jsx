export function Mark({ size = 32, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512"
         className={className} role="img" aria-label="Cadence">
      <rect width="512" height="512" rx="143" fill="#FF5C38" />
      <path d="M96 256 L190 256 L234 150 L276 380 L322 244 L416 244"
            fill="none" stroke="#F5F7FA" strokeWidth="36"
            strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function Logo({ className = '' }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Mark size={32} />
      <span className="font-display font-medium text-xl tracking-tight text-fg">Cadence</span>
    </div>
  )
}