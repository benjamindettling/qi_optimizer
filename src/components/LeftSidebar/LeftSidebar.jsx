// Left sidebar with tree visualizer, harvest controls, save/load, and tools
import { useEffect, useState } from "react";
import { ClockArrowUp, Trash2 } from "lucide-react";
import { TreeVisualizer } from "../TreeVisualizer/TreeVisualizer";
import { SaveMenu } from "../ActionToolbar/SaveMenu";
import AdsterraBanner from "../Adsterra/AdsterraBanner";
import { ACTION_COLORS } from "../../config/colors";
import "./LeftSidebar.css";

const EXTRA_TOOLS_STORAGE_KEY = "qi_extraToolsCollapsed";

export function LeftSidebar({
  // Tree visualizer props
  treeNodes,
  historyIndex,
  onJumpHistory,
  onMakeTop,
  // Harvest props
  harvestAll,
  harvestIsPartial = false,
  finishProductions,
  // Save/load props
  onSave,
  onLoad,
  saves = {},
  loadName,
  setLoadName,
  onDeleteSave,
  // Export/import props
  onOpenExport,
  onOpenImport,
  // Refund and other tools
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

  const harvestTitle = harvestIsPartial
    ? "Sammelt nur fertige Produktionen ein"
    : "Volle Ernte: erntet die gesamte Stadt";

  return (
    <aside className="left-sidebar">
      {/* Tree Visualizer */}
      <div className="sidebar-section tree-section">
        <TreeVisualizer
          nodes={treeNodes}
          selectedId={historyIndex}
          onSelectNode={onJumpHistory}
          onMakeTop={onMakeTop}
          actionColors={ACTION_COLORS}
          width={280}
          height={180}
        />
      </div>

      {/* Harvest Section */}
      {!isPast && (
        <div className="sidebar-section">
          <div className="section-title">Ernten</div>
          <div className="sidebar-row">
            <button
              onClick={harvestAll}
              className="sidebar-btn"
              style={{
                background: harvestIsPartial
                  ? ACTION_COLORS.harvestPartial
                  : ACTION_COLORS.harvestFull,
              }}
              title={harvestTitle}
            >
              {harvestIsPartial ? "Rest einsammeln" : "Schnelle Ernte"}
            </button>
            <button
              onClick={finishProductions}
              className="sidebar-btn"
              style={{ background: ACTION_COLORS.boostAll }}
              title="Beendet alle Produktionen. Danach kannst du ernten"
            >
              <ClockArrowUp size={16} />
              <span>Alle Prod</span>
            </button>
          </div>
        </div>
      )}

      {/* Save/Load Section */}
      <div className="sidebar-section">
        <div className="sidebar-row">
          <button
            onClick={handleSaveClick}
            className="sidebar-btn"
            title="Speicher aktuellen Stand in deinem Browser"
          >
            Speichern
          </button>
          <button
            onClick={() => {
              if (loadName) onLoad(loadName);
            }}
            className="sidebar-btn"
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
      </div>

      {/* Export/Import Section */}
      <div className="sidebar-section">
        <div className="sidebar-row">
          <button className="sidebar-btn" onClick={onOpenExport}>
            Export
          </button>
          <button className="sidebar-btn" onClick={onOpenImport}>
            Import
          </button>
        </div>
      </div>

      {/* Extra Tools Section */}
      <div className="sidebar-section">
        <div className="sidebar-row section-header">
          <span className="section-title">Weitere Tools</span>
          <button
            className="sidebar-btn small"
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
              className={`sidebar-btn refund ${refundMode ? "active-mode" : ""}`}
              style={{ background: ACTION_COLORS.sell }}
              title="Erhalte den VOLLEN Wert des Gebäudes zurück"
            >
              Volle Erstattung
            </button>
            <div className="sidebar-row">
              <button
                className={`sidebar-btn ${highlightMode ? "active-mode" : ""}`}
                onClick={onToggleHighlightMode}
                title="Hebt betroffene Gebaeude seit dem letzten Checkpoint hervor"
              >
                <span>Highlight</span>
              </button>
              <button
                className="sidebar-btn"
                onClick={onPrintBoard}
                title="Screenshot des aktuellen Aufbaus herunterladen"
              >
                Screenshot
              </button>
            </div>
            <button
              className="sidebar-btn"
              onClick={onExportPdf}
              title="Aktuelle Datei als PDF exportieren"
            >
              File → PDF
            </button>
            <button
              className="sidebar-btn"
              onClick={onFindWorst}
              title="Berechne, welche Gebäude den geringsten Beitrag leisten"
            >
              Finde schlechtestes
            </button>

            {/* Archived tools - currently disabled
            <button
              className="sidebar-btn"
              disabled
              title="Snapshot navigation - coming soon"
            >
              Snapshot Nav
            </button>
            */}
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
