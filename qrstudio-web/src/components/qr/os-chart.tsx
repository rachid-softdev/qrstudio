"use client"

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface OSChartProps {
  data: { os: string; scans: number }[]
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

const OS_LABELS: Record<string, string> = {
  ios: "iOS",
  android: "Android",
  windows: "Windows",
  macOS: "macOS",
  "Mac OS": "macOS",
  other: "Autre",
}

export function OSChart({ data }: OSChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex h-48 items-center justify-center text-sm text-muted-foreground"
        role="img"
        aria-label="Aucune donnée de système d'exploitation"
      >
        Aucune donnée de système d&apos;exploitation
      </div>
    )
  }

  const chartData = data.map((d) => ({
    name: OS_LABELS[d.os.toLowerCase()] ?? d.os,
    value: d.scans,
  }))

  return (
    <figure aria-label="Répartition par système d'exploitation">
      <figcaption className="sr-only">
        Systèmes d&apos;exploitation : {chartData.map(d => `${d.name}: ${d.value} scans`).join(", ")}
      </figcaption>
      <ResponsiveContainer width="100%" height={192}>
        <PieChart role="img" aria-label="Graphique en camembert de la répartition par OS">
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          innerRadius={40}
          outerRadius={72}
          paddingAngle={2}
          dataKey="value"
        >
          {chartData.map((_, index) => (
            <Cell
              key={`os-cell-${String(index)}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "var(--popover)",
            fontSize: "13px",
          }}
          formatter={(value) => {
            return [value ?? 0, "Scans"]
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
        />
      </PieChart>
    </ResponsiveContainer>
    </figure>
  )
}
