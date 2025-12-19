// src/components/modals/FastBuyModal.jsx

/**
 * Modal for "fast buy" of goods using purchase plans.
 *
 * Props:
 * - fastBuyModal: {
 *     goodKey: string,
 *     goodsCost: number,
 *     options: Array<{
 *       label: string,
 *       totalAmount: number,
 *       plan: Array<{
 *         cost: { coins?: number, supplies?: number }
 *       }>
 *     }>
 *   } | null
 * - onFastBuy: (option: {
 *     label: string,
 *     totalAmount: number,
 *     plan: Array<{ cost: { coins?: number, supplies?: number } }>
 *   }) => void
 * - onCancel: () => void
 */
export function FastBuyModal({ fastBuyModal, onFastBuy, onCancel }) {
  if (!fastBuyModal) return null;

  const { goodKey, goodsCost, options = [] } = fastBuyModal;

  return (
    <div className="modal">
      <div className="modal-card">
        <h3>Fast buy {goodKey}</h3>
        <div className="modal-body">
          <div>
            Need: {goodsCost} {goodKey}
          </div>
          {options.map((opt, idx) => {
            const coins = opt.plan.reduce((s, p) => s + (p.cost.coins ?? 0), 0);
            const supplies = opt.plan.reduce(
              (s, p) => s + (p.cost.supplies ?? 0),
              0
            );
            return (
              <button
                key={idx}
                onClick={() => onFastBuy(opt)}
                style={{ width: "100%", marginBottom: 6 }}
              >
                {opt.label}: buy {opt.totalAmount} for {coins} coins /{" "}
                {supplies} supplies
              </button>
            );
          })}
        </div>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
