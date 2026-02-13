// Expansion costs display for TopBar - shows region unlock costs
import { Infinity as InfinityIcon } from "lucide-react";
import { REGION_GOODS_COSTS, REGION_SHARD_COSTS } from "../../config/boardConfig";
import { formatNumber } from "../../utils/formatNumber";
import shardsIcon from "/shards.webp";

const isInfinityCost = (value) =>
  value === "Infinity" ||
  value === Infinity ||
  value === Number.POSITIVE_INFINITY;

export function ExpansionCosts({
  currentGoodsCost,
  currentShardCost,
  goodsUnlocks,
  shardUnlocks,
  onSetGoodsUnlocks,
  onSetShardUnlocks,
  adminMode = false,
  editingLocked = false,
}) {
  const adminEnabled = adminMode && !editingLocked;

  const renderCostValue = (value) =>
    isInfinityCost(value) ? (
      <InfinityIcon className="inline-icon" aria-label="Infinity" title="Infinity" />
    ) : (
      formatNumber(value)
    );

  return (
    <div className="topbar-stack expansion-costs">
      <div className="stack-title">Erweiterungskosten</div>
      
      {/* Goods cost row */}
      <div className="resource-line">
        <img src="/goods/Kupfer.webp" alt="Güter" title="Güterkosten" />
        {adminEnabled ? (
          <select
            className="cost-select"
            value={goodsUnlocks}
            onChange={(e) => {
              const idx = Number(e.target.value);
              if (Number.isFinite(idx) && onSetGoodsUnlocks) {
                onSetGoodsUnlocks(idx);
              }
            }}
          >
            {REGION_GOODS_COSTS.map((cost, idx) => (
              <option key={idx} value={idx}>
                {isInfinityCost(cost) ? "∞" : formatNumber(cost)}
              </option>
            ))}
          </select>
        ) : (
          <span>{renderCostValue(currentGoodsCost)}</span>
        )}
      </div>

      {/* Shards cost row */}
      <div className="resource-line">
        <img src={shardsIcon} alt="Scherben" title="Scherbenkosten" />
        {adminEnabled ? (
          <select
            className="cost-select"
            value={shardUnlocks}
            onChange={(e) => {
              const idx = Number(e.target.value);
              if (Number.isFinite(idx) && onSetShardUnlocks) {
                onSetShardUnlocks(idx);
              }
            }}
          >
            {REGION_SHARD_COSTS.map((cost, idx) => (
              <option key={idx} value={idx}>
                {isInfinityCost(cost) ? "∞" : formatNumber(cost)}
              </option>
            ))}
          </select>
        ) : (
          <span>{renderCostValue(currentShardCost)}</span>
        )}
      </div>
    </div>
  );
}
