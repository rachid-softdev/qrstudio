"use client"

import { useId } from "react"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface ScansChartProps {
  data: { date: string; scans: number }[]
  title?: string
}

function formatDateFR(dateString: string): string {
  const d = new Date(dateString)
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function ScansChart({ data, title = "Scans des 7 derniers jours" }: ScansChartProps) {
  const chartId = useId()
  const descId = `chart-desc-${chartId}`

  if (data.length === 0) {
    return (
      <div
        className="flex h-64 items-center justify-center text-sm text-muted-foreground"
        role="img"
        aria-label={`${title} : aucune donnée`}
      >
        Aucune donnée pour cette période
      </div>
    )
  }

  const totalScans = data.reduce((sum, d) => sum + d.scans, 0)

  return (
    <figure aria-labelledby={descId}>
      <figcaption id={descId} className="sr-only">
        {title} — {data.length} jours, {totalScans} scans au total
      </figcaption>

      <ResponsiveContainer width="100%" height={256}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 8, left: -16 }}
          role="img"
          aria-label={`Graphique : ${title}`}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
            tickFormatter={(val) => {
              const d = new Date(val)
              return `${d.getDate()}/${d.getMonth() + 1}`
            }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            className="text-muted-foreground"
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              background: "var(--popover)",
              fontSize: "13px",
            }}
            labelFormatter={(label) => {
              if (typeof label !== "string") return ""
              return formatDateFR(label)
            }}
            formatter={(value) => {
              return [value ?? 0, "Scans"]
            }}
          />
          <Line
            type="monotone"
            dataKey="scans"
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Data table fallback for screen readers */}
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Scans</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.date}>
              <td>{formatDateFR(row.date)}</td>
              <td>{row.scans}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
