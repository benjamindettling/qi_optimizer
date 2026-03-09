// Step Tracker panel for TopBar - step navigation controls
import {
  ArrowLeft,
  ArrowLeftToLine,
  ArrowRight,
  ArrowRightToLine,
} from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";

export function StepTracker({
  timeStep,
  loadName,
  saveNameColor,
  canStepBack,
  canStepForward,
  onJumpPrevCheckpoint,
  onStepBack,
  onStepForward,
  onJumpNextCheckpoint,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  const stepVal = Math.max(1, Math.min(23, timeStep ?? 1));
  const dayNames = [
    t("stepDayThu"),
    t("stepDayFri"),
    t("stepDaySat"),
    t("stepDaySun"),
    t("stepDayMon"),
    t("stepDayTue"),
    t("stepDayWed"),
  ];
  const dayIndex = Math.floor((stepVal - 1) / 2) % dayNames.length;
  const period = stepVal % 2 === 1 ? t("stepMorgen") : t("stepAbend");
  const dayDisplay = `${dayNames[dayIndex]} ${period}`;

  return (
    <div className="step-tracker-panel" data-tutorial-zone="topbar-steps">
      <div className="step-display" data-help-id="step-time-display">
        <span className="step-main">
          {t("stepLabel")} {stepVal}
        </span>
        <span className="step-day">{dayDisplay}</span>
        <span
          className="step-savename"
          style={{ color: saveNameColor }}
          data-help-id="step-save-name"
        >
          {loadName || "-"}
        </span>
      </div>
      <div className="step-buttons" data-help-id="step-skip-buttons">
        <button
          className="step-btn"
          onClick={onJumpPrevCheckpoint}
          disabled={!canStepBack}
          title={t("stepJumpFirst")}
          aria-label={t("stepJumpFirst")}
        >
          <ArrowLeftToLine size={20} />
        </button>
        <button
          className="step-btn"
          onClick={onStepBack}
          disabled={!canStepBack}
          title={t("stepBack")}
          aria-label={t("stepBack")}
        >
          <ArrowLeft size={20} />
        </button>
        <button
          className="step-btn"
          onClick={onStepForward}
          disabled={!canStepForward}
          title={t("stepForward")}
          aria-label={t("stepForward")}
        >
          <ArrowRight size={20} />
        </button>
        <button
          className="step-btn"
          onClick={onJumpNextCheckpoint}
          disabled={!canStepForward}
          title={t("stepJumpLast")}
          aria-label={t("stepJumpLast")}
        >
          <ArrowRightToLine size={20} />
        </button>
      </div>
    </div>
  );
}

