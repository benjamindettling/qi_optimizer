// Main action toolbar with mode toggles, saves, and notes.
import { useEffect, useState } from "react";
import { ClockArrowUp, Move, Redo, Trash2, Undo } from "lucide-react";
import { NotesEditor } from "./NotesEditor";
import { SaveMenu } from "./SaveMenu";
import { TimeControls } from "./TimeControls";
import { ACTION_COLORS } from "../../config/colors";
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
  selectMode,
  onToggleSelectMode,
  autoSelectNew = false,
  onToggleAutoSelectNew,
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
  const stepVal = Math.max(1, Math.min(23, timeStep ?? 1));
  const dayNames = ["Do", "Fr", "Sa", "So", "Mo", "Di", "Mi"];
  const dayIndex = Math.floor((stepVal - 1) / 2) % dayNames.length;
  const period = stepVal % 2 === 1 ? "Morgen" : "Abend";
  const stepLabel = `Schritt ${stepVal}, ${dayNames[dayIndex]} ${period}`;

  const harvestTitle = harvestIsPartial
    ? "Sammelt nur fertige Produktionen ein"
    : "Volle Ernte: erntet die gesamte Stadt";
  const hasParts = (timePartTotal ?? 0) > 1 && (timePart ?? 0) > 0;
  const partColor =
    timePart && timePartTotal && timePart === timePartTotal
      ? "#2ecc71"
      : "#f1c40f";

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
            title="Bewege oder tausche Gebaeude nach Belieben"
          >
            <Move />
          </button>
          {!editUnlocked && (
            <button
              className="action-button warn"
              onClick={onOpenPastEditWarning}
              title="Bearbeitung im Vergangenheitszustand aktivieren"
            >
              Bearbeitung aktivieren
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
              title="Bewege oder tausche Gebaeude nach Belieben"
            >
              <Move />
            </button>
            <button
              onClick={onToggleSell}
              className={`mode-button ${sellMode ? "active-mode" : ""}`}
              style={{ background: ACTION_COLORS.sell }}
              title="Verkauf Gebaeude. Erhalte 1/4 des gezahlten Werts zurueck"
            >
              <Trash2 />
            </button>
            <button
              onClick={onToggleBoost}
              className={`mode-button ${boostMode ? "active-mode" : ""}`}
              style={{ background: ACTION_COLORS.boostSingle }}
              title="Boost einzelne Gebaeude: entsperre oder beende Produktionen"
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
            >
              {harvestIsPartial ? "Rest einsammeln" : "Ernte"}
            </button>
            <button
              onClick={finishProductions}
              className="action-button"
              style={{ background: ACTION_COLORS.boostAll }}
              title="Beendet alle Produktionen. Danach kannst du ernten"
            >
              <ClockArrowUp />
              <span style={{ marginLeft: 6 }}>alle</span>
            </button>
          </div>
        </>
      )}

      <div className="actions-row">
        <button
          className="action-button"
          onClick={onSnapshotBack}
          disabled={!canSnapshotBack}
          title="Vorherigen Snapshot laden"
        >
          <Undo />
        </button>
        <button
          className="action-button"
          onClick={onSnapshotForward}
          disabled={!canSnapshotForward}
          title="Naechsten Snapshot laden"
        >
          <Redo />
        </button>
      </div>

      <div className="actions-row">
        <button
          onClick={handleSaveClick}
          className="action-button"
          title="Speicher aktuellen Stand (inkl. Undo/Redo) in deinem Browser."
        >
          Speichern als
        </button>
        <button
          onClick={() => {
            if (loadName) onLoad(loadName);
          }}
          className="action-button"
          disabled={!loadName}
        >
          Laden
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
          Export
        </button>
        <button className="action-button" onClick={onOpenImport}>
          Import
        </button>
        <button
          className="action-button"
          onClick={onExportPdf}
          title="Aktuelle Datei als PDF exportieren"
        >
          File -&gt; PDF
        </button>
      </div>

      <NotesEditor notes={notes} onChangeNotes={onChangeNotes} />

      <div className="actions-row">
        <span>
          <b>Weitere Tools:</b>
        </span>
        <button
          className="action-button"
          onClick={() => setExtraToolsCollapsed((prev) => !prev)}
          title={
            extraToolsCollapsed
              ? "Weitere Tools einblenden"
              : "Weitere Tools ausblenden"
          }
        >
          {extraToolsCollapsed ? "Einblenden" : "Ausblenden"}
        </button>
      </div>

      {!extraToolsCollapsed && (
        <>
          <button
            onClick={onToggleRefund}
            className={`mode-button refund ${refundMode ? "active-mode" : ""}`}
            title="DEBUG: Erhalte den VOLLEN Wert des Gebaeudes zurueck"
          >
            Volle Erstattung
          </button>
          <div className="actions-row">
            <button
              className={`mode-button select ${selectMode ? "active-mode" : ""}`}
              onClick={onToggleSelectMode}
              title="Markiere Gebaeude rot, ohne sie zu aendern"
            >
              <span>Select</span>
              <label className="select-auto">
                <input
                  type="checkbox"
                  checked={autoSelectNew}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleAutoSelectNew?.()}
                  title="Neue Gebaeude automatisch markieren"
                />
              </label>
            </button>
            <button
              className="action-button print"
              onClick={onPrintBoard}
              title="Screenshot des aktuellen Aufbaus herunterladen"
            >
              Print
            </button>
          </div>
          <button
            className="action-button worst"
            onClick={onFindWorst}
            title="Berechne, welche Wohn-/Produktionsgebaeude beim Entfernen den hoechsten Ertrag uebrig lassen"
          >
            Finde schlechtestes
          </button>
        </>
      )}
    </div>
  );
}
