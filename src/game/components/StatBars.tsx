import { Progress } from "@base-ui/react";
import { clamp } from "es-toolkit/math";
import { motion } from "motion/react";
import { getStatColor, STAT_ABBR, STAT_BAR_MAX } from "../data";

export interface StatBarItem {
  name: string;
  /** Valor base: determina el ancho y el color de la barra. */
  base: number;
  /** Valor mostrado a la derecha (por defecto `base`). */
  display?: number;
}

interface StatBarsProps {
  stats: StatBarItem[];
  variant?: "card" | "preview";
}

const CLASSES = {
  card: { root: "stats", row: "srow", name: "sname", value: "sval" },
  preview: { root: "prev-stats", row: "prev-srow", name: "prev-sname", value: "text-text font-mono text-[9px]" },
} as const;

export function StatBars({ stats, variant = "card" }: StatBarsProps) {
  const cls = CLASSES[variant];
  return (
    <div className={cls.root}>
      {stats.map((s) => {
        const abbr = STAT_ABBR[s.name] || s.name.slice(0, 3).toUpperCase();
        const pct = Math.round(clamp((s.base / STAT_BAR_MAX) * 100, 0, 100));
        return (
          <Progress.Root key={s.name} className={cls.row} value={s.base} max={STAT_BAR_MAX}>
            <span className={cls.name}>{abbr}</span>
            <Progress.Track className="strack">
              <Progress.Indicator
                className="sfill"
                render={<motion.div animate={{ width: `${pct}%`, background: getStatColor(s.base) }} />}
              />
            </Progress.Track>
            <span className={cls.value}>{s.display ?? s.base}</span>
          </Progress.Root>
        );
      })}
    </div>
  );
}
