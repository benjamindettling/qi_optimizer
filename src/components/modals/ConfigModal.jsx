import { useEffect, useState } from "react";
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import shardsIcon from "/shards.webp";
import qaIcon from "/quantum_actions.webp";
import redAttackIcon from "/fight/red_attack.webp";
import redDefenseIcon from "/fight/red_defense.webp";
import blueAttackIcon from "/fight/blue_attack.webp";
import blueDefenseIcon from "/fight/blue_defense.webp";

export function ConfigModal({
  open,
  onClose,
  config,
  onSave,
  onApplyStartBonus,
}) {
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

  const handleApplyStartBonus = () => {
    const coins = Number(draft.extraCoins ?? 0) || 0;
    const supplies = Number(draft.extraSupplies ?? 0) || 0;
    onApplyStartBonus?.(coins, supplies);
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
            <Label text="Totale Start-Gueter" />
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
            <Label icon={shardsIcon} text="Scherben Start" />
            <input
              {...numberProps}
              value={draft.shardsStart ?? 500}
              onChange={(e) =>
                updateField("shardsStart", Number(e.target.value) || 0)
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
          <label className="config-row">
            <Label icon={redAttackIcon} text="Rot Angriff %" />
            <input
              {...numberProps}
              value={draft.redAttackBoost ?? 0}
              onChange={(e) =>
                updateField("redAttackBoost", Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="config-row">
            <Label icon={redDefenseIcon} text="Rot Verteidigung %" />
            <input
              {...numberProps}
              value={draft.redDefenseBoost ?? 0}
              onChange={(e) =>
                updateField("redDefenseBoost", Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="config-row">
            <Label icon={blueAttackIcon} text="Blau Angriff %" />
            <input
              {...numberProps}
              value={draft.blueAttackBoost ?? 0}
              onChange={(e) =>
                updateField("blueAttackBoost", Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="config-row">
            <Label icon={blueDefenseIcon} text="Blau Verteidigung %" />
            <input
              {...numberProps}
              value={draft.blueDefenseBoost ?? 0}
              onChange={(e) =>
                updateField("blueDefenseBoost", Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="config-row">
            <Label
              icon={qaIcon}
              text="QA Basisbonus pro Stunde (zusätzlich zu 5000)"
            />
            <input
              {...numberProps}
              value={draft.qaBaseBonus ?? 0}
              onChange={(e) =>
                updateField("qaBaseBonus", Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="config-row">
            <Label icon={qaIcon} text="QA Stunden pro Ernte" />
            <input
              {...numberProps}
              value={draft.qaHarvestHours ?? 12}
              onChange={(e) =>
                updateField("qaHarvestHours", Number(e.target.value) || 0)
              }
            />
          </label>
          <label className="config-row">
            <Label text="Erlaube negative Scherben" />
            <input
              type="checkbox"
              checked={!!draft.allowNegativeShards}
              onChange={(e) =>
                updateField("allowNegativeShards", e.target.checked)
              }
            />
          </label>
        </div>
        <div className="config-footer">
          <div className="config-actions">
            <button onClick={handleApplyStartBonus}>
              <span>+Extra Start</span>
              <img src={moneyIcon} alt="coins" className="inline-icon" />
              <span>/</span>
              <img src={suppliesIcon} alt="supplies" className="inline-icon" />
              <span>auf alle Schritte</span>
            </button>
            <button onClick={handleSave}>Speichern</button>
            <button onClick={onClose}>Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  );
}
