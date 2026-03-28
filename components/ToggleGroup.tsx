'use client'

// Reusable pill toggle — renders a group of options as a segmented control.
// Active option gets brand-red fill; inactive is transparent with muted text.
// Input: options (label+value pairs), value (selected), onChange (callback)

interface ToggleGroupProps {
  options: { label: string; value: string }[]
  value: string
  onChange: (value: string) => void
}

export default function ToggleGroup({ options, value, onChange }: ToggleGroupProps) {
  return (
    <div className="inline-flex bg-[#EBEBEB] rounded-pill p-[3px] gap-0.5">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={
            option.value === value
              ? 'bg-[var(--rebil-red)] text-white rounded-pill text-xs font-medium px-3.5 py-1'
              : 'bg-transparent text-text-muted rounded-pill text-xs font-medium px-3.5 py-1'
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
