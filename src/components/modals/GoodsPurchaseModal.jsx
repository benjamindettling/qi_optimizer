// src/components/modals/GoodsPurchaseModal.jsx

/**
 * Modal for buying goods for a specific goods building.
 *
 * Props:
 * - goodsModal: { def: any } | null
 *     where def is the building definition with:
 *       - def.produces: string (good key)
 *       - def.goodsCost: Record<string, { coins?: number, supplies?: number }>
 * - onPurchase: (def: any, amountKey: string) => void
 * - onClose: () => void
 */
export function GoodsPurchaseModal({ goodsModal, onPurchase, onClose }) {
  if (!goodsModal) return null;

  const { def } = goodsModal;
  const costs = Object.entries(def.goodsCost || {});

  return (
    <div className="modal">
      <div className="modal-card">
        <h3>Buy {def.produces}</h3>
        <div className="modal-body">
          {costs.map(([amt, cost]) => (
            <button
              key={amt}
              onClick={() => onPurchase(def, amt)}
              style={{ width: "100%", marginBottom: 6 }}
            >
              +{amt} for {cost.coins ?? 0} coins / {cost.supplies ?? 0} supplies
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
