// Main action toolbar with mode toggles, saves, and notes.
import { useEffect, useState } from "react";
import { ClockArrowUp, Move, Redo, Trash2, Undo } from "lucide-react";
import { NotesEditor } from "./NotesEditor";
import { SaveMenu } from "./SaveMenu";
import { TimeControls } from "./TimeControls";
import { ACTION_COLORS } from "../../config/colors";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import "./ActionToolbar.css";

const EXTRA_TOOLS_STORAGE_KEY = "qi_extraToolsCollapsed";

export function ActionToolbar({
  moveMode,
  sellMode,
  refundMode,
  boostMode,
  onToggleMove,
  onToggleSell,
  onToggleRefund,
  onToggleBoost,
  finishProductions,
  harvestAll,
  harvestIsPartial = false,
  onSave,
  onLoad,
  saves = {},
  snapshots = [],
  selectedSnapshotName = null,
  loadName,
  setLoadName,
  onDeleteSave,
  notes,
  onChangeNotes,
  highlightMode,
  onToggleHighlightMode,
  onPrintBoard,
  onFindWorst,
  onOpenExport,
  onOpenImport,
  onExportPdf,
  onSnapshotBack,
  onSnapshotForward,
  timeStep,
  canTimeBack,
  canTimeForward,
  onStepBack,
  onStepForward,
  onAddCheckpoint,
  isLatestCheckpoint = false,
  timePart = null,
  timePartTotal = 0,
  isPast = false,
  editUnlocked = false,
  onOpenPastEditWarning,
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
  const stepLabel = `${t("stepLabel")} ${stepVal}, ${dayNames[dayIndex]} ${period}`;

  const harvestTitle = harvestIsPartial
    ? t("toolHarvestPartialTitle")
    : t("toolHarvestFullTitle");
  const hasParts = (timePartTotal ?? 0) > 1 && (timePart ?? 0) > 0;
  const partColor =
    timePart && timePartTotal && timePart === timePartTotal ? "#2ecc71" : "#f1c40f";

  const selectedSnapshotIdx = snapshots.findIndex(
    (s) => s.name === selectedSnapshotName,
  );
  const canSnapshotBack = selectedSnapshotIdx > 0;
  const canSnapshotForward =
    selectedSnapshotIdx >= 0 && selectedSnapshotIdx < snapshots.length - 1;

  const [extraToolsCollapsed, setExtraToolsCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const raw = localStorage.getItem(EXTRA_TOOLS_STORAGE_KEY);
      if (raw === "true") return true;
      if (raw === "false") return false;
    } catch {
      return false;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        EXTRA_TOOLS_STORAGE_KEY,
        extraToolsCollapsed ? "true" : "false",
      );
    } catch (e) {
      console.error("Failed to persist extra tools toggle", e);
    }
  }, [extraToolsCollapsed]);

  const promptSaveName = () => {
    const next = prompt("Save name?", loadName || "");
    if (!next) return null;
    setLoadName(next);
    return next;
  };

  const handleSaveClick = () => {
    const target = promptSaveName();
    if (!target) return;
    if (onSave) onSave(target);
  };

  return (
    <div className="actions-column">
      <TimeControls
        stepLabel={stepLabel}
        hasParts={hasParts}
        partColor={partColor}
        timePart={timePart}
        timePartTotal={timePartTotal}
        canTimeBack={canTimeBack}
        canTimeForward={canTimeForward}
        isLatestCheckpoint={isLatestCheckpoint}
        onStepBack={onStepBack}
        onStepForward={onStepForward}
        onAddCheckpoint={onAddCheckpoint}
      />

      {isPast ? (
        <div className="actions-row">
          <button
            onClick={onToggleMove}
            className={`mode-button ${moveMode ? "active-mode" : ""}`}
            style={{ background: ACTION_COLORS.move }}
            title={t("toolMoveTitle")}
            aria-label={t("toolMoveTitle")}
          >
            <Move />
          </button>
          {!editUnlocked && (
            <button
              className="action-button warn"
              onClick={onOpenPastEditWarning}
              title={t("toolPastEditTitle")}
              aria-label={t("toolPastEditTitle")}
            >
              {lang === "EN" ? "Enable editing" : "Bearbeitung aktivieren"}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="actions-row">
            <button
              onClick={onToggleMove}
              className={`mode-button ${moveMode ? "active-mode" : ""}`}
              style={{ background: ACTION_COLORS.move }}
              title={t("toolMoveTitle")}
              aria-label={t("toolMoveTitle")}
            >
              <Move />
            </button>
            <button
              onClick={onToggleSell}
              className={`mode-button ${sellMode ? "active-mode" : ""}`}
              style={{ background: ACTION_COLORS.sell }}
              title={t("toolSellTitle")}
              aria-label={t("toolSellTitle")}
            >
              <Trash2 />
            </button>
            <button
              onClick={onToggleBoost}
              className={`mode-button ${boostMode ? "active-mode" : ""}`}
              style={{ background: ACTION_COLORS.boostSingle }}
              title={t("toolBoostTitle")}
              aria-label={t("toolBoostTitle")}
            >
              <ClockArrowUp />
            </button>
          </div>

          <div className="actions-row">
            <button
              onClick={harvestAll}
              className="action-button"
              style={{
                background: harvestIsPartial
                  ? ACTION_COLORS.harvestPartial
                  : ACTION_COLORS.harvestFull,
              }}
              title={harvestTitle}
              aria-label={harvestTitle}
            >
              {harvestIsPartial
                ? lang === "EN"
                  ? "Collect Rest"
                  : "Rest einsammeln"
                : lang === "EN"
                  ? "Harvest"
                  : "Ernte"}
            </button>
            <button
              onClick={finishProductions}
              className="action-button"
              style={{ background: ACTION_COLORS.boostAll }}
              title={t("toolFinishProductionsTitle")}
              aria-label={t("toolFinishProductionsTitle")}
            >
              <ClockArrowUp />
              <span style={{ marginLeft: 6 }}>{lang === "EN" ? "all" : "alle"}</span>
            </button>
          </div>
        </>
      )}

      <div className="actions-row">
        <button
          className="action-button"
          onClick={onSnapshotBack}
          disabled={!canSnapshotBack}
          title={t("toolSnapshotBackTitle")}
          aria-label={t("toolSnapshotBackTitle")}
        >
          <Undo />
        </button>
        <button
          className="action-button"
          onClick={onSnapshotForward}
          disabled={!canSnapshotForward}
          title={t("toolSnapshotForwardTitle")}
          aria-label={t("toolSnapshotForwardTitle")}
        >
          <Redo />
        </button>
      </div>

      <div className="actions-row">
        <button
          onClick={handleSaveClick}
          className="action-button"
          title={t("toolSaveBrowserTitle")}
          aria-label={t("toolSaveBrowserTitle")}
        >
          {lang === "EN" ? "Save as" : "Speichern als"}
        </button>
        <button
          onClick={() => {
            if (loadName) onLoad(loadName);
          }}
          className="action-button"
          disabled={!loadName}
        >
          {t("btnLoadTitle")}
        </button>
      </div>

      <SaveMenu
        saves={saves}
        loadName={loadName}
        setLoadName={setLoadName}
        onDeleteSave={onDeleteSave}
      />

      <div className="actions-row">
        <button className="action-button" onClick={onOpenExport}>
          {t("quickMenuExport")}
        </button>
        <button className="action-button" onClick={onOpenImport}>
          {t("quickMenuImport")}
        </button>
        <button
          className="action-button"
          onClick={onExportPdf}
          title={t("toolExportPdfTitle")}
          aria-label={t("toolExportPdfTitle")}
        >
          File -&gt; PDF
        </button>
      </div>

      <NotesEditor notes={notes} onChangeNotes={onChangeNotes} />

      <div className="actions-row">
        <span>
          <b>{lang === "EN" ? "Extra Tools:" : "Weitere Tools:"}</b>
        </span>
        <button
          className="action-button"
          onClick={() => setExtraToolsCollapsed((prev) => !prev)}
          title={
            extraToolsCollapsed
              ? lang === "EN"
                ? "Show extra tools"
                : "Weitere Tools einblenden"
              : lang === "EN"
                ? "Hide extra tools"
                : "Weitere Tools ausblenden"
          }
        >
          {extraToolsCollapsed
            ? lang === "EN"
              ? "Show"
              : "Einblenden"
            : lang === "EN"
              ? "Hide"
              : "Ausblenden"}
        </button>
      </div>

      {!extraToolsCollapsed && (
        <>
          <button
            onClick={onToggleRefund}
            className={`mode-button refund ${refundMode ? "active-mode" : ""}`}
            title={t("toolRefundTitle")}
            aria-label={t("toolRefundTitle")}
          >
            {lang === "EN" ? "Full Refund" : "Volle Erstattung"}
          </button>
          <div className="actions-row">
            <button
              className={`mode-button select ${highlightMode ? "active-mode" : ""}`}
              onClick={onToggleHighlightMode}
              title={
                lang === "EN"
                  ? "Highlight affected buildings since the last checkpoint"
                  : "Hebt betroffene Gebäude seit dem letzten Checkpoint hervor"
              }
            >
              <span>Highlight</span>
            </button>
            <button
              className="action-button print"
              onClick={onPrintBoard}
              title={
                lang === "EN"
                  ? "Download a screenshot of the current layout"
                  : "Screenshot des aktuellen Aufbaus herunterladen"
              }
            >
              {lang === "EN" ? "Print" : "Print"}
            </button>
          </div>
          <button
            className="action-button worst"
            onClick={onFindWorst}
            title={
              lang === "EN"
                ? "Compute which housing/production buildings can be removed with best remaining yield"
                : "Berechne, welche Wohn-/Produktionsgebäude beim Entfernen den höchsten Ertrag übrig lassen"
            }
          >
            {lang === "EN" ? "Find worst" : "Finde schlechtestes"}
          </button>
        </>
      )}
    </div>
  );
}

