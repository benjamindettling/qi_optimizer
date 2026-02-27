// Mini toolbar beside/above the board with mode buttons
import {
  Move,
  Trash2,
  ClockArrowUp,
  Store,
  FastForward,
  PackageCheck,
} from "lucide-react";
import { ACTION_COLORS } from "../../config/colors";
import { useTutorialGate } from "../../hooks/useTutorialGate";
import "./MiniToolbar.css";

export function MiniToolbar({
  moveMode,
  sellMode,
  boostMode,
  onToggleMove,
  onToggleSell,
  onToggleBoost,
  onOpenShop,
  isPlacementMode = false,
  onCancelPlacement,
  //harvest
  finishProductions,
  harvestPartial,
  harvestIsPartial = false,
  isPast = false,
  editUnlocked = false,
  onOpenPastEditWarning,
  // Orientation: "left" (vertical) or "top" (horizontal)
  position = "left",
}) {
  const isHorizontal = position === "top";
  const toolbarLocked = useTutorialGate("mini-toolbar");
  const toolbarClass = `mini-toolbar ${isHorizontal ? "mini-toolbar--horizontal" : "mini-toolbar--vertical"}`;

  if (isPast && !editUnlocked) {
    return (
      <div className={`${toolbarClass}${toolbarLocked ? " tutorial-zone-locked" : ""}`}>
        <button
          onClick={onToggleMove}
          className={`mini-btn ${moveMode ? "active-mode" : ""}`}
          style={{ background: ACTION_COLORS.move }}
          title="Bewege oder tausche Gebäude"
          data-tutorial-zone="move-btn"
        >
          <Move size={20} />
        </button>
        <button
          className="mini-btn warn"
          onClick={onOpenPastEditWarning}
          title="Bearbeitung im Vergangenheitszustand aktivieren"
        >
          Bearbeitung aktivieren
        </button>
      </div>
    );
  }

  return (
    <div className={`${toolbarClass}${toolbarLocked ? " tutorial-zone-locked" : ""}`}>
      <button
        onClick={onToggleMove}
        className={`mini-btn ${moveMode ? "active-mode" : ""}`}
        style={{ background: ACTION_COLORS.move }}
        title="Bewege oder tausche Gebäude"
        data-tutorial-zone="move-btn"
      >
        <Move size={20} />
      </button>
      <button
        onClick={onToggleSell}
        className={`mini-btn ${sellMode ? "active-mode" : ""}`}
        style={{ background: ACTION_COLORS.sell }}
        title="Verkaufe Gebäude (1/4 Erstattung)"
        data-tutorial-zone="sell-btn"
      >
        <Trash2 size={20} />
      </button>
      <button
        onClick={onToggleBoost}
        className={`mini-btn ${boostMode ? "active-mode" : ""}`}
        style={{ background: ACTION_COLORS.boostSingle }}
        title="Boost einzelne Gebäude"
        data-tutorial-zone="boost-btn"
      >
        <ClockArrowUp size={20} />
      </button>
      <button
        onClick={isPlacementMode ? onCancelPlacement : onOpenShop}
        className={`mini-btn shop-btn ${isPlacementMode ? "active-mode" : ""}`}
        style={{ background: ACTION_COLORS.build }}
        title={isPlacementMode ? "Platziermodus beenden" : "Shop öffnen"}
        data-tutorial-zone="shop-btn"
      >
        <Store size={20} />
      </button>

      {/* Visual separator / gap */}
      <div className="mini-toolbar-spacer" />

      <button
        onClick={finishProductions}
        className="mini-btn glow"
        style={{ background: ACTION_COLORS.boostAll }}
        title="Beendet alle Produktionen"
        data-tutorial-zone="finish-btn"
      >
        <FastForward size={25} />
      </button>
      <button
        onClick={harvestPartial}
        className="mini-btn"
        style={{ background: ACTION_COLORS.harvestPartial }}
        disabled={!harvestIsPartial}
        title={
          harvestIsPartial
            ? "Sammelt fertige Produktionen ein"
            : "Keine fertigen Produktionen"
        }
        data-tutorial-zone="harvest-btn"
      >
        <PackageCheck size={20} />
      </button>
    </div>
  );
}



