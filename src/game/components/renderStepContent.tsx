import type { ReactNode } from "react";
import { m } from "#/i18n/paraglide/messages.js";
import type { BattleStep } from "../types";

export function renderStepContent(step: BattleStep | null, p1Name: string, p2Name: string): ReactNode {
  if (!step) {
    return <>{m.battle_preparing_arena()}</>;
  }
  switch (step.type) {
    case "action": {
      const attackerName = step.attackerIdx === 0 ? p1Name : p2Name;
      const aUpper = attackerName.toUpperCase();
      const moveUpper = step.moveName?.toUpperCase() ?? "";
      return (
        <>
          ¡<strong>{aUpper}</strong> usó <strong>{moveUpper}</strong>! {step.isCrit && <em>{m.battle_crit()}💥 </em>}
          {step.eff !== undefined && step.eff > 1.5 && <span className="super-eff">{m.battle_super_eff()}</span>}
          {step.eff !== undefined && step.eff < 0.6 && step.eff > 0 && <span>{m.battle_not_very_eff()}</span>}
          {step.eff === 0 && <span>{m.battle_no_effect()}</span>}
        </>
      );
    }
    case "miss": {
      const attackerName = step.attackerIdx === 0 ? p1Name : p2Name;
      return <>{m.battle_miss({ attacker: attackerName.toUpperCase(), move: step.moveName?.toUpperCase() ?? "" })}</>;
    }
    case "faint": {
      const faintedName = step.faintedIdx === 0 ? p1Name : p2Name;
      return <>{m.battle_faint({ fainted: faintedName.toUpperCase() })}</>;
    }
    case "start":
      return <>{m.battle_start({ p1: p1Name.toUpperCase(), p2: p2Name.toUpperCase() })}</>;
    case "end": {
      const winnerName = step.winnerIdx === 0 ? p1Name : p2Name;
      return <>{m.battle_end({ winner: winnerName.toUpperCase() })}</>;
    }
    default:
      return null;
  }
}
