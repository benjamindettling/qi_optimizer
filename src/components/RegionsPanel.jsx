import { useState } from "react";
import { RegionBadge } from "./RegionBadge";
import { REGION_GOODS_COSTS, REGION_SHARD_COSTS } from "../config/boardConfig";

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
  canAnyUnlock,
  handleUnlockRegion,
  REGION_COLS,
  debugRegions = false,
  onToggleDebugRegions,
  onDebugUnlockRegion,
  onDebugLockRegion,
}) {
  const [editGoods, setEditGoods] = useState(false);
  const [editShards, setEditShards] = useState(false);

  return (
    <div className="regions">
      <div className="regions-title-row">
        <div className="regions-title">Regions</div>

        {/* Keep this always present so layout never changes */}
        <label className="regions-debug">
          <input
            type="checkbox"
            checked={debugRegions}
            onChange={(e) => onToggleDebugRegions?.(e.target.checked)}
          />
          Debug
        </label>
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
                debugMode={debugRegions}
                onDebugUnlock={() => onDebugUnlockRegion?.(idx)}
                onDebugLock={() => onDebugLockRegion?.(idx, isBase)}
              />
            );
          })}
        </div>
      </div>

      <div className="region-note">
        Costs scale per unlock. Current:{" "}
        <span
          className={debugRegions ? "cost-debug" : ""}
          onDoubleClick={() => debugRegions && setEditGoods(true)}
          title={debugRegions ? "Double-click to adjust goods cost index" : ""}
        >
          {editGoods && debugRegions ? (
            <select
              autoFocus
              value={goodsUnlocks}
              onChange={(e) => {
                const idx = Number(e.target.value);
                if (Number.isFinite(idx) && onSetGoodsUnlocks)
                  onSetGoodsUnlocks(idx);
                setEditGoods(false);
              }}
              onBlur={() => setEditGoods(false)}
            >
              {REGION_GOODS_COSTS.map((cost, idx) => (
                <option key={idx} value={idx}>
                  {cost}
                </option>
              ))}
            </select>
          ) : (
            `${currentGoodsCost} goods`
          )}
        </span>{" "}
        or{" "}
        <span
          className={debugRegions ? "cost-debug" : ""}
          onDoubleClick={() => debugRegions && setEditShards(true)}
          title={debugRegions ? "Double-click to adjust shard cost index" : ""}
        >
          {editShards && debugRegions ? (
            <select
              autoFocus
              value={shardUnlocks}
              onChange={(e) => {
                const idx = Number(e.target.value);
                if (Number.isFinite(idx) && onSetShardUnlocks)
                  onSetShardUnlocks(idx);
                setEditShards(false);
              }}
              onBlur={() => setEditShards(false)}
            >
              {REGION_SHARD_COSTS.map((cost, idx) => (
                <option key={idx} value={idx}>
                  {cost}
                </option>
              ))}
            </select>
          ) : (
            `${currentShardCost} shards`
          )}
        </span>
        .
      </div>
    </div>
  );
}
