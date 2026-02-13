import { useEffect, useState } from "react";

export function EditUnitModal({ modal, onSave, onClose }) {
  const [amount, setAmount] = useState(modal?.value ?? 0);

  useEffect(() => {
    setAmount(modal?.value ?? 0);
  }, [modal]);

  if (!modal) return null;

  const unitKey = modal.unitKey;
  const unitIcon = `/units/${unitKey}.webp`;

  const numberProps = {
    type: "number",
    inputMode: "numeric",
    className: "config-input",
    onFocus: (e) => e.target.select(),
  };

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
            <input
              {...numberProps}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value) || 0)}
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
