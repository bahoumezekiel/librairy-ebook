import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { DailyRevenue } from "@/api/types";
import { Card, CardHeader } from "@/components/Card";
import { formatCompact, formatMoney, formatShortDay } from "@/lib/format";

// Couleurs de la charte, reprises ici car Recharts dessine en SVG.
const BRAND = "#ff7f00";
const LINE = "#e2e6ee";
const CANVAS = "#f6f7fb";
const AXIS_TICK = { fill: "#55627d", fontSize: 12 };

function DayTooltip({ active, payload }: { active?: boolean; payload?: { payload: DailyRevenue }[] }) {
  const day = active && payload?.[0]?.payload;
  if (!day) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3 shadow-card">
      <p className="text-xs text-muted">{formatShortDay(day.date)}</p>
      <p className="mt-1 text-sm font-bold">{formatMoney(day.revenue)}</p>
      <p className="text-xs text-muted">
        {day.orders} {day.orders > 1 ? "ventes" : "vente"}
      </p>
    </div>
  );
}

interface RevenueChartProps {
  days: DailyRevenue[];
  periodTotal: number;
}

/**
 * Chiffre d'affaires encaissé jour par jour.
 * Une barre par jour : un jour sans vente reste visiblement vide.
 */
export function RevenueChart({ days, periodTotal }: RevenueChartProps) {
  return (
    <Card>
      <CardHeader
        title="Chiffre d'affaires par jour"
        legend={
          <span className="flex items-start gap-2">
            <span className="mt-1.5 size-2.5 shrink-0 rounded-sm bg-brand" aria-hidden />
            Montant encaissé chaque jour, en FCFA, sur les {days.length} derniers jours
          </span>
        }
        aside={
          <div className="shrink-0 text-right">
            <p className="text-xs text-muted">Total de la période</p>
            <p className="text-lg font-bold text-brand-strong">{formatMoney(periodTotal)}</p>
          </div>
        }
      />
      <div className="h-72" role="img" aria-label="Chiffre d'affaires encaissé par jour">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={days} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke={LINE} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDay}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: LINE }}
              tickMargin={12}
              minTickGap={40}
            />
            <YAxis
              tickFormatter={formatCompact}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={48}
              allowDecimals={false}
            />
            <Tooltip content={<DayTooltip />} cursor={{ fill: CANVAS }} />
            <Bar
              dataKey="revenue"
              fill={BRAND}
              radius={[4, 4, 0, 0]}
              maxBarSize={28}
              animationDuration={400}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
