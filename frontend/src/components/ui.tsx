import * as React from 'react'
import { createPortal } from 'react-dom'
import { X, ChevronDown, Check, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ Logo */

export function Logo({ className, mark = false }: { className?: string; mark?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#16202D]">
        <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
          <path d="M6 8h20v3.2H6z" fill="#fff" />
          <path d="M6 14.4h20v3.2H6z" fill="#D92D20" />
          <path d="M6 20.8h20V24H6z" fill="#fff" />
          <path d="M9.5 8v16M16 8v16M22.5 8v16" stroke="#16202D" strokeWidth="1.1" />
        </svg>
      </span>
      {!mark && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-tight">Textile CAD</span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
            Studio
          </span>
        </span>
      )}
    </span>
  )
}

/* ---------------------------------------------------------------- Button */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon'

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    'bg-accent text-white border border-accent hover:bg-accent-hover hover:border-accent-hover shadow-[0_1px_2px_rgba(16,24,40,.06)]',
  secondary:
    'bg-white text-ink border border-line hover:bg-surface-muted hover:border-line-strong',
  outline:
    'bg-transparent text-ink border border-line-strong hover:bg-white hover:border-ink/25',
  ghost: 'bg-transparent text-ink-soft border border-transparent hover:bg-black/[0.04]',
  danger:
    'bg-white text-accent border border-line hover:bg-accent-soft hover:border-accent/40',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12.5px] gap-1.5 rounded-md',
  md: 'h-9 px-3.5 text-[13px] gap-2 rounded-lg',
  lg: 'h-10 px-5 text-[13.5px] gap-2 rounded-lg',
  icon: 'size-9 rounded-lg justify-center',
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'primary', size = 'md', loading, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-55',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
})

/* ----------------------------------------------------------------- Input */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-9 w-full rounded-lg border border-line bg-white px-3 text-[13px] text-ink',
          'placeholder:text-muted/70',
          'transition-colors hover:border-line-strong focus:border-accent/60 focus:outline-none',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted',
          className,
        )}
        {...props}
      />
    )
  },
)

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-[13px] text-ink',
        'placeholder:text-muted/70 transition-colors hover:border-line-strong focus:border-accent/60 focus:outline-none',
        className,
      )}
      {...props}
    />
  )
})

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...props }, ref) {
  return (
    <span className="relative block">
      <select
        ref={ref}
        className={cn(
          'h-9 w-full appearance-none rounded-lg border border-line bg-white ps-3 pe-8 text-[13px] text-ink',
          'transition-colors hover:border-line-strong focus:border-accent/60 focus:outline-none',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </span>
  )
})

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('mb-1.5 block text-[12px] font-medium text-ink-soft', className)}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  htmlFor?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={className}>
      {label && <Label htmlFor={htmlFor}>{label}</Label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-[11.5px] text-accent">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[11.5px] text-muted">{hint}</p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ Card */

export function Card({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-[10px] border border-line bg-surface shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5',
        className,
      )}
    >
      <div className="min-w-0">
        <h3 className="truncate text-[14.5px] font-semibold leading-tight text-ink">{title}</h3>
        {subtitle && <p className="mt-1 text-[11.5px] text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

/* ----------------------------------------------------------------- Badge */

type BadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'info' | 'dark'

const badgeTones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-ink-soft border-line',
  accent: 'bg-accent-soft text-accent border-accent/20',
  success: 'bg-success-soft text-[#067647] border-[#abefc6]',
  warning: 'bg-warning-soft text-[#b54708] border-[#fedf89]',
  info: 'bg-info-soft text-[#175cd3] border-[#b2ddff]',
  dark: 'bg-[#16202D] text-white border-[#16202D]',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: React.ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4',
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ------------------------------------------------------------ Segmented */

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'sm',
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-line bg-surface-muted p-0.5',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-[6px] font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-[11.5px]' : 'h-8 px-3 text-[12.5px]',
              active
                ? 'bg-white text-ink shadow-[0_1px_2px_rgba(16,24,40,.06)]'
                : 'text-muted hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

/* ------------------------------------------------------------------ Tabs */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { value: T; label: React.ReactNode; icon?: React.ReactNode }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn('flex items-center gap-1 overflow-x-auto border-b border-line', className)}
    >
      {tabs.map((tab) => {
        const active = tab.value === value
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.value)}
            className={cn(
              'relative -mb-px inline-flex h-10 shrink-0 items-center gap-1.5 border-b-2 px-3 text-[12.5px] font-medium transition-colors',
              active
                ? 'border-accent text-ink'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------------------------------------------------------- Dialog */

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 'max-w-md',
}: {
  open: boolean
  onClose: () => void
  title: React.ReactNode
  description?: React.ReactNode
  children?: React.ReactNode
  footer?: React.ReactNode
  width?: string
}) {
  const { t } = useTranslation()
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#0b1220]/45 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cn(
          'relative w-full overflow-hidden rounded-[12px] border border-line bg-white shadow-[0_18px_48px_rgba(16,24,40,.18)] animate-fade-up',
          width,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
            {description && <p className="mt-1 text-[12px] text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-ink"
            aria-label={t('common.close', 'Close')}
          >
            <X className="size-4" />
          </button>
        </div>
        {children && <div className="px-5 py-4">{children}</div>}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-muted px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

/* ---------------------------------------------------------------- Switch */

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  description?: React.ReactNode
  disabled?: boolean
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start justify-between gap-4',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-[13px] font-medium text-ink">{label}</span>}
          {description && <span className="mt-0.5 block text-[11.5px] text-muted">{description}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-5 w-9 shrink-0 rounded-full border transition-colors',
          checked ? 'border-accent bg-accent' : 'border-line-strong bg-[#e7e7e3]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3.5 rounded-full bg-white shadow-sm transition-all',
            checked ? 'start-[18px]' : 'start-0.5',
          )}
        />
      </button>
    </label>
  )
}

/* --------------------------------------------------------------- Spinner */

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('size-4 animate-spin text-accent', className)} aria-hidden="true" />
}

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
      <Spinner className="size-5" />
      {label && <p className="text-[12.5px] text-muted">{label}</p>}
    </div>
  )
}

/* ------------------------------------------------------------ EmptyState */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-12 text-center', className)}>
      {icon && (
        <div className="mb-3 grid size-10 place-items-center rounded-full border border-line bg-surface-muted text-muted">
          {icon}
        </div>
      )}
      <p className="text-[13.5px] font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[12px] text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/* ------------------------------------------------------------ PageHeader */

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-[18px] font-semibold leading-tight tracking-[-0.01em] text-ink">{title}</h1>
        {subtitle && <p className="mt-1 text-[12.5px] text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* --------------------------------------------------------------- KpiCard */

export function KpiCard({
  label,
  value,
  hint,
  delta,
  deltaTone = 'success',
  icon,
}: {
  label: React.ReactNode
  value: React.ReactNode
  hint?: React.ReactNode
  delta?: React.ReactNode
  deltaTone?: 'success' | 'accent' | 'neutral'
  icon?: React.ReactNode
}) {
  const toneClass =
    deltaTone === 'success'
      ? 'bg-success-soft text-[#067647]'
      : deltaTone === 'accent'
        ? 'bg-accent-soft text-accent'
        : 'bg-surface-muted text-ink-soft'
  return (
    <Card className="p-3.5">
      <div className="flex items-start justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-muted">
          {icon}
          {label}
        </span>
        {delta && (
          <span className={cn('rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold', toneClass)}>
            {delta}
          </span>
        )}
      </div>
      <div className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.02em] text-ink">
        {value}
      </div>
      {hint && <div className="mt-2 text-[11px] leading-4 text-muted">{hint}</div>}
    </Card>
  )
}

/* -------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('loading-shimmer rounded-md', className)} />
}

/* ---------------------------------------------------------- ColorSwatch */

export function ColorSwatch({
  color,
  selected,
  onClick,
  label,
  size = 'md',
}: {
  color: string
  selected?: boolean
  onClick?: () => void
  label?: string
  size?: 'sm' | 'md'
}) {
  const cls = size === 'sm' ? 'size-5' : 'size-6'
  const content = (
    <span
      className={cn(
        cls,
        'block rounded-[5px] border border-black/10 transition-transform',
        selected && 'ring-2 ring-accent ring-offset-1',
      )}
      style={{ backgroundColor: color }}
    />
  )
  if (!onClick) return content
  return (
    <button type="button" onClick={onClick} title={label ?? color} aria-label={label ?? color}>
      {content}
    </button>
  )
}

/* ------------------------------------------------------------ CheckRow */

export function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-[12.5px] text-ink-soft">
      <span className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-full bg-success-soft text-[#067647]">
        <Check className="size-2.5" strokeWidth={3} />
      </span>
      {children}
    </li>
  )
}
