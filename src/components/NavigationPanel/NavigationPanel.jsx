// Navigation panel combining time step display with tree navigation buttons

import { ArrowLeft, ArrowLeftToLine, ArrowRight, ArrowRightToLine } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import "./NavigationPanel.css";

export function NavigationPanel({
  timeStep,
  timePart,
  timePartTotal,
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
  const stepLabel = `${t("stepLabel")} ${stepVal}`;
  const dayLabel = `${dayNames[dayIndex]} ${period}`;

  const hasParts = (timePartTotal ?? 0) > 1 && (timePart ?? 0) > 0;
  const partColor =
    timePart && timePartTotal && timePart === timePartTotal ? "#2ecc71" : "#f1c40f";

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
          title={t("treePrevCheckpoint")}
        >
          <ArrowLeftToLine size={22} />
        </button>
        <button className="nav-btn" onClick={onStepBack} title={t("treeStepBack")}>
          <ArrowLeft size={22} />
        </button>
        <button
          className="nav-btn"
          onClick={onStepForward}
          title={t("treeStepForward")}
        >
          <ArrowRight size={22} />
        </button>
        <button
          className="nav-btn"
          onClick={onJumpNextCheckpoint}
          title={t("treeNextCheckpoint")}
        >
          <ArrowRightToLine size={22} />
        </button>
      </div>
    </div>
  );
}

