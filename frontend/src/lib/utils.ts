import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { Locale } from './types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatNumber(value: number, locale: Locale, maximumFractionDigits = 0) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0)
}

export function formatDate(value: string | Date, locale: Locale) {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(value: string | Date, locale: Locale) {
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-EG-u-nu-latn' : 'en-US', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean
  const num = Number.parseInt(full, 16)
  if (Number.isNaN(num)) return [255, 255, 255]
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

export function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value)
}

export function hslToHex(h: number, s: number, l: number) {
  const sat = s / 100
  const light = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(light, 1 - light)
  const f = (n: number) =>
    Math.round(255 * (light - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))))
  const toHex = (n: number) => n.toString(16).padStart(2, '0')
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`.toUpperCase()
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
