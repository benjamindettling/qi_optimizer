// TopBar with horizontal pager for responsive regions
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { StatsPanel } from "./StatsPanel";
import { StepTracker } from "./StepTracker";
import { MenuPanel } from "./MenuPanel";
import { getSavefileStatusColor } from "../../config/colors";
import { useLang } from "../../context/LanguageContext";
import { useTutorialGate } from "../../hooks/useTutorialGate";
import { getSavefileSyncState } from "../../utils/saveConfig";
import "./TopBar.css";

const PANEL_MIN_WIDTHS = {
  stats: 420,
  steps: 280,
  menu: 200,
};

export function TopBar({
  resources,
  stats,
  happyInfo,
  adminMode,
  editingLocked,
  onEditResource,
  onEditGood,
  onEditUnit,
  config,
  timeStep,
  canStepBack,
  canStepForward,
  onJumpPrevCheckpoint,
  onStepBack,
  onStepForward,
  onJumpNextCheckpoint,
  onSave,
  onLoad,
  saves,
  userConfig,
  loadName,
  setLoadName,
  onDeleteSave,
  onOpenExport,
  onOpenImport,
  onOpenLoadSaves,
  onOpenOnlineLibrary,
  onToggleAdmin,
  onOpenHelp,
  onOpenAccount,
  onStartTutorial,
  hasUnsavedChanges,
}) {
  const { lang } = useLang();
  const topbarLocked = useTutorialGate("topbar");
  const pagerRef = useRef(null);
  const [visiblePanels, setVisiblePanels] = useState(3);
  const [pageIndex, setPageIndex] = useState(0);

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

  useEffect(() => {
    const updateLayout = () => {
      const newVisible = calculateVisiblePanels();
      setVisiblePanels(newVisible);
      setPageIndex((prev) => Math.min(prev, 3 - newVisible));
    };

    updateLayout();

    if (!pagerRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateLayout);
    observer.observe(pagerRef.current);
    return () => observer.disconnect();
  }, [calculateVisiblePanels]);

  const maxPage = 3 - visiblePanels;
  const canGoLeft = pageIndex > 0;
  const canGoRight = pageIndex < maxPage;

  const goLeft = () => {
    if (canGoLeft) setPageIndex((p) => p - 1);
  };

  const goRight = () => {
    if (canGoRight) setPageIndex((p) => p + 1);
  };

  const getTrackTransform = () => {
    if (visiblePanels === 3) return "translateX(0)";
    if (visiblePanels === 2) {
      return `translateX(-${pageIndex * 50}%)`;
    }
    return `translateX(-${pageIndex * 100}%)`;
  };

  const getPanelStyle = () => {
    if (visiblePanels === 3) return { flex: "0 0 33.333%" };
    if (visiblePanels === 2) return { flex: "0 0 50%" };
    return { flex: "0 0 100%" };
  };

  const showArrows = visiblePanels < 3;
  const prevLabel =
    lang === "EN"
      ? "Show previous topbar section"
      : "Vorherigen TopBar-Bereich anzeigen";
  const nextLabel =
    lang === "EN"
      ? "Show next topbar section"
      : "Nächsten TopBar-Bereich anzeigen";
  const currentSaveStatus = useMemo(
    () =>
      !loadName
        ? null
        : getSavefileSyncState({
            saveEntry: loadName ? saves?.[loadName] : null,
            userConfig,
          }),
    [loadName, saves, userConfig],
  );
  const currentSaveColor = getSavefileStatusColor(currentSaveStatus);

  return (
    <header
      className={`topbar-pager-container${topbarLocked ? " tutorial-zone-locked" : ""}`}
    >
      {showArrows && canGoLeft && (
        <button
          className="topbar-nav-arrow topbar-nav-arrow--left"
          onClick={goLeft}
          aria-label={prevLabel}
        >
          <ChevronLeft size={24} />
        </button>
      )}

      <div className="topbar-pager" ref={pagerRef}>
        <div
          className="topbar-track"
          style={{ transform: getTrackTransform() }}
        >
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

          <section
            className="topbar-panel panel--steps"
            style={getPanelStyle()}
          >
            <StepTracker
              timeStep={timeStep}
              loadName={loadName}
              saveNameColor={currentSaveColor}
              canStepBack={canStepBack}
              canStepForward={canStepForward}
              onJumpPrevCheckpoint={onJumpPrevCheckpoint}
              onStepBack={onStepBack}
              onStepForward={onStepForward}
              onJumpNextCheckpoint={onJumpNextCheckpoint}
            />
          </section>

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
              onOpenOnlineLibrary={onOpenOnlineLibrary}
              adminMode={adminMode}
              editingLocked={editingLocked}
              onToggleAdmin={onToggleAdmin}
              onOpenHelp={onOpenHelp}
              onOpenAccount={onOpenAccount}
              onStartTutorial={onStartTutorial}
              hasUnsavedChanges={hasUnsavedChanges}
            />
          </section>
        </div>
      </div>

      {showArrows && canGoRight && (
        <button
          className="topbar-nav-arrow topbar-nav-arrow--right"
          onClick={goRight}
          aria-label={nextLabel}
        >
          <ChevronRight size={24} />
        </button>
      )}
    </header>
  );
}
