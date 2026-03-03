import { useMemo, useRef, useState, useCallback, useEffect } from "react";
import { Board } from "../../components/Board/Board";
import { TopBarPager } from "../../components/TopBar/TopBarPager";
import { ShopSidebar } from "../../components/ShopSidebar/ShopSidebar";
import { NotesCluster } from "../../components/RightSidebar/NotesCluster";
import { MiniToolbar } from "../../components/MiniToolbar/MiniToolbar";
import { TreeVisualizer } from "../../components/TreeVisualizer/TreeVisualizer";
import { FixDeficitsModal } from "../../components/modals/FixDeficitsModal";
import { FixLayoutModal } from "../../components/modals/FixLayoutModal";
import { ACTION_COLORS } from "../../config/colors";
import { useTreeNavigation } from "../../hooks/useTreeNavigation";
import { useTutorialGate } from "../../hooks/useTutorialGate";
import { REGION_COLS, REGION_MASK } from "../../config/boardConfig";
import { formatNumber } from "../../utils/formatNumber";
import { getGoodIconPath } from "../../utils/goodsIconPath";
import { useLang } from "../../context/LanguageContext";
import { useTutorial } from "../../context/TutorialContext";
import { TUTORIAL_STEPS } from "../../tutorial/tutorialSteps";
import { T } from "../../i18n/translations";
import { getBuildingName } from "../../utils/buildingName";
import {
  FoldVertical,
  UnfoldVertical,
  FoldHorizontal,
  UnfoldHorizontal,
  ArrowUpFromLine,
  Trash2,
} from "lucide-react";

// Main page layout: TopBar + Workspace Grid (Board, Tree, Notes clusters)
export function AppLayout({
  sidebarProps,
  topBarProps,
  boardProps,
  toolbarProps,
  historyProps,
  isShopOpen,
  onCloseShop,
  onOpenShop,
  config,
  updateConfig,
  boardClusterRef,
  boardContentRef,
  topBarRef,
  toolbarPosition = "left",
  // Sync config props
  showSyncConfig,
  onSyncConfig,
  onTutorialStepForward,
  onTutorialJumpHistory,
  onTutorialTreeToggleFocus,
  onTutorialTreeToggleHorizontal,
  onTutorialMakeTop,
  onTutorialDeleteNode,
  onTutorialDeleteModeChanged,
  onTutorialCopyBranch,
  onTutorialTreeZoomChanged,
  onTutorialTreeFixOpened,
  onTutorialTreeFixPopupClosed,
  warnDeleteSingleAction = true,
  setWarnDeleteSingleAction,
  warnDeleteSubtree = true,
  setWarnDeleteSubtree,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const { isTutorialActive, currentStepIndex, showWarningNotice } =
    useTutorial();
  const boardLocked = useTutorialGate("board");
  const treeToolbarLocked = useTutorialGate("tree-toolbar");
  const { libraryMap, shortIdMap } = historyProps;
  const treeTutorialPreparedRef = useRef(false);

  // Tree visualizer ref and state for toolbar
  const treeRef = useRef(null);
  const [treeState, setTreeState] = useState({
    focusMode: false,
    horizontalCollapse: false,
    currentOnMainBranch: true,
  });

  const [deleteMode, setDeleteMode] = useState(false);
  const [deleteConfirmState, setDeleteConfirmState] = useState(null); // { nodeId, deleteSubtree, options? }
  const [dontShowDeleteWarningAgain, setDontShowDeleteWarningAgain] =
    useState(false);

  // Fix modal state - can be config fix or order fix
  // { nodeId, type: "config"|"order", deficits?, fixedLayout? }
  const [fixModal, setFixModal] = useState(null);

  // Force re-render on tree state change
  const updateTreeState = useCallback(() => {
    if (treeRef.current) {
      setTreeState({
        focusMode: treeRef.current.focusMode,
        horizontalCollapse: treeRef.current.horizontalCollapse,
        currentOnMainBranch: treeRef.current.currentOnMainBranch,
      });
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(updateTreeState, 0);
    return () => clearTimeout(timeoutId);
  }, [updateTreeState, historyProps.historyIndex]);

  useEffect(() => {
    const section = TUTORIAL_STEPS[currentStepIndex]?.section;
    if (!isTutorialActive || section !== "tree") {
      treeTutorialPreparedRef.current = false;
      return;
    }
    if (treeTutorialPreparedRef.current || !treeRef.current) return;
    setDeleteMode(false);
    onTutorialDeleteModeChanged?.(false);
    treeRef.current.setFocusMode?.(false);
    treeRef.current.setHorizontalCollapse?.(false);
    treeRef.current.setSelectionFocusMode?.(true);
    treeRef.current.zoomIn?.();
    treeTutorialPreparedRef.current = true;
    setTimeout(updateTreeState, 50);
  }, [
    currentStepIndex,
    isTutorialActive,
    onTutorialDeleteModeChanged,
    updateTreeState,
  ]);

  // Get skipToEnd preference from config (default true)
  const skipToEnd = config?.skipToEnd !== false;

  // Get tree nodes from history - uses the tree structure from historyNodes()
  const treeNodes = useMemo(() => {
    // If historyNodes is a function (new tree-based history), call it
    if (typeof historyProps.historyNodes === "function") {
      const nodes = historyProps.historyNodes();
      // Map action types for coloring and generate titles/labels
      return nodes.map((node) => {
        const { nodeLabel, nodeIcon } = generateNodeDisplay(
          node.action,
          libraryMap,
          shortIdMap,
          lang,
        );
        return {
          ...node,
          actionType: mapActionToType(node.action),
          actionTitle: node.action?.title, // Include action title for checkpoint detection
          actionTooltip: generateActionTitle(
            node.action,
            libraryMap,
            shortIdMap,
            lang,
          ),
          nodeLabel,
          nodeIcon,
        };
      });
    }
    // Fallback: empty array
    return [
      {
        id: 0,
        parentId: null,
        actionType: "default",
        label: "Start",
        actionTooltip: "Start",
      },
    ];
  }, [historyProps, libraryMap, shortIdMap, lang]);

  const hasDeletableNodes = useMemo(
    () => treeNodes.some((node) => node.id !== 0),
    [treeNodes],
  );

  useEffect(() => {
    if (hasDeletableNodes) return;
    setDeleteMode(false);
  }, [hasDeletableNodes]);

  useEffect(() => {
    if (deleteConfirmState) return;
    setDontShowDeleteWarningAgain(false);
  }, [deleteConfirmState]);

  const executeDeleteAction = useCallback(
    (nodeId, deleteSubtree, options = null) => {
      const bundleNodeIds = Array.isArray(options?.bundleNodeIds)
        ? options.bundleNodeIds.filter((id) => id != null && id !== 0)
        : [];
      if (!deleteSubtree && bundleNodeIds.length > 1) {
        bundleNodeIds.forEach((id) => {
          historyProps.onDeleteNode?.(id, false);
          onTutorialDeleteNode?.(id, false);
        });
      } else {
        historyProps.onDeleteNode?.(nodeId, deleteSubtree);
        onTutorialDeleteNode?.(nodeId, deleteSubtree);
      }
      setTimeout(updateTreeState, 50);
    },
    [historyProps, onTutorialDeleteNode, updateTreeState],
  );

  const handleDeleteFromTree = useCallback(
    (nodeId, deleteSubtree, options = null) => {
      if (isTutorialActive) {
        const stepId = TUTORIAL_STEPS[currentStepIndex]?.id;
        if (stepId === "tree-delete-second-branch-subtree") {
          const rootChildren =
            historyProps.historyTree?.nodes?.get?.(0)?.childrenIds ?? [];
          const secondRootChildId =
            rootChildren.length > 1 ? rootChildren[1] : null;
          if (
            !deleteSubtree ||
            secondRootChildId == null ||
            nodeId !== secondRootChildId
          ) {
            showWarningNotice?.("tree-delete-wrong-node");
            return;
          }
        }
      }

      const shouldWarn = deleteSubtree
        ? warnDeleteSubtree
        : warnDeleteSingleAction;
      if (shouldWarn) {
        setDeleteConfirmState({ nodeId, deleteSubtree, options });
        setDontShowDeleteWarningAgain(false);
        return;
      }
      executeDeleteAction(nodeId, deleteSubtree, options);
    },
    [
      currentStepIndex,
      executeDeleteAction,
      historyProps.historyTree,
      isTutorialActive,
      showWarningNotice,
      warnDeleteSingleAction,
      warnDeleteSubtree,
    ],
  );

  const applyDeleteWarningPreference = useCallback(
    (deleteSubtree) => {
      if (!dontShowDeleteWarningAgain) return;
      if (deleteSubtree) {
        setWarnDeleteSubtree?.(false);
      } else {
        setWarnDeleteSingleAction?.(false);
      }
    },
    [
      dontShowDeleteWarningAgain,
      setWarnDeleteSingleAction,
      setWarnDeleteSubtree,
    ],
  );

  const handleConfirmDelete = useCallback(() => {
    if (!deleteConfirmState) return;
    const { nodeId, deleteSubtree, options } = deleteConfirmState;
    applyDeleteWarningPreference(deleteSubtree);
    executeDeleteAction(nodeId, deleteSubtree, options);
    setDeleteConfirmState(null);
  }, [deleteConfirmState, applyDeleteWarningPreference, executeDeleteAction]);

  const handleCancelDelete = useCallback(() => {
    if (!deleteConfirmState) return;
    applyDeleteWarningPreference(deleteConfirmState.deleteSubtree);
    setDeleteConfirmState(null);
  }, [deleteConfirmState, applyDeleteWarningPreference]);

  const setDeleteModeWithTutorial = useCallback(
    (nextDeleteMode) => {
      setDeleteMode((prev) => {
        const resolved =
          typeof nextDeleteMode === "function"
            ? !!nextDeleteMode(prev)
            : !!nextDeleteMode;
        if (resolved !== prev) {
          onTutorialDeleteModeChanged?.(resolved);
        }
        return resolved;
      });
    },
    [onTutorialDeleteModeChanged],
  );

  const clearExclusiveModes = useCallback(() => {
    sidebarProps.onResetModes?.();
    setDeleteModeWithTutorial(false);
  }, [sidebarProps, setDeleteModeWithTutorial]);

  // Use tree navigation hook for TopBar
  const {
    stepForward,
    stepBackward,
    jumpToPrevCheckpoint,
    jumpToNextCheckpoint,
    hasParent,
    hasChildren,
  } = useTreeNavigation(
    treeNodes,
    historyProps.historyIndex,
    historyProps.onJumpHistory,
    skipToEnd,
    treeState.horizontalCollapse,
  );

  const wrappedJumpPrevCheckpoint = useCallback(() => {
    clearExclusiveModes();
    jumpToPrevCheckpoint();
  }, [clearExclusiveModes, jumpToPrevCheckpoint]);

  const wrappedStepBack = useCallback(() => {
    clearExclusiveModes();
    stepBackward();
  }, [clearExclusiveModes, stepBackward]);

  const wrappedStepForward = useCallback(() => {
    clearExclusiveModes();
    onTutorialStepForward?.();
    stepForward();
  }, [clearExclusiveModes, onTutorialStepForward, stepForward]);

  const wrappedJumpNextCheckpoint = useCallback(() => {
    clearExclusiveModes();
    jumpToNextCheckpoint();
  }, [clearExclusiveModes, jumpToNextCheckpoint]);

  const wrappedToggleMove = useCallback(() => {
    setDeleteModeWithTutorial(false);
    toolbarProps.onToggleMove?.();
  }, [setDeleteModeWithTutorial, toolbarProps]);

  const wrappedToggleSell = useCallback(() => {
    setDeleteModeWithTutorial(false);
    toolbarProps.onToggleSell?.();
  }, [setDeleteModeWithTutorial, toolbarProps]);

  const wrappedToggleBoost = useCallback(() => {
    setDeleteModeWithTutorial(false);
    toolbarProps.onToggleBoost?.();
  }, [setDeleteModeWithTutorial, toolbarProps]);

  const wrappedToggleRefund = useCallback(() => {
    setDeleteModeWithTutorial(false);
    toolbarProps.onToggleRefund?.();
  }, [setDeleteModeWithTutorial, toolbarProps]);

  const wrappedOpenShop = useCallback(() => {
    clearExclusiveModes();
    onOpenShop?.();
  }, [clearExclusiveModes, onOpenShop]);

  const wrappedCancelPlacement = useCallback(() => {
    clearExclusiveModes();
    toolbarProps.onCancelPlacement?.();
  }, [clearExclusiveModes, toolbarProps]);

  const wrappedFinishProductions = useCallback(() => {
    clearExclusiveModes();
    toolbarProps.finishProductions?.();
  }, [clearExclusiveModes, toolbarProps]);

  const wrappedHarvestPartial = useCallback(() => {
    clearExclusiveModes();
    toolbarProps.harvestPartial?.();
  }, [clearExclusiveModes, toolbarProps]);

  const wrappedHighlightToggle = useCallback(() => {
    clearExclusiveModes();
    toolbarProps.onToggleHighlightMode?.();
  }, [clearExclusiveModes, toolbarProps]);

  const wrappedPrintBoard = useCallback(() => {
    clearExclusiveModes();
    toolbarProps.onPrintBoard?.();
  }, [clearExclusiveModes, toolbarProps]);

  const wrappedExportPdf = useCallback(() => {
    clearExclusiveModes();
    toolbarProps.onExportPdf?.();
  }, [clearExclusiveModes, toolbarProps]);

  const wrappedFindWorst = useCallback(() => {
    clearExclusiveModes();
    toolbarProps.onFindWorst?.();
  }, [clearExclusiveModes, toolbarProps]);

  const wrappedBoardRegionClick = useCallback(
    (...args) => {
      clearExclusiveModes();
      boardProps.onRegionClick?.(...args);
    },
    [boardProps, clearExclusiveModes],
  );

  const wrappedDebugUnlockRegion = useCallback(
    (...args) => {
      clearExclusiveModes();
      boardProps.onDebugUnlockRegion?.(...args);
    },
    [boardProps, clearExclusiveModes],
  );

  const wrappedDebugLockRegion = useCallback(
    (...args) => {
      clearExclusiveModes();
      boardProps.onDebugLockRegion?.(...args);
    },
    [boardProps, clearExclusiveModes],
  );

  const wrappedShopResetModes = useCallback(() => {
    clearExclusiveModes();
  }, [clearExclusiveModes]);

  const wrappedShopSetSelectedBuildingId = useCallback(
    (defId) => {
      setDeleteModeWithTutorial(false);
      sidebarProps.setSelectedBuildingId?.(defId);
    },
    [setDeleteModeWithTutorial, sidebarProps],
  );

  const wrappedTopBarSave = useCallback(
    (...args) => {
      clearExclusiveModes();
      toolbarProps.onSave?.(...args);
    },
    [clearExclusiveModes, toolbarProps],
  );

  const wrappedTopBarLoad = useCallback(
    (...args) => {
      clearExclusiveModes();
      toolbarProps.onLoad?.(...args);
    },
    [clearExclusiveModes, toolbarProps],
  );

  const wrappedTopBarOpenExport = useCallback(() => {
    clearExclusiveModes();
    toolbarProps.onOpenExport?.();
  }, [clearExclusiveModes, toolbarProps]);

  const wrappedTopBarOpenImport = useCallback(() => {
    clearExclusiveModes();
    toolbarProps.onOpenImport?.();
  }, [clearExclusiveModes, toolbarProps]);

  const wrappedTopBarOpenLoadSaves = useCallback(() => {
    clearExclusiveModes();
    toolbarProps.onOpenLoadSaves?.();
  }, [clearExclusiveModes, toolbarProps]);

  const wrappedTopBarToggleAdmin = useCallback(
    (...args) => {
      clearExclusiveModes();
      topBarProps.onToggleAdmin?.(...args);
    },
    [clearExclusiveModes, topBarProps],
  );

  const wrappedTopBarOpenHelp = useCallback(() => {
    clearExclusiveModes();
    topBarProps.onOpenHelp?.();
  }, [clearExclusiveModes, topBarProps]);

  const wrappedTopBarOpenAccount = useCallback(() => {
    clearExclusiveModes();
    topBarProps.onOpenAccount?.();
  }, [clearExclusiveModes, topBarProps]);

  const wrappedTopBarStartTutorial = useCallback(() => {
    clearExclusiveModes();
    topBarProps.onStartTutorial?.();
  }, [clearExclusiveModes, topBarProps]);

  const wrappedTopBarSyncConfig = useCallback(() => {
    clearExclusiveModes();
    onSyncConfig?.();
  }, [clearExclusiveModes, onSyncConfig]);

  const wrappedTopBarEditResource = useCallback(
    (...args) => {
      clearExclusiveModes();
      topBarProps.onEditResource?.(...args);
    },
    [clearExclusiveModes, topBarProps],
  );

  const wrappedTopBarEditGood = useCallback(
    (...args) => {
      clearExclusiveModes();
      topBarProps.onEditGood?.(...args);
    },
    [clearExclusiveModes, topBarProps],
  );

  const wrappedTopBarEditUnit = useCallback(
    (...args) => {
      clearExclusiveModes();
      topBarProps.onEditUnit?.(...args);
    },
    [clearExclusiveModes, topBarProps],
  );

  const handleTopBarClickCapture = useCallback(
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest("button")) {
        clearExclusiveModes();
      }
    },
    [clearExclusiveModes],
  );

  const handleTreeClusterClickCapture = useCallback(
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      if (target.closest('[data-tree-delete-mode-toggle="true"]')) {
        return;
      }

      const clickedNode = target.closest("[data-node-id]");
      if (clickedNode) {
        if (!deleteMode) {
          clearExclusiveModes();
        }
        return;
      }

      if (target.closest("button") || target.closest('input[type="range"]')) {
        clearExclusiveModes();
      }
    },
    [clearExclusiveModes, deleteMode],
  );

  const wrappedJumpHistory = useCallback(
    (id) => {
      clearExclusiveModes();
      onTutorialJumpHistory?.(id);
      historyProps.onJumpHistory(id);
      setTimeout(updateTreeState, 50);
    },
    [clearExclusiveModes, historyProps, onTutorialJumpHistory, updateTreeState],
  );

  return (
    <>
      <div className="page">
        {/* TopBar spans full width */}
        <div ref={topBarRef} onClickCapture={handleTopBarClickCapture}>
          <TopBarPager
            // Stats panel props
            resources={topBarProps.resources}
            stats={topBarProps.stats}
            happyInfo={topBarProps.happyInfo}
            adminMode={topBarProps.adminMode}
            editingLocked={topBarProps.editingLocked}
            onEditResource={wrappedTopBarEditResource}
            onEditGood={wrappedTopBarEditGood}
            onEditUnit={wrappedTopBarEditUnit}
            config={config}
            // Step tracker props
            timeStep={toolbarProps.timeStep}
            timePart={toolbarProps.timePart}
            timePartTotal={toolbarProps.timePartTotal}
            canStepBack={hasParent}
            canStepForward={hasChildren}
            onJumpPrevCheckpoint={wrappedJumpPrevCheckpoint}
            onStepBack={wrappedStepBack}
            onStepForward={wrappedStepForward}
            onJumpNextCheckpoint={wrappedJumpNextCheckpoint}
            // Menu panel props
            onSave={wrappedTopBarSave}
            onLoad={wrappedTopBarLoad}
            saves={toolbarProps.saves}
            loadName={toolbarProps.loadName}
            setLoadName={toolbarProps.setLoadName}
            onDeleteSave={toolbarProps.onDeleteSave}
            onOpenExport={wrappedTopBarOpenExport}
            onOpenImport={wrappedTopBarOpenImport}
            onOpenLoadSaves={wrappedTopBarOpenLoadSaves}
            onToggleAdmin={wrappedTopBarToggleAdmin}
            onOpenHelp={wrappedTopBarOpenHelp}
            onOpenAccount={wrappedTopBarOpenAccount}
            onStartTutorial={wrappedTopBarStartTutorial}
            showSyncConfig={showSyncConfig}
            onSyncConfig={wrappedTopBarSyncConfig}
            hasUnsavedChanges={topBarProps.hasUnsavedChanges}
          />
        </div>

        {/* Shop overlay (modal) */}
        <div className={`shop-shell ${isShopOpen ? "open" : "closed"}`}>
          <div className="shop-overlay" onClick={onCloseShop} />
          <div className="shop-panel">
            <ShopSidebar
              {...sidebarProps}
              setSelectedBuildingId={wrappedShopSetSelectedBuildingId}
              onResetModes={wrappedShopResetModes}
              REGION_COLS={REGION_COLS}
              regionMask={REGION_MASK}
            />
          </div>
        </div>

        {/* Main workspace - Board priority + remaining clusters */}
        <div className="workspace">
          {/* Board Cluster */}
          <div
            className={`board-cluster board-cluster--toolbar-${toolbarPosition}`}
            ref={boardClusterRef}
          >
            <MiniToolbar
              moveMode={toolbarProps.moveMode}
              sellMode={toolbarProps.sellMode}
              boostMode={toolbarProps.boostMode}
              onToggleMove={wrappedToggleMove}
              onToggleSell={wrappedToggleSell}
              onToggleBoost={wrappedToggleBoost}
              onOpenShop={wrappedOpenShop}
              isPlacementMode={toolbarProps.isPlacementMode}
              onCancelPlacement={wrappedCancelPlacement}
              finishProductions={wrappedFinishProductions}
              harvestPartial={wrappedHarvestPartial}
              harvestIsPartial={toolbarProps.harvestIsPartial}
              isPast={toolbarProps.isPast}
              editUnlocked={toolbarProps.editUnlocked}
              onOpenPastEditWarning={toolbarProps.onOpenPastEditWarning}
              position={toolbarPosition}
            />
            <div
              className={`board-content${boardLocked ? " tutorial-zone-locked" : ""}`}
              ref={boardContentRef}
            >
              <Board
                {...boardProps}
                finishProductions={wrappedFinishProductions}
                harvestPartial={toolbarProps.harvestAll}
                harvestIsPartial={toolbarProps.harvestIsPartial}
                isPast={toolbarProps.isPast}
                onRegionClick={wrappedBoardRegionClick}
                onDebugUnlockRegion={wrappedDebugUnlockRegion}
                onDebugLockRegion={wrappedDebugLockRegion}
              />
            </div>
          </div>

          {/* Tree Cluster - Centered */}
          <div
            className="tree-cluster"
            onPointerDownCapture={handleTreeClusterClickCapture}
          >
            {/* Tree Toolbar */}
            <div
              className={`tree-toolbar${treeToolbarLocked ? " tutorial-zone-locked" : ""}`}
            >
              <div className="tree-toolbar-group">
                <button
                  className={`mini-btn ${treeState.focusMode ? "active-mode" : ""}`}
                  style={{ background: ACTION_COLORS.default }}
                  onClick={() => {
                    onTutorialTreeToggleFocus?.();
                    treeRef.current?.toggleFocusMode();
                    setTimeout(updateTreeState, 50);
                  }}
                  data-tutorial-zone="tree-focus-btn"
                  title={
                    treeState.focusMode
                      ? "Branches sind eingeklappt"
                      : "Branches sind ausgeklappt"
                  }
                >
                  {treeState.focusMode ? (
                    <FoldVertical size={20} />
                  ) : (
                    <UnfoldVertical size={20} />
                  )}
                </button>
                <button
                  className={`mini-btn ${treeState.horizontalCollapse ? "active-mode" : ""}`}
                  style={{ background: ACTION_COLORS.default }}
                  onClick={() => {
                    onTutorialTreeToggleHorizontal?.();
                    treeRef.current?.toggleHorizontalCollapse();
                    setTimeout(updateTreeState, 50);
                  }}
                  data-tutorial-zone="tree-collapse-btn"
                  title={
                    treeState.horizontalCollapse
                      ? "Aktionen sind zusammengefasst"
                      : "Aktionen sind ausgeklappt"
                  }
                >
                  {treeState.horizontalCollapse ? (
                    <FoldHorizontal size={20} />
                  ) : (
                    <UnfoldHorizontal size={20} />
                  )}
                </button>
              </div>
              <div className="tree-toolbar-spacer" />
              <div className="tree-toolbar-group">
                <button
                  className="mini-btn"
                  style={{ background: ACTION_COLORS.regionUnlock }}
                  onClick={() => {
                    onTutorialMakeTop?.();
                    treeRef.current?.makeTop();
                    setTimeout(updateTreeState, 50);
                  }}
                  disabled={treeState.currentOnMainBranch}
                  data-tutorial-zone="tree-main-btn"
                  title={
                    treeState.currentOnMainBranch
                      ? "Bereits auf dem Hauptbranch"
                      : "Diesen Branch zum Hauptbranch machen"
                  }
                >
                  <ArrowUpFromLine size={20} />
                </button>
                <button
                  className={`mini-btn ${deleteMode ? "active-mode delete-mode-active" : ""}`}
                  style={{ background: "var(--ui-error-red)" }}
                  onClick={() =>
                    setDeleteModeWithTutorial((prev) => {
                      const next = !prev;
                      if (next) {
                        sidebarProps.onResetModes?.();
                      }
                      return next;
                    })
                  }
                  disabled={!hasDeletableNodes}
                  data-tree-delete-mode-toggle="true"
                  data-tutorial-zone="tree-delete-btn"
                  title={
                    !hasDeletableNodes
                      ? t("treeDeleteModeDisabledTitle")
                      : deleteMode
                        ? t("treeDeleteModeActiveTitle")
                        : t("treeDeleteModeInactiveTitle")
                  }
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </div>

            {/* Tree Visualizer */}
            <div className="tree-section">
              <TreeVisualizer
                ref={treeRef}
                nodes={treeNodes}
                selectedId={historyProps.historyIndex}
                onSelectNode={wrappedJumpHistory}
                onMakeTop={(id) => {
                  clearExclusiveModes();
                  historyProps.onMakeTop(id);
                  setTimeout(updateTreeState, 50);
                }}
                onCopyBranch={(sourceId, targetId) => {
                  clearExclusiveModes();
                  if (isTutorialActive) {
                    const stepId = TUTORIAL_STEPS[currentStepIndex]?.id;
                    if (stepId === "tree-copy-first-to-second") {
                      const rootChildren =
                        historyProps.historyTree?.nodes?.get?.(0)
                          ?.childrenIds ?? [];
                      const firstRootChildId =
                        rootChildren.length > 0 ? rootChildren[0] : null;
                      const secondRootChildId =
                        rootChildren.length > 1 ? rootChildren[1] : null;
                      if (
                        firstRootChildId == null ||
                        secondRootChildId == null ||
                        sourceId !== firstRootChildId ||
                        targetId !== secondRootChildId
                      ) {
                        showWarningNotice?.("wrong-tree-copy");
                        return;
                      }
                    }
                  }
                  onTutorialCopyBranch?.(sourceId, targetId);
                  historyProps.onCopyBranch?.(sourceId, targetId);
                  setTimeout(updateTreeState, 50);
                }}
                onDeleteNode={handleDeleteFromTree}
                deleteMode={deleteMode}
                onDeleteModeChange={setDeleteModeWithTutorial}
                onZoomLevelChange={onTutorialTreeZoomChanged}
                onFixNode={(nodeId, fixData) => {
                  clearExclusiveModes();
                  onTutorialTreeFixOpened?.({ nodeId, type: fixData?.type });
                  setFixModal({ nodeId, ...fixData });
                }}
                actionColors={ACTION_COLORS}
              />
            </div>
          </div>

          {/* Log Cluster */}
          <NotesCluster
            notes={toolbarProps.notes}
            onChangeNotes={toolbarProps.onChangeNotes}
            historyTree={historyProps.historyTree}
            selectedNodeId={historyProps.historyIndex}
            libraryMap={historyProps.libraryMap}
            shortIdMap={historyProps.shortIdMap}
            refundMode={toolbarProps.refundMode}
            onToggleRefund={wrappedToggleRefund}
            highlightMode={toolbarProps.highlightMode}
            onToggleHighlightMode={wrappedHighlightToggle}
            onPrintBoard={wrappedPrintBoard}
            onExportPdf={wrappedExportPdf}
            onFindWorst={wrappedFindWorst}
            isPast={toolbarProps.isPast}
          />
        </div>
      </div>
      {deleteConfirmState && (
        <div className="modal modal-overlay">
          <div
            className="modal-card modal-confirm-delete"
            data-tutorial-zone="tree-delete-confirm-popup"
          >
            <div className="help-header">
              <h3>
                {deleteConfirmState.deleteSubtree
                  ? t("treeDeleteConfirmSubtreeTitle")
                  : t("treeDeleteConfirmSingleTitle")}
              </h3>
            </div>
            <div className="modal-body">
              <p>{t("treeDeleteConfirmBody")}</p>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginTop: "12px",
                  cursor: "pointer",
                  justifyContent: "center",
                }}
              >
                <input
                  type="checkbox"
                  checked={dontShowDeleteWarningAgain}
                  onChange={(e) =>
                    setDontShowDeleteWarningAgain(e.target.checked)
                  }
                />
                {t("treeDeleteConfirmDontShowAgain")}
              </label>
            </div>
            <div className="modal-actions">
              <button
                className="btn-confirm-delete"
                onClick={handleConfirmDelete}
              >
                {t("treeDeleteConfirmProceed")}
              </button>
              <button
                className="btn-cancel-delete"
                onClick={handleCancelDelete}
              >
                {t("loadSavesBtnCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Fix deficits modal (for configFixable) */}
      <FixDeficitsModal
        open={fixModal?.type === "config"}
        onClose={() => {
          onTutorialTreeFixPopupClosed?.();
          setFixModal(null);
        }}
        deficits={fixModal?.deficits}
        currentConfig={config}
        onApplyFix={(fixes) => {
          updateConfig?.(fixes);
        }}
      />

      {/* Fix layout modal (for orderFixable) */}
      <FixLayoutModal
        open={fixModal?.type === "order"}
        onClose={() => {
          onTutorialTreeFixPopupClosed?.();
          setFixModal(null);
        }}
        fixedLayout={fixModal?.fixedLayout}
        layoutFixPlan={fixModal?.layoutFixPlan}
        currentLayout={boardProps.layout}
        boardProps={boardProps}
        onApplyFix={(fixedLayout, layoutFixPlan) => {
          // Apply the layout fix
          historyProps.onApplyLayoutFix?.(
            fixModal?.nodeId,
            fixedLayout,
            layoutFixPlan,
          );
        }}
      />
    </>
  );
}

// Map history entry to action type for coloring
function mapActionToType(action) {
  if (!action) return "default";
  const type = action.type || "";
  const title = action.title || "";

  // Admin actions get dedicated admin color
  if (type.endsWith("Admin") || type === "adminAdjust") {
    return "admin";
  }

  if (type.includes("move")) return "move";
  if (type.includes("sell")) return "sell";
  if (type === "boostReady" || type === "boostUnlock") return "boostSingle";
  if (type === "finishProductions") return "boostAll";
  if (type === "harvestAll") {
    // "Volle Ernte" = harvestFull (checkpoint), "Rest einsammeln" = harvestPartial
    return title === "Volle Ernte" ? "harvestFull" : "harvestPartial";
  }
  if (type === "harvest") return "collectSingle"; // einzelnes Gebäude einsammeln
  if (type.includes("build")) return "build";
  if (type.includes("region")) return "regionUnlock";

  return "default";
}

// Generate node display data (label text and/or icon path)
function generateNodeDisplay(action, libraryMap, shortIdMap, lang) {
  if (!action) return { nodeLabel: null, nodeIcon: null };

  const type = action.type || "";

  // Resolve defId from action (may have shortId instead of defId)
  const resolveDefId = (act) => {
    if (act?.defId) return act.defId;
    if (act?.shortId && shortIdMap) {
      return shortIdMap[act.shortId] || null;
    }
    return null;
  };

  // Get short name for building
  const getShortName = (act) => {
    const defId = resolveDefId(act);
    if (!defId) return null;
    const def = libraryMap?.[defId];
    if (!def) return null;
    return getBuildingName(def, lang, "short");
  };

  switch (type) {
    // Building actions - show short name
    case "build":
    case "buildAdmin":
    case "sell":
    case "sellAdmin":
    case "boostReady":
    case "boostReadyAdmin":
    case "boostUnlock":
    case "boostUnlockAdmin":
    case "harvest":
    case "harvestAdmin":
      return { nodeLabel: getShortName(action), nodeIcon: null };

    // Goods production - show goods icon
    case "produceGoods":
      return {
        nodeLabel: null,
        nodeIcon: action.goodKey ? getGoodIconPath(action.goodKey) : null,
      };

    case "goodsPurchase":
    case "goodsPurchaseAdmin":
      return {
        nodeLabel: null,
        nodeIcon:
          action.goodsKey || action.key
            ? getGoodIconPath(action.goodsKey || action.key)
            : null,
      };

    // Units production - show unit icon
    case "produceUnits":
      return {
        nodeLabel: null,
        nodeIcon: action.unitKey ? `/units/${action.unitKey}.webp` : null,
      };

    case "unitPurchase":
    case "unitPurchaseAdmin":
      return {
        nodeLabel: null,
        nodeIcon:
          action.unitKey || action.key
            ? `/units/${action.unitKey || action.key}.webp`
            : null,
      };

    // Region unlock - show payment icon
    case "regionUnlockGoods":
      return {
        nodeLabel: null,
        nodeIcon: action.goodKey
          ? getGoodIconPath(action.goodKey)
          : "/menu/goods.png",
      };

    case "regionUnlockShards":
      return {
        nodeLabel: null,
        nodeIcon: "/shards.webp",
      };

    default:
      return { nodeLabel: null, nodeIcon: null };
  }
}

// Generate a human-readable title for history actions
function generateActionTitle(action, libraryMap, shortIdMap, lang) {
  if (!action) return "Start";

  const type = action.type || "";
  const isAdmin = type.endsWith("Admin") || action.admin;
  const adminSuffix = isAdmin ? " (Admin)" : "";

  // Resource labels for adminAdjust
  const RESOURCE_LABELS = {
    coins: "Münzen",
    supplies: "Vorräte",
    chronos: "Chronos",
    shards: "Scherben",
    quantumActions: "QA",
  };

  // Resolve defId from action (may have shortId instead of defId)
  const resolveDefId = (act) => {
    if (act?.defId) return act.defId;
    if (act?.shortId && shortIdMap) {
      return shortIdMap[act.shortId] || null;
    }
    return null;
  };

  // Get short name for building
  const getShortName = (act) => {
    const defId = resolveDefId(act);
    if (!defId) return "?";
    const def = libraryMap?.[defId];
    if (!def) return defId.split(":").pop() || "?";
    return getBuildingName(def, lang, "short");
  };

  const formatCostValue = (value) => {
    if (
      value === "Infinity" ||
      value === Infinity ||
      value === Number.POSITIVE_INFINITY
    ) {
      return "Infinity";
    }
    return formatNumber(value ?? 0);
  };

  switch (type) {
    // Building actions
    case "build":
    case "buildAdmin":
      return `+1 ${getShortName(action)}${adminSuffix}`;

    case "sell":
    case "sellAdmin":
      return `-1 ${getShortName(action)}${adminSuffix}`;

    case "boostReady":
    case "boostReadyAdmin":
      return `Boost 1 ${getShortName(action)}${adminSuffix}`;

    case "boostUnlock":
    case "boostUnlockAdmin":
      return `Unlock 1 ${getShortName(action)}${adminSuffix}`;

    case "harvest":
    case "harvestAdmin":
      return `Ernte 1 ${getShortName(action)}${adminSuffix}`;

    // Move action
    case "move":
      return "Move";

    // Region actions
    case "regionUnlockGoods":
      return `+1 Region (${action.goodKey || "Güter"})${action.admin ? " (Admin)" : ""}`;

    case "regionUnlockShards":
      return `+1 Region (Scherben)${action.admin ? " (Admin)" : ""}`;

    case "regionUnlock":
    case "regionUnlockAdmin":
      return `+1 Region${adminSuffix}`;

    case "regionLockAdmin":
      if (action.method === "goods") {
        return `-1 Region (Güter) (Admin)`;
      }
      if (action.method === "shards") {
        return `-1 Region (Scherben) (Admin)`;
      }
      return `-1 Region (Admin)`;

    case "goodsCostAdmin": {
      const prev = action.prevValue ?? action.oldValue ?? action.prevCost;
      const next = action.nextValue ?? action.newValue ?? action.nextCost;
      if (prev !== undefined && next !== undefined) {
        return `Güterkosten: ${formatCostValue(prev)} -> ${formatCostValue(
          next,
        )} (Admin)`;
      }
      return "Güterkosten angepasst (Admin)";
    }

    case "shardsCostAdmin": {
      const prev = action.prevValue ?? action.oldValue ?? action.prevCost;
      const next = action.nextValue ?? action.newValue ?? action.nextCost;
      if (prev !== undefined && next !== undefined) {
        return `Scherbenkosten: ${formatCostValue(prev)} -> ${formatCostValue(
          next,
        )} (Admin)`;
      }
      return "Scherbenkosten angepasst (Admin)";
    }

    // Harvest all
    case "harvestAll":
    case "harvestAllAdmin":
      return action.title === "Volle Ernte"
        ? `Volle Ernte${adminSuffix}`
        : `Rest einsammeln${adminSuffix}`;

    // Finish productions (boost all)
    case "finishProductions":
    case "finishProductionsAdmin":
      return `Boost Alle${adminSuffix}`;

    case "goodsPurchase":
    case "goodsPurchaseAdmin": {
      const total =
        action.q && typeof action.q === "object" && !Array.isArray(action.q)
          ? Object.entries(action.q).reduce((sum, [amountRaw, countRaw]) => {
              const amount = Number(amountRaw);
              const count = Number(countRaw);
              if (!Number.isFinite(amount) || amount <= 0) return sum;
              if (!Number.isFinite(count) || count <= 0) return sum;
              return sum + amount * count;
            }, 0)
          : Number(action.quantity ?? action.amount ?? action.count ?? 0);
      const goodsKey = action.goodsKey || action.key || "Gueter";
      return `+${formatNumber(total || 0)} ${goodsKey}${adminSuffix}`;
    }

    case "unitPurchase":
    case "unitPurchaseAdmin": {
      const total =
        action.q && typeof action.q === "object" && !Array.isArray(action.q)
          ? Object.entries(action.q).reduce((sum, [amountRaw, countRaw]) => {
              const amount = Number(amountRaw);
              const count = Number(countRaw);
              if (!Number.isFinite(amount) || amount <= 0) return sum;
              if (!Number.isFinite(count) || count <= 0) return sum;
              return sum + amount * count;
            }, 0)
          : Number(action.quantity ?? action.amount ?? action.count ?? 0);
      const unitKey = action.unitKey || action.key || "Units";
      return `+${formatNumber(total || 0)} ${unitKey}${adminSuffix}`;
    }

    // Admin resource adjustments
    case "adminAdjust": {
      const delta = action.delta;
      const group = action.group;
      const key = action.key;

      // Handle single key adjustments
      if (key && typeof delta === "number" && delta !== 0) {
        const prefix = delta > 0 ? "+" : "";

        if (group === "resources") {
          const label = RESOURCE_LABELS[key] || key;
          return `${prefix}${formatNumber(delta)} ${label} (Admin)`;
        }
        if (group === "goods") {
          return `${prefix}${formatNumber(delta)} ${key} (Admin)`;
        }
        if (group === "units") {
          return `${prefix}${formatNumber(delta)} ${key} (Admin)`;
        }
      }

      // Handle deltaByKey for batch changes (e.g., "all goods to X")
      if (action.deltaByKey && typeof action.deltaByKey === "object") {
        const parts = [];
        Object.entries(action.deltaByKey).forEach(([k, v]) => {
          if (v && v !== 0) {
            const prefix = v > 0 ? "+" : "";
            parts.push(`${prefix}${formatNumber(v)} ${k}`);
          }
        });
        if (parts.length > 0) {
          return `${parts.join(", ")} (Admin)`;
        }
      }

      return "Admin Änderung";
    }

    // Goods/Units production
    case "produceGoods":
      return action.goodKey
        ? `+${formatNumber(action.amount || 0)} ${action.goodKey}`
        : "Güter produziert";

    case "produceUnits":
      return action.unitKey
        ? `+${formatNumber(action.amount || 0)} ${action.unitKey}`
        : "Truppen ausgebildet";

    default:
      return action.title || type || "Aktion";
  }
}
