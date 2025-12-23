import { useDropdownMenu } from "../hooks/useDropdownMenu";

export function ActionToolbar({
  moveMode,
  sellMode,
  refundMode,
  onToggleMove,
  onToggleSell,
  onToggleRefund,
  onUndo,
  onRedo,
  finishProductions,
  harvestAll,
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
    let target = loadName;
    if (!target) {
      target = promptSaveName();
    }
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
          title="Move"
        >
          ↕↔
        </button>
        <button
          onClick={onToggleSell}
          className={`mode-button sell ${sellMode ? "active-mode" : ""}`}
          title="Verkauf Gebäude. Erhalte 1/4 des gezahlten Werts zurück"
        >
          🗑
        </button>
      </div>

      <div className="actions-row">
        <button
          onClick={onUndo}
          className="action-button undo"
          title="Undo"
          disabled={!canUndo}
        >
          Undo
        </button>
        <button
          onClick={onRedo}
          className="action-button redo"
          title="Redo"
          disabled={!canRedo}
        >
          Redo
        </button>
      </div>

      <button
        onClick={onToggleRefund}
        className={`mode-button refund ${refundMode ? "active-mode" : ""}`}
        title="DEBUG: Erhalte den VOLLEN Wert des Gebäudes zurück"
      >
        Full Refund
      </button>

      <button
        onClick={finishProductions}
        className="action-button finish"
        title="Beendet alle Produktion. Gebäude können dann angeklickt werden um zu ernten oder mit Harvest All geerntet werden"
      >
        Finish Productions
      </button>
      <button
        onClick={harvestAll}
        title="Sammle alle noch nicht eingesammelten Produktionen ein, oder, falls keine Produktionen offen, erntet es die ganze Stadt"
      >
        Harvest All
      </button>

      <button
        onClick={handleSaveClick}
        title="Speicher aktuellen Stand in deinem Browser. (Hinweis, undo/redo Verlauf wird nicht mitgespeichert)"
      >
        Save as "
        <span
          style={{ textDecoration: "underline", cursor: "pointer" }}
          onClick={(e) => {
            e.stopPropagation();
            promptSaveName();
          }}
          title="Name ändern"
        >
          {loadName || "neuer Save"}
        </span>
        "
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
                      e.stopPropagation(); // do not select when deleting
                      if (onDeleteSave) onDeleteSave(k);

                      // If you deleted the currently selected save, clear selection
                      if (loadName === k) setLoadName("");

                      // Keep menu open so user can delete multiple quickly (optional)
                      // setIsSaveMenuOpen(false);
                    }}
                  >
                    ×
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
          Load
        </button>
      </div>
      <div className="notes-card">
        <label className="notes-label" htmlFor="city-notes">
          Notes
        </label>
        <textarea
          id="city-notes"
          className="notes-input"
          placeholder="Add notes about this setup..."
          value={notes}
          onChange={(e) => onChangeNotes?.(e.target.value)}
          rows={6}
        />
      </div>
    </div>
  );
}
