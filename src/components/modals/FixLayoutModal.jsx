import { useMemo } from "react";
import { Board } from "../Board/Board";

/**
 * Modal to show layout fix preview and allow applying the fix
 * Shows a full board preview with the fixed layout
 */
export function FixLayoutModal({
  open,
  onClose,
  fixedLayout,
  currentLayout,
  boardProps,
  onApplyFix,
}) {
  // Compute move operations needed - must be before any early returns
  const moveOperations = useMemo(() => {
    if (!currentLayout || !fixedLayout) return [];

    const moves = [];
    // Map current layout by id for quick lookup
    const currentById = new Map(currentLayout.map((inst) => [inst.id, inst]));

    for (const newInst of fixedLayout) {
      const oldInst = currentById.get(newInst.id);
      if (oldInst && (oldInst.x !== newInst.x || oldInst.y !== newInst.y)) {
        moves.push({
          id: newInst.id,
          defId: newInst.defId,
          fromX: oldInst.x,
          fromY: oldInst.y,
          toX: newInst.x,
          toY: newInst.y,
          width: newInst.width,
          height: newInst.height,
        });
      }
    }
    return moves;
  }, [currentLayout, fixedLayout]);

  // Early return after hooks
  if (!open || !fixedLayout) return null;

  const { libraryMap } = boardProps || {};

  // Get building name
  const getBuildingName = (defId) => {
    if (!defId || !libraryMap) return "?";
    const def = libraryMap[defId];
    return def?.short || def?.name || defId.split(":").pop() || "?";
  };

  // Create preview board props with the fixed layout
  // Keep all visual settings (rotation, transform, etc) but override layout and disable interactions
  const previewBoardProps = {
    ...boardProps,
    layout: fixedLayout,
    // Disable all interactions
    handleCellClick: () => {},
    setHoverCell: () => {},
    onDropComplete: () => {},
    onRegionClick: () => {},
    onDebugUnlockRegion: () => {},
    onDebugLockRegion: () => {},
    onWrapperResize: () => {},
    boardRef: null,
    // Clear highlight overlays
    highlightedIds: new Set(),
    // No ready/boost states in preview
    readyMap: {},
    buildLocks: {},
  };

  return (
    <div className="modal">
      <div className="modal-card help-modal" style={{ maxWidth: "500px" }}>
        <div className="help-header">
          <h3>Layout-Fix gefunden</h3>
          <button onClick={onClose}>Schliessen</button>
        </div>

        <div className="modal-body" style={{ padding: "16px" }}>
          <p style={{ marginBottom: "16px", color: "var(--ui-text-muted)" }}>
            Eine gültige Platzierung wurde gefunden. Folgende Gebäude werden
            verschoben:
          </p>

          {/* Move operations list */}
          {moveOperations.length > 0 && (
            <div
              style={{
                background: "rgba(249, 115, 22, 0.1)",
                border: "1px solid var(--color-warning)",
                borderRadius: "6px",
                padding: "12px",
                marginBottom: "16px",
                maxHeight: "120px",
                overflowY: "auto",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--color-warning)",
                  marginBottom: "8px",
                }}
              >
                {moveOperations.length} Verschiebung
                {moveOperations.length !== 1 ? "en" : ""}:
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                {moveOperations.map((move, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "12px",
                      color: "var(--ui-text-muted)",
                    }}
                  >
                    <span
                      style={{ fontWeight: "600", color: "var(--ui-white)" }}
                    >
                      {getBuildingName(move.defId)}
                    </span>
                    <span>
                      ({move.fromX},{move.fromY})
                    </span>
                    <span>→</span>
                    <span style={{ color: "var(--color-success)" }}>
                      ({move.toX},{move.toY})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Board preview - uses the real Board component with fixed layout */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginBottom: "16px",
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid var(--color-border)",
              maxHeight: "400px",
            }}
          >
            <div
              style={{ transform: "scale(0.6)", transformOrigin: "top center" }}
            >
              <Board {...previewBoardProps} />
            </div>
          </div>

          <p
            style={{
              fontSize: "12px",
              color: "var(--ui-text-muted)",
              textAlign: "center",
            }}
          >
            Vorschau der neuen Platzierung
          </p>
        </div>

        <div
          className="modal-actions"
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 16px",
              background: "rgba(255,255,255,0.1)",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              color: "var(--ui-white)",
              cursor: "pointer",
            }}
          >
            Abbrechen
          </button>
          <button
            onClick={() => {
              onApplyFix(fixedLayout, moveOperations);
              onClose();
            }}
            style={{
              padding: "8px 16px",
              background: "var(--color-warning)",
              border: "none",
              borderRadius: "4px",
              color: "white",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Fix anwenden
          </button>
        </div>
      </div>
    </div>
  );
}
