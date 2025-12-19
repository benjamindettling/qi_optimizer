export function RegionBadge({
  unlocked,
  isNeighbor,
  isVoid,
  canUnlock,
  onUnlock,
  debugMode = false,
  onDebugUnlock,
  onDebugLock,
  isBase = false,
  canDebugUnlock = false,
}) {
  if (isVoid) return <span className="region void" />;

  if (unlocked) {
    return (
      <div className="region unlocked">
        {debugMode && !isBase && (
          <button
            className="region-debug-btn remove"
            onClick={onDebugLock}
            title="Remove region (debug)"
            type="button"
          />
        )}
      </div>
    );
  }

  return (
    <div className={`region locked ${isNeighbor ? "neighbor" : ""}`}>
      {isNeighbor && (
        <button className="region-unlock-btn" disabled={!canUnlock} onClick={onUnlock} title="Unlock region" />
      )}
      {debugMode && canDebugUnlock && (
        <button
          className="region-debug-btn add"
          onClick={onDebugUnlock}
          title="Debug unlock region"
          type="button"
        />
      )}
    </div>
  );
}
