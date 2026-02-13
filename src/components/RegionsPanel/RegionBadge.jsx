// Single region tile, including debug unlock/lock behavior.
export function RegionBadge({
  unlocked,
  isNeighbor,
  isVoid,
  canUnlock,
  onUnlock,

  // debug
  debugMode = false,
  onDebugUnlock,
  onDebugLock,
  isBase = false,
}) {
  if (isVoid) return <span className="region void" />;

  const isDebugUnlockable = debugMode && !unlocked && isNeighbor;
  const isDebugLockable = debugMode && unlocked && !isBase;

  const className = [
    "region",
    unlocked ? "unlocked" : "locked",
    isNeighbor ? "neighbor" : "",
    isBase ? "base" : "",
    isDebugUnlockable ? "debug-unlockable" : "",
    isDebugLockable ? "debug-unlocked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = () => {
    if (debugMode) {
      // Debug behavior:
      // - green neighbor locked => unlock for free
      // - red unlocked => lock again (except base)
      if (isDebugUnlockable) onDebugUnlock?.();
      else if (isDebugLockable) onDebugLock?.();
      return;
    }

    // Normal behavior: do nothing on tile click (unlock uses button)
  };

  return (
    <div
      className={className}
      onClick={handleClick}
      role={debugMode ? "button" : undefined}
      tabIndex={debugMode ? 0 : undefined}
      onKeyDown={
        debugMode
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
      title={
        debugMode
          ? isDebugUnlockable
            ? "Debug: Unlock for free"
            : isDebugLockable
            ? "Debug: Lock again"
            : isBase
            ? "Base region (cannot lock)"
            : unlocked
            ? "Unlocked"
            : "Locked"
          : unlocked
          ? "Unlocked region"
          : isNeighbor
          ? "Neighbor region"
          : "Locked region"
      }
    >
      {/* Normal-mode unlock button only (no debug buttons => no size changes) */}
      {!debugMode && !unlocked && isNeighbor && (
        <button
          className="region-unlock-btn"
          disabled={!canUnlock}
          onClick={(e) => {
            e.stopPropagation();
            onUnlock?.();
          }}
          title="Unlock region"
          type="button"
        />
      )}
    </div>
  );
}
