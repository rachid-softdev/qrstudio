"use client"

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface DeviceChartProps {
  data: { device: string; scans: number }[]
}

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)"]

const DEVICE_LABELS: Record<string, string> = {
  mobile: "Mobile",
  tablet: "Tablette",
  desktop: "Desktop",
}

export function DeviceChart({ data }: DeviceChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex h-48 items-center justify-center text-sm text-muted-foreground"
        role="img"
        aria-label="Aucune donnée d'appareil"
      >
        Aucune donnée d&apos;appareil
      </div>
    )
  }

  const chartData = data.map((d) => ({
    name: DEVICE_LABELS[d.device] ?? d.device,
    value: d.scans,
  }))

  const totalScans = chartData.reduce((sum, d) => sum + d.value, 0)

  return (
    <figure aria-label="Répartition par appareil">
      <figcaption className="sr-only">
        Répartition des appareils : {chartData.map(d => `${d.name}: ${d.value} scans`).join(", ")}
      </figcaption>
      <ResponsiveContainer width="100%" height={192}>
        <PieChart role="img" aria-label="Graphique en camembert de la répartition par appareil">
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
              key={`device-cell-${String(index)}`}
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
