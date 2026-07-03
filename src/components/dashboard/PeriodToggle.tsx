"use client"

export interface PeriodToggleProps {
  value: '7d' | '30d'
  onChange: (p: '7d' | '30d') => void
}

export function PeriodToggle({ value, onChange }: PeriodToggleProps) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border-default)' }}>
      {(['7d', '30d'] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
            value === p
              ? 'bg-primary text-white'
              : 'bg-transparent hover:text-primary dark:hover:text-white'
          }`}
          style={value !== p ? { color: 'var(--text-muted)' } : undefined}
        >
          {p === '7d' ? '7 Days' : '30 Days'}
        </button>
      ))}
    </div>
  )
}
