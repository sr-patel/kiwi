import React from 'react';

interface SettingsCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

export function SettingsCard({ title, description, children, className = '' }: SettingsCardProps) {
  return (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 ${className}`}
    >
      {title && (
        <div className="mb-4">
          <h3 className="text-base font-semibold text-gray-900 dark:text-zinc-100">{title}</h3>
          {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

interface SettingsToggleProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  accentHex: string;
}

export function SettingsToggle({ label, description, checked, onChange, accentHex }: SettingsToggleProps) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-transparent p-3 transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0"
        style={{ accentColor: accentHex }}
      />
      <div className="min-w-0">
        <div className="font-medium text-gray-900 dark:text-zinc-100">{label}</div>
        {description && <div className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">{description}</div>}
      </div>
    </label>
  );
}

interface SettingsSliderProps {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  accentHex: string;
}

export function SettingsSlider({
  label,
  description,
  value,
  min,
  max,
  step,
  onChange,
  formatValue = (v) => String(v),
  accentHex,
}: SettingsSliderProps) {
  return (
    <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="font-medium text-gray-900 dark:text-zinc-100">{label}</div>
        {description && <div className="mt-0.5 text-sm text-gray-500 dark:text-zinc-400">{description}</div>}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value, 10))}
          className="w-28"
          style={{ accentColor: accentHex }}
        />
        <span className="min-w-[3rem] text-right text-sm font-medium tabular-nums text-gray-700 dark:text-zinc-300">
          {formatValue(value)}
        </span>
      </div>
    </div>
  );
}
