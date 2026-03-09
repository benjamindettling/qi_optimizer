import { useEffect, useState } from "react";
import { QiInput } from "../common/QiInput";

export function EditUnitModal({ modal, onSave, onClose }) {
  const [amount, setAmount] = useState(modal?.value ?? 0);

  useEffect(() => {
    setAmount(modal?.value ?? 0);
  }, [modal]);

  if (!modal) return null;

  const unitKey = modal.unitKey;
  const unitIcon = `/units/${unitKey}.webp`;

  const save = () => {
    onSave?.(amount);
  };

  return (
    <div className="modal">
      <div className="modal-card">
        <h3 className="modal-title">
          <img src={unitIcon} alt={unitKey} className="inline-icon" />
          <span>{unitKey}</span>
        </h3>
        <div className="modal-body">
          <label className="config-row">
            <span>Menge</span>
            <QiInput
              mode="number"
              className="config-input"
              value={amount}
              onChange={(nextValue) => setAmount(nextValue)}
            />
          </label>
        </div>
        <div className="modal-actions">
          <button onClick={save}>Ok</button>
          <button onClick={onClose}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
