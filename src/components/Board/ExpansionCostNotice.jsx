// Inline expansion cost notice under the board.
import { Infinity as InfinityIcon } from "lucide-react";
import {
  REGION_GOODS_COSTS,
  REGION_SHARD_COSTS,
} from "../../config/boardConfig";
import { formatNumber } from "../../utils/formatNumber";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import "./ExpansionCostNotice.css";

const goodsIcon = "/menu/goods.png";
const shardsIcon = "/shards.webp";

const isInfinityCost = (value) =>
  value === "Infinity" ||
  value === Infinity ||
  value === Number.POSITIVE_INFINITY;

const renderCostValue = (value) =>
  isInfinityCost(value) ? (
    <InfinityIcon
      className="expansion-cost-infinity"
      aria-label="Infinity"
      title="Infinity"
    />
  ) : (
    formatNumber(value)
  );

export function ExpansionCostNotice({
  currentGoodsCost,
  currentShardCost,
  goodsUnlocks,
  shardUnlocks,
  onSetGoodsUnlocks,
  onSetShardUnlocks,
  adminMode = false,
  editingLocked = false,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  const adminEnabled = adminMode && !editingLocked;
  const safeGoodsUnlocks = Number.isFinite(goodsUnlocks) ? goodsUnlocks : 0;
  const safeShardUnlocks = Number.isFinite(shardUnlocks) ? shardUnlocks : 0;

  return (
    <div className="expansion-cost-line">
      <span className="expansion-cost-label">{t("expansionCostLabel")}</span>
      <span className="expansion-cost-entry">
        {adminEnabled ? (
          <select
            className="expansion-cost-select"
            value={safeGoodsUnlocks}
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
          <span className="expansion-cost-value">
            {renderCostValue(currentGoodsCost)}
          </span>
        )}
        <img src={goodsIcon} alt={t("goodsAlt")} className="expansion-cost-icon" />
      </span>
      <span className="expansion-cost-sep">/</span>
      <span className="expansion-cost-entry">
        {adminEnabled ? (
          <select
            className="expansion-cost-select"
            value={safeShardUnlocks}
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
          <span className="expansion-cost-value">
            {renderCostValue(currentShardCost)}
          </span>
        )}
        <img
          src={shardsIcon}
          alt={t("shardsAlt")}
          className="expansion-cost-icon"
        />
      </span>
    </div>
  );
}

