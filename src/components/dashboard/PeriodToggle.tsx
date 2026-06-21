"use client"

export interface PeriodToggleProps {
  value: '7d' | '30d'
  onChange: (p: '7d' | '30d') => void
}

export function PeriodToggle({ value, onChange }: PeriodToggleProps) {
  return (
    <div className="inline-flex rounded-lg overflow-hidden border border-white/10">
      {(['7d', '30d'] as const).map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className={`px-4 py-2 text-xs font-bold uppercase tracking-widest transition-colors ${
            value === p
              ? 'bg-primary text-white'
              : 'bg-transparent text-gray-400 hover:text-white'
          }`}
        >
          {p === '7d' ? '7 Days' : '30 Days'}
        </button>
      ))}
    </div>
  )
}
