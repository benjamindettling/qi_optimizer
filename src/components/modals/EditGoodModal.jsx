import { useEffect, useState } from "react";
import { getGoodIconPath } from "../../utils/goodsIconPath";

const goodsIcon = "/menu/goods.png";

export function EditGoodModal({ modal, onSave, onSaveAll, onClose }) {
  const [amount, setAmount] = useState(modal?.value ?? 0);

  useEffect(() => {
    setAmount(modal?.value ?? 0);
  }, [modal]);

  if (!modal) return null;

  const goodKey = modal.goodKey;
  const goodIcon = getGoodIconPath(goodKey);

  const numberProps = {
    type: "number",
    inputMode: "numeric",
    className: "config-input",
    onFocus: (e) => e.target.select(),
  };

  const saveSingle = () => {
    onSave?.(amount);
  };

  const saveAll = () => {
    onSaveAll?.(amount);
  };

  return (
    <div className="modal">
      <div className="modal-card">
        <h3 className="modal-title">
          <img src={goodIcon} alt={goodKey} className="inline-icon" />
          <span>{goodKey}</span>
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
          <button onClick={saveSingle}>Ok</button>
          <button onClick={onClose}>Abbrechen</button>
          <button onClick={saveAll}>
            Alle <img src={goodsIcon} alt="Güter" className="inline-icon" />{" "}
            anpassen
          </button>
        </div>
      </div>
    </div>
  );
}
