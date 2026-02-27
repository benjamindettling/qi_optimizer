import { createContext, useCallback, useContext, useMemo, useState } from "react";
import {
  MH_TARGET_SLOTS,
  TUTORIAL_STEPS,
  TUTORIAL_EXAMPLE_SAVE_NAME,
} from "../tutorial/tutorialSteps";

const TutorialContext = createContext({
  isTutorialActive: false,
  currentStepIndex: 0,
  warningNotice: null,
  completionCount: 0,
  mhPlacedCount: 0,
  tutorialRuntime: {
    isShopOpen: false,
    selectedBuildingId: null,
    historyTree: null,
    historyIndex: 0,
  },
  startTutorial: () => {},
  advanceStep: () => {},
  exitTutorial: () => {},
  fireEvent: () => {},
  clearWarningNotice: () => {},
  showWarningNotice: () => {},
  setTutorialRuntime: () => {},
  jumpToSection: () => {},
});

const LS_KEY = "qi_tutorial";

const persistProgress = (payload) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(payload));
  } catch {
    // no-op
  }
};

const actionMatches = (expected, actual) => {
  if (expected === actual) return true;
  if (expected === "build" && actual === "buildAdmin") return true;
  if (expected === "harvest" && actual === "harvestAdmin") return true;
  if (expected === "harvestAll" && actual === "harvestAllAdmin") return true;
  if (expected === "finishProductions" && actual === "finishProductionsAdmin") return true;
  return false;
};

const isMhDefId = (defId) =>
  typeof defId === "string" &&
  (defId === "mehrgeschossiges_haus" ||
    defId.endsWith(":mehrgeschossiges_haus"));
const isGutshausDefId = (defId) =>
  typeof defId === "string" && (defId === "gutshaus" || defId.endsWith(":gutshaus"));

export function TutorialProvider({ children }) {
  const [isTutorialActive, setIsTutorialActive] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [warningNotice, setWarningNotice] = useState(null);
  const [completionCount, setCompletionCount] = useState(0);
  const [mhPlacedCount, setMhPlacedCount] = useState(0);
  const [tutorialRuntime, setTutorialRuntime] = useState({
    isShopOpen: false,
    selectedBuildingId: null,
    historyTree: null,
    historyIndex: 0,
  });

  const clearWarningNotice = useCallback(() => {
    setWarningNotice(null);
  }, []);

  const showWarningNotice = useCallback((reason = "unexpected-popup") => {
    setWarningNotice({
      id: Date.now(),
      reason,
    });
  }, []);

  const initializeStepState = useCallback((stepIndex) => {
    const step = TUTORIAL_STEPS[stepIndex];
    if (!step) return;
    if (step.id === "board-place-mh-sequence") {
      setMhPlacedCount(0);
    }
  }, []);

  const finishTutorial = useCallback((lastStep) => {
    setIsTutorialActive(false);
    setWarningNotice(null);
    setCompletionCount((prev) => prev + 1);
    persistProgress({
      completed: true,
      dismissed: true,
      lastStep,
    });
  }, []);

  const jumpToStep = useCallback(
    (stepIndex) => {
      const next = Math.max(0, Math.min(stepIndex, TUTORIAL_STEPS.length - 1));
      initializeStepState(next);
      setWarningNotice(null);
      setCurrentStepIndex(next);
      persistProgress({
        completed: false,
        dismissed: false,
        lastStep: next,
      });
    },
    [initializeStepState],
  );

  const advanceFromCurrent = useCallback(() => {
    const next = currentStepIndex + 1;
    if (next >= TUTORIAL_STEPS.length) {
      finishTutorial(currentStepIndex);
      return;
    }
    jumpToStep(next);
  }, [currentStepIndex, finishTutorial, jumpToStep]);

  const jumpToSection = useCallback(
    (sectionKey) => {
      const idx = TUTORIAL_STEPS.findIndex((item) => item.section === sectionKey);
      if (idx < 0) return;
      jumpToStep(idx);
    },
    [jumpToStep],
  );

  const startTutorial = useCallback(
    (fromStep = 0) => {
      const safeStep = Math.max(0, Math.min(fromStep, TUTORIAL_STEPS.length - 1));
      setIsTutorialActive(true);
      setMhPlacedCount(0);
      setTutorialRuntime({
        isShopOpen: false,
        selectedBuildingId: null,
        historyTree: null,
        historyIndex: 0,
      });
      jumpToStep(safeStep);
    },
    [jumpToStep],
  );

  const advanceStep = useCallback(() => {
    advanceFromCurrent();
  }, [advanceFromCurrent]);

  const exitTutorial = useCallback(() => {
    setIsTutorialActive(false);
    setWarningNotice(null);
    persistProgress({
      completed: false,
      dismissed: true,
      lastStep: currentStepIndex,
    });
  }, [currentStepIndex]);

  const fireEvent = useCallback(
    (eventName, payload = {}) => {
      if (!isTutorialActive) return;
      const step = TUTORIAL_STEPS[currentStepIndex];
      if (!step) return;

      if (step.id === "board-select-mh") {
        if (eventName !== "building-selected") return;
        if (!isMhDefId(payload?.defId)) {
          showWarningNotice("wrong-building");
          return;
        }
        advanceFromCurrent();
        return;
      }

      if (step.id === "board-place-mh-sequence") {
        if (!actionMatches("build", eventName)) return;
        const expected = MH_TARGET_SLOTS[mhPlacedCount];
        if (!expected) return;
        const isMh = payload?.shortId === "H1" || isMhDefId(payload?.defId);
        const isExactSlot = payload?.x === expected.x && payload?.y === expected.y;
        if (!isMh || !isExactSlot) {
          showWarningNotice("wrong-placement");
          return;
        }
        const nextCount = mhPlacedCount + 1;
        if (nextCount >= MH_TARGET_SLOTS.length) {
          setMhPlacedCount(nextCount);
          advanceFromCurrent();
          return;
        }
        setMhPlacedCount(nextCount);
        return;
      }

      if (step.id === "tree-zoom-out") {
        if (
          eventName === "treeZoomOut" ||
          (eventName === "treeZoomChanged" && (payload?.relativeZoom ?? 1) <= 0.001)
        ) {
          advanceFromCurrent();
        }
        return;
      }

      if (step.id === "tree-select-gutshaus") {
        if (eventName !== "building-selected") return;
        if (!isGutshausDefId(payload?.defId)) {
          showWarningNotice("wrong-building");
          return;
        }
        advanceFromCurrent();
        return;
      }

      if (step.id === "tree-place-gutshaus") {
        if (!actionMatches("build", eventName)) return;
        const target = MH_TARGET_SLOTS[0];
        const isTarget =
          payload?.x === target.x &&
          payload?.y === target.y;
        if (!isTarget) {
          showWarningNotice("wrong-placement");
          return;
        }
        advanceFromCurrent();
        return;
      }

      if (step.id === "tree-copy-first-to-second") {
        if (eventName !== "copyBranch") return;
        if (!payload?.isCopyFirstToSecond) {
          showWarningNotice("wrong-tree-copy");
          return;
        }
        advanceFromCurrent();
        return;
      }

      if (step.id === "tree-open-fix") {
        if (eventName !== "treeFixOpened") return;
        advanceFromCurrent();
        return;
      }

      if (step.id === "tree-fix-popup") {
        if (eventName !== "treeFixPopupClosed") return;
        advanceFromCurrent();
        return;
      }

      if (step.id === "tree-inspect-second-branch") {
        if (eventName !== "inspectSecondBranchTail") return;
        advanceFromCurrent();
        return;
      }

      if (step.id === "tree-delete-intro") {
        if (eventName !== "treeDeleteModeChanged") return;
        if (!payload?.enabled) return;
        advanceFromCurrent();
        return;
      }

      if (step.id === "tree-delete-second-branch-subtree") {
        if (eventName === "treeDeleteNode") {
          if (!payload?.deleteSubtree || !payload?.isSecondRootChild) {
            showWarningNotice("tree-delete-wrong-node");
          }
          return;
        }
        if (eventName !== "treeSecondBranchPruned") return;
        advanceFromCurrent();
        return;
      }

      if (step.id === "board-harvest-first-mh") {
        if (actionMatches("harvestAll", eventName)) {
          showWarningNotice("harvest-first-single");
          return;
        }
        if (!actionMatches("harvest", eventName)) return;
        const first = MH_TARGET_SLOTS[0];
        const isFirstMh =
          (isMhDefId(payload?.defId) || payload?.shortId === "H1") &&
          payload?.x === first.x &&
          payload?.y === first.y;
        if (!isFirstMh) {
          showWarningNotice("harvest-wrong-target");
          return;
        }
        advanceFromCurrent();
        return;
      }

      if (step.id === "save-load-load-example") {
        if (eventName !== "loadExampleSave") return;
        if (payload?.name !== TUTORIAL_EXAMPLE_SAVE_NAME) {
          showWarningNotice("wrong-savefile");
          return;
        }
        advanceFromCurrent();
        return;
      }

      if (step.advanceOn !== "action") return;
      if (!actionMatches(step.actionType, eventName)) return;
      advanceFromCurrent();
    },
    [
      advanceFromCurrent,
      currentStepIndex,
      isTutorialActive,
      mhPlacedCount,
      showWarningNotice,
    ],
  );

  const value = useMemo(
    () => ({
      isTutorialActive,
      currentStepIndex,
      warningNotice,
      completionCount,
      mhPlacedCount,
      tutorialRuntime,
      startTutorial,
      advanceStep,
      exitTutorial,
      fireEvent,
      clearWarningNotice,
      showWarningNotice,
      setTutorialRuntime,
      jumpToSection,
    }),
    [
      isTutorialActive,
      currentStepIndex,
      warningNotice,
      completionCount,
      mhPlacedCount,
      tutorialRuntime,
      startTutorial,
      advanceStep,
      exitTutorial,
      fireEvent,
      clearWarningNotice,
      showWarningNotice,
      jumpToSection,
    ],
  );

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
}

export function useTutorial() {
  return useContext(TutorialContext);
}
