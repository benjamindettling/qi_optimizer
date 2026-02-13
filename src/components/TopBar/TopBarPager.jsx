// TopBar with horizontal pager for responsive regions
import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatsPanel } from "./StatsPanel";
import { StepTracker } from "./StepTracker";
import { MenuPanel } from "./MenuPanel";
import "./TopBarPager.css";

// Minimum widths for each panel (used to determine visible panel count)
const PANEL_MIN_WIDTHS = {
  stats: 420,
  steps: 280,
  menu: 200,
};

export function TopBarPager({
  // Stats panel props
  resources,
  stats,
  happyInfo,
  adminMode,
  editingLocked,
  onEditResource,
  onEditGood,
  onEditUnit,
  config,
  // Step tracker props
  timeStep,
  canStepBack,
  canStepForward,
  onJumpPrevCheckpoint,
  onStepBack,
  onStepForward,
  onJumpNextCheckpoint,
  // Menu panel props
  onSave,
  onLoad,
  saves,
  loadName,
  setLoadName,
  onDeleteSave,
  onOpenExport,
  onOpenImport,
  onOpenLoadSaves,
  onToggleAdmin,
  onOpenHelp,
  onOpenAccount,
  // Sync config props
  showSyncConfig,
  onSyncConfig,
  // Unsaved changes
  hasUnsavedChanges,
}) {
  const pagerRef = useRef(null);
  const [visiblePanels, setVisiblePanels] = useState(3);
  const [pageIndex, setPageIndex] = useState(0);

  // Calculate how many panels fit based on width
  const calculateVisiblePanels = useCallback(() => {
    if (!pagerRef.current) return 3;
    const width = pagerRef.current.offsetWidth;
    const totalMin =
      PANEL_MIN_WIDTHS.stats + PANEL_MIN_WIDTHS.steps + PANEL_MIN_WIDTHS.menu;
    const twoMin = PANEL_MIN_WIDTHS.stats + PANEL_MIN_WIDTHS.steps;

    if (width >= totalMin) return 3;
    if (width >= twoMin) return 2;
    return 1;
  }, []);

  // Update visible panels on resize
  useEffect(() => {
    const updateLayout = () => {
      const newVisible = calculateVisiblePanels();
      setVisiblePanels(newVisible);
      // Clamp page index when panel count changes
      setPageIndex((prev) => Math.min(prev, 3 - newVisible));
    };

    updateLayout();

    if (!pagerRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateLayout);
    observer.observe(pagerRef.current);
    return () => observer.disconnect();
  }, [calculateVisiblePanels]);

  // Navigation handlers
  const maxPage = 3 - visiblePanels;
  const canGoLeft = pageIndex > 0;
  const canGoRight = pageIndex < maxPage;

  const goLeft = () => {
    if (canGoLeft) setPageIndex((p) => p - 1);
  };

  const goRight = () => {
    if (canGoRight) setPageIndex((p) => p + 1);
  };

  // Calculate track transform
  // Each "page" shifts by (100% / visiblePanels) of the viewport
  const getTrackTransform = () => {
    if (visiblePanels === 3) return "translateX(0)";
    if (visiblePanels === 2) {
      // Page 0: show panels 0,1 (stats+steps)
      // Page 1: show panels 1,2 (steps+menu)
      return `translateX(-${pageIndex * 50}%)`;
    }
    // visiblePanels === 1
    // Page 0: stats, Page 1: steps, Page 2: menu
    return `translateX(-${pageIndex * 100}%)`;
  };

  // Get panel width style based on visible panels
  const getPanelStyle = () => {
    if (visiblePanels === 3) return { flex: "0 0 33.333%" };
    if (visiblePanels === 2) return { flex: "0 0 50%" };
    return { flex: "0 0 100%" };
  };

  const showArrows = visiblePanels < 3;

  return (
    <header className="topbar-pager-container">
      {/* Left navigation arrow - only render when can go left */}
      {showArrows && canGoLeft && (
        <button
          className="topbar-nav-arrow topbar-nav-arrow--left"
          onClick={goLeft}
          aria-label="Vorherigen TopBar-Bereich anzeigen"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* Pager viewport */}
      <div className="topbar-pager" ref={pagerRef}>
        <div
          className="topbar-track"
          style={{ transform: getTrackTransform() }}
        >
          {/* Panel 1: Stats */}
          <section
            className="topbar-panel panel--stats"
            style={getPanelStyle()}
          >
            <StatsPanel
              resources={resources}
              stats={stats}
              happyInfo={happyInfo}
              adminMode={adminMode}
              editingLocked={editingLocked}
              onEditResource={onEditResource}
              onEditGood={onEditGood}
              onEditUnit={onEditUnit}
              config={config}
            />
          </section>

          {/* Panel 2: Step Tracker */}
          <section
            className="topbar-panel panel--steps"
            style={getPanelStyle()}
          >
            <StepTracker
              timeStep={timeStep}
              loadName={loadName}
              canStepBack={canStepBack}
              canStepForward={canStepForward}
              onJumpPrevCheckpoint={onJumpPrevCheckpoint}
              onStepBack={onStepBack}
              onStepForward={onStepForward}
              onJumpNextCheckpoint={onJumpNextCheckpoint}
            />
          </section>

          {/* Panel 3: Menu */}
          <section className="topbar-panel panel--menu" style={getPanelStyle()}>
            <MenuPanel
              onSave={onSave}
              onLoad={onLoad}
              saves={saves}
              loadName={loadName}
              setLoadName={setLoadName}
              onDeleteSave={onDeleteSave}
              onOpenExport={onOpenExport}
              onOpenImport={onOpenImport}
              onOpenLoadSaves={onOpenLoadSaves}
              adminMode={adminMode}
              editingLocked={editingLocked}
              onToggleAdmin={onToggleAdmin}
              onOpenHelp={onOpenHelp}
              onOpenAccount={onOpenAccount}
              showSyncConfig={showSyncConfig}
              onSyncConfig={onSyncConfig}
              hasUnsavedChanges={hasUnsavedChanges}
            />
          </section>
        </div>
      </div>

      {/* Right navigation arrow - only render when can go right */}
      {showArrows && canGoRight && (
        <button
          className="topbar-nav-arrow topbar-nav-arrow--right"
          onClick={goRight}
          aria-label="Nächsten TopBar-Bereich anzeigen"
        >
          <ChevronRight size={24} />
        </button>
      )}
    </header>
  );
}
