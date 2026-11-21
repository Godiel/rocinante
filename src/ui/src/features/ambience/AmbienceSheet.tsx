import { useCallback, useEffect, useId, useRef, useState } from "react";
import { request } from "../../bridge/core";
import type { Ambience, SessionGoal, Theme } from "../../bridge/generated/protocol";
import { messageFor } from "../../app/messages";
import { sounds } from "../../audio/engine";
import { TYPING_ORDER, TYPING_SOUNDS } from "../../audio/typing-sounds";
import type { AmbientSound } from "../../audio/ambient-sounds";
import { backdropOf, paintOf, type Backdrop } from "./catalog";
import "./ambience.css";

interface AmbienceSheetProps {
  ambience: Ambience;
  /** Every background there is: the built-in ones and the writer's own images. */
  backdrops: Backdrop[];
  /** Every ambient sound there is: the built-in ones and the writer's own sounds. */
  ambients: AmbientSound[];
  /** Whether this window plays the ambient sounds; only the main one does. */
  playsAmbients: boolean;
  theme: Theme;
  origin: string;
  onClose(): void;
  onProblem(message: string | null): void;
}

/** How long a slider rests before its value is sent: dragging sends once, not at every step. */
export const SEND_DELAY_MS = 250;
/** How many ambient sounds may play at once, as the contract allows. */
export const MAX_AMBIENTS = 6;
/** The level an ambient starts at when it joins the mix. */
const DEFAULT_LEVEL = 0.7;

/** What a goal of each kind may be, as the contract allows, and what it starts at. */
const GOAL_LIMITS = {
  words: { min: 50, max: 50_000, start: 500, unit: "palabras" },
  minutes: { min: 5, max: 600, start: 45, unit: "minutos" },
} as const;

/**
 * The writer's ambience: the background behind the sheet in focus mode, the typing sound and, later,
 * the ambient sounds and the session goal. Every choice applies at once and is the writer's, in
 * every work. A volume is heard as it moves and sent when it rests.
 */
export function AmbienceSheet({
  ambience,
  backdrops,
  ambients,
  playsAmbients,
  theme,
  origin,
  onClose,
  onProblem,
}: AmbienceSheetProps) {
  const backgroundsId = useId();
  const typingId = useId();
  const ambientsId = useId();
  const focusId = useId();
  // What the sheet shows before the core has it: a slider moving, a choice on its way. The core's
  // answer comes back as new preferences, and a draft made on older ones gives way.
  const [draft, setDraft] = useState<{ base: Ambience; value: Ambience } | null>(null);
  const shown = draft?.base === ambience ? draft.value : ambience;
  const chosen = backdropOf(shown.background, backdrops).id;
  const timer = useRef<number | undefined>(undefined);
  const pending = useRef<Ambience | null>(null);

  const send = useCallback(
    (next: Ambience) =>
      request("preferences.update", { changes: { ambience: next }, origin })
        .then(() => onProblem(null))
        .catch((error: unknown) => onProblem(messageFor(error))),
    [origin, onProblem],
  );
  const latestSend = useRef(send);
  useEffect(() => {
    latestSend.current = send;
  }, [send]);

  // Closing the sheet does not lose a volume still resting.
  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (pending.current) void latestSend.current(pending.current);
    },
    [],
  );

  const change = (next: Ambience) => {
    window.clearTimeout(timer.current);
    pending.current = null;
    setDraft({ base: ambience, value: next });
    void send(next);
  };

  const changeSoon = (next: Ambience) => {
    pending.current = next;
    setDraft({ base: ambience, value: next });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      pending.current = null;
      void send(next);
    }, SEND_DELAY_MS);
  };

  // The writer hears the typing as they choose it.
  const hearTyping = (next: Ambience) => {
    sounds.setTyping(next.typing);
    sounds.play("key");
  };

  return (
    <aside
      className="sheet ambience-sheet"
      aria-label="Ambiente"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <header className="sheet-header small-caps">
        <h2 className="sheet-title">Ambiente</h2>
        <button type="button" className="action" onClick={onClose}>
          Cerrar
        </button>
      </header>

      <section aria-labelledby={backgroundsId}>
        <h3 id={backgroundsId} className="ambience-label small-caps">
          Fondo
        </h3>
        <p className="ambience-hint">Se ve detrás de la hoja en el modo concentración (F11).</p>
        <div className="ambience-backdrops" role="radiogroup" aria-labelledby={backgroundsId}>
          {backdrops.map((backdrop) => (
            <button
              key={backdrop.id}
              type="button"
              role="radio"
              aria-checked={backdrop.id === chosen}
              className="ambience-backdrop"
              onClick={() =>
                backdrop.id !== chosen && change({ ...shown, background: backdrop.id })
              }
            >
              <span
                className="ambience-swatch"
                aria-hidden="true"
                style={{ background: paintOf(backdrop, theme) ?? "var(--color-paper)" }}
              />
              <span className="ambience-name">{backdrop.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby={typingId}>
        <h3 id={typingId} className="ambience-label small-caps">
          Tecleo
        </h3>
        <div className="ambience-choices" role="radiogroup" aria-labelledby={typingId}>
          {TYPING_ORDER.map((sound) => (
            <label key={sound} className="ambience-choice">
              <input
                type="radio"
                name={`${typingId}-sound`}
                checked={shown.typing.sound === sound}
                onChange={() => {
                  const next = { ...shown, typing: { ...shown.typing, sound, muted: false } };
                  change(next);
                  hearTyping(next);
                }}
              />
              {TYPING_SOUNDS[sound].name}
            </label>
          ))}
        </div>
        <Volume
          label="Volumen del tecleo"
          value={shown.typing.volume}
          muted={shown.typing.muted}
          onChange={(volume) => {
            const next = { ...shown, typing: { ...shown.typing, volume, muted: false } };
            changeSoon(next);
            hearTyping(next);
          }}
          onMute={(muted) => {
            const next = { ...shown, typing: { ...shown.typing, muted } };
            change(next);
            if (!muted) hearTyping(next);
          }}
        />
      </section>

      <section aria-labelledby={focusId}>
        <h3 id={focusId} className="ambience-label small-caps">
          Concentración
        </h3>
        <label className="ambience-choice">
          <input
            type="checkbox"
            checked={shown.dimOthers}
            onChange={(event) => change({ ...shown, dimOthers: event.target.checked })}
          />
          Atenuar el resto: solo el párrafo donde escribes, con toda su tinta
        </label>
        <GoalField
          key={shown.goal.kind}
          goal={shown.goal}
          onKind={(kind) =>
            change({
              ...shown,
              goal: kind === "none" ? { kind } : { kind, amount: GOAL_LIMITS[kind].start },
            })
          }
          onAmount={(goal) => changeSoon({ ...shown, goal })}
        />
      </section>

      <section aria-labelledby={ambientsId}>
        <h3 id={ambientsId} className="ambience-label small-caps">
          Ambientes
        </h3>
        <p className="ambience-hint">
          {playsAmbients
            ? `Suenan en bucle. Puedes mezclar hasta ${MAX_AMBIENTS}.`
            : "Suenan en la ventana principal."}
        </p>
        <ul className="ambience-ambients">
          {ambients.map((sound) => {
            const playing = shown.ambients.find((ambient) => ambient.id === sound.id);
            const full = shown.ambients.length >= MAX_AMBIENTS;
            return (
              <li key={sound.id}>
                <label className="ambience-choice">
                  <input
                    type="checkbox"
                    checked={!!playing}
                    disabled={!playing && full}
                    onChange={(event) =>
                      change({
                        ...shown,
                        ambientMuted: event.target.checked ? false : shown.ambientMuted,
                        ambients: event.target.checked
                          ? [...shown.ambients, { id: sound.id, level: DEFAULT_LEVEL }]
                          : shown.ambients.filter((ambient) => ambient.id !== sound.id),
                      })
                    }
                  />
                  {sound.name}
                </label>
                {playing && (
                  <input
                    type="range"
                    className="ambience-level"
                    min={0}
                    max={100}
                    step={1}
                    aria-label={`Nivel de ${sound.name}`}
                    value={Math.round(playing.level * 100)}
                    onChange={(event) =>
                      changeSoon({
                        ...shown,
                        ambients: shown.ambients.map((ambient) =>
                          ambient.id === sound.id
                            ? { ...ambient, level: Number(event.target.value) / 100 }
                            : ambient,
                        ),
                      })
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
        <Volume
          label="Volumen de los ambientes"
          value={shown.ambientVolume}
          muted={shown.ambientMuted}
          onChange={(ambientVolume) => changeSoon({ ...shown, ambientVolume, ambientMuted: false })}
          onMute={(ambientMuted) => change({ ...shown, ambientMuted })}
        />
      </section>
    </aside>
  );
}

interface VolumeProps {
  label: string;
  /** From 0 to 1. */
  value: number;
  muted: boolean;
  onChange(value: number): void;
  onMute(muted: boolean): void;
}

/** A volume from 0 to 100 and its silence, which keeps the volume for when the sound comes back. */
function Volume({ label, value, muted, onChange, onMute }: VolumeProps) {
  return (
    <div className="ambience-volume">
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        aria-label={label}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
      <label className="ambience-choice">
        <input type="checkbox" checked={muted} onChange={(event) => onMute(event.target.checked)} />
        Silencio
      </label>
    </div>
  );
}

interface GoalFieldProps {
  goal: SessionGoal;
  onKind(kind: SessionGoal["kind"]): void;
  /** A valid amount the writer typed. */
  onAmount(goal: SessionGoal): void;
}

/** The goal of a session: none, a number of new words, or of minutes. */
function GoalField({ goal, onKind, onAmount }: GoalFieldProps) {
  const id = useId();
  // What the writer is typing, which may not be a valid amount yet.
  const [text, setText] = useState(goal.kind === "none" ? "" : String(goal.amount));
  const limits = goal.kind === "none" ? null : GOAL_LIMITS[goal.kind];
  const amount = Number(text);
  const valid =
    !limits || (Number.isInteger(amount) && amount >= limits.min && amount <= limits.max);
  const number = new Intl.NumberFormat("es-ES", { useGrouping: "always" });

  return (
    <fieldset className="ambience-goal">
      <legend className="ambience-goal-legend">Meta de la sesión</legend>
      <div className="ambience-choices">
        {(["none", "words", "minutes"] as const).map((kind) => (
          <label key={kind} className="ambience-choice">
            <input
              type="radio"
              name={`${id}-kind`}
              checked={goal.kind === kind}
              onChange={() => onKind(kind)}
            />
            {kind === "none"
              ? "Sin meta"
              : kind === "words"
                ? "Palabras nuevas"
                : "Minutos escribiendo"}
          </label>
        ))}
      </div>
      {limits && goal.kind !== "none" && (
        <>
          <input
            type="number"
            className="ambience-goal-amount"
            aria-label={`Meta en ${limits.unit}`}
            aria-invalid={!valid}
            aria-describedby={valid ? undefined : `${id}-problem`}
            min={limits.min}
            max={limits.max}
            step={goal.kind === "words" ? 50 : 5}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
              const next = Number(event.target.value);
              if (Number.isInteger(next) && next >= limits.min && next <= limits.max) {
                onAmount({ kind: goal.kind, amount: next });
              }
            }}
          />
          {!valid && (
            <p id={`${id}-problem`} className="ambience-problem" role="alert">
              Entre {number.format(limits.min)} y {number.format(limits.max)} {limits.unit}.
            </p>
          )}
          <p className="ambience-hint">
            Cuenta desde que entras en el modo concentración (F11) hasta que sales.
          </p>
        </>
      )}
    </fieldset>
  );
}
