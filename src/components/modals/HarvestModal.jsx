// src/components/modals/HarvestModal.jsx

import { GOODS_TYPES } from "../../config/boardConfig";
import { formatGoods } from "../../utils/gameMath";

/**
 * Modal for showing the result of a harvest (single or multiple buildings).
 *
 * Props:
 * - harvestModal: {
 *     title?: string,
 *     delta: {
 *       coins: number,
 *       supplies: number,
 *       chronos: number,
 *       goods: Record<string, number>,
 *     },
 *     result: {
 *       coins: number,
 *       supplies: number,
 *       chronos: number,
 *       goods: Record<string, number>,
 *     },
 *   } | null
 * - onConfirm: () => void        // typically confirmHarvest
 * - onCancel: () => void         // typically cancelHarvest
 */
export function HarvestModal({ harvestModal, onConfirm, onCancel }) {
  if (!harvestModal) return null;

  const { title, delta, result } = harvestModal;

  return (
    <div className="modal">
      <div className="modal-card">
        <h3>{title || "Harvest Result"}</h3>
        <div className="modal-body">
          <div>
            Changes: +{delta.coins} coins, +{delta.supplies} supplies, +
            {delta.chronos} chronos
          </div>
          <div>Goods: {formatGoods(delta.goods, GOODS_TYPES)}</div>
          <div>
            Totals: {result.coins} coins / {result.supplies} supplies /{" "}
            {result.chronos} chronos
          </div>
          <div>Goods Totals: {formatGoods(result.goods, GOODS_TYPES)}</div>
        </div>
        <div className="modal-actions">
          <button onClick={onConfirm}>Okay</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
