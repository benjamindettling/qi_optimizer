import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import shardsIcon from "/shards.webp";

/**
 * Modal to show config fix suggestions for resource deficits
 */
export function FixDeficitsModal({
  open,
  onClose,
  deficits,
  currentConfig,
  onApplyFix,
}) {
  if (!open || !deficits) return null;

  // Calculate required config changes to fix deficits
  const calculateFixes = () => {
    const fixes = {};

    if (deficits.coins && deficits.coins > 0) {
      const currentExtra = currentConfig?.extraCoins || 0;
      fixes.extraCoins = currentExtra + Math.ceil(deficits.coins);
    }

    if (deficits.supplies && deficits.supplies > 0) {
      const currentExtra = currentConfig?.extraSupplies || 0;
      fixes.extraSupplies = currentExtra + Math.ceil(deficits.supplies);
    }

    if (deficits.shards && deficits.shards > 0) {
      const currentStart = currentConfig?.shardsLimit || 500;
      fixes.shardsLimit = currentStart + Math.ceil(deficits.shards);
    }

    // For goods deficits, suggest increasing goodsStartBonus
    if (deficits.goods && Object.keys(deficits.goods).length > 0) {
      const maxGoodsDeficit = Math.max(...Object.values(deficits.goods));
      const currentBonus = currentConfig?.goodsStartBonus || 0;
      fixes.goodsStartBonus = currentBonus + Math.ceil(maxGoodsDeficit);
    }

    return fixes;
  };

  const fixes = calculateFixes();
  const hasAnything = Object.keys(fixes).length > 0;

  const formatNumber = (n) => {
    if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
    return String(Math.round(n));
  };

  const handleApply = () => {
    onApplyFix(fixes);
    onClose();
  };

  return (
    <div className="modal">
      <div
        className="modal-card help-modal"
        data-tutorial-zone="tree-fix-popup"
        style={{ maxWidth: "400px" }}
      >
        <div className="help-header">
          <h3>Config-Fix für Ressourcen</h3>
          <button onClick={onClose}>Schliessen</button>
        </div>

        <div className="modal-body" style={{ padding: "16px" }}>
          <p style={{ marginBottom: "16px", color: "var(--ui-text-muted)" }}>
            Folgende Config-Änderungen werden vorgeschlagen, um die
            Ressourcen-Defizite zu beheben:
          </p>

          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {/* Show current deficits */}
            <div
              style={{
                background: "rgba(236, 72, 153, 0.1)",
                border: "1px solid #ec4899",
                borderRadius: "6px",
                padding: "12px",
              }}
            >
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#ec4899",
                  marginBottom: "8px",
                }}
              >
                Aktuelle Defizite:
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "4px" }}
              >
                {deficits.coins > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                    }}
                  >
                    <img
                      src={moneyIcon}
                      alt="Coins"
                      style={{ width: "18px", height: "18px" }}
                    />
                    <span style={{ color: "#ef4444" }}>
                      −{formatNumber(deficits.coins)}
                    </span>
                    <span style={{ color: "var(--ui-text-muted)" }}>
                      Münzen
                    </span>
                  </div>
                )}
                {deficits.supplies > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                    }}
                  >
                    <img
                      src={suppliesIcon}
                      alt="Supplies"
                      style={{ width: "18px", height: "18px" }}
                    />
                    <span style={{ color: "#ef4444" }}>
                      −{formatNumber(deficits.supplies)}
                    </span>
                    <span style={{ color: "var(--ui-text-muted)" }}>
                      Vorräte
                    </span>
                  </div>
                )}
                {deficits.shards > 0 && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                    }}
                  >
                    <img
                      src={shardsIcon}
                      alt="Shards"
                      style={{ width: "18px", height: "18px" }}
                    />
                    <span style={{ color: "#ef4444" }}>
                      −{formatNumber(deficits.shards)}
                    </span>
                    <span style={{ color: "var(--ui-text-muted)" }}>
                      Scherben
                    </span>
                  </div>
                )}
                {deficits.goods &&
                  Object.entries(deficits.goods).map(([key, value]) => (
                    <div
                      key={key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                      }}
                    >
                      <span style={{ color: "#ef4444" }}>
                        −{formatNumber(value)}
                      </span>
                      <span style={{ color: "var(--ui-text-muted)" }}>
                        {key}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Show proposed config changes */}
            {hasAnything && (
              <div
                style={{
                  background: "rgba(34, 197, 94, 0.1)",
                  border: "1px solid #22c55e",
                  borderRadius: "6px",
                  padding: "12px",
                }}
              >
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#22c55e",
                    marginBottom: "8px",
                  }}
                >
                  Vorgeschlagene Config-Änderungen:
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {fixes.extraCoins !== undefined && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                      }}
                    >
                      <img
                        src={moneyIcon}
                        alt="Coins"
                        style={{ width: "18px", height: "18px" }}
                      />
                      <span>Extra Münzen:</span>
                      <span style={{ color: "var(--ui-text-muted)" }}>
                        {currentConfig?.extraCoins || 0}
                      </span>
                      <span>→</span>
                      <span style={{ color: "#22c55e", fontWeight: "600" }}>
                        {fixes.extraCoins}
                      </span>
                    </div>
                  )}
                  {fixes.extraSupplies !== undefined && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                      }}
                    >
                      <img
                        src={suppliesIcon}
                        alt="Supplies"
                        style={{ width: "18px", height: "18px" }}
                      />
                      <span>Extra Vorräte:</span>
                      <span style={{ color: "var(--ui-text-muted)" }}>
                        {currentConfig?.extraSupplies || 0}
                      </span>
                      <span>→</span>
                      <span style={{ color: "#22c55e", fontWeight: "600" }}>
                        {fixes.extraSupplies}
                      </span>
                    </div>
                  )}
                  {fixes.shardsLimit !== undefined && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                      }}
                    >
                      <img
                        src={shardsIcon}
                        alt="Shards"
                        style={{ width: "18px", height: "18px" }}
                      />
                      <span>Scherben-Limit:</span>
                      <span style={{ color: "var(--ui-text-muted)" }}>
                        {currentConfig?.shardsLimit || 500}
                      </span>
                      <span>→</span>
                      <span style={{ color: "#22c55e", fontWeight: "600" }}>
                        {fixes.shardsLimit}
                      </span>
                    </div>
                  )}
                  {fixes.goodsStartBonus !== undefined && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        fontSize: "13px",
                      }}
                    >
                      <span>Waren-Bonus:</span>
                      <span style={{ color: "var(--ui-text-muted)" }}>
                        {currentConfig?.goodsStartBonus || 0}
                      </span>
                      <span>→</span>
                      <span style={{ color: "#22c55e", fontWeight: "600" }}>
                        {fixes.goodsStartBonus}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
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
          {hasAnything && (
            <button
              onClick={handleApply}
              style={{
                padding: "8px 16px",
                background: "#22c55e",
                border: "none",
                borderRadius: "4px",
                color: "white",
                fontWeight: "600",
                cursor: "pointer",
              }}
            >
              Fix anwenden
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
