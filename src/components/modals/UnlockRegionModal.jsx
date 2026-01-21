// src/components/modals/UnlockRegionModal.jsx
import { formatNumber } from "../../utils/formatNumber";
import { Infinity as InfinityIcon } from "lucide-react";

const isInfinityCost = (value) =>
  value === "Infinity" || value === Infinity || value === Number.POSITIVE_INFINITY;

const renderCostValue = (value, className = "") =>
  isInfinityCost(value) ? (
    <InfinityIcon className="inline-icon" aria-label="Infinity" title="Infinity" />
  ) : (
    <span className={className}>{formatNumber(value)}</span>
  );

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
 * - shards: number
 * - allowNegativeShards: boolean
 */
export function UnlockRegionModal({
  unlockChoice,
  onChooseGoods,
  onUnlockWithShards,
  onCancel,
  shards = 0,
  allowNegativeShards = false,
}) {
  if (!unlockChoice) return null;

  const { idx, goodsCost, shardCost, allowGoods, allowShards } = unlockChoice;
  const goodsIcon = "/menu/goods.png";
  const shardsIcon = "/shards.webp";
  const shardWillGoNegative =
    allowNegativeShards &&
    !isInfinityCost(shardCost) &&
    (shards ?? 0) - shardCost < 0;

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
            {renderCostValue(goodsCost)}
          </button>
          <button
            onClick={() => onUnlockWithShards(idx)}
            disabled={!allowShards}
          >
            <img src={shardsIcon} alt="Shards" className="inline-icon" />
            {renderCostValue(shardCost, shardWillGoNegative ? "text-negative" : "")}
          </button>
        </div>
        <div className="modal-actions">
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
