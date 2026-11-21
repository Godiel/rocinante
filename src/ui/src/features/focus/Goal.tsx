import { useEffect, useState } from "react";
import type { GoalProgress, Session } from "./useSessionGoal";

/** How long the notice of a reached goal stays. */
export const NOTICE_MS = 6000;

const number = new Intl.NumberFormat("es-ES", { useGrouping: "always" });

function unit(progress: GoalProgress) {
  return progress.kind === "words" ? "palabras" : "min";
}

/** The progress of the session, for the minimal bar: «312 / 500 palabras». */
export function GoalMeter({ progress }: { progress: GoalProgress }) {
  const share = Math.min(1, progress.done / progress.target);
  return (
    <span
      className={`focus-goal${progress.reached ? " focus-goal-reached" : ""}`}
      role="meter"
      aria-label="Meta de la sesión"
      aria-valuemin={0}
      aria-valuemax={progress.target}
      aria-valuenow={Math.min(progress.done, progress.target)}
      aria-valuetext={`${number.format(progress.done)} de ${number.format(progress.target)} ${progress.kind === "words" ? "palabras" : "minutos"}`}
    >
      <span className="focus-goal-text">
        {number.format(progress.done)} / {number.format(progress.target)} {unit(progress)}
      </span>
      <span className="focus-goal-track" aria-hidden="true">
        <span className="focus-goal-fill" style={{ width: `${share * 100}%` }} />
      </span>
    </span>
  );
}

/**
 * A quiet word when the goal is reached, once a session: no sound, no window, and the text keeps
 * the keyboard. It goes away by itself.
 */
export function GoalReached({ session, progress }: { session: Session; progress: GoalProgress }) {
  const [told, setTold] = useState<Session | null>(null);
  const showing = progress.reached && told !== session;

  useEffect(() => {
    if (!showing) return;
    const timer = window.setTimeout(() => setTold(session), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [showing, session]);

  return (
    <p className="focus-goal-notice" role="status">
      {showing &&
        (progress.kind === "words"
          ? `Meta cumplida: ${number.format(progress.target)} palabras nuevas.`
          : `Meta cumplida: ${number.format(progress.target)} minutos de escritura.`)}
    </p>
  );
}
