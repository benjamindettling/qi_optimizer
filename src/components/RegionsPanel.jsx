import { RegionBadge } from "./RegionBadge";

export function RegionsPanel({
  viewMode,
  regionTransform,
  unlockedRegions,
  regionMask,
  neighborUnlocked,
  currentGoodsCost,
  currentShardCost,
  canAnyUnlock,
  handleUnlockRegion,
  REGION_COLS,
  debugRegions = false,
  onToggleDebugRegions,
  onDebugUnlockRegion,
  onDebugLockRegion,
}) {
  return (
    <div className="regions">
      <div className="regions-title">
        <span>Regions</span>
        <label className="region-debug-toggle" title="Toggle debug region edit">
          <input
            type="checkbox"
            checked={debugRegions}
            onChange={() => onToggleDebugRegions?.()}
          />
          Debug
        </label>
      </div>
      <div className={`region-frame view-${viewMode}`} style={{ transform: regionTransform }}>
        <div className="region-grid" style={{ gridTemplateColumns: `repeat(${REGION_COLS}, 1fr)` }}>
          {unlockedRegions.map((flag, idx) => {
            const row = Math.floor(idx / REGION_COLS);
            const col = idx % REGION_COLS;
            const maskVal = regionMask[row][col];
            const isVoid = maskVal === "N";
            const isBase = maskVal === "S";
            const canDebugUnlock = !flag && neighborUnlocked(idx) && !isVoid;
            return (
              <RegionBadge
                key={idx}
                unlocked={flag}
                isNeighbor={neighborUnlocked(idx)}
                isVoid={isVoid}
                canUnlock={canAnyUnlock}
                onUnlock={() => handleUnlockRegion(idx)}
                debugMode={debugRegions}
                canDebugUnlock={canDebugUnlock}
                onDebugUnlock={() => onDebugUnlockRegion?.(idx)}
                onDebugLock={() => onDebugLockRegion?.(idx, isBase)}
                isBase={isBase}
              />
            );
          })}
        </div>
      </div>
      <div className="region-note">
        Costs scale per unlock. Current: {currentGoodsCost} goods or {currentShardCost} shards.
      </div>
    </div>
  );
}
