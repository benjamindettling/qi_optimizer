import { useState, useMemo } from "react";
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import goodsIcon from "/goods/Kupfer.webp";
import troopIcon from "/troop.webp";
import shardsIcon from "/shards.webp";
import "./SaveConfigModal.css";

const Label = ({ icon, text }) => (
  <span className="config-label">
    {icon && <img src={icon} alt="" className="config-icon" />}
    <span>{text}</span>
  </span>
);

const DEFAULT_SAVE_CONFIG = {
  extraCoins: 0,
  extraSupplies: 0,
  goodsStartBonus: 0,
  troopsStartBonus: 0,
  shardsStart: 500,
  coinBoost: 0,
  supplyBoost: 0,
};

export function SaveConfigModal({
  open,
  saveName,
  saveConfig,
  onClose,
  onSave,
}) {
  // Use key-based reset instead of useEffect
  const initialDraft = useMemo(
    () => ({ ...DEFAULT_SAVE_CONFIG, ...(saveConfig || {}) }),
    [saveConfig],
  );
  const [draft, setDraft] = useState(initialDraft);

  // Reset draft when saveConfig changes (e.g., switching between saves)
  const [lastSaveConfig, setLastSaveConfig] = useState(saveConfig);
  if (saveConfig !== lastSaveConfig) {
    setLastSaveConfig(saveConfig);
    setDraft({ ...DEFAULT_SAVE_CONFIG, ...(saveConfig || {}) });
  }

  const updateField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onSave?.(draft);
    onClose?.();
  };

  const numberProps = {
    type: "number",
    min: 0,
    step: 1,
  };

  if (!open) return null;

  return (
    <div className="modal">
      <div className="modal-card save-config-modal">
        <div className="help-header">
          <h3>Savefile Config: {saveName}</h3>
          <button onClick={onClose}>Schliessen</button>
        </div>

        <div className="save-config-content">
          <p className="save-config-description">
            Diese Einstellungen werden beim Laden dieses Savefiles angewendet.
          </p>

          <div className="config-grid">
            {/* Extra flat bonuses */}
            <label className="config-row">
              <Label icon={moneyIcon} text="Münzen Extra" />
              <input
                {...numberProps}
                value={draft.extraCoins ?? 0}
                onChange={(e) =>
                  updateField("extraCoins", Number(e.target.value) || 0)
                }
              />
            </label>
            <label className="config-row">
              <Label icon={suppliesIcon} text="Vorräte Extra" />
              <input
                {...numberProps}
                value={draft.extraSupplies ?? 0}
                onChange={(e) =>
                  updateField("extraSupplies", Number(e.target.value) || 0)
                }
              />
            </label>
            <label className="config-row">
              <Label icon={goodsIcon} text="Güter Extra" />
              <input
                {...numberProps}
                value={draft.goodsStartBonus ?? 0}
                onChange={(e) =>
                  updateField("goodsStartBonus", Number(e.target.value) || 0)
                }
              />
            </label>
            <label className="config-row">
              <Label icon={troopIcon} text="Truppen Extra" />
              <input
                {...numberProps}
                value={draft.troopsStartBonus ?? 0}
                onChange={(e) =>
                  updateField("troopsStartBonus", Number(e.target.value) || 0)
                }
              />
            </label>
            <label className="config-row">
              <Label icon={shardsIcon} text="Scherben Start" />
              <input
                {...numberProps}
                value={draft.shardsStart ?? 500}
                onChange={(e) =>
                  updateField("shardsStart", Number(e.target.value) || 0)
                }
              />
            </label>

            {/* Percentage boosts */}
            <label className="config-row">
              <Label icon={moneyIcon} text="Münzen % Boost" />
              <input
                {...numberProps}
                value={draft.coinBoost ?? 0}
                onChange={(e) =>
                  updateField("coinBoost", Number(e.target.value) || 0)
                }
              />
            </label>
            <label className="config-row">
              <Label icon={suppliesIcon} text="Vorräte % Boost" />
              <input
                {...numberProps}
                value={draft.supplyBoost ?? 0}
                onChange={(e) =>
                  updateField("supplyBoost", Number(e.target.value) || 0)
                }
              />
            </label>
          </div>
        </div>

        <div className="save-config-actions">
          <button className="save-config-save-btn" onClick={handleSave}>
            Speichern
          </button>
          <button className="save-config-cancel-btn" onClick={onClose}>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}
