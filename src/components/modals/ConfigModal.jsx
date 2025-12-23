import { useEffect, useState } from "react";
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";

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
    className: "config-input",
    onFocus: (e) => e.target.select(),
  };

  const Label = ({ icon, text }) => (
    <span className="config-label">
      {icon ? <img src={icon} alt={text} className="inline-icon" /> : null}
      <span>{text}</span>
    </span>
  );

  return (
    <div className="modal">
      <div className="modal-card help-modal">
        <div className="help-header">
          <h3>Konfiguration</h3>
          <button onClick={onClose}>Schliessen</button>
        </div>
        <div className="config-grid">
          <label className="config-row">
            <Label text="Totale Start-Gueter (pro Gut)" />
            <input
              {...numberProps}
              value={draft.goodsStartBonus ?? 0}
              onChange={(e) =>
                updateField("goodsStartBonus", Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="config-row">
            <Label icon={moneyIcon} text="Extra Start" />
            <input
              {...numberProps}
              value={draft.extraCoins ?? 0}
              onChange={(e) =>
                updateField("extraCoins", Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="config-row">
            <Label icon={suppliesIcon} text="Extra Start" />
            <input
              {...numberProps}
              value={draft.extraSupplies ?? 0}
              onChange={(e) =>
                updateField("extraSupplies", Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="config-row">
            <Label icon={moneyIcon} text="Muenzen Boost (% additiv)" />
            <input
              {...numberProps}
              value={draft.coinBoost ?? 0}
              onChange={(e) =>
                updateField("coinBoost", Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="config-row">
            <Label icon={suppliesIcon} text="Vorraete Boost (% additiv)" />
            <input
              {...numberProps}
              value={draft.supplyBoost ?? 0}
              onChange={(e) =>
                updateField("supplyBoost", Number(e.target.value) || 0)
              }
            />
          </label>
        </div>
        <div className="config-footer">
          <span>Aenderungen werden erst beim Neuladen der Seite aktiv.</span>
          <div className="config-actions">
            <button onClick={handleSave}>Speichern</button>
            <button onClick={onClose}>Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  );
}
