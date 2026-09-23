"use client"

import * as React from "react"

export type DashboardRangeUnit = "days" | "months" | "years"

export interface DashboardRangeSelection {
  allTime: boolean
  value: number
  unit: DashboardRangeUnit
  compare: boolean
}

interface FlexiblePeriodControlProps {
  value: DashboardRangeSelection
  accountCreatedAt?: string | null
  onChange: (next: DashboardRangeSelection) => void
}

const PRESETS: Array<{ label: string; allTime?: boolean; value?: number; unit?: DashboardRangeUnit }> = [
  { label: "7D", value: 7, unit: "days" },
  { label: "30D", value: 30, unit: "days" },
  { label: "3M", value: 3, unit: "months" },
  { label: "1Y", value: 1, unit: "years" },
  { label: "All", allTime: true },
]

export function FlexiblePeriodControl({
  value,
  accountCreatedAt,
  onChange,
}: FlexiblePeriodControlProps) {
  const [amount, setAmount] = React.useState(String(value.value || 30))
  const [unit, setUnit] = React.useState<DashboardRangeUnit>(value.unit || "days")

  React.useEffect(() => {
    setAmount(String(value.value || 30))
    setUnit(value.unit || "days")
  }, [value.value, value.unit])

  const applyCustom = () => {
    const parsed = Math.min(Math.max(Math.floor(Number(amount) || 1), 1), 10000)
    setAmount(String(parsed))
    onChange({ allTime: false, value: parsed, unit, compare: value.compare })
  }

  const createdLabel = accountCreatedAt
    ? new Date(accountCreatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : null

  return (
    <div className="w-full sm:w-auto rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-2.5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((preset) => {
          const active = preset.allTime
            ? value.allTime
            : !value.allTime && value.value === preset.value && value.unit === preset.unit
          return (
            <button
              key={preset.label}
              type="button"
              onClick={() => onChange({
                allTime: Boolean(preset.allTime),
                value: preset.value ?? value.value,
                unit: preset.unit ?? value.unit,
                compare: value.compare,
              })}
              className={`min-h-[38px] rounded-lg px-3 text-xs font-black transition-colors ${
                active
                  ? "bg-primary text-white"
                  : "bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-primary"
              }`}
            >
              {preset.label}
            </button>
          )
        })}

        <div className="flex min-h-[38px] items-center overflow-hidden rounded-lg border border-[var(--border-default)] bg-[var(--bg-input)]">
          <input
            aria-label="Custom reporting range amount"
            type="number"
            min={1}
            max={10000}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyCustom()
            }}
            className="w-16 bg-transparent px-2.5 text-xs font-black text-[var(--text-primary)] outline-none"
          />
          <select
            aria-label="Custom reporting range unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value as DashboardRangeUnit)}
            className="h-[38px] border-l border-[var(--border-default)] bg-transparent px-2 text-xs font-bold text-[var(--text-primary)] outline-none"
          >
            <option value="days">Days</option>
            <option value="months">Months</option>
            <option value="years">Years</option>
          </select>
          <button
            type="button"
            onClick={applyCustom}
            className="h-[38px] border-l border-[var(--border-default)] px-3 text-xs font-black text-primary hover:bg-primary/10"
          >
            Apply
          </button>
        </div>

        <label className="flex min-h-[38px] cursor-pointer items-center gap-2 rounded-lg bg-[var(--bg-input)] px-3 text-xs font-bold text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={value.compare}
            onChange={(event) => onChange({ ...value, compare: event.target.checked })}
            className="h-4 w-4 accent-[var(--primary)]"
          />
          Compare previous
        </label>
      </div>

      {value.allTime && createdLabel && (
        <p className="mt-2 px-1 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          All available data since account creation: {createdLabel}
        </p>
      )}
    </div>
  )
}
