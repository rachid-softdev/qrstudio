import { randomInt } from "crypto"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const MONTHS_FR = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
] as const

export function formatDate(date: Date): string {
  const d = new Date(date)
  const day = d.getDate()
  const month = MONTHS_FR[d.getMonth()]
  const year = d.getFullYear()
  return `${day} ${month} ${year}`
}

export function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

export function truncate(str: string, max: number): string {
  if (str.length <= max) return str
  return str.slice(0, max - 3) + "..."
}

const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789"

function getRandomInt(max: number): number {
  return randomInt(0, max)
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function generateShortCode(length = 6): string {
  let result = ""
  for (let i = 0; i < length; i++) {
    result += CHARS.charAt(getRandomInt(CHARS.length))
  }
  return result
}
