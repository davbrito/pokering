import type { ReactNode } from "react";
import type { BattleStep } from "../types";

export function renderStepContent(
  step: BattleStep | null,
  p1Name: string,
  p2Name: string,
): ReactNode {
  if (!step) {
    return <>Preparando la arena de combate...</>;
  }
  switch (step.type) {
    case "action": {
      const attackerName = step.attackerIdx === 0 ? p1Name : p2Name;
      return (
        <>
          ¡<strong>{attackerName.toUpperCase()}</strong> usó{" "}
          <strong>{step.moveName?.toUpperCase()}</strong>!{" "}
          {step.isCrit && <em>¡Impacto Crítico! 💥 </em>}
          {step.eff !== undefined && step.eff > 1.5 && (
            <span className="super-eff">¡Es súper eficaz! </span>
          )}
          {step.eff !== undefined && step.eff < 0.6 && step.eff > 0 && (
            <span>No es muy eficaz... </span>
          )}
          {step.eff === 0 && <span>¡No le afecta en absoluto! </span>}
        </>
      );
    }
    case "faint": {
      const faintedName = step.faintedIdx === 0 ? p1Name : p2Name;
      return (
        <>
          El oponente <strong>{faintedName.toUpperCase()}</strong> se ha
          desplomado agotado! 😵
        </>
      );
    }
    case "start":
      return (
        <>
          ¡Comienza el duelo de exhibición!{" "}
          <strong>{p1Name.toUpperCase()}</strong> se enfrenta a{" "}
          <strong>{p2Name.toUpperCase()}</strong> en la arena.
        </>
      );
    case "end": {
      const winnerName = step.winnerIdx === 0 ? p1Name : p2Name;
      return (
        <>
          🏆 ¡El combate ha terminado! El absoluto ganador de la contienda es{" "}
          <strong>{winnerName.toUpperCase()}</strong>.
        </>
      );
    }
    default:
      return null;
  }
}
