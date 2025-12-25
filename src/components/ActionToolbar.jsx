import { useDropdownMenu } from "../hooks/useDropdownMenu";
import { Redo } from "lucide-react";
import { Undo } from "lucide-react";

export function ActionToolbar({
  moveMode,
  sellMode,
  refundMode,
  boostMode,
  onToggleMove,
  onToggleSell,
  onToggleRefund,
  onToggleBoost,
  onUndo,
  onRedo,
  finishProductions,
  harvestAll,
  harvestIsPartial = false,
  canUndo,
  canRedo,
  onSave,
  onLoad,
  saves,
  loadName,
  setLoadName,
  toolbarOffset = 0,
  onDeleteSave,
  notes,
  onChangeNotes,
}) {
  const saveKeys = Object.keys(saves).sort((a, b) => a.localeCompare(b));
  const {
    ref: saveMenuRef,
    isOpen: isSaveMenuOpen,
    setIsOpen: setIsSaveMenuOpen,
  } = useDropdownMenu(false);

  const promptSaveName = () => {
    const next = prompt("Save name?", loadName || "");
    if (!next) return;
    setLoadName(next);
    return next;
  };

  const handleSaveClick = () => {
    const target = promptSaveName();
    if (!target) return;
    if (onSave) onSave(target);
  };

  return (
    <div
      className="actions-column"
      style={{ marginLeft: `${toolbarOffset}px` }}
    >
      <div className="actions-row">
        <button
          onClick={onToggleMove}
          className={`mode-button move ${moveMode ? "active-mode" : ""}`}
          title="Bewege oder tausche Gebäude nach Belieben"
        >
          Bewegen
        </button>
        <button
          onClick={onToggleSell}
          className={`mode-button sell ${sellMode ? "active-mode" : ""}`}
          title="Verkauf Gebäude. Erhalte 1/4 des gezahlten Werts zurück"
        >
          Verkaufen
        </button>
      </div>

      <div className="actions-row">
        <button
          onClick={onUndo}
          className="action-button undo"
          title="Undo. Kehre zu voherigen Schritten zurück"
          disabled={!canUndo}
        >
          <Undo />
        </button>
        <button
          onClick={onRedo}
          className="action-button redo"
          title="Redo. Kehre zu späteren Schritten zurück"
          disabled={!canRedo}
        >
          <Redo />
        </button>
      </div>

      <button
        onClick={onToggleRefund}
        className={`mode-button refund ${refundMode ? "active-mode" : ""}`}
        title="DEBUG: Erhalte den VOLLEN Wert des Gebäudes zurück"
      >
        Volle Erstattung
      </button>

      <div className="actions-row">
        <button
          onClick={finishProductions}
          className="action-button finish"
          title="Beendet alle Produktion. Gebäude kБnnen dann angeklickt werden um zu ernten oder mit Harvest All geerntet werden"
        >
          Beende alle Prod.
        </button>
        <button
          onClick={onToggleBoost}
          className={`action-button finish ${boostMode ? "active-mode" : ""}`}
          title="Boost-Modus: Klick auf Gebäude um zu entsperren/fertigzustellen/ernten"
        >
          Boost einzelne Gebäude
        </button>
      </div>

      <button
        onClick={harvestAll}
        className="action-button harvest"
        title="Sammle alle noch nicht eingesammelten Produktionen ein, oder, falls keine Produktionen offen, erntet es die ganze Stadt"
      >
        {harvestIsPartial ? "Rest einsammeln" : "Volle Ernte"}
      </button>

      <button
        onClick={handleSaveClick}
        title="Speicher aktuellen Stand in deinem Browser. (Hinweis, undo/redo Verlauf wird nicht mitgespeichert)"
      >
        Speichern als
      </button>
      <div className="save-control" ref={saveMenuRef}>
        <button
          type="button"
          className="save-trigger"
          onClick={() => setIsSaveMenuOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={isSaveMenuOpen}
        >
          <span
            className={`save-trigger-label ${loadName ? "" : "placeholder"}`}
            title={`${loadName}`}
          >
            {loadName || "Load state..."}
          </span>
          <span className="save-trigger-caret" aria-hidden="true">
            ▾
          </span>
        </button>

        {isSaveMenuOpen && (
          <div className="save-menu" role="listbox" aria-label="Saved states">
            {saveKeys.length === 0 ? (
              <div className="save-empty">No saves yet</div>
            ) : (
              saveKeys.map((k) => (
                <div
                  key={k}
                  className={`save-item ${k === loadName ? "selected" : ""}`}
                  role="option"
                  aria-selected={k === loadName}
                  onClick={() => {
                    setLoadName(k);
                    setIsSaveMenuOpen(false);
                  }}
                  title={`${k}`}
                >
                  <span className="save-item-label">{k}</span>

                  <button
                    type="button"
                    className="save-delete"
                    title={`Delete save ${k}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDeleteSave) onDeleteSave(k);
                      if (loadName === k) setLoadName("");
                    }}
                  >
                    x
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        <button
          onClick={() => {
            if (loadName) onLoad(loadName);
          }}
          disabled={!loadName}
          style={{ marginTop: 4, width: "100%" }}
        >
          Spielstand laden
        </button>
      </div>
      <div className="notes-card">
        <label className="notes-label" htmlFor="city-notes">
          Notizen
        </label>
        <textarea
          id="city-notes"
          className="notes-input"
          placeholder="Füge Notizen hinzu"
          value={notes}
          onChange={(e) => onChangeNotes?.(e.target.value)}
          rows={6}
        />
      </div>
    </div>
  );
}
