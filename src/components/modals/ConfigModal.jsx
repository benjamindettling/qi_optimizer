import { useEffect, useState } from "react";
export function ConfigModal({ open, onClose, config, onSave }) {
  const [draft, setDraft] = useState(config);

  useEffect(() => {
    setDraft(config);
  }, [config, open]);

  if (!open) return null;

  const updateField = (key, val) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  const numberProps = {
    type: "number",
    inputMode: "numeric",
    onFocus: (e) => e.target.select(),
  };

  return (
    <div className="modal">
      <div className="modal-card help-modal">
        <div className="help-header">
          <h3>Konfiguration</h3>
          <button onClick={onClose}>Schliessen</button>
        </div>
        <div className="config-grid">
          <label className="config-row">
            <span>Totale Start-Gaeter (pro Gut)</span>
            <input
              {...numberProps}
              className="config-input"
              value={draft.goodsStartBonus ?? 0}
              onChange={(e) => updateField("goodsStartBonus", Number(e.target.value) || 0)}
            />
          </label>
          <label className="config-row">
            <span>Extra Start Muenzen</span>
            <input
              {...numberProps}
              className="config-input"
              value={draft.extraCoins ?? 0}
              onChange={(e) => updateField("extraCoins", Number(e.target.value) || 0)}
            />
          </label>
          <label className="config-row">
            <span>Extra Start Vorraete</span>
            <input
              {...numberProps}
              className="config-input"
              value={draft.extraSupplies ?? 0}
              onChange={(e) => updateField("extraSupplies", Number(e.target.value) || 0)}
            />
          </label>
          <label className="config-row">
            <span>Muenzen Boost (% additiv)</span>
            <input
              {...numberProps}
              className="config-input"
              value={draft.coinBoost ?? 0}
              onChange={(e) => updateField("coinBoost", Number(e.target.value) || 0)}
            />
          </label>
          <label className="config-row">
            <span>Vorraete Boost (% additiv)</span>
            <input
              {...numberProps}
              className="config-input"
              value={draft.supplyBoost ?? 0}
              onChange={(e) => updateField("supplyBoost", Number(e.target.value) || 0)}
            />
          </label>
        </div>
        <div className="config-footer">
          <span>Manche Aenderungen werden erst beim neu laden der Seite aktiv.</span>
          <div className="config-actions">
            <button onClick={handleSave}>Speichern</button>
            <button onClick={onClose}>Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  );
}
