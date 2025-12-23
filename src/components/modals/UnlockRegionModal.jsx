// src/components/modals/UnlockRegionModal.jsx
import { formatNumber } from "../../utils/formatNumber";

/**
 * Modal for choosing how to unlock a region (goods vs shards).
 *
 * Props:
 * - unlockChoice: {
 *     idx: number,
 *     goodsCost: number,
 *     shardCost: number,
 *     allowGoods: boolean,
 *     allowShards: boolean,
 *   } | null
 * - onChooseGoods: (idx: number, goodsCost: number) => void
 * - onUnlockWithShards: (idx: number) => void
 * - onCancel: () => void
 */
export function UnlockRegionModal({
  unlockChoice,
  onChooseGoods,
  onUnlockWithShards,
  onCancel,
}) {
  if (!unlockChoice) return null;

  const { idx, goodsCost, shardCost, allowGoods, allowShards } = unlockChoice;
  const goodsIcon = "/menu/goods.png";
  const shardsIcon = "/shards.webp";

  return (
    <div className="modal">
      <div className="modal-card">
        <h3>Unlock Region</h3>
        <div className="modal-body">
          <button
            onClick={() => {
              if (!allowGoods) return;
              onChooseGoods(idx, goodsCost);
            }}
            disabled={!allowGoods}
          >
            <img src={goodsIcon} alt="Goods" className="inline-icon" />
            {formatNumber(goodsCost)}
          </button>
          <button
            onClick={() => onUnlockWithShards(idx)}
            disabled={!allowShards}
          >
            <img src={shardsIcon} alt="Shards" className="inline-icon" />
            {formatNumber(shardCost)}
          </button>
        </div>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
