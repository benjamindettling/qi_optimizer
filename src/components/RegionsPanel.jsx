import { REGION_GOODS_COSTS, REGION_SHARD_COSTS } from "../config/boardConfig";
import { formatNumber } from "../utils/formatNumber";
import { RegionBadge } from "./RegionBadge";

export function RegionsPanel({
  viewMode,
  regionTransform,
  unlockedRegions,
  regionMask,
  neighborUnlocked,
  currentGoodsCost,
  currentShardCost,
  goodsUnlocks,
  shardUnlocks,
  onSetGoodsUnlocks,
  onSetShardUnlocks,
  infiniteResources = false,
  adminMode = false,
  canAnyUnlock,
  handleUnlockRegion,
  REGION_COLS,
  onDebugUnlockRegion,
  onDebugLockRegion,
}) {
  return (
    <div className="regions">
      <div className="regions-title-row">
        <div className="regions-title">Regions</div>
      </div>

      <div className={`region-frame ${viewMode ? `view-${viewMode}` : ""}`}>
        <div
          className="region-grid"
          style={{
            gridTemplateColumns: `repeat(${REGION_COLS}, 1fr)`,
            transform: regionTransform,
          }}
        >
          {unlockedRegions.map((flag, idx) => {
            const row = Math.floor(idx / REGION_COLS);
            const col = idx % REGION_COLS;

            const mask = regionMask?.[row]?.[col];
            const isVoid = mask === "N";
            const isBase = mask === "S";
            const isNeighbor =
              typeof neighborUnlocked === "function"
                ? neighborUnlocked(idx)
                : !!neighborUnlocked?.[idx];

            return (
              <RegionBadge
                key={idx}
                unlocked={!!flag}
                isNeighbor={isNeighbor}
                isVoid={isVoid}
                isBase={isBase}
                canUnlock={infiniteResources ? true : canAnyUnlock}
                onUnlock={() => handleUnlockRegion?.(idx)}
                debugMode={adminMode}
                onDebugUnlock={() => adminMode && onDebugUnlockRegion?.(idx)}
                onDebugLock={() => adminMode && onDebugLockRegion?.(idx, isBase)}
              />
            );
          })}
        </div>
      </div>

      <div className="region-note">
        Kosten skalieren mit jedem Kauf. Aktuell:{" "}
        <span className={adminMode ? "cost-debug" : ""}>
          {adminMode ? (
            <select
              value={goodsUnlocks}
              onChange={(e) => {
                const idx = Number(e.target.value);
                if (Number.isFinite(idx) && onSetGoodsUnlocks)
                  onSetGoodsUnlocks(idx);
              }}
            >
              {REGION_GOODS_COSTS.map((cost, idx) => (
                <option key={idx} value={idx}>
                  {formatNumber(cost)}
                </option>
              ))}
            </select>
          ) : (
            `${formatNumber(currentGoodsCost)} Güter`
          )}
        </span>{" "}
        or{" "}
        <span className={adminMode ? "cost-debug" : ""}>
          {adminMode ? (
            <select
              value={shardUnlocks}
              onChange={(e) => {
                const idx = Number(e.target.value);
                if (Number.isFinite(idx) && onSetShardUnlocks)
                  onSetShardUnlocks(idx);
              }}
            >
              {REGION_SHARD_COSTS.map((cost, idx) => (
                <option key={idx} value={idx}>
                  {formatNumber(cost)}
                </option>
              ))}
            </select>
          ) : (
            `${formatNumber(currentShardCost)} Scherben`
          )}
        </span>
        . <br></br>
        Werte ändern automatisch, oder können im Admin-Modus bearbeitet werden
      </div>
    </div>
  );
}
