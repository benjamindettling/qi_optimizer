// Navigation panel combining time step display with tree navigation buttons

import { ArrowLeft, ArrowLeftToLine, ArrowRight, ArrowRightToLine } from "lucide-react";
import "./NavigationPanel.css";

export function NavigationPanel({
  // Time step info
  timeStep,
  timePart,
  timePartTotal,
  // Navigation callbacks (from tree visualizer)
  onJumpPrevCheckpoint,
  onStepBack,
  onStepForward,
  onJumpNextCheckpoint,
}) {
  const stepVal = Math.max(1, Math.min(23, timeStep ?? 1));
  const dayNames = ["Do", "Fr", "Sa", "So", "Mo", "Di", "Mi"];
  const dayIndex = Math.floor((stepVal - 1) / 2) % dayNames.length;
  const period = stepVal % 2 === 1 ? "Morgen" : "Abend";
  const stepLabel = `Schritt ${stepVal}`;
  const dayLabel = `${dayNames[dayIndex]} ${period}`;
  
  const hasParts = (timePartTotal ?? 0) > 1 && (timePart ?? 0) > 0;
  const partColor = timePart && timePartTotal && timePart === timePartTotal
    ? "#2ecc71"
    : "#f1c40f";

  return (
    <div className="navigation-panel">
      <div className="nav-time-display">
        <div className="nav-step">{stepLabel}</div>
        <div className="nav-day">{dayLabel}</div>
        {hasParts && (
          <div className="nav-parts">
            Teil <span style={{ color: partColor }}>{timePart}</span>
            <span className="nav-parts-sep">/</span>
            <span style={{ color: partColor }}>{timePartTotal}</span>
          </div>
        )}
      </div>
      <div className="nav-buttons">
        <button
          className="nav-btn"
          onClick={onJumpPrevCheckpoint}
          title="Vorheriger Checkpoint (Shift+←)"
        >
          <ArrowLeftToLine size={22} />
        </button>
        <button
          className="nav-btn"
          onClick={onStepBack}
          title="Schritt zurück (←)"
        >
          <ArrowLeft size={22} />
        </button>
        <button
          className="nav-btn"
          onClick={onStepForward}
          title="Schritt vor (→)"
        >
          <ArrowRight size={22} />
        </button>
        <button
          className="nav-btn"
          onClick={onJumpNextCheckpoint}
          title="Nächster Checkpoint (Shift+→)"
        >
          <ArrowRightToLine size={22} />
        </button>
      </div>
    </div>
  );
}
