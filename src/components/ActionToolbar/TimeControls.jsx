// Time navigation controls for moving between checkpoints.
import { ArrowLeft, ArrowRight, Plus } from "lucide-react";

export function TimeControls({
  stepLabel,
  hasParts,
  partColor,
  timePart,
  timePartTotal,
  canTimeBack,
  canTimeForward,
  isLatestCheckpoint,
  onStepBack,
  onStepForward,
  onAddCheckpoint,
}) {
  return (
    <div className="actions-row time-row">
      <button
        className="action-button"
        onClick={onStepBack}
        disabled={!canTimeBack}
        title="Zum vorherigen Zeitschritt"
      >
        <ArrowLeft />
      </button>
      {isLatestCheckpoint ? (
        <button
          className="action-button"
          onClick={onAddCheckpoint}
          title="Neuen Zwischen-Checkpoint einfuegen"
        >
          <Plus />
        </button>
      ) : (
        <button
          className="action-button"
          onClick={onStepForward}
          disabled={!canTimeForward}
          title="Zum naechsten Zeitschritt"
        >
          <ArrowRight />
        </button>
      )}
      <div className="time-tracker-label">
        <span>{stepLabel}</span>
        {hasParts && (
          <span>
            Teil <span style={{ color: partColor }}>{timePart}</span> von{" "}
            <span style={{ color: partColor }}>{timePartTotal}</span>
          </span>
        )}
      </div>
    </div>
  );
}
