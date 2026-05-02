import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  loading?: boolean
  variant?: ButtonVariant
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-[#1565ff] text-white shadow-lg shadow-[#1565ff]/20 hover:bg-[#0a3dbf] focus-visible:outline-[#1565ff]',
  secondary:
    'bg-white text-slate-900 ring-1 ring-slate-200 hover:bg-slate-50 focus-visible:outline-slate-400',
  ghost:
    'bg-transparent text-slate-700 hover:bg-white/70 focus-visible:outline-slate-400',
}

export function Button({
  children,
  className = '',
  loading = false,
  variant = 'primary',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? 'Please wait...' : children}
    </button>
  )
}