import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { ReactNode } from "react";
import { m } from "#/i18n/paraglide/messages.js";
import type { BattleStatusStep, BattleStep } from "../types";

export function renderStepContent(step: BattleStep | null, p1Name: string, p2Name: string): ReactNode {
  if (!step) return m.battle_preparing_arena();

  switch (step.type) {
    case "use-move": {
      const attackerName = formatName(step.attackerIdx, p1Name, p2Name);
      const catLabel = step.category === "physical" ? m.battle_cat_physical() : m.battle_cat_special();
      return (
        <>
          <ParaglideMessage
            message={m.battle_use_move}
            inputs={{ attacker: attackerName, move: step.moveName.toUpperCase() }}
            markup={{ strong: ({ children }) => <strong>{children}</strong> }}
          />
          <small className="cat-tag">{catLabel}</small>
        </>
      );
    }
    case "damage": {
      const targetName = formatName(step.targetIdx, p1Name, p2Name);
      const eff = step.eff;
      const critText = step.isCrit ? m.battle_crit() : "";
      const effText =
        eff > 1.5
          ? m.battle_super_eff()
          : eff < 0.6 && eff > 0
            ? m.battle_not_very_eff()
            : eff === 0
              ? m.battle_no_effect()
              : "";
      return (
        <ParaglideMessage
          message={m.battle_damage}
          inputs={{ target: targetName, damage: String(step.damage), crit: critText, eff: effText }}
          markup={{ strong: ({ children }) => <strong>{children}</strong> }}
        />
      );
    }
    case "miss": {
      const attackerName = formatName(step.attackerIdx, p1Name, p2Name);
      return <>{m.battle_miss({ attacker: attackerName, move: step.moveName.toUpperCase() })}</>;
    }
    case "faint": {
      const faintedName = formatName(step.faintedIdx, p1Name, p2Name);
      return (
        <ParaglideMessage
          message={m.battle_faint}
          inputs={{ fainted: faintedName }}
          markup={{ strong: ({ children }) => <strong>{children}</strong> }}
        />
      );
    }
    case "start":
      return <>{m.battle_start({ p1: formatName(0, p1Name, p2Name), p2: formatName(1, p1Name, p2Name) })}</>;
    case "end": {
      const winnerName = formatName(step.winnerIdx, p1Name, p2Name);
      return <>{m.battle_end({ winner: winnerName })}</>;
    }
    case "status": {
      const attackerName = formatName(step.attackerIdx, p1Name, p2Name);
      const targetName = formatName(step.targetIdx, p1Name, p2Name);
      const moveUpper = step.moveName.toUpperCase();
      return (
        <>
          <ParaglideMessage
            message={m.battle_use_move}
            inputs={{ attacker: attackerName, move: moveUpper }}
            markup={{ strong: ({ children }) => <strong>{children}</strong> }}
          />{" "}
          <small className="cat-tag">{m.battle_cat_status()}</small> {renderStatusContent(step, targetName)}
        </>
      );
    }
    case "passive": {
      const targetName = formatName(step.targetIdx, p1Name, p2Name);
      const p = step.payload;
      switch (p.subType) {
        case "residual-damage":
          return (
            <ParaglideMessage
              message={m.battle_burn_damage}
              inputs={{ target: targetName, damage: String(p.damage) }}
              markup={{ strong: ({ children }) => <strong>{children}</strong> }}
            />
          );
        case "restriction":
          return (
            <ParaglideMessage
              message={m.battle_full_para}
              inputs={{ target: targetName }}
              markup={{ strong: ({ children }) => <strong>{children}</strong> }}
            />
          );
        default:
          return null;
      }
    }
    default:
      return null;
  }
}

function renderStatusContent(step: BattleStatusStep, targetName: string): ReactNode {
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
        <span>
          <ParaglideMessage
            message={m.battle_stat_change}
            inputs={{ stat: statName, target: targetName, direction: dir + intensity }}
            markup={{ strong: ({ children }) => <strong>{children}</strong> }}
          />
        </span>
      );
    }
    case "heal":
      return (
        <ParaglideMessage
          message={m.battle_heal}
          inputs={{ target: targetName, amount: String(p.amount) }}
          markup={{ strong: ({ children }) => <strong>{children}</strong> }}
        />
      );
    case "ailment": {
      const nameMap: Record<string, string> = { burn: "QUEMADURA", paralysis: "PARÁLISIS" };
      return (
        <ParaglideMessage
          message={m.battle_ailment}
          inputs={{ target: targetName, ailment: nameMap[p.name] || p.name }}
          markup={{ strong: ({ children }) => <strong>{children}</strong> }}
        />
      );
    }
  }
}

function formatName(index: number, name1: string, name2: string): string {
  const name = (index === 0 ? name1 : name2).toUpperCase();
  const opName = (index === 0 ? name2 : name1).toUpperCase();
  if (name === opName) {
    return `${name} (${index === 0 ? "P1" : "P2"})`;
  }
  return name;
}
