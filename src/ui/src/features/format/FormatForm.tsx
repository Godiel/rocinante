import { useEffect, useId, useRef, useState } from "react";
import type { PageSize, Typeface, WorkFormat } from "../../bridge/generated/protocol";
import { TYPEFACE_ORDER, TYPEFACES } from "../../design/typefaces";
import {
  PAGE_SIZE_ORDER,
  PAGE_SIZES,
  shown,
  shownNumber,
  typed,
  typedNumber,
  type Unit,
} from "./page-sizes";
import { problemsOf, type FormatField, type Problems } from "./rules";
import "./format.css";

type Measure = "pageWidth" | "pageHeight" | "top" | "bottom" | "inside" | "outside";
type NumberField = Measure | "bodySize" | "leading";
type Texts = Record<NumberField, string>;

function textsOf(format: WorkFormat, unit: Unit): Texts {
  return {
    pageWidth: shown(format.pageWidth, unit),
    pageHeight: shown(format.pageHeight, unit),
    top: shown(format.margins.top, unit),
    bottom: shown(format.margins.bottom, unit),
    inside: shown(format.margins.inside, unit),
    outside: shown(format.margins.outside, unit),
    bodySize: shownNumber(format.bodySize),
    leading: shownNumber(format.leading),
  };
}

function unitOf(format: WorkFormat): Unit {
  return format.pageSize === "custom" ? "cm" : PAGE_SIZES[format.pageSize].unit;
}

/** The format as typed so far, and what is wrong with it. */
function read(
  base: WorkFormat,
  texts: Texts,
  unit: Unit,
): { format: WorkFormat; problems: Problems } {
  const problems: Problems = {};
  // A field the writer did not touch keeps its exact value: 19 mm are «0,75» in, not 19,05 mm.
  const measure = (field: Measure, fallback: number) => {
    if (texts[field] === shown(fallback, unit)) return fallback;
    const value = typed(texts[field], unit);
    if (value === null) problems[field] = "Escribe un número.";
    return value ?? fallback;
  };
  const plain = (field: "bodySize" | "leading", fallback: number) => {
    if (texts[field] === shownNumber(fallback)) return fallback;
    const value = typedNumber(texts[field]);
    if (value === null) problems[field] = "Escribe un número.";
    return value ?? fallback;
  };
  const format: WorkFormat = {
    ...base,
    pageWidth: measure("pageWidth", base.pageWidth),
    pageHeight: measure("pageHeight", base.pageHeight),
    margins: {
      top: measure("top", base.margins.top),
      bottom: measure("bottom", base.margins.bottom),
      inside: measure("inside", base.margins.inside),
      outside: measure("outside", base.margins.outside),
    },
    bodySize: plain("bodySize", base.bodySize),
    leading: plain("leading", base.leading),
  };
  return { format, problems: { ...problemsOf(format, unit), ...problems } };
}

export interface FormatFormProps {
  value: WorkFormat;
  /** Called with every change that the core would accept; a change with problems waits. */
  onChange(format: WorkFormat): void;
  /** Told whether what is shown can be sent, after every change. */
  onValidity?(valid: boolean): void;
}

/**
 * Every setting of the format of a work: the page and its margins, the type, the paragraphs. Used
 * by the format sheet and by the step that follows the title of a new work.
 */
export function FormatForm({ value, onChange, onValidity }: FormatFormProps) {
  const id = useId();
  const [unit, setUnit] = useState<Unit>(() => unitOf(value));
  const [texts, setTexts] = useState<Texts>(() => textsOf(value, unitOf(value)));
  const [problems, setProblems] = useState<Problems>({});
  const [choices, setChoices] = useState(value);
  const editing = useRef<NumberField | null>(null);
  const sent = useRef(value);
  const seen = useRef(value);

  // A change from elsewhere (another window) replaces what is shown, but never the field being
  // typed in. A change of ours coming back from the core is already shown.
  useEffect(() => {
    if (value === seen.current) return;
    seen.current = value;
    if (JSON.stringify(value) === JSON.stringify(sent.current)) return;
    sent.current = value;
    setChoices(value);
    setTexts((current) => {
      const next = textsOf(value, unit);
      const field = editing.current;
      return field ? { ...next, [field]: current[field] } : next;
    });
  }, [value, unit]);

  function commit(nextChoices: WorkFormat, nextTexts: Texts, nextUnit: Unit) {
    const { format, problems: found } = read(nextChoices, nextTexts, nextUnit);
    setChoices(nextChoices);
    setTexts(nextTexts);
    setProblems(found);
    onValidity?.(Object.keys(found).length === 0);
    if (Object.keys(found).length === 0) {
      sent.current = format;
      onChange(format);
    }
  }

  function chooseSize(size: PageSize) {
    if (size === "custom") {
      commit({ ...read(choices, texts, unit).format, pageSize: "custom" }, texts, unit);
      return;
    }
    const info = PAGE_SIZES[size];
    const next = {
      ...choices,
      pageSize: size,
      pageWidth: info.width,
      pageHeight: info.height,
      margins: info.margins,
    };
    setUnit(info.unit);
    commit(next, { ...texts, ...textsOf(next, info.unit) }, info.unit);
  }

  function type(field: NumberField, text: string) {
    const next = { ...texts, [field]: text };
    // Changing the page by hand makes it a size of its own.
    const resized = field === "pageWidth" || field === "pageHeight";
    commit(resized ? { ...choices, pageSize: "custom" } : choices, next, unit);
  }

  function changeUnit(next: Unit) {
    const { format } = read(choices, texts, unit);
    setUnit(next);
    setTexts(textsOf(format, next));
  }

  const field = (name: NumberField, label: string, suffix: string) => {
    const problem = problems[name as FormatField];
    return (
      <p className="format-field">
        <label htmlFor={`${id}-${name}`}>{label}</label>
        <span className="format-input">
          <input
            id={`${id}-${name}`}
            inputMode="decimal"
            value={texts[name]}
            aria-invalid={problem ? true : undefined}
            aria-describedby={problem ? `${id}-${name}-problem` : undefined}
            onFocus={() => (editing.current = name)}
            onBlur={() => (editing.current = null)}
            onChange={(event) => type(name, event.target.value)}
          />
          <span className="format-unit">{suffix}</span>
        </span>
        {problem && (
          <span id={`${id}-${name}-problem`} className="format-problem">
            {problem}
          </span>
        )}
      </p>
    );
  };

  const length = unit === "cm" ? "cm" : "in";

  return (
    <div className="format-form">
      <fieldset className="format-group">
        <legend className="format-legend small-caps">Hoja</legend>
        <p className="format-field">
          <label htmlFor={`${id}-size`}>Tamaño</label>
          <select
            id={`${id}-size`}
            value={choices.pageSize}
            onChange={(event) => chooseSize(event.target.value as PageSize)}
          >
            {PAGE_SIZE_ORDER.map((size) => (
              <option key={size} value={size}>
                {PAGE_SIZES[size].label}
              </option>
            ))}
            <option value="custom">A medida</option>
          </select>
        </p>
        <p className="format-field" role="radiogroup" aria-label="Unidad">
          {(["cm", "in"] as const).map((option) => (
            <label key={option} className="format-choice">
              <input
                type="radio"
                name={`${id}-unit`}
                checked={unit === option}
                onChange={() => changeUnit(option)}
              />
              {option === "cm" ? "Centímetros" : "Pulgadas"}
            </label>
          ))}
        </p>
        {choices.pageSize === "custom" && (
          <>
            {field("pageWidth", "Ancho", length)}
            {field("pageHeight", "Alto", length)}
          </>
        )}
        {field("top", "Margen superior", length)}
        {field("bottom", "Margen inferior", length)}
        {field("inside", "Margen interior (lomo)", length)}
        {field("outside", "Margen exterior", length)}
        {problems.margins && (
          <p className="format-problem" role="alert">
            {problems.margins}
          </p>
        )}
      </fieldset>

      <fieldset className="format-group">
        <legend className="format-legend small-caps">Letra</legend>
        <p className="format-field">
          <label htmlFor={`${id}-typeface`}>Tipografía</label>
          <select
            id={`${id}-typeface`}
            value={choices.typeface}
            style={{ fontFamily: TYPEFACES[choices.typeface].family }}
            onChange={(event) =>
              commit({ ...choices, typeface: event.target.value as Typeface }, texts, unit)
            }
          >
            {TYPEFACE_ORDER.map((typeface) => (
              <option key={typeface} value={typeface}>
                {TYPEFACES[typeface].label}
              </option>
            ))}
          </select>
        </p>
        {field("bodySize", "Cuerpo", "pt")}
        {field("leading", "Interlineado", "×")}
      </fieldset>

      <fieldset className="format-group">
        <legend className="format-legend small-caps">Párrafos</legend>
        <p className="format-field" role="radiogroup" aria-label="Alineación">
          {([true, false] as const).map((justified) => (
            <label key={String(justified)} className="format-choice">
              <input
                type="radio"
                name={`${id}-align`}
                checked={choices.justified === justified}
                onChange={() => commit({ ...choices, justified }, texts, unit)}
              />
              {justified ? "Justificado" : "Alineado a la izquierda"}
            </label>
          ))}
        </p>
        <label className="format-choice">
          <input
            type="checkbox"
            checked={choices.firstLineIndent}
            onChange={(event) =>
              commit({ ...choices, firstLineIndent: event.target.checked }, texts, unit)
            }
          />
          Sangría en la primera línea
        </label>
        <label className="format-choice">
          <input
            type="checkbox"
            checked={choices.dropCap}
            onChange={(event) => commit({ ...choices, dropCap: event.target.checked }, texts, unit)}
          />
          Capitular al empezar cada capítulo
        </label>
      </fieldset>
    </div>
  );
}
