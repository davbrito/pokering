import { m } from "#/i18n/paraglide/messages.js";
import { cn } from "#/lib/utils.ts";
import type { BattleActionStep } from "../types";

export interface DamagePopupData {
  id: number;
  defIdx: number;
  step: BattleActionStep;
}

export function DamagePopup({ pop }: { pop: DamagePopupData }) {
  const { step } = pop;
  const isImmune = step.eff === 0;
  const isCrit = step.isCrit;

  let subtitle: string | undefined;
  let subtitleColor: string | undefined;

  if (isCrit) {
    subtitle = "¡CRÍTICO!";
    subtitleColor = "var(--gold)";
  } else if (step.eff > 1.5) {
    subtitle = "¡SÚPER EFICAZ!";
    subtitleColor = "var(--green)";
  } else if (step.eff < 0.6 && step.eff > 0) {
    subtitle = "POCO EFICAZ";
    subtitleColor = "var(--muted)";
  }

  const popDamage = isImmune ? undefined : step.damage;

  return (
    <div className={cn("damage-popup", isCrit && "crit")}>
      {isImmune ? (
        <span style={{ fontSize: 24 }}>{m.battle_immune()}</span>
      ) : (
        <>
          <span className="popup-dmg">-{popDamage}</span>
          {subtitle && (
            <span className="popup-sub" style={{ color: subtitleColor }}>
              {subtitle}
            </span>
          )}
        </>
      )}
    </div>
  );
}
