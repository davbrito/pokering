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
      const moveUpper = step.moveName.toUpperCase();
      const catLabel = step.category === "physical" ? "FÍSICO" : "ESPECIAL";
      return (
        <>
          ¡<strong>{aUpper}</strong> usó <strong>{moveUpper}</strong>
          <small className="cat-tag">{catLabel}</small>! {step.isCrit && <em>{m.battle_crit()}💥 </em>}
          {step.eff > 1.5 && <span className="super-eff">{m.battle_super_eff()}</span>}
          {step.eff < 0.6 && step.eff > 0 && <span>{m.battle_not_very_eff()}</span>}
          {step.eff === 0 && <span>{m.battle_no_effect()}</span>}
        </>
      );
    }
    case "miss": {
      const attackerName = step.attackerIdx === 0 ? p1Name : p2Name;
      return <>{m.battle_miss({ attacker: attackerName.toUpperCase(), move: step.moveName.toUpperCase() })}</>;
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
    case "status": {
      const targetName = step.targetIdx === 0 ? p1Name : p2Name;
      const p = step.payload;
      switch (p.subType) {
        case "stat-change": {
          const statNames: Record<string, string> = {
            atk: "Ataque",
            def: "Defensa",
            spa: "Atq. Esp.",
            spd: "Def. Esp.",
            spe: "Velocidad",
          };
          const statName = statNames[p.stat] || p.stat;
          const dir = p.change > 0 ? "subió" : "bajó";
          const intensity = Math.abs(p.change) >= 2 ? " mucho" : "";
          return (
            <>
              <small className="cat-tag">STATUS</small>{" "}
              {`¡La ${statName} de ${targetName.toUpperCase()} ${dir}${intensity}!`}
            </>
          );
        }
        case "heal":
          return (
            <>
              <small className="cat-tag">STATUS</small> ¡<strong>{targetName.toUpperCase()}</strong> recuperó{" "}
              <strong>+{p.amount}</strong> PS!
            </>
          );
        case "ailment": {
          const nameMap: Record<string, string> = { burn: "QUEMADURA", paralysis: "PARÁLISIS" };
          return (
            <>
              <small className="cat-tag">STATUS</small> ¡<strong>{targetName.toUpperCase()}</strong> fue afectadx por{" "}
              <strong>{nameMap[p.name] || p.name}</strong>!
            </>
          );
        }
      }
      break;
    }
    case "passive": {
      const targetName = step.targetIdx === 0 ? p1Name : p2Name;
      const p = step.payload;
      switch (p.subType) {
        case "residual-damage":
          return (
            <>
              <strong>{targetName.toUpperCase()}</strong> sufre daño por su quemadura: <strong>-{p.damage}</strong> PS
            </>
          );
        case "restriction":
          return <>{targetName.toUpperCase()} está totalmente paralizadx y no pudo moverse.</>;
      }
      break;
    }
    default:
      return null;
  }
}
