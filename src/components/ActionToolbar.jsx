import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDropdownMenu } from "../hooks/useDropdownMenu";
import { useStorageEstimate } from "../hooks/useStorageEstimate";
import {
  ArrowLeft,
  ArrowRight,
  ClockArrowUp,
  Move,
  Plus,
  Trash2,
  Undo,
  Redo,
} from "lucide-react";

export const NOTE_RULES = [
  { regex: /\+/g, className: "notes-green" },
  { regex: /-/g, className: "notes-red" },
  { regex: />>/g, className: "notes-turquoise", fullLine: true },
  { regex: /\(1h\)/g, className: "notes-yellow" },
  { regex: /\(boost\)/g, className: "notes-yellow" },
];

const EXTRA_TOOLS_STORAGE_KEY = "qi_extraToolsCollapsed";

const applyRuleToLineHtml = (lineHtml, rule) => {
  if (!lineHtml) return lineHtml;

  // FULL-LINE RULE
  if (rule.fullLine) {
    const match = lineHtml.match(rule.regex);
    if (!match) return lineHtml; // nothing to do

    // remove all spans from this line (wipe previous styling)
    const plain = lineHtml.replace(/<span[^>]*>/g, "").replace(/<\/span>/g, "");

    return `<span class="${rule.className}">${plain}</span>`;
  }

  // NORMAL RULE – only operate on text, not tags
  const parts = lineHtml.split(/(<[^>]+>)/g);

  const processed = parts.map((part) => {
    // If this is a tag ("<...>"), never touch it
    if (part.startsWith("<")) return part;

    // Text chunk: apply regex and wrap matches in spans
    return part.replace(rule.regex, (match) => {
      return `<span class="${rule.className}">${match}</span>`;
    });
  });

  return processed.join("");
};

export const formatNotesHtml = (text) => {
  const raw = text || "";

  // Start as plain text lines (no spans)
  let htmlLines = raw.split(/\n/);

  // Apply rules one by one, across all lines
  for (const rule of NOTE_RULES) {
    htmlLines = htmlLines.map((lineHtml) =>
      applyRuleToLineHtml(lineHtml, rule),
    );
  }

  const merged = htmlLines.join("<br />");

  return merged || '<span class="notes-placeholder">Fuege Notizen hinzu</span>';
};

function StorageInfoInline() {
  const { supported, usage, quota, indexedDB, percent, formatBytes } =
    useStorageEstimate({ intervalMs: 30 });

  if (!supported) {
    return (
      <div style={{ fontSize: 13, opacity: 0.8 }}>
        Storage info not available in this browser.
      </div>
    );
  }

  return (
    <div style={{ fontSize: 13, lineHeight: 1.4 }}>
      <div>
        <strong>Speicher benutzt:</strong> {formatBytes(usage)}
      </div>
      <div>
        <strong>Freier Speicher:</strong> {formatBytes(quota)}
      </div>
      {indexedDB != null && (
        <div>
          <strong>IndexedDB used:</strong> {formatBytes(indexedDB)}
        </div>
      )}
      {percent != null && (
        <div>
          <strong>Verwendet:</strong> {percent.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

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
  onSmartHarvest,
  onSmartInvest,
  onOpenSmartInvestResults,
  smartInvestResultsAvailable = false,
  smartInvestRunning = false,
  harvestIsPartial = false,
  onSave,
  onLoad,
  saves = {},
  snapshots = [],
  selectedSnapshotName = null,
  loadName,
  setLoadName,
  toolbarOffset = 0,
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
  onCreateSnapshot,
  onLoadSnapshot,
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
  editingLocked = false,
}) {
  const stepVal = Math.max(1, Math.min(23, timeStep ?? 1));
  const dayNames = ["Do", "Fr", "Sa", "So", "Mo", "Di", "Mi"];
  const dayIndex = Math.floor((stepVal - 1) / 2) % dayNames.length;
  const period = stepVal % 2 === 1 ? "Morgen" : "Abend";
  const stepLabel = `Schritt ${stepVal}, ${dayNames[dayIndex]} ${period}`;

  const saveKeys = Object.entries(saves || {})
    .filter(([, entry]) => !entry?.meta?.isSnapshot)
    .map(([name]) => name)
    .sort((a, b) => a.localeCompare(b));
  const {
    ref: saveMenuRef,
    isOpen: isSaveMenuOpen,
    setIsOpen: setIsSaveMenuOpen,
  } = useDropdownMenu(false);

  const promptSaveName = () => {
    const next = prompt("Save name?", loadName || "");
    if (!next) return;
    setLoadName(next);
    return next;
  };

  const handleSaveClick = () => {
    const target = promptSaveName();
    if (!target) return;
    if (onSave) onSave(target);
  };

  const harvestTitle = harvestIsPartial
    ? "Sammelt nur fertige Produktionen ein"
    : "Volle Ernte: erntet die gesamte Stadt";
  const hasParts = (timePartTotal ?? 0) > 1 && (timePart ?? 0) > 0;
  const partColor =
    timePart && timePartTotal && timePart === timePartTotal
      ? "#2ecc71"
      : "#f1c40f";

  const NOTE_RULES = [
    { regex: /\+/g, className: "notes-green" },
    { regex: /-/g, className: "notes-red" },
    { regex: />>/g, className: "notes-turquoise", fullLine: true },
    { regex: /\(1h\)/g, className: "notes-yellow" },
    { regex: /\(boost\)/g, className: "notes-yellow" },
  ];

  const applyRuleToLineHtml = (lineHtml, rule) => {
    if (!lineHtml) return lineHtml;

    // FULL-LINE RULE
    if (rule.fullLine) {
      const match = lineHtml.match(rule.regex);
      if (!match) return lineHtml; // nothing to do
      const plain = lineHtml
        .replace(/<span[^>]*>/g, "")
        .replace(/<\/span>/g, "");

      return `<span class="${rule.className}">${plain}</span>`;
    }

    // NORMAL RULE
    const parts = lineHtml.split(/(<[^>]+>)/g);

    const processed = parts.map((part) => {
      // If this is a tag ("<...>"), never touch it
      if (part.startsWith("<")) return part;

      // Text chunk: apply regex and wrap matches in spans
      return part.replace(rule.regex, (match) => {
        return `<span class="${rule.className}">${match}</span>`;
      });
    });

    return processed.join("");
  };

  const formattedNotes = useMemo(() => formatNotesHtml(notes), [notes]);

  const notesRef = useRef(null);

  const resizeNotes = () => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto"; // reset
    el.style.height = `${el.scrollHeight}px`; // grow to fit content
  };

  useEffect(() => {
    resizeNotes();
  }, [notes]);

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
    } catch {}
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

  return (
    <div className="actions-column">
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

      {isPast ? (
        <div className="actions-row">
          <button
            onClick={onToggleMove}
            className={`mode-button move ${moveMode ? "active-mode" : ""}`}
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
              className={`mode-button move ${moveMode ? "active-mode" : ""}`}
              title="Bewege oder tausche Gebaeude nach Belieben"
            >
              <Move />
            </button>
            <button
              onClick={onToggleSell}
              className={`mode-button sell ${sellMode ? "active-mode" : ""}`}
              title="Verkauf Gebaeude. Erhalte 1/4 des gezahlten Werts zurueck"
            >
              <Trash2 />
            </button>
            <button
              onClick={onToggleBoost}
              className={`mode-button finish ${boostMode ? "active-mode" : ""}`}
              title="Boost einzelne Gebaeude: entsperre oder beende Produktionen"
            >
              <ClockArrowUp />
            </button>
          </div>

          <div className="actions-row">
            <button
              onClick={harvestAll}
              className="action-button harvest"
              title={harvestTitle}
            >
              {harvestIsPartial ? "Rest einsammeln" : "Ernte"}
            </button>
            <button
              onClick={finishProductions}
              className="action-button finish"
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
      <div className="save-control" ref={saveMenuRef}>
        <button
          type="button"
          className="save-trigger"
          onClick={() => setIsSaveMenuOpen((v) => !v)}
          aria-haspopup="listbox"
          aria-expanded={isSaveMenuOpen}
        >
          <span
            className={`save-trigger-label ${loadName ? "" : "placeholder"}`}
            title={`${loadName}`}
          >
            {loadName || "Load state..."}
          </span>
          <span className="save-trigger-caret" aria-hidden="true">
            v
          </span>
        </button>

        {isSaveMenuOpen && (
          <div className="save-menu" role="listbox" aria-label="Saved states">
            {saveKeys.length === 0 ? (
              <div className="save-empty">No saves yet</div>
            ) : (
              saveKeys.map((k) => (
                <div
                  key={k}
                  className={`save-item ${k === loadName ? "selected" : ""}`}
                  role="option"
                  aria-selected={k === loadName}
                  onClick={() => {
                    setLoadName(k);
                    setIsSaveMenuOpen(false);
                  }}
                  title={`${k}`}
                >
                  <span className="save-item-label">{k}</span>

                  <button
                    type="button"
                    className="save-delete"
                    title={`Delete save ${k}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onDeleteSave) onDeleteSave(k);
                      if (loadName === k) setLoadName("");
                    }}
                  >
                    x
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
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
      <div className="notes-card">
        <label className="notes-label" htmlFor="city-notes">
          Notizen
        </label>
        <div className="notes-autosize">
          <div
            className="notes-mirror"
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: `${formattedNotes}\n` }}
          />
          <textarea
            id="city-notes"
            className="notes-input"
            placeholder="Fuege Notizen hinzu"
            value={notes}
            onChange={(e) => {
              onChangeNotes?.(e.target.value);
              const el = notesRef.current;
              if (el) {
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }
            }}
            ref={notesRef}
            rows={3}
          />
        </div>
      </div>
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
              className={`mode-button select ${
                selectMode ? "active-mode" : ""
              }`}
              onClick={onToggleSelectMode}
              title="Markiere Geb\u00e4ude rot, ohne sie zu \u00e4ndern"
            >
              <span>Select</span>
              <label className="select-auto">
                <input
                  type="checkbox"
                  checked={autoSelectNew}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => onToggleAutoSelectNew?.()}
                  title="Neue Geb\u00e4ude automatisch markieren"
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
            title="Berechne, welche Wohn-/Produktionsgeb\u00e4ude beim Entfernen den h\u00f6chsten Ertrag \u00fcbrig lassen"
          >
            Finde schlechtestes
          </button>
          {/*
          <div className="actions-row snapshot-row">
            <button
              className="action-button snapshot"
              onClick={() => onCreateSnapshot?.()}
              title="Versteckten Snapshot des aktuellen Aufbaus speichern"
            >
              Snapshot
            </button>
            
            <div className="snapshot-list">
              {snapshots.length === 0 ? (
                <span className="snapshot-empty">Keine Snapshots</span>
              ) : (
                snapshots.map((snap) => (
                  <button
                    type="button"
                    key={snap.name}
                    className={`snapshot-pill ${
                      snap.name === selectedSnapshotName ? "selected" : ""
                    }`}
                    onClick={() => onLoadSnapshot?.(snap.name)}
                    title={snap.label}
                  >
                    {snap.index ?? "?"}
                  </button>
                ))
              )}
            </div>
          </div>
          
        </>
      )}
      {!isPast && (
        <>
          <div className="actions-row">
            <button
              className="action-button smart-harvest"
              onClick={onSmartHarvest}
              title="Schlaue Ernte: Bauen, Entfernen, Ernten mit Zufriedenheit"
            >
              Schlaue Ernte
            </button>
          </div>
          <div className="actions-row">
            <button
              className="action-button smart-invest"
              onClick={onSmartInvest}
              disabled={smartInvestRunning}
              title="Schlauer Invest: Beste Ernte fuer ein Budget finden"
            >
              {smartInvestRunning ? "Schlauer Invest..." : "Schlauer Invest"}
            </button>
          </div>
          <div className="actions-row">
            <button
              className="action-button smart-invest-results"
              onClick={onOpenSmartInvestResults}
              disabled={!smartInvestResultsAvailable || smartInvestRunning}
              title="Letzte Schlauer-Invest-Ergebnisse anzeigen"
            >
              Resultate
            </button>
          </div>
          */}
        </>
      )}
    </div>
  );
}
