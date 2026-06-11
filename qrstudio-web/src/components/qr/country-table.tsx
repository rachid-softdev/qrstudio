"use client"

interface CountryTableProps {
  data: { country: string; scans: number }[]
}

function getFlagEmoji(country: string): string {
  if (country === "Inconnu" || country === "Unknown") return "🌍"
  const codePoints = country
    .toUpperCase()
    .split("")
    .map((char) => 127397 + char.charCodeAt(0))
  if (codePoints.length !== 2) return "🌍"
  return String.fromCodePoint(...codePoints)
}

export function CountryTable({ data }: CountryTableProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex h-32 items-center justify-center text-sm text-muted-foreground"
        role="img"
        aria-label="Aucune donnée de localisation"
      >
        Aucune donnée de localisation
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => b.scans - a.scans).slice(0, 10)

  return (
    <div className="space-y-1" role="list" aria-label="Top 10 pays par nombre de scans">
      {sorted.map((row) => (
        <div
          key={row.country}
          className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-muted/50"
          role="listitem"
        >
          <div className="flex items-center gap-2">
            <span className="text-base" aria-hidden="true">{getFlagEmoji(row.country)}</span>
            <span>{row.country}</span>
          </div>
          <span className="font-medium tabular-nums">{row.scans} scan{row.scans !== 1 ? "s" : ""}</span>
        </div>
      ))}
    </div>
  )
}
