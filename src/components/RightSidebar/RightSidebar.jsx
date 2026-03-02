// Right sidebar: Notes, Tools
import { useEffect, useState } from "react";
import { NotesEditor } from "../ActionToolbar/NotesEditor";
import AdsterraBanner from "../Adsterra/AdsterraBanner";
import { ACTION_COLORS } from "../../config/colors";
import "./RightSidebar.css";

const EXTRA_TOOLS_STORAGE_KEY = "qi_extraToolsCollapsed";

export function RightSidebar({
  // Notes props
  notes,
  onChangeNotes,
  // Tools props
  refundMode,
  onToggleRefund,
  highlightMode,
  onToggleHighlightMode,
  onPrintBoard,
  onExportPdf,
  onFindWorst,
  // Past mode
  isPast = false,
}) {
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
    <aside className="right-sidebar">
      {/* Notes Section */}
      <div className="rs-section notes-section">
        <NotesEditor notes={notes} onChangeNotes={onChangeNotes} />
      </div>

      {/* Extra Tools Section */}
      <div className="rs-section">
        <div className="rs-row section-header">
          <span className="rs-section-title">Weitere Tools</span>
          <button
            className="rs-btn small"
            onClick={() => setExtraToolsCollapsed((prev) => !prev)}
            title={extraToolsCollapsed ? "Einblenden" : "Ausblenden"}
          >
            {extraToolsCollapsed ? "▼" : "▲"}
          </button>
        </div>

        {!extraToolsCollapsed && (
          <div className="extra-tools">
            <button
              onClick={onToggleRefund}
              className={`rs-btn refund ${refundMode ? "active-mode" : ""}`}
              style={{ background: ACTION_COLORS.sell }}
              title="Erhalte den VOLLEN Wert des Gebäudes zurück"
            >
              Volle Erstattung
            </button>
            <div className="rs-row">
              <button
                className={`rs-btn ${highlightMode ? "active-mode" : ""}`}
                onClick={onToggleHighlightMode}
                title="Hebt betroffene Gebaeude seit dem letzten Checkpoint hervor"
              >
                <span>Highlight</span>
              </button>
              <button
                className="rs-btn"
                onClick={onPrintBoard}
                title="Screenshot des aktuellen Aufbaus herunterladen"
              >
                Screenshot
              </button>
            </div>
            <button
              className="rs-btn"
              onClick={onExportPdf}
              title="Aktuelle Datei als PDF exportieren"
            >
              File → PDF
            </button>
            <button
              className="rs-btn"
              onClick={onFindWorst}
              title="Berechne, welche Gebäude den geringsten Beitrag leisten"
            >
              Finde schlechtestes
            </button>
          </div>
        )}
      </div>
      {/* Sidebar Bottom Banner */}
      <div className="sidebar-ad-wrapper">
        <AdsterraBanner
          formatKey="d68f07f8b34919f00710f305079b7f46"
          width={300}
          height={250}
        />
      </div>
    </aside>
  );
}
