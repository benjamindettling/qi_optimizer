import { useCallback, useEffect, useRef, useState } from "react";
import { Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { useGameController } from "../hooks/useGameController";
import { AppLayout } from "./layout/AppLayout";
import { AppModals } from "./layout/AppModals";
import { HoldTooltip } from "./ui/HoldTooltip";
import { PdfProgressModal } from "./ui/PdfProgressModal";
import { useHoldTooltip } from "./hooks/useHoldTooltip";
import { useHighlightMode } from "./hooks/useHighlightMode";
import { useSnapshotNavigation } from "./hooks/useSnapshotNavigation";
import { useBoardExport } from "./hooks/useBoardExport";
import { useAccountCloudSync } from "../hooks/useAccountCloudSync";
import { applyThemeToDocument, initializeCssColors } from "../config/colors";
import { StartingPage } from "../components/StartingPage/StartingPage";
import { LegalPage } from "../components/LegalPage/LegalPage";
import { useLang } from "../context/LanguageContext";
import { useTutorial } from "../context/TutorialContext";
import { useTutorialActionWatcher } from "../hooks/useTutorialActionWatcher";
import { useTutorialGate } from "../hooks/useTutorialGate";
import { TutorialOverlay } from "../components/Tutorial/TutorialOverlay";
import {
  TUTORIAL_STEPS,
  TUTORIAL_EXAMPLE_SAVE_NAME,
  MH_TARGET_SLOTS,
  CHURCH_TARGET_SLOTS,
} from "../tutorial/tutorialSteps";
import { T } from "../i18n/translations";
import tutorialExampleSave from "../config/example/example_full.json";
import tutorialTreeSave from "../config/example/example_tree.json";
import { deserializeTree, getMainBranchEndNodeId } from "../utils/treeSerializer";

const ROOT_TREE_NEXT_NODE_ID = 1;

const isMhDefId = (defId) =>
  typeof defId === "string" &&
  (defId === "mehrgeschossiges_haus" ||
    defId.endsWith(":mehrgeschossiges_haus"));
const isGutshausDefId = (defId) =>
  typeof defId === "string" && (defId === "gutshaus" || defId.endsWith(":gutshaus"));
const isChurchDefId = (defId) =>
  typeof defId === "string" && (defId === "kirche" || defId.endsWith(":kirche"));

const getRootChildren = (historyTree) => {
  const root = historyTree?.nodes?.get?.(0);
  return Array.isArray(root?.childrenIds) ? root.childrenIds : [];
};

const getBranchTailId = (historyTree, startNodeId) => {
  if (startNodeId == null) return null;
  const nodes = historyTree?.nodes;
  if (!nodes?.get) return null;
  let currentId = startNodeId;
  const seen = new Set();
  while (currentId != null && !seen.has(currentId)) {
    seen.add(currentId);
    const node = nodes.get(currentId);
    if (!node) return null;
    const children = Array.isArray(node.childrenIds) ? node.childrenIds : [];
    if (!children.length) return currentId;
    currentId = children[0];
  }
  return currentId;
};

const isNodeInSubtree = (historyTree, rootNodeId, candidateId) => {
  if (rootNodeId == null || candidateId == null) return false;
  const nodes = historyTree?.nodes;
  if (!nodes?.get) return false;
  const queue = [rootNodeId];
  const seen = new Set();
  while (queue.length) {
    const nodeId = queue.shift();
    if (nodeId == null || seen.has(nodeId)) continue;
    if (nodeId === candidateId) return true;
    seen.add(nodeId);
    const node = nodes.get(nodeId);
    const children = Array.isArray(node?.childrenIds) ? node.childrenIds : [];
    children.forEach((childId) => queue.push(childId));
  }
  return false;
};

// Entry component that wires controller state into all UI pieces.
export function AppRoot() {
  const boardRef = useRef(null);
  const topBarRef = useRef(null);
  const controller = useGameController();
  const adminMode = controller.infiniteResources;
  const [isShopOpen, setIsShopOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountInitialTab, setAccountInitialTab] = useState("account");
  const navigate = useNavigate();
  const location = useLocation();
  const isSimulator = location.pathname === "/simulator";
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const {
    isTutorialActive,
    currentStepIndex,
    completionCount,
    mhPlacedCount,
    churchPlacedCount,
    fireEvent,
    startTutorial,
    showWarningNotice,
    setTutorialRuntime,
  } = useTutorial();
  const boardLocked = useTutorialGate("board");
  const [showTutorialPrompt, setShowTutorialPrompt] = useState(() => {
    try {
      return (
        !localStorage.getItem("qi_tutorial") &&
        !localStorage.getItem("qi_tutorial_dismissed")
      );
    } catch {
      return false;
    }
  });
  const [tutorialExampleInjected, setTutorialExampleInjected] = useState(false);

  // Cloud sync for account settings (config + preferences)
  const {
    canCloudSave,
    saveNow: saveAccountToCloud,
    profile: cloudProfile,
  } = useAccountCloudSync({
    config: controller.config,
    replaceConfig: controller.replaceConfig,
    viewMode: controller.viewMode,
    setViewMode: controller.setViewMode,
    useShortNames: controller.useShortNames,
    setUseShortNames: controller.setUseShortNames,
    boardScale: controller.boardScale,
    setBoardScale: controller.setBoardScale,
    warnDeleteSingleAction: controller.warnDeleteSingleAction,
    setWarnDeleteSingleAction: controller.setWarnDeleteSingleAction,
    warnDeleteSubtree: controller.warnDeleteSubtree,
    setWarnDeleteSubtree: controller.setWarnDeleteSubtree,
  });

  const { tooltip } = useHoldTooltip();
  const { highlightMode, toggleHighlightMode, highlightedIds } =
    useHighlightMode({
      historyTree: controller.historyTree,
      selectedNodeId: controller.historyIndex,
      layout: controller.layout,
      libraryMap: controller.libraryMap,
    });

  useTutorialActionWatcher({
    historyIndex: controller.historyIndex,
    historyNodes: controller.historyNodes,
  });

  const { handleSnapshotBack, handleSnapshotForward } = useSnapshotNavigation({
    snapshots: controller.snapshots,
    selectedSnapshotName: controller.selectedSnapshotName,
    setSelectedSnapshotName: controller.setSelectedSnapshotName,
    handleLoadState: controller.handleLoadState,
  });

  const { handlePrint, handleExportPdf, pdfProgress } = useBoardExport({
    boardRef,
    topBarRef,
    checkpoints: controller.checkpoints,
    loadName: controller.loadName,
    checkpointIndex: controller.checkpointIndex,
    setCheckpointIndex: controller.setCheckpointIndex,
    pauseCheckpointTracking: controller.pauseCheckpointTracking,
    resumeCheckpointTracking: controller.resumeCheckpointTracking,
    buildSnapshot: controller.buildSnapshot,
    applySnapshot: controller.applySnapshot,
    harvestFullForPdf: controller.harvestFullForPdf,
  });

  useEffect(() => {
    // Initialize CSS color variables from colors.js on mount
    initializeCssColors();
  }, []);

  useEffect(() => {
    // Apply theme colors when admin mode changes
    applyThemeToDocument(adminMode);
  }, [adminMode]);

  // Keep topbar height CSS variable updated
  useEffect(() => {
    const el = topBarRef.current;
    if (!el || typeof window === "undefined") return;
    const root = document.documentElement;

    const updateTopBarHeight = () => {
      const topBarHeight = el.getBoundingClientRect().height;
      root.style.setProperty("--topbar-height", `${topBarHeight}px`);
    };

    updateTopBarHeight();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateTopBarHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [isSimulator]);

  // Observe the actual .board-content element and feed its real size
  // to the controller so the board scales fluidly — just like the tree.
  // Width: read from the element (stable — determined by flex layout, not content).
  // Height: capped to the element's width (board is square-ish) and also to
  //         the viewport-available height, whichever is smaller.  This prevents
  //         the board from extending vertically beyond its flex row.
  const boardContentRef = useRef(null);
  const handledTutorialCompletionRef = useRef(0);
  const previousTutorialSectionRef = useRef(null);
  const wasTutorialActiveRef = useRef(false);
  const tutorialTreeBackupRef = useRef(null);

  useEffect(() => {
    const el = boardContentRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const WORKSPACE_PADDING = 32;

    const update = () => {
      const { width } = el.getBoundingClientRect();
      if (width < 1) return;

      // Viewport-based height ceiling
      const topBarH = parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--topbar-height",
        ) || "60",
      );
      const viewportH = Math.max(
        240,
        window.innerHeight - topBarH - WORKSPACE_PADDING,
      );

      // Board height = min(element width, viewport available height).
      const availableH = Math.min(width, viewportH);

      controller.setContainerWidth(width);
      controller.setContainerHeight(availableH);

      // Publish the computed height as a CSS variable on :root so that
      // .board-content can use it as max-height without a resize loop.
      document.documentElement.style.setProperty(
        "--board-content-h",
        `${availableH + 8}px`,
      );
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [
    isSimulator,
    controller.setContainerHeight,
    controller.setContainerWidth,
  ]);

  const boardClusterRef = useRef(null);

  const dismissTutorialPrompt = useCallback(() => {
    setShowTutorialPrompt(false);
    try {
      localStorage.setItem("qi_tutorial_dismissed", "1");
    } catch {
      // no-op
    }
  }, []);

  const cloneHistoryTree = useCallback((tree) => {
    if (!tree?.nodes || !(tree.nodes instanceof Map)) return null;
    const clonedNodes = new Map();
    tree.nodes.forEach((node, id) => {
      clonedNodes.set(id, {
        ...node,
        action: node?.action ? { ...node.action } : null,
        childrenIds: Array.isArray(node?.childrenIds) ? [...node.childrenIds] : [],
      });
    });
    return {
      ...tree,
      nodes: clonedNodes,
    };
  }, []);

  const backupCurrentTreeForTutorial = useCallback(() => {
    if (tutorialTreeBackupRef.current) return;
    const clonedTree = cloneHistoryTree(controller.historyTree);
    if (!clonedTree) return;
    tutorialTreeBackupRef.current = {
      historyTree: clonedTree,
      historyIndex: controller.historyIndex ?? 0,
      loadName: controller.loadName ?? "",
    };
  }, [cloneHistoryTree, controller.historyIndex, controller.historyTree, controller.loadName]);

  const clearTreeForBoardTutorial = useCallback(() => {
    controller.loadHistoryTree?.(
      {
        nodes: new Map([
          [
            0,
            { id: 0, parentId: null, action: null, childrenIds: [] },
          ],
        ]),
        nextNodeId: ROOT_TREE_NEXT_NODE_ID,
      },
      0,
    );
    controller.setSelectedBuildingId?.(null);
    setIsShopOpen(false);
  }, [controller]);

  const restoreTreeAfterTutorial = useCallback(() => {
    const backup = tutorialTreeBackupRef.current;
    if (!backup?.historyTree) return;
    controller.loadHistoryTree?.(backup.historyTree, backup.historyIndex ?? 0);
    controller.setLoadName?.(backup.loadName ?? "");
    tutorialTreeBackupRef.current = null;
  }, [controller]);

  const handleOpenShop = useCallback(() => {
    setIsShopOpen(true);
    fireEvent("shop-opened");
  }, [fireEvent]);

  const handleSetSelectedBuildingId = useCallback(
    (defId) => {
      const step = TUTORIAL_STEPS[currentStepIndex];
      if (isTutorialActive && defId !== null) {
        const requiresMh = step?.id === "board-select-mh";
        const requiresChurch = step?.id === "board-select-church";
        const requiresGutshaus = step?.id === "tree-select-gutshaus";
        const wrongBuilding =
          (requiresMh && !isMhDefId(defId)) ||
          (requiresChurch && !isChurchDefId(defId)) ||
          (requiresGutshaus && !isGutshausDefId(defId));
        if (wrongBuilding) {
          showWarningNotice("wrong-building");
          return;
        }
      }

      if (defId === null) {
        controller.setSelectedBuildingId(null);
      } else if (controller.handleSelectBuilding) {
        controller.handleSelectBuilding(defId);
      } else {
        controller.setSelectedBuildingId(defId);
      }
      if (defId !== null) {
        setIsShopOpen(false);
        fireEvent("building-selected", { defId });
      }
    },
    [
      controller,
      currentStepIndex,
      fireEvent,
      isTutorialActive,
      showWarningNotice,
    ],
  );

  const handleSetSelectedCategory = useCallback(
    (categoryKey) => {
      controller.setSelectedCategory?.(categoryKey);
      fireEvent("shopCategorySelected", { categoryKey });
    },
    [controller, fireEvent],
  );

  const handleCancelPlacement = useCallback(() => {
    controller.setSelectedBuildingId(null);
  }, [controller]);

  const handleChangeNotes = useCallback(
    (value) => {
      controller.handleChangeNotes(value);
      fireEvent("notes-changed");
    },
    [controller, fireEvent],
  );

  const handleSaveWithTutorial = useCallback(
    (name) => {
      controller.handleSaveState(name);
      fireEvent("save");
    },
    [controller, fireEvent],
  );

  const handleOpenLoadSaves = useCallback(() => {
    controller.openLoadSavesModal?.();
    fireEvent("loadMenuOpened");
  }, [controller, fireEvent]);

  const handleTutorialStepForward = useCallback(() => {
    fireEvent("stepForward");
  }, [fireEvent]);

  const handleTutorialJumpHistory = useCallback(
    (id) => {
      fireEvent("jumpHistory", { id });
      if (id === 0) {
        fireEvent("jumpHistoryStart", { id });
      }
      const rootChildren = getRootChildren(controller.historyTree);
      const secondRootChildId =
        rootChildren.length > 1 ? rootChildren[1] : null;
      if (
        secondRootChildId != null &&
        isNodeInSubtree(controller.historyTree, secondRootChildId, id)
      ) {
        fireEvent("jumpHistorySecondRootChild", { id });
      }
      const secondBranchTailId =
        rootChildren.length > 1
          ? getBranchTailId(controller.historyTree, rootChildren[1])
          : null;
      const thirdBranchTailId =
        rootChildren.length > 2
          ? getBranchTailId(controller.historyTree, rootChildren[2])
          : null;
      if (secondBranchTailId != null && id === secondBranchTailId) {
        fireEvent("inspectSecondBranchTail", { id });
      }
      if (thirdBranchTailId != null && id === thirdBranchTailId) {
        fireEvent("inspectThirdBranchTail", { id });
      }
    },
    [controller.historyTree, fireEvent],
  );

  const handleTutorialTreeToggleFocus = useCallback(() => {
    fireEvent("treeToggleFocus");
  }, [fireEvent]);

  const handleTutorialTreeToggleHorizontal = useCallback(() => {
    fireEvent("treeToggleHorizontal");
  }, [fireEvent]);

  const handleTutorialMakeTopBranch = useCallback(() => {
    fireEvent("makeTopBranch");
  }, [fireEvent]);

  const handleTutorialDeleteNode = useCallback(
    (nodeId, deleteSubtree) => {
      const rootChildren = getRootChildren(controller.historyTree);
      const secondRootChildId =
        rootChildren.length > 1 ? rootChildren[1] : null;
      fireEvent("treeDeleteNode", {
        nodeId,
        deleteSubtree: !!deleteSubtree,
        isSecondRootChild:
          secondRootChildId != null && nodeId === secondRootChildId,
      });
      if (deleteSubtree === false) {
        fireEvent("deleteNodeKeepChildren", { nodeId });
      }
    },
    [controller.historyTree, fireEvent],
  );

  const handleTutorialCopyBranch = useCallback(
    (sourceId, targetId) => {
      const rootChildren = getRootChildren(controller.historyTree);
      const firstRootChildId =
        rootChildren.length > 0 ? rootChildren[0] : null;
      const secondRootChildId =
        rootChildren.length > 1 ? rootChildren[1] : null;

      fireEvent("copyBranch", {
        sourceId,
        targetId,
        isCopyFirstToSecond:
          firstRootChildId != null &&
          secondRootChildId != null &&
          sourceId === firstRootChildId &&
          targetId === secondRootChildId,
      });
    },
    [controller.historyTree, fireEvent],
  );

  const handleTutorialDeleteModeChanged = useCallback(
    (enabled) => {
      fireEvent("treeDeleteModeChanged", { enabled: !!enabled });
    },
    [fireEvent],
  );

  const handleTutorialTreeZoomChanged = useCallback(
    ({ relativeZoom }) => {
      fireEvent("treeZoomChanged", { relativeZoom });
      if ((relativeZoom ?? 1) <= 0.001) {
        fireEvent("treeZoomOut", { relativeZoom });
      }
    },
    [fireEvent],
  );

  const handleTutorialTreeFixOpened = useCallback(
    ({ nodeId, type }) => {
      fireEvent("treeFixOpened", { nodeId, type });
    },
    [fireEvent],
  );

  const handleTutorialTreeFixPopupClosed = useCallback(() => {
    fireEvent("treeFixPopupClosed");
  }, [fireEvent]);

  const handleStartTutorial = useCallback(() => {
    startTutorial(0);
    dismissTutorialPrompt();
    navigate("/simulator");
  }, [dismissTutorialPrompt, navigate, startTutorial]);

  const handleStartTutorialFromTopBar = useCallback(() => {
    startTutorial(0);
    dismissTutorialPrompt();
  }, [dismissTutorialPrompt, startTutorial]);

  const closeTutorialPopupByKey = useCallback(
    (popupKey) => {
      switch (popupKey) {
        case "shop":
          setIsShopOpen(false);
          return true;
        case "unlockChoice":
          controller.setUnlockChoice(null);
          return true;
        case "unlockGoodSelect":
          controller.setUnlockGoodSelect(null);
          return true;
        case "harvestModal":
          controller.cancelHarvest?.();
          return true;
        case "smartHarvestModal":
          controller.confirmSmartHarvest?.();
          return true;
        case "smartInvestModal":
          controller.closeSmartInvestModal?.();
          return true;
        case "goodsModal":
          controller.setGoodsModal(null);
          return true;
        case "unitModal":
          controller.setUnitModal(null);
          return true;
        case "fastBuyModal":
          controller.setFastBuyModal(null);
          controller.setFastBuyTarget(null);
          return true;
        case "helpModal":
          controller.setHelpModal(false);
          return true;
        case "configModal":
          controller.setConfigModal(false);
          return true;
        case "accountModal":
          setAccountModalOpen(false);
          return true;
        case "editResourceModal":
          controller.cancelEditResource?.();
          return true;
        case "editGoodModal":
          controller.cancelEditGood?.();
          return true;
        case "editUnitModal":
          controller.cancelEditUnit?.();
          return true;
        case "exportModal":
          controller.setExportModal(false);
          return true;
        case "importModal":
          controller.setImportModal(false);
          return true;
        case "loadSavesModal":
          controller.setLoadSavesModal(false);
          fireEvent("loadMenuClosed");
          return true;
        case "worstModal":
          controller.setWorstModal(null);
          return true;
        case "pastEditModal":
          controller.closePastEditModal?.();
          return true;
        default:
          return false;
      }
    },
    [controller, fireEvent],
  );

  useEffect(() => {
    const ESC_CLOSE_ORDER = [
      "editResourceModal",
      "editGoodModal",
      "editUnitModal",
      "worstModal",
      "fastBuyModal",
      "unlockGoodSelect",
      "unlockChoice",
      "loadSavesModal",
      "helpModal",
      "accountModal",
      "shop",
    ];

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;

      const popupOpenMap = {
        editResourceModal: !!controller.editResourceModal,
        editGoodModal: !!controller.editGoodModal,
        editUnitModal: !!controller.editUnitModal,
        worstModal: !!controller.worstModal,
        fastBuyModal: !!controller.fastBuyModal,
        unlockGoodSelect: !!controller.unlockGoodSelect,
        unlockChoice: !!controller.unlockChoice,
        loadSavesModal: !!controller.loadSavesModal,
        helpModal: !!controller.helpModal,
        accountModal: !!accountModalOpen,
        shop: !!isShopOpen,
      };

      const targetKey = ESC_CLOSE_ORDER.find((key) => popupOpenMap[key]);
      if (!targetKey) return;

      e.preventDefault();
      e.stopPropagation();
      closeTutorialPopupByKey(targetKey);
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [
    accountModalOpen,
    closeTutorialPopupByKey,
    controller.editGoodModal,
    controller.editResourceModal,
    controller.editUnitModal,
    controller.fastBuyModal,
    controller.helpModal,
    controller.loadSavesModal,
    controller.unlockChoice,
    controller.unlockGoodSelect,
    controller.worstModal,
    isShopOpen,
  ]);

  useEffect(() => {
    if (!isTutorialActive) return;
    const step = TUTORIAL_STEPS[currentStepIndex];
    if (!step) return;

    const allowed = new Set(step.allowedPopups ?? []);
    const popupOpenMap = {
      shop: isShopOpen,
      unlockChoice: !!controller.unlockChoice,
      unlockGoodSelect: !!controller.unlockGoodSelect,
      harvestModal: !!controller.harvestModal,
      smartHarvestModal: !!controller.smartHarvestModal,
      smartInvestModal: !!controller.smartInvestModal,
      goodsModal: !!controller.goodsModal,
      unitModal: !!controller.unitModal,
      fastBuyModal: !!controller.fastBuyModal,
      helpModal: !!controller.helpModal,
      configModal: !!controller.configModal,
      accountModal: accountModalOpen,
      editResourceModal: !!controller.editResourceModal,
      editGoodModal: !!controller.editGoodModal,
      editUnitModal: !!controller.editUnitModal,
      exportModal: !!controller.exportModal,
      importModal: !!controller.importModal,
      loadSavesModal: !!controller.loadSavesModal,
      worstModal: !!controller.worstModal,
      pastEditModal: !!controller.pastEditModal,
    };

    let closedAny = false;
    Object.entries(popupOpenMap).forEach(([key, isOpen]) => {
      if (!isOpen || allowed.has(key)) return;
      const closed = closeTutorialPopupByKey(key);
      if (closed) closedAny = true;
    });

    if (closedAny) {
      showWarningNotice("unexpected-popup");
    }
  }, [
    accountModalOpen,
    closeTutorialPopupByKey,
    controller,
    currentStepIndex,
    isShopOpen,
    isTutorialActive,
    showWarningNotice,
  ]);

  useEffect(() => {
    if (!isTutorialActive) return;
    setTutorialRuntime({
      isShopOpen,
      selectedBuildingId: controller.selectedBuildingId,
      selectedCategory: controller.selectedCategory,
      historyTree: controller.historyTree,
      historyIndex: controller.historyIndex,
    });
  }, [
    controller.historyIndex,
    controller.historyTree,
    controller.selectedCategory,
    controller.selectedBuildingId,
    isShopOpen,
    isTutorialActive,
    setTutorialRuntime,
  ]);

  useEffect(() => {
    if (!isTutorialActive) return;
    const stepId = TUTORIAL_STEPS[currentStepIndex]?.id;
    if (stepId !== "tree-delete-second-branch-subtree") return;
    const rootChildren = getRootChildren(controller.historyTree);
    if (rootChildren.length === 1) {
      fireEvent("treeSecondBranchPruned", {
        remainingRootChildren: rootChildren.length,
      });
    }
  }, [
    controller.historyTree,
    currentStepIndex,
    fireEvent,
    isTutorialActive,
  ]);

  const ensureTutorialExampleSave = useCallback(() => {
    if (!controller.setAllSaves || tutorialExampleInjected) return;
    controller.setAllSaves((prev) => {
      if (prev?.[TUTORIAL_EXAMPLE_SAVE_NAME]) return prev;
      return {
        ...(prev || {}),
        [TUTORIAL_EXAMPLE_SAVE_NAME]: {
          ...tutorialExampleSave,
          name: TUTORIAL_EXAMPLE_SAVE_NAME,
        },
      };
    });
    setTutorialExampleInjected(true);
  }, [controller, tutorialExampleInjected]);

  useEffect(() => {
    if (!isTutorialActive || !controller.loadSavesModal) return;
    const step = TUTORIAL_STEPS[currentStepIndex];
    if (!step || step.section !== "saveLoad") return;
    ensureTutorialExampleSave();
  }, [
    controller.loadSavesModal,
    currentStepIndex,
    ensureTutorialExampleSave,
    isTutorialActive,
  ]);

  const loadTutorialTreeSeed = useCallback(() => {
    const treeData = tutorialTreeSave?.tree;
    if (!treeData || !controller.loadHistoryTree) return;
    try {
      const { historyTree: deserializedTree } = deserializeTree(treeData);
      const endNodeId = getMainBranchEndNodeId(deserializedTree);
      controller.loadHistoryTree(deserializedTree, endNodeId);
      controller.setLoadName?.("");
      controller.setSelectedBuildingId?.(null);
      setIsShopOpen(false);
    } catch (err) {
      console.error("Failed to load tutorial tree seed", err);
    }
  }, [controller]);

  useEffect(() => {
    if (!isTutorialActive) {
      previousTutorialSectionRef.current = null;
      return;
    }
    const section = TUTORIAL_STEPS[currentStepIndex]?.section ?? null;
    const previousSection = previousTutorialSectionRef.current;
    if (section === "board" && previousSection !== "board") {
      backupCurrentTreeForTutorial();
      clearTreeForBoardTutorial();
    }
    if (section === "tree" && previousSection !== "tree") {
      loadTutorialTreeSeed();
    }
    previousTutorialSectionRef.current = section;
  }, [
    backupCurrentTreeForTutorial,
    clearTreeForBoardTutorial,
    currentStepIndex,
    isTutorialActive,
    loadTutorialTreeSeed,
  ]);

  useEffect(() => {
    const wasActive = wasTutorialActiveRef.current;
    if (!isTutorialActive && wasActive) {
      restoreTreeAfterTutorial();
      previousTutorialSectionRef.current = null;
    }
    if (isTutorialActive && !wasActive) {
      tutorialTreeBackupRef.current = null;
    }
    wasTutorialActiveRef.current = isTutorialActive;
  }, [isTutorialActive, restoreTreeAfterTutorial]);

  useEffect(() => {
    if (!completionCount) return;
    if (handledTutorialCompletionRef.current === completionCount) return;
    handledTutorialCompletionRef.current = completionCount;
    setIsShopOpen(false);
    setAccountModalOpen(false);
    controller.setHelpModal?.(false);
    controller.setLoadSavesModal?.(false);
    controller.setExportModal?.(false);
    controller.setImportModal?.(false);
    controller.setUnlockChoice?.(null);
    controller.setUnlockGoodSelect?.(null);
    controller.setFastBuyModal?.(null);
    controller.setFastBuyTarget?.(null);
    controller.setGoodsModal?.(null);
    controller.setUnitModal?.(null);
    controller.setSelectedBuildingId?.(null);
  }, [completionCount, controller]);

  // Check if we're in placement mode (a building is selected for placement)
  const isPlacementMode = controller.selectedBuildingId !== null;

  // Calculate if we should show the Sync Config button
  // Show when: savefile is loaded AND its config differs from user config
  const showSyncConfig = (() => {
    if (!controller.loadName || !controller.activeSaveConfig) return false;
    const fields = [
      "extraCoins",
      "extraSupplies",
      "goodsStartBonus",
      "troopsStartBonus",
      "coinBoost",
      "supplyBoost",
    ];
    return fields.some(
      (f) =>
        (controller.activeSaveConfig[f] ?? 0) !==
        (controller.userConfig?.[f] ?? 0),
    );
  })();

  // Handler to sync config - creates new savefile with user's config
  const handleSyncConfig = () => {
    controller.handleSyncConfig?.(controller.userConfig);
  };

  const openAccountModal = (tabKey = "account") => {
    setAccountInitialTab(tabKey);
    setAccountModalOpen(true);
  };

  const sidebarProps = {
    selectedCategory: controller.selectedCategory,
    setSelectedCategory: handleSetSelectedCategory,
    setSelectedBuildingId: handleSetSelectedBuildingId,
    resources: controller.resources,
    stats: controller.stats,
    editingLocked: controller.editingLocked,
    infiniteResources: controller.infiniteResources,
    viewMode: controller.viewMode,
    regionTransform: controller.regionTransform,
    unlockedRegions: controller.unlockedRegions,
    neighborUnlocked: controller.neighborUnlocked,
    currentGoodsCost: controller.currentGoodsCost,
    currentShardCost: controller.currentShardCost,
    goodsUnlocks: controller.goodsUnlocks,
    shardUnlocks: controller.shardUnlocks,
    onSetGoodsUnlocks: controller.setGoodsUnlocks,
    onSetShardUnlocks: controller.setShardUnlocks,
    canAnyUnlock: controller.canAnyUnlock,
    handleUnlockRegion: controller.handleUnlockRegion,
    adminMode,
    onResetModes: controller.resetModes,
    onDebugUnlockRegion: controller.handleDebugUnlockRegion,
    onDebugLockRegion: controller.handleDebugLockRegion,
  };

  const topBarProps = {
    resources: controller.resources,
    stats: controller.stats,
    happyInfo: controller.happyInfo,
    viewMode: controller.viewMode,
    setViewMode: controller.setViewMode,
    adminMode,
    onToggleAdmin: controller.handleToggleInfinite,
    useShortNames: controller.useShortNames,
    setUseShortNames: controller.setUseShortNames,
    onOpenHelp: () => {
      controller.setHelpModal(true);
      fireEvent("helpOpened");
    },
    onOpenAccount: () => openAccountModal("account"),
    onEditResource: controller.handleEditResource,
    onEditGood: controller.handleEditGood,
    onEditUnit: controller.handleEditUnit,
    editingLocked: controller.editingLocked,
    // Expansion costs
    currentGoodsCost: controller.currentGoodsCost,
    currentShardCost: controller.currentShardCost,
    goodsUnlocks: controller.goodsUnlocks,
    shardUnlocks: controller.shardUnlocks,
    onSetGoodsUnlocks: controller.setGoodsUnlocks,
    onSetShardUnlocks: controller.setShardUnlocks,
    hasUnsavedChanges: controller.hasUnsavedChanges,
    onStartTutorial: handleStartTutorialFromTopBar,
  };

  const guardedCellClick = useCallback(
    (col, row) => {
      if (boardLocked) return { ok: false, done: false, kind: "locked" };
      if (isTutorialActive) {
        const step = TUTORIAL_STEPS[currentStepIndex];
        if (step?.id === "board-place-mh-sequence") {
          if (
            controller.selectedBuildingId &&
            !isMhDefId(controller.selectedBuildingId)
          ) {
            showWarningNotice("wrong-building");
            return;
          }
          if (isMhDefId(controller.selectedBuildingId)) {
            const expected = MH_TARGET_SLOTS[mhPlacedCount];
            if (!expected || col !== expected.x || row !== expected.y) {
              showWarningNotice("wrong-placement");
              return { ok: false, done: false, kind: "tutorial-blocked" };
            }
          }
        }
        if (step?.id === "tree-place-gutshaus") {
          const target = MH_TARGET_SLOTS[0];
          if (!isGutshausDefId(controller.selectedBuildingId)) {
            showWarningNotice("wrong-building");
            return { ok: false, done: false, kind: "tutorial-blocked" };
          }
          if (!target || col !== target.x || row !== target.y) {
            showWarningNotice("wrong-placement");
            return { ok: false, done: false, kind: "tutorial-blocked" };
          }
        }
        if (step?.id === "board-place-church-sequence") {
          if (
            controller.selectedBuildingId &&
            !isChurchDefId(controller.selectedBuildingId)
          ) {
            showWarningNotice("wrong-building");
            return;
          }
          if (isChurchDefId(controller.selectedBuildingId)) {
            const expected = CHURCH_TARGET_SLOTS[churchPlacedCount];
            if (!expected || col !== expected.x || row !== expected.y) {
              showWarningNotice("wrong-placement");
              return { ok: false, done: false, kind: "tutorial-blocked" };
            }
          }
        }
        if (step?.id === "board-harvest-first-mh") {
          const first = MH_TARGET_SLOTS[0];
          const isFirstMhCell =
            col >= first.x &&
            col < first.x + first.w &&
            row >= first.y &&
            row < first.y + first.h;
          if (!isFirstMhCell) {
            return { ok: false, done: false, kind: "tutorial-blocked" };
          }
          if (controller.selectedBuildingId) {
            controller.setSelectedBuildingId(null);
          }
        }
      }
      return controller.handleCellClick(col, row);
    },
    [
      boardLocked,
      controller,
      currentStepIndex,
      isTutorialActive,
      mhPlacedCount,
      churchPlacedCount,
      showWarningNotice,
    ],
  );

  const guardedRegionClick = useCallback(
    (...args) => {
      if (boardLocked) return;
      controller.handleUnlockRegion(...args);
      fireEvent("region-opened");
    },
    [boardLocked, controller, fireEvent],
  );

  const boardProps = {
    viewRotation: controller.viewRotation,
    boardTransform: controller.boardTransform,
    rotatedWidthPx: controller.rotatedWidthPx,
    rotatedHeightPx: controller.rotatedHeightPx,
    viewWidth: controller.viewWidth,
    viewHeight: controller.viewHeight,
    viewColStart: controller.viewColStart,
    viewRowStart: controller.viewRowStart,
    cellSizePx: controller.cellSizePx,
    previewOrigin: controller.previewOrigin,
    isCellUnlocked: controller.isCellUnlocked,
    handleCellClick: guardedCellClick,
    setHoverCell: controller.setHoverCell,
    onDropComplete: () => controller.setSelectedBuildingId(null),
    onCancelAction: controller.onCancelAction,
    boardRef,
    highlightedIds,
    layout: controller.layout,
    libraryMap: controller.libraryMap,
    categoryColors: controller.categoryColors,
    boardTransformClass: controller.boardTransformClass,
    buildLocks: controller.buildLocks,
    readyMap: controller.readyMap,
    useShortNames: controller.useShortNames,
    // Region props
    unlockedRegions: controller.unlockedRegions,
    neighborUnlocked: controller.neighborUnlocked,
    canAnyUnlock: controller.canAnyUnlock,
    onRegionClick: guardedRegionClick,
    adminMode,
    onDebugUnlockRegion: controller.handleDebugUnlockRegion,
    onDebugLockRegion: controller.handleDebugLockRegion,
    infiniteResources: controller.infiniteResources,
    moveMode: controller.moveMode,
    selectedBuildingId: controller.selectedBuildingId,
    carried: controller.carried,
  };

  const toolbarProps = {
    moveMode: controller.moveMode,
    onToggleMove: controller.toggleMove,
    sellMode: controller.sellMode,
    refundMode: controller.refundMode,
    onToggleSell: controller.toggleSell,
    onToggleRefund: controller.toggleRefund,
    onToggleBoost: controller.toggleBoost,
    finishProductions: controller.finishProductions,
    harvestIsPartial: Object.values(controller.readyMap || {}).some(Boolean),
    harvestPartial: controller.harvestPartialOnly,
    boostMode: controller.boostMode,
    harvestAll: controller.harvestAll,
    onSave: handleSaveWithTutorial,
    onLoad: (name) =>
      controller.handleLoadState(name, { createSnapshot: true }),
    saves: controller.visibleSaves,
    snapshots: controller.snapshots,
    selectedSnapshotName: controller.selectedSnapshotName,
    onSnapshotBack: handleSnapshotBack,
    onSnapshotForward: handleSnapshotForward,
    loadName: controller.loadName,
    setLoadName: controller.setLoadName,
    notes: controller.notes,
    onChangeNotes: handleChangeNotes,
    highlightMode,
    onToggleHighlightMode: toggleHighlightMode,
    onPrintBoard: handlePrint,
    onFindWorst: controller.openWorstModal,
    timeStep: controller.timeStep,
    canTimeBack: controller.canTimeBack,
    canTimeForward: controller.canTimeForward,
    onStepBack: controller.jumpBackTime,
    onStepForward: controller.jumpForwardTime,
    onAddCheckpoint: controller.addCheckpointPart,
    isLatestCheckpoint: controller.checkpointIndex === null,
    timePart: controller.currentPart,
    timePartTotal: controller.currentPartTotal,
    isPast: controller.isPast,
    editUnlocked: controller.editUnlocked,
    onOpenPastEditWarning: controller.openPastEditModal,
    editingLocked: controller.editingLocked,
    onOpenExport: controller.openExportSaves,
    onOpenImport: controller.openImportSaves,
    onOpenLoadSaves: handleOpenLoadSaves,
    onExportPdf: handleExportPdf,
    isPlacementMode,
    onCancelPlacement: handleCancelPlacement,
    onDeleteSave: (name) => {
      controller.deleteSave(name);
      controller.setLoadName((prev) => (prev === name ? "" : prev));
    },
    hasUnsavedChanges: controller.hasUnsavedChanges,
  };

  const historyProps = {
    historyIndex: controller.historyIndex,
    historyTree: controller.historyTree,
    historyNodes: controller.historyNodes,
    historyInvalidSteps: controller.historyInvalidSteps,
    historyChecking: controller.historyChecking,
    onJumpHistory: controller.jumpToHistory,
    onMakeTop: controller.makeTopBranch,
    onCopyBranch: controller.copyBranchTo,
    onDeleteNode: controller.deleteNode,
    onApplyLayoutFix: controller.applyLayoutFix,
    libraryMap: controller.libraryMap,
    shortIdMap: controller.shortIdMap,
  };

  // NOTE: regionPanelProps removed - region functionality moved to Board overlays
  // and expansion costs moved under the Board.

  // ---- Route-based rendering ----
  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <StartingPage
              config={controller.config}
              updateConfig={controller.updateConfig}
              onStartSimulator={() => navigate("/simulator")}
              onOpenSaves={() => controller.setLoadSavesModal(true)}
              onOpenAccount={openAccountModal}
              onStartTutorial={handleStartTutorial}
            />
          }
        />
        <Route
          path="/simulator"
          element={
            <>
              <AppLayout
                sidebarProps={sidebarProps}
                topBarProps={topBarProps}
                boardProps={boardProps}
                toolbarProps={toolbarProps}
                historyProps={historyProps}
                status={controller.status}
                carried={controller.carried}
                topBarRef={topBarRef}
                boardClusterRef={boardClusterRef}
                boardContentRef={boardContentRef}
                isShopOpen={isShopOpen}
                onCloseShop={() => setIsShopOpen(false)}
                onOpenShop={handleOpenShop}
                config={controller.config}
                updateConfig={controller.updateConfig}
                toolbarPosition={controller.toolbarPosition}
                showSyncConfig={showSyncConfig}
                onSyncConfig={handleSyncConfig}
                onTutorialStepForward={handleTutorialStepForward}
                onTutorialJumpHistory={handleTutorialJumpHistory}
                onTutorialTreeToggleFocus={handleTutorialTreeToggleFocus}
                onTutorialTreeToggleHorizontal={
                  handleTutorialTreeToggleHorizontal
                }
                onTutorialMakeTop={handleTutorialMakeTopBranch}
                onTutorialDeleteNode={handleTutorialDeleteNode}
                onTutorialDeleteModeChanged={handleTutorialDeleteModeChanged}
                onTutorialCopyBranch={handleTutorialCopyBranch}
                onTutorialTreeZoomChanged={handleTutorialTreeZoomChanged}
                onTutorialTreeFixOpened={handleTutorialTreeFixOpened}
                onTutorialTreeFixPopupClosed={handleTutorialTreeFixPopupClosed}
                warnDeleteSingleAction={controller.warnDeleteSingleAction}
                setWarnDeleteSingleAction={controller.setWarnDeleteSingleAction}
                warnDeleteSubtree={controller.warnDeleteSubtree}
                setWarnDeleteSubtree={controller.setWarnDeleteSubtree}
              />
              {isSimulator && showTutorialPrompt && (
                <div className="tutorial-first-visit-banner">
                  <span>{t("tutorialFirstVisit")}</span>
                  <button
                    onClick={() => {
                      startTutorial(0);
                      dismissTutorialPrompt();
                    }}
                  >
                    {t("tutorialFirstVisitBtn")}
                  </button>
                  <button
                    onClick={dismissTutorialPrompt}
                    aria-label={t("loadSavesBtnCancel")}
                  >
                    x
                  </button>
                </div>
              )}
              <HoldTooltip tooltip={tooltip} />
              <PdfProgressModal progress={pdfProgress} />
            </>
          }
        />
        <Route path="/contact" element={<LegalPage type="contact" />} />
        <Route path="/imprint" element={<LegalPage type="imprint" />} />
        <Route path="/privacy" element={<LegalPage type="privacy" />} />
      </Routes>
      {/* Modals rendered on all routes so Account & LoadSaves work everywhere */}
      <AppModals
        controller={controller}
        accountModalOpen={accountModalOpen}
        accountInitialTab={accountInitialTab}
        setAccountModalOpen={setAccountModalOpen}
        viewMode={controller.viewMode}
        setViewMode={controller.setViewMode}
        useShortNames={controller.useShortNames}
        setUseShortNames={controller.setUseShortNames}
        toolbarPosition={controller.toolbarPosition}
        setToolbarPosition={controller.setToolbarPosition}
        boardScale={controller.boardScale}
        setBoardScale={controller.setBoardScale}
        warnDeleteSingleAction={controller.warnDeleteSingleAction}
        setWarnDeleteSingleAction={controller.setWarnDeleteSingleAction}
        warnDeleteSubtree={controller.warnDeleteSubtree}
        setWarnDeleteSubtree={controller.setWarnDeleteSubtree}
        saveAccountToCloud={saveAccountToCloud}
        canCloudSave={canCloudSave}
        cloudProfile={cloudProfile}
      />
      <TutorialOverlay />
    </>
  );
}
