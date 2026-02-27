// Log Cluster: Action log + Extra tools section
// Replaces RightSidebar as a grid cluster component
import { useEffect, useState } from "react";
import { ActionLog } from "../ActionToolbar/ActionLog";
import { NotesEditor } from "../ActionToolbar/NotesEditor";
import { ACTION_COLORS } from "../../config/colors";
import { GoogleAd } from "../GoogleAd/GoogleAd";
import { useTutorialGate } from "../../hooks/useTutorialGate";
import "./NotesCluster.css";

const EXTRA_TOOLS_STORAGE_KEY = "qi_extraToolsCollapsed";

export function NotesCluster({
  // Notes props
  notes,
  onChangeNotes,
  // Log props
  historyTree,
  selectedNodeId,
  libraryMap,
  shortIdMap,
  // Tools props
  refundMode,
  onToggleRefund,
  highlightMode,
  onToggleHighlightMode,
  onPrintBoard,
  onExportPdf,
  onFindWorst,
  // Past mode (reserved for future use)
  // eslint-disable-next-line no-unused-vars
  isPast = false,
}) {
  const notesLocked = useTutorialGate("notes");
  const [extraToolsCollapsed, setExtraToolsCollapsed] = useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const raw = localStorage.getItem(EXTRA_TOOLS_STORAGE_KEY);
      if (raw === "true") return true;
      if (raw === "false") return false;
    } catch {
      return true;
    }
    return true;
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
    <div className={`notes-cluster${notesLocked ? " tutorial-zone-locked" : ""}`}>
      {/* Notes Section */}
      <div className="nc-section notes-section">
        <NotesEditor notes={notes} onChangeNotes={onChangeNotes} />
      </div>

      {/* Log Section */}
      <div className="nc-section">
        <ActionLog
          historyTree={historyTree}
          selectedNodeId={selectedNodeId}
          libraryMap={libraryMap}
          shortIdMap={shortIdMap}
        />
      </div>

      {/* Extra Tools Section */}
      <div className="nc-section">
        <div className="nc-row section-header">
          <span className="nc-section-title">Weitere Tools</span>
          <button
            className="nc-btn small"
            onClick={() => setExtraToolsCollapsed((prev) => !prev)}
            title={extraToolsCollapsed ? "Einblenden" : "Ausblenden"}
          >
            {extraToolsCollapsed ? "v" : "^"}
          </button>
        </div>

        {!extraToolsCollapsed && (
          <div className="extra-tools">
            <button
              onClick={onToggleRefund}
              className={`nc-btn refund ${refundMode ? "active-mode" : ""}`}
              style={{ background: ACTION_COLORS.sell }}
              title="Erhalte den vollen Wert des Gebaeudes zurueck"
            >
              Volle Erstattung
            </button>
            <div className="nc-row">
              <button
                className={`nc-btn ${highlightMode ? "active-mode" : ""}`}
                onClick={onToggleHighlightMode}
                title="Hebt betroffene Gebaeude seit dem letzten Checkpoint hervor"
              >
                <span>Highlight</span>
              </button>
              <button
                className="nc-btn"
                onClick={onPrintBoard}
                title="Screenshot des aktuellen Aufbaus herunterladen"
              >
                Screenshot
              </button>
            </div>
            <button
              className="nc-btn"
              onClick={onExportPdf}
              title="Aktuelle Datei als PDF exportieren"
            >
              File -&gt; PDF
            </button>
            <button
              className="nc-btn"
              onClick={onFindWorst}
              title="Berechne, welche Gebaeude den geringsten Beitrag leisten"
            >
              Finde schlechtestes
            </button>
          </div>
        )}
      </div>

      {/* Google AdSense ad at the bottom */}
      <GoogleAd
        adSlot={import.meta.env.VITE_ADSENSE_NOTES_SLOT}
        maxHeight={120}
        className="notes-cluster-ad"
      />
    </div>
  );
}
