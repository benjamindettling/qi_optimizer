import { useEffect, useState } from "react";

export function ExportSavesModal({ open, saves = {}, onClose, onExport }) {
  const names = Object.keys(saves);
  const [selected, setSelected] = useState(new Set());

  useEffect(() => {
    setSelected(new Set());
  }, [open, saves]);

  if (!open) return null;

  const toggle = (name) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleExport = () => {
    onExport?.(Array.from(selected));
  };

  return (
    <div className="modal">
      <div className="modal-card">
        <div className="help-header">
          <h3>Saves exportieren</h3>
          <button onClick={onClose}>Schliessen</button>
        </div>
        <div className="export-list">
          {names.length === 0 ? (
            <div className="worst-empty">Keine Saves vorhanden</div>
          ) : (
            names.map((n) => (
              <label key={n} className="export-row">
                <input
                  type="checkbox"
                  checked={selected.has(n)}
                  onChange={() => toggle(n)}
                />
                <span>{n}</span>
              </label>
            ))
          )}
        </div>
        <div className="modal-actions">
          <button onClick={handleExport} disabled={!selected.size}>
            Export
          </button>
          <button onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
