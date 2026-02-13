// Step Tracker panel for TopBar - step navigation controls
import {
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
} from "lucide-react";

export function StepTracker({
  timeStep,
  loadName,
  canStepBack,
  canStepForward,
  onJumpPrevCheckpoint,
  onStepBack,
  onStepForward,
  onJumpNextCheckpoint,
}) {
  const stepVal = Math.max(1, Math.min(23, timeStep ?? 1));
  const dayNames = ["Do", "Fr", "Sa", "So", "Mo", "Di", "Mi"];
  const dayIndex = Math.floor((stepVal - 1) / 2) % dayNames.length;
  const period = stepVal % 2 === 1 ? "Morgen" : "Abend";
  const dayDisplay = `${dayNames[dayIndex]} ${period}`;

  return (
    <div className="step-tracker-panel">
      <div className="step-display">
        <span className="step-main">Schritt {timeStep ?? 1}</span>
        <span className="step-day">{dayDisplay}</span>
        <span className="step-savename">{loadName || "-"}</span>
      </div>
      <div className="step-buttons">
        <button
          className="step-btn"
          onClick={onJumpPrevCheckpoint}
          disabled={!canStepBack}
          title="Zum ersten Schritt springen"
          aria-label="Zum ersten Schritt springen"
        >
          <ArrowLeftToLine size={20} />
        </button>
        <button
          className="step-btn"
          onClick={onStepBack}
          disabled={!canStepBack}
          title="Einen Schritt zurück"
          aria-label="Einen Schritt zurück"
        >
          <ArrowLeft size={20} />
        </button>
        <button
          className="step-btn"
          onClick={onStepForward}
          disabled={!canStepForward}
          title="Einen Schritt vorwärts"
          aria-label="Einen Schritt vorwärts"
        >
          <ArrowRight size={20} />
        </button>
        <button
          className="step-btn"
          onClick={onJumpNextCheckpoint}
          disabled={!canStepForward}
          title="Zum letzten Schritt springen"
          aria-label="Zum letzten Schritt springen"
        >
          <ArrowRightToLine size={20} />
        </button>
      </div>
    </div>
  );
}
