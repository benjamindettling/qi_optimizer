// src/components/modals/ChooseGoodModal.jsx

import { GOODS_TYPES } from "../../config/boardConfig";
import { canAffordSingleGood } from "../../utils/stateUtils";
import { formatNumber } from "../../utils/formatNumber";

/**
 * Modal for choosing WHICH good to spend when unlocking a region.
 *
 * Props:
 * - unlockGoodSelect: { idx: number, goodsCost: number } | null
 * - goods: Record<string, number>   // resources.goods
 * - layout: Array<{ id: number, defId: string, x: number, y: number }>
 * - libraryMap: Record<string, any> // defId -> building definition
 * - onUnlockWithGood: (idx: number, goodKey: string) => void
 * - onCancel: () => void
 */
export function ChooseGoodModal({
  unlockGoodSelect,
  goods,
  layout,
  libraryMap,
  onUnlockWithGood,
  onCancel,
}) {
  if (!unlockGoodSelect) return null;

  const { idx, goodsCost } = unlockGoodSelect;

  return (
    <div className="modal">
      <div className="modal-card">
        <h3>Choose good</h3>
        <div className="modal-body">
          {GOODS_TYPES.map((g) => {
            const haveEnough = canAffordSingleGood(goods, g, goodsCost);
            const hasProducer = layout.some(
              (inst) =>
                libraryMap[inst.defId]?.category === "goods" &&
                libraryMap[inst.defId]?.produces === g
            );
            const needsPurchase = !haveEnough && hasProducer;
            const disabled = !haveEnough && !hasProducer;

            return (
              <button
                key={g}
                className={needsPurchase ? "needs-purchase" : ""}
                disabled={disabled}
                onClick={() => onUnlockWithGood(idx, g)}
                title={
                  needsPurchase ? "Will open fast buy options" : "Spend goods"
                }
              >
                <img
                  src={`/goods/${g === "Stein" ? "Backstein" : g}.webp`}
                  alt={g}
                  style={{ width: 20, height: 20, marginRight: 6 }}
                />
                {g} (
                {formatNumber(goods[g] ?? 0)}/{formatNumber(goodsCost)})
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
