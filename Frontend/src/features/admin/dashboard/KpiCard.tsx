import { type LucideIcon, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { animate } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { Card } from "@/components/Card";
import { formatNumber } from "@/lib/format";

const TONES = {
  brand: "bg-brand-soft text-brand-strong",
  leaf: "bg-leaf-soft text-leaf-strong",
};

/** Nombre qui défile de son ancienne valeur vers la nouvelle quand les données changent. */
function AnimatedNumber({ value, format }: { value: number; format: (value: number) => string }) {
  const [displayed, setDisplayed] = useState(0);
  const previous = useRef(0);

  useEffect(() => {
    const controls = animate(previous.current, value, {
      duration: 0.4,
      ease: "easeOut",
      onUpdate: setDisplayed,
    });
    previous.current = value;
    return () => controls.stop();
  }, [value]);

  return format(displayed);
}

const TRENDS = {
  up: { icon: TrendingUp, className: "bg-leaf-soft text-leaf-strong" },
  down: { icon: TrendingDown, className: "bg-danger-soft text-danger" },
  flat: { icon: Minus, className: "bg-canvas text-muted" },
};

interface TrendProps {
  current: number;
  previous: number;
  /** « percent » : variation relative. « points » : écart entre deux pourcentages. */
  unit?: "percent" | "points";
}

/** Pastille d'évolution par rapport à la période précédente : sens, icône et écart. */
function Trend({ current, previous, unit = "percent" }: TrendProps) {
  const gap = current - previous;
  const { icon: Icon, className } = TRENDS[gap > 0 ? "up" : gap < 0 ? "down" : "flat"];
  const sign = gap > 0 ? "+" : gap < 0 ? "−" : "";

  let text = "Stable";
  if (unit === "points" && gap !== 0) text = `${sign}${formatNumber(Math.abs(gap))} pts`;
  else if (gap !== 0 && previous === 0) text = "Nouveau";
  else if (gap !== 0) text = `${sign}${formatNumber((Math.abs(gap) / previous) * 100)} %`;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-bold ${className}`}
    >
      <Icon className="size-3.5" aria-hidden />
      {text}
    </span>
  );
}

interface KpiCardProps {
  icon: LucideIcon;
  tone: keyof typeof TONES;
  label: string;
  value: number;
  format: (value: number) => string;
  /** Valeurs comparées dans la pastille d'évolution. */
  trend: TrendProps;
  /** Phrase courte qui précise ce que mesure l'indicateur. */
  legend: ReactNode;
}

/** Indicateur clé : une valeur, son évolution, son intitulé et sa légende. */
export function KpiCard({ icon: Icon, tone, label, value, format, trend, legend }: KpiCardProps) {
  return (
    <Card className="transition-shadow duration-200 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-11 place-items-center rounded-xl ${TONES[tone]}`}>
          <Icon className="size-5" aria-hidden />
        </span>
        <Trend {...trend} />
      </div>
      <p className="mt-5 text-sm text-muted">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">
        <AnimatedNumber value={value} format={format} />
      </p>
      <p className="mt-3 text-sm text-muted">{legend}</p>
    </Card>
  );
}
