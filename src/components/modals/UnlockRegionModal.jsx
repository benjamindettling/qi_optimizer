// src/components/modals/UnlockRegionModal.jsx
import { formatNumber } from "../../utils/formatNumber";
import { Infinity as InfinityIcon } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import {
  allowShardLimitOverflow,
  willShardCostExceedLimit,
} from "../../utils/shards";

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
 *     mode?: "unlock" | "lock",
 *     adminMode?: boolean,
 *     goodsCost: number,
 *     shardCost: number,
 *     nextGoodsCost?: number | null,
 *     nextShardCost?: number | null,
 *     allowGoods: boolean,
 *     allowShards: boolean,
 *   } | null
 * - onChooseGoods: (choice: any) => void
 * - onChooseShards: (choice: any) => void
 * - onCancel: () => void
 * - shards: number
 * - config: object
 */
export function UnlockRegionModal({
  unlockChoice,
  onChooseGoods,
  onChooseShards,
  onCancel,
  shards = 0,
  config,
}) {
  if (!unlockChoice) return null;
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  const {
    goodsCost,
    shardCost,
    nextGoodsCost = null,
    nextShardCost = null,
    allowGoods,
    allowShards,
    mode = "unlock",
  } = unlockChoice;
  const goodsIcon = "/menu/goods.png";
  const shardsIcon = "/shards.webp";
  const isLockMode = mode === "lock";
  const shardWillGoNegative =
    allowShardLimitOverflow(config) &&
    !isInfinityCost(shardCost) &&
    !isLockMode &&
    willShardCostExceedLimit({ shards: shards ?? 0, cost: shardCost });

  const renderChoiceValue = (currentCost, nextCost, enabled, className = "") => {
    if (isLockMode) {
      return (
        <span className="region-choice-line">
          {renderCostValue(currentCost, className)}
          {enabled && nextCost !== null ? (
            <>
              <span className="region-choice-arrow">-&gt;</span>
              {renderCostValue(nextCost, className)}
            </>
          ) : null}
        </span>
      );
    }

    return renderCostValue(currentCost, className);
  };

  return (
    <div className="modal">
      <div className="modal-card region-choice-modal">
        <h3>{isLockMode ? t("lockRegionTitle") : t("unlockRegionTitle")}</h3>
        <div className="modal-body region-choice-grid">
          <button
            onClick={() => {
              if (!allowGoods) return;
              onChooseGoods?.(unlockChoice);
            }}
            disabled={!allowGoods}
            className="region-choice-button"
          >
            <img src={goodsIcon} alt={t("goodsAlt")} className="inline-icon" />
            {renderChoiceValue(goodsCost, nextGoodsCost, allowGoods)}
          </button>
          <button
            onClick={() => {
              if (!allowShards) return;
              onChooseShards?.(unlockChoice);
            }}
            disabled={!allowShards}
            className="region-choice-button"
          >
            <img src={shardsIcon} alt={t("shardsAlt")} className="inline-icon" />
            {renderChoiceValue(
              shardCost,
              nextShardCost,
              allowShards,
              shardWillGoNegative ? "text-negative" : "",
            )}
          </button>
        </div>
        <div className="modal-actions">
          <button onClick={onCancel}>{t("loadSavesBtnCancel")}</button>
        </div>
      </div>
    </div>
  );
}
