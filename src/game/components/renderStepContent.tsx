import { ParaglideMessage } from "@inlang/paraglide-js-react";
import type { ReactNode } from "react";
import { m } from "#/i18n/paraglide/messages.js";
import { TYPE_TAB_COLORS } from "../data";
import type { BattleStatusStep, BattleStep } from "../types";

function renderAttackClassLabel(damageClass: "physical" | "special" | "status") {
  switch (damageClass) {
    case "physical":
      return m.battle_cat_physical();
    case "special":
      return m.battle_cat_special();
    case "status":
      return m.battle_cat_status();
    default:
      return `${damageClass}?`;
  }
}

export function RenderStepContent({
  step,
  p1Name,
  p2Name,
}: {
  step: BattleStep | null;
  p1Name: string;
  p2Name: string;
}): ReactNode {
  if (!step) return m.battle_preparing_arena();

  switch (step.type) {
    case "use-move": {
      const attackerName = formatName(step.attackerIdx, p1Name, p2Name);
      const catLabel = renderAttackClassLabel(step.move.damageClass);
      const typeColors = TYPE_TAB_COLORS[step.move.type as keyof typeof TYPE_TAB_COLORS];
      return (
        <>
          <ParaglideMessage
            message={m.battle_use_move}
            inputs={{ attacker: attackerName, move: step.move.name.toUpperCase() }}
            markup={{ strong: ({ children }) => <strong>{children}</strong> }}
          />{" "}
          <small className="cat-tag">{catLabel}</small>{" "}
          <small
            className="rounded-xl px-2 py-0.5 capitalize"
            style={{
              backgroundColor: typeColors.bg,
              color: typeColors.color,
              border: `1px solid ${typeColors.border}`,
            }}
          >
            {step.move.type}
          </small>
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
      return m.battle_end({ winner: winnerName });
    }
    case "status": {
      const targetName = formatName(step.targetIdx, p1Name, p2Name);
      return <RenderStatusContent step={step} targetName={targetName} />;
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

export function RenderStatusContent({ step, targetName }: { step: BattleStatusStep; targetName: string }): ReactNode {
  const payload = step.payload;

  switch (payload.subType) {
    case "stat-change": {
      const statNames: Record<string, string> = {
        atk: "Ataque",
        def: "Defensa",
        spa: "Atq. Esp.",
        spd: "Def. Esp.",
        spe: "Velocidad",
      };
      const statName = statNames[payload.stat] || payload.stat;
      const dir = payload.change > 0 ? "subió" : "bajó";
      const intensity = Math.abs(payload.change) >= 2 ? " mucho" : "";
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
          inputs={{ target: targetName, amount: String(payload.amount) }}
          markup={{ strong: ({ children }) => <strong>{children}</strong> }}
        />
      );
    case "ailment": {
      const nameMap: Record<string, string> = { burn: "QUEMADURA", paralysis: "PARÁLISIS" };
      return (
        <ParaglideMessage
          message={m.battle_ailment}
          inputs={{ target: targetName, ailment: nameMap[payload.name] || payload.name }}
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
