import { formatNumber } from "../../utils/formatNumber";

export function UnitsPurchaseModal({ unitModal, onPurchase, onClose }) {
  if (!unitModal) return null;

  const { def } = unitModal;
  const costs = Object.entries(def.unitCosts || {});
  const unitIcon = `/units/${def.produces}.webp`;

  return (
    <div className="modal" onClick={onClose}>
      <div
        className="modal-card"
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        <h3>
          <img src={unitIcon} alt={def.produces} className="inline-icon" />
          {def.produces} kaufen
        </h3>
        <div className="modal-body">
          {costs.map(([amt, cost]) => (
            <button
              key={amt}
              onClick={() => onPurchase(def, amt)}
              style={{ width: "100%", marginBottom: 6 }}
            >
              +{formatNumber(Number(amt))} für {formatNumber(cost.coins ?? 0)}{" "}
              coins / {formatNumber(cost.supplies ?? 0)} supplies
            </button>
          ))}
        </div>
        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
