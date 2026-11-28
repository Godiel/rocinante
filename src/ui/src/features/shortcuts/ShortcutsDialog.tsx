import { useId } from "react";
import { SHORTCUTS, keyLabel } from "./table";
import "../export/export.css";
import "./shortcuts.css";

export interface ShortcutsDialogProps {
  onClose(): void;
}

/** Every shortcut of Rocinante, grouped, with the keys as this system writes them. Escape or F1 closes it. */
export function ShortcutsDialog({ onClose }: ShortcutsDialogProps) {
  const id = useId();
  return (
    <div className="export-backdrop" onClick={onClose}>
      <section
        className="export-dialog shortcuts-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        tabIndex={-1}
        ref={(dialog) => dialog?.focus()}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key !== "Escape" && event.key !== "F1") return;
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      >
        <header className="shortcuts-header">
          <h2 id={`${id}-title`} className="export-title small-caps">
            Teclas rápidas
          </h2>
          <button type="button" className="action" onClick={onClose}>
            Cerrar
          </button>
        </header>
        {SHORTCUTS.map((group) => (
          <section key={group.title} className="shortcuts-group" aria-label={group.title}>
            <h3 className="shortcuts-group-title small-caps">{group.title}</h3>
            <dl className="shortcuts-list">
              {group.shortcuts.map((shortcut) => (
                <div key={shortcut.keys.join("+")} className="shortcuts-row">
                  <dt>
                    {shortcut.keys.map((key, index) => (
                      <span key={key}>
                        {index > 0 && <span className="shortcuts-plus">+</span>}
                        <kbd>{keyLabel(key)}</kbd>
                      </span>
                    ))}
                  </dt>
                  <dd>{shortcut.does}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </section>
    </div>
  );
}
