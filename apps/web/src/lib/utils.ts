import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, fmt = 'MMM d, yyyy') {
  return format(new Date(date), fmt)
}

export function formatDateTime(date: string | Date) {
  return format(new Date(date), 'MMM d, yyyy h:mm a')
}

export function timeAgo(date: string | Date) {
  return formatDistanceToNow(new Date(date), { addSuffix: true })
}

export function formatCurrency(amount: number, currency = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('en-IN').format(n)
}

export function truncate(str: string, length: number) {
  return str.length > length ? str.slice(0, length) + '…' : str
}

export function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const statusColors: Record<string, string> = {
  active: 'text-green-400 bg-green-400/10',
  draft: 'text-yellow-400 bg-yellow-400/10',
  completed: 'text-blue-400 bg-blue-400/10',
  archived: 'text-gray-400 bg-gray-400/10',
  cancelled: 'text-red-400 bg-red-400/10',
  confirmed: 'text-green-400 bg-green-400/10',
  pending: 'text-yellow-400 bg-yellow-400/10',
  overdue: 'text-red-400 bg-red-400/10',
}
