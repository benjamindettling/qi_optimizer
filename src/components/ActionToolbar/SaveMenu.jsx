// Dropdown menu for loading and deleting saved states.
import { useDropdownMenu } from "../../hooks/useDropdownMenu";

export function SaveMenu({ saves = {}, loadName, setLoadName, onDeleteSave }) {
  const saveKeys = Object.entries(saves || {})
    .filter(([, entry]) => !entry?.meta?.isSnapshot)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));

  const {
    ref: saveMenuRef,
    isOpen: isSaveMenuOpen,
    setIsOpen: setIsSaveMenuOpen,
  } = useDropdownMenu(false);

  return (
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
          v
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
    </div>
  );
}
