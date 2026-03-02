import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTutorial } from "../../context/TutorialContext";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import {
  MH_TARGET_SLOTS,
  CHURCH_TARGET_SLOTS,
  TUTORIAL_SECTIONS,
  TUTORIAL_STEPS,
} from "../../tutorial/tutorialSteps";
import { ZONE_REGISTRY } from "../../tutorial/zoneRegistry";
import "./TutorialOverlay.css";

const isMhDefId = (defId) =>
  typeof defId === "string" &&
  (defId === "mehrgeschossiges_haus" ||
    defId.endsWith(":mehrgeschossiges_haus"));
const isChurchDefId = (defId) =>
  typeof defId === "string" && (defId === "kirche" || defId.endsWith(":kirche"));

const getRootChildId = (historyTree, childIndex) => {
  const root = historyTree?.nodes?.get?.(0);
  const children = Array.isArray(root?.childrenIds) ? root.childrenIds : [];
  return children[childIndex] ?? null;
};

const getBranchTailId = (historyTree, startNodeId) => {
  const nodes = historyTree?.nodes;
  if (!nodes?.get || startNodeId == null) return null;
  const visited = new Set();
  let currentId = startNodeId;
  while (currentId != null && !visited.has(currentId)) {
    visited.add(currentId);
    const node = nodes.get(currentId);
    if (!node) return null;
    const children = Array.isArray(node.childrenIds) ? node.childrenIds : [];
    if (!children.length) return currentId;
    currentId = children[0];
  }
  return currentId;
};

const collectSubtreeNodeIds = (historyTree, startNodeId) => {
  const nodes = historyTree?.nodes;
  if (!nodes?.get || startNodeId == null) return [];
  const queue = [startNodeId];
  const seen = new Set();
  while (queue.length) {
    const currentId = queue.shift();
    if (currentId == null || seen.has(currentId)) continue;
    seen.add(currentId);
    const node = nodes.get(currentId);
    const children = Array.isArray(node?.childrenIds) ? node.childrenIds : [];
    children.forEach((childId) => queue.push(childId));
  }
  return Array.from(seen);
};

const getTreeEdgeRect = (parentId, childId) => {
  if (parentId == null || childId == null) return null;
  const edgeEl =
    document.querySelector(
      `.tree-visualizer [data-edge-parent-id="${parentId}"][data-edge-child-id="${childId}"].edge-hit`,
    ) ||
    document.querySelector(
      `.tree-visualizer [data-edge-parent-id="${parentId}"][data-edge-child-id="${childId}"].edge`,
    );
  if (!edgeEl) return null;
  return toRect(edgeEl.getBoundingClientRect());
};

const toRect = (domRect) => ({
  top: domRect.top,
  left: domRect.left,
  width: domRect.width,
  height: domRect.height,
});

const rectsOverlap = (a, b) =>
  a.left < b.left + b.width &&
  a.left + a.width > b.left &&
  a.top < b.top + b.height &&
  a.top + a.height > b.top;

const overlapArea = (a, b) => {
  if (!rectsOverlap(a, b)) return 0;
  const xOverlap =
    Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const yOverlap =
    Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  return Math.max(0, xOverlap) * Math.max(0, yOverlap);
};

const isEditableTarget = (target) => {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
    return true;
  }
  return !!target.closest('[contenteditable="true"]');
};

const resolveZoneRect = (target) => {
  if (!target) return null;
  if (typeof target.getBoundingClientRect === "function") {
    return toRect(target.getBoundingClientRect());
  }
  if (
    Number.isFinite(target.top) &&
    Number.isFinite(target.left) &&
    Number.isFinite(target.width) &&
    Number.isFinite(target.height)
  ) {
    return target;
  }
  return null;
};

export function TutorialOverlay() {
  const {
    isTutorialActive,
    currentStepIndex,
    warningNotice,
    completionCount,
    mhPlacedCount,
    churchPlacedCount,
    tutorialRuntime,
    advanceStep,
    exitTutorial,
    clearWarningNotice,
    jumpToSection,
  } = useTutorial();
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const [targetRects, setTargetRects] = useState([]);
  const [chapterAvoidRect, setChapterAvoidRect] = useState(null);
  const [manualPopoverPos, setManualPopoverPos] = useState(null);
  const [manualWarningPos, setManualWarningPos] = useState(null);
  const [dragState, setDragState] = useState(null);
  const rafRef = useRef(null);

  const step = TUTORIAL_STEPS[currentStepIndex];
  const isLastStep = currentStepIndex === TUTORIAL_STEPS.length - 1;
  const POP_WIDTH = 340;
  const POP_HEIGHT = 300;
  const WARNING_WIDTH = 360;
  const WARNING_HEIGHT = 132;
  const VIEWPORT_MARGIN = 8;

  const computeBoardSlotRect = useCallback((slot) => {
    if (!slot) return null;
    const svg = document.querySelector(".board-svg");
    const boardSpaceLike = document.querySelector(
      '.board-svg g[data-layer="background-grid"]',
    );
    if (!svg || !boardSpaceLike) return null;
    const ctm = boardSpaceLike.getScreenCTM?.();
    if (!ctm) return null;

    const cellSize = Number(svg.dataset.cellSize || 0);
    const viewColStart = Number(svg.dataset.viewColStart || 0);
    const viewRowStart = Number(svg.dataset.viewRowStart || 0);
    if (!cellSize) return null;

    const x0 = (slot.x - viewColStart) * cellSize;
    const y0 = (slot.y - viewRowStart) * cellSize;
    const x1 = x0 + slot.w * cellSize;
    const y1 = y0 + slot.h * cellSize;

    const toScreen = (x, y) => {
      const point = svg.createSVGPoint();
      point.x = x;
      point.y = y;
      return point.matrixTransform(ctm);
    };

    const corners = [
      toScreen(x0, y0),
      toScreen(x1, y0),
      toScreen(x0, y1),
      toScreen(x1, y1),
    ];
    const left = Math.min(...corners.map((p) => p.x));
    const right = Math.max(...corners.map((p) => p.x));
    const top = Math.min(...corners.map((p) => p.y));
    const bottom = Math.max(...corners.map((p) => p.y));

    return {
      zone: "dynamic-board-slot",
      top,
      left,
      width: right - left,
      height: bottom - top,
    };
  }, []);

  const getDynamicRects = useCallback(() => {
    if (!step) return [];
    if (
      step.dynamicMode === "mh-placement" ||
      step.dynamicMode === "church-placement" ||
      step.dynamicMode === "mh-first-harvest" ||
      step.dynamicMode === "gutshaus-first-slot"
    ) {
      const slot =
        step.dynamicMode === "mh-first-harvest" || step.dynamicMode === "gutshaus-first-slot"
          ? MH_TARGET_SLOTS[0]
          : step.dynamicMode === "church-placement"
            ? CHURCH_TARGET_SLOTS[churchPlacedCount]
            : MH_TARGET_SLOTS[mhPlacedCount];
      const rect = computeBoardSlotRect(slot);
      return rect ? [rect] : [];
    }

    if (step.dynamicMode?.startsWith("tree-")) {
      const historyTree = tutorialRuntime.historyTree;
      const getNodeRect = (nodeId) => {
        if (nodeId == null) return null;
        const nodeEl = document.querySelector(`[data-node-id="${nodeId}"]`);
        if (!nodeEl) return null;
        const rect = nodeEl.getBoundingClientRect();
        return {
          zone: `dynamic-tree-node-${nodeId}`,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        };
      };

      if (step.dynamicMode === "tree-root-node") {
        const rect = getNodeRect(0);
        return rect ? [rect] : [];
      }
      if (step.dynamicMode === "tree-root-second-child-node") {
        const secondChildId = getRootChildId(historyTree, 1);
        const rect = getNodeRect(secondChildId);
        return rect ? [rect] : [];
      }
      if (step.dynamicMode === "tree-root-second-child-edge") {
        const secondChildId = getRootChildId(historyTree, 1);
        const rect = getTreeEdgeRect(0, secondChildId);
        return rect
          ? [
              {
                zone: `dynamic-tree-edge-0-${secondChildId}`,
                ...rect,
              },
            ]
          : [];
      }
      if (step.dynamicMode === "tree-root-second-branch-tail") {
        const secondChildId = getRootChildId(historyTree, 1);
        const tailId = getBranchTailId(historyTree, secondChildId);
        const rect = getNodeRect(tailId);
        return rect ? [rect] : [];
      }
      if (step.dynamicMode === "tree-root-third-branch-tail") {
        const thirdChildId = getRootChildId(historyTree, 2);
        const tailId = getBranchTailId(historyTree, thirdChildId);
        const rect = getNodeRect(tailId);
        return rect ? [rect] : [];
      }
      if (step.dynamicMode === "tree-root-second-branch-subtree") {
        const popup = ZONE_REGISTRY["tree-delete-confirm-popup"]?.();
        if (popup) {
          const rect = popup.getBoundingClientRect();
          return [
            {
              zone: "dynamic-tree-delete-popup",
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            },
          ];
        }
        const secondChildId = getRootChildId(historyTree, 1);
        const subtreeIds = collectSubtreeNodeIds(historyTree, secondChildId);
        if (!subtreeIds.length) return [];
        const subtreeRects = subtreeIds
          .map((nodeId) => getNodeRect(nodeId))
          .filter(Boolean);
        if (!subtreeRects.length) return [];
        const minTop = Math.min(...subtreeRects.map((r) => r.top));
        const minLeft = Math.min(...subtreeRects.map((r) => r.left));
        const maxRight = Math.max(...subtreeRects.map((r) => r.left + r.width));
        const maxBottom = Math.max(...subtreeRects.map((r) => r.top + r.height));
        return [
          {
            zone: "dynamic-tree-root-second-branch-subtree",
            top: minTop,
            left: minLeft,
            width: maxRight - minLeft,
            height: maxBottom - minTop,
          },
        ];
      }
    }

    return [];
  }, [computeBoardSlotRect, mhPlacedCount, churchPlacedCount, step, tutorialRuntime.historyTree]);

  const staticHighlightZones = useMemo(() => {
    if (!step) return [];
    if (step.dynamicMode === "mh-placement") {
      if (isMhDefId(tutorialRuntime.selectedBuildingId)) {
        return [];
      }
      if (tutorialRuntime.isShopOpen) {
        return ["mh-card", "shop-panel"];
      }
      return ["shop-btn"];
    }
    if (step.dynamicMode === "church-placement") {
      if (isChurchDefId(tutorialRuntime.selectedBuildingId)) {
        return [];
      }
      if (tutorialRuntime.isShopOpen) {
        return ["church-card", "shop-panel"];
      }
      return ["shop-btn"];
    }
    const zones = [step.highlight, ...(step.highlightZones ?? [])].filter(Boolean);
    return Array.from(new Set(zones));
  }, [step, tutorialRuntime.isShopOpen, tutorialRuntime.selectedBuildingId]);

  useEffect(() => {
    if (!isTutorialActive || !step) return undefined;

    const update = () => {
      const nextRects = [];
      staticHighlightZones.forEach((zone) => {
        const getter = ZONE_REGISTRY[zone];
        const rect = resolveZoneRect(getter?.());
        if (!rect) return;
        nextRects.push({
          zone,
          ...rect,
        });
      });
      nextRects.push(...getDynamicRects());
      setTargetRects(nextRects);

      if (step.section === "board" || step.section === "tree") {
        const chapterZoneRect = ZONE_REGISTRY[step.section]?.()?.getBoundingClientRect?.();
        setChapterAvoidRect(chapterZoneRect ? toRect(chapterZoneRect) : null);
      } else {
        setChapterAvoidRect(null);
      }
      rafRef.current = requestAnimationFrame(update);
    };

    rafRef.current = requestAnimationFrame(update);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [getDynamicRects, isTutorialActive, staticHighlightZones, step]);

  useEffect(() => {
    setManualPopoverPos(null);
  }, [currentStepIndex]);

  useEffect(() => {
    if (!warningNotice) return undefined;
    setManualWarningPos(null);
    const timer = setTimeout(() => {
      clearWarningNotice();
    }, 2200);
    return () => clearTimeout(timer);
  }, [warningNotice, clearWarningNotice]);

  useEffect(() => {
    if (!completionCount) return;
    setManualPopoverPos(null);
  }, [completionCount]);

  const focusRect = useMemo(() => {
    if (!targetRects.length) return null;
    let minTop = Number.POSITIVE_INFINITY;
    let minLeft = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;
    targetRects.forEach((rect) => {
      minTop = Math.min(minTop, rect.top);
      minLeft = Math.min(minLeft, rect.left);
      maxRight = Math.max(maxRight, rect.left + rect.width);
      maxBottom = Math.max(maxBottom, rect.top + rect.height);
    });
    return {
      top: minTop,
      left: minLeft,
      width: maxRight - minLeft,
      height: maxBottom - minTop,
    };
  }, [targetRects]);

  const clipPath = useMemo(() => {
    if (!focusRect) return "none";
    const padding = 8;
    const top = Math.max(0, focusRect.top - padding);
    const left = Math.max(0, focusRect.left - padding);
    const bottom = focusRect.top + focusRect.height + padding;
    const right = focusRect.left + focusRect.width + padding;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    return `polygon(
      0px 0px,
      0px ${vh}px,
      ${left}px ${vh}px,
      ${left}px ${top}px,
      ${right}px ${top}px,
      ${right}px ${bottom}px,
      ${left}px ${bottom}px,
      ${left}px ${vh}px,
      ${vw}px ${vh}px,
      ${vw}px 0px
    )`;
  }, [focusRect]);

  const popoverAutoStyle = useMemo(() => {
    const MARGIN = 12;
    const clampToViewport = (x, y) => ({
      x: Math.max(MARGIN, Math.min(window.innerWidth - POP_WIDTH - MARGIN, x)),
      y: Math.max(MARGIN, Math.min(window.innerHeight - POP_HEIGHT - MARGIN, y)),
    });

    const placeAwayFromAvoidRect = (x, y) => {
      if (!chapterAvoidRect) return clampToViewport(x, y);

      const base = clampToViewport(x, y);
      const baseRect = {
        left: base.x,
        top: base.y,
        width: POP_WIDTH,
        height: POP_HEIGHT,
      };
      if (!rectsOverlap(baseRect, chapterAvoidRect)) {
        return base;
      }

      const candidates = [
        { x: chapterAvoidRect.left - POP_WIDTH - MARGIN, y: base.y },
        { x: chapterAvoidRect.left + chapterAvoidRect.width + MARGIN, y: base.y },
        { x: base.x, y: chapterAvoidRect.top - POP_HEIGHT - MARGIN },
        { x: base.x, y: chapterAvoidRect.top + chapterAvoidRect.height + MARGIN },
        { x: MARGIN, y: MARGIN },
        { x: window.innerWidth - POP_WIDTH - MARGIN, y: MARGIN },
        { x: MARGIN, y: window.innerHeight - POP_HEIGHT - MARGIN },
        {
          x: window.innerWidth - POP_WIDTH - MARGIN,
          y: window.innerHeight - POP_HEIGHT - MARGIN,
        },
      ];

      let best = base;
      let bestOverlap = overlapArea(baseRect, chapterAvoidRect);
      for (const candidate of candidates) {
        const next = clampToViewport(candidate.x, candidate.y);
        const nextRect = {
          left: next.x,
          top: next.y,
          width: POP_WIDTH,
          height: POP_HEIGHT,
        };
        if (!rectsOverlap(nextRect, chapterAvoidRect)) {
          return next;
        }
        const nextOverlap = overlapArea(nextRect, chapterAvoidRect);
        if (nextOverlap < bestOverlap) {
          best = next;
          bestOverlap = nextOverlap;
        }
      }
      return best;
    };

    if (!focusRect) {
      const next = placeAwayFromAvoidRect(
        (window.innerWidth - POP_WIDTH) / 2,
        window.innerHeight - POP_HEIGHT - 24,
      );
      return {
        position: "fixed",
        top: next.y,
        left: next.x,
        width: POP_WIDTH,
      };
    }
    const padding = 8;
    const spaceBelow = window.innerHeight - (focusRect.top + focusRect.height + padding);
    const spaceAbove = focusRect.top - padding;

    let top;
    if (spaceBelow >= POP_HEIGHT + MARGIN) {
      top = focusRect.top + focusRect.height + padding + MARGIN;
    } else if (spaceAbove >= POP_HEIGHT + MARGIN) {
      top = focusRect.top - padding - MARGIN - POP_HEIGHT;
    } else {
      top = window.innerHeight - POP_HEIGHT - MARGIN;
    }

    let left = focusRect.left + focusRect.width / 2 - POP_WIDTH / 2;
    left = Math.max(MARGIN, Math.min(window.innerWidth - POP_WIDTH - MARGIN, left));
    const next = placeAwayFromAvoidRect(left, top);

    return {
      position: "fixed",
      top: next.y,
      left: next.x,
      width: POP_WIDTH,
    };
  }, [chapterAvoidRect, focusRect]);

  const warningAutoStyle = useMemo(
    () => ({
      position: "fixed",
      top: 18,
      left: Math.max(VIEWPORT_MARGIN, (window.innerWidth - WARNING_WIDTH) / 2),
      width: WARNING_WIDTH,
    }),
    [],
  );

  const clampPos = useCallback((x, y, width, height, avoidRect = null) => {
    const clamped = {
      x: Math.max(VIEWPORT_MARGIN, Math.min(window.innerWidth - width - VIEWPORT_MARGIN, x)),
      y: Math.max(VIEWPORT_MARGIN, Math.min(window.innerHeight - height - VIEWPORT_MARGIN, y)),
    };

    if (!avoidRect) return clamped;

    const clampedRect = {
      left: clamped.x,
      top: clamped.y,
      width,
      height,
    };
    if (!rectsOverlap(clampedRect, avoidRect)) return clamped;

    const candidates = [
      { x: avoidRect.left - width - VIEWPORT_MARGIN, y: clamped.y },
      { x: avoidRect.left + avoidRect.width + VIEWPORT_MARGIN, y: clamped.y },
      { x: clamped.x, y: avoidRect.top - height - VIEWPORT_MARGIN },
      { x: clamped.x, y: avoidRect.top + avoidRect.height + VIEWPORT_MARGIN },
    ];

    for (const candidate of candidates) {
      const next = {
        x: Math.max(
          VIEWPORT_MARGIN,
          Math.min(window.innerWidth - width - VIEWPORT_MARGIN, candidate.x),
        ),
        y: Math.max(
          VIEWPORT_MARGIN,
          Math.min(window.innerHeight - height - VIEWPORT_MARGIN, candidate.y),
        ),
      };
      const nextRect = { left: next.x, top: next.y, width, height };
      if (!rectsOverlap(nextRect, avoidRect)) {
        return next;
      }
    }

    return clamped;
  }, []);

  const startDrag = useCallback(
    (kind, e) => {
      e.preventDefault();
      const clientX = e.clientX;
      const clientY = e.clientY;
      if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) return;

      const basePos =
        kind === "main"
          ? manualPopoverPos ?? { x: popoverAutoStyle.left, y: popoverAutoStyle.top }
          : manualWarningPos ?? { x: warningAutoStyle.left, y: warningAutoStyle.top };

      setDragState({
        kind,
        startX: clientX,
        startY: clientY,
        originX: basePos.x,
        originY: basePos.y,
      });
    },
    [manualPopoverPos, manualWarningPos, popoverAutoStyle, warningAutoStyle],
  );

  useEffect(() => {
    if (!dragState) return undefined;

    const onMove = (e) => {
      const dx = e.clientX - dragState.startX;
      const dy = e.clientY - dragState.startY;
      const width = dragState.kind === "main" ? POP_WIDTH : WARNING_WIDTH;
      const height = dragState.kind === "main" ? POP_HEIGHT : WARNING_HEIGHT;
      const next = clampPos(
        dragState.originX + dx,
        dragState.originY + dy,
        width,
        height,
        dragState.kind === "main" ? chapterAvoidRect : null,
      );
      if (dragState.kind === "main") {
        setManualPopoverPos(next);
      } else {
        setManualWarningPos(next);
      }
    };

    const onUp = () => setDragState(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [chapterAvoidRect, dragState, clampPos]);

  useEffect(() => {
    if (!isTutorialActive || !step || step.advanceOn !== "click") return undefined;

    const onKeyDown = (e) => {
      const isSpaceKey = e.key === " " || e.key === "Spacebar" || e.code === "Space";
      const isArrowRightKey =
        e.key === "ArrowRight" || e.key === "Right" || e.code === "ArrowRight";
      const isAdvanceKey = isSpaceKey || isArrowRightKey;
      if (e.repeat || !isAdvanceKey) return;
      if (isEditableTarget(e.target)) return;
      const isButtonTarget =
        e.target instanceof HTMLElement && !!e.target.closest("button");
      if (isSpaceKey && isButtonTarget) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation?.();
      advanceStep();
    };

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [advanceStep, isTutorialActive, step]);

  const sectionStatus = useMemo(() => {
    const lastBySection = {};
    TUTORIAL_STEPS.forEach((s, idx) => {
      lastBySection[s.section] = idx;
    });
    return TUTORIAL_SECTIONS.map((sectionKey) => {
      const lastIdx = lastBySection[sectionKey] ?? -1;
      const done = currentStepIndex > lastIdx;
      const active = step?.section === sectionKey && !done;
      return { sectionKey, done, active };
    });
  }, [currentStepIndex, step?.section]);

  const completedSections = sectionStatus.filter((entry) => entry.done).length;

  const arrowLine = useMemo(() => {
    if (!step?.showArrow) return null;
    let fromNodeId = step.arrowFromNodeId;
    let toNodeId = step.arrowToNodeId;

    if (step.dynamicArrowMode === "root-second-to-third") {
      const historyTree = tutorialRuntime.historyTree;
      fromNodeId = getRootChildId(historyTree, 1);
      toNodeId = getRootChildId(historyTree, 2);
    }
    if (step.dynamicArrowMode === "root-first-to-second") {
      const historyTree = tutorialRuntime.historyTree;
      fromNodeId = getRootChildId(historyTree, 0);
      toNodeId = getRootChildId(historyTree, 1);
    }

    const from = document.querySelector(`[data-node-id="${fromNodeId}"]`);
    const to = document.querySelector(`[data-node-id="${toNodeId}"]`);
    if (!from || !to) return null;
    const fromRect = from.getBoundingClientRect();
    const toRect = to.getBoundingClientRect();
    const x1 = fromRect.left + fromRect.width / 2;
    const y1 = fromRect.top + fromRect.height / 2;
    const x2 = toRect.left + toRect.width / 2;
    const y2 = toRect.top + toRect.height / 2;
    return {
      x1,
      y1,
      x2,
      y2,
      cx1: x1 - 180,
      cy1: y1 - 120,
      cx2: x2 + 160,
      cy2: y2 - 120,
    };
  }, [step, targetRects, tutorialRuntime.historyTree]);

  if (!isTutorialActive || !step) return null;

  const maskStyle = focusRect ? { clipPath } : { pointerEvents: "none" };

  const popoverStyle = manualPopoverPos
    ? {
        position: "fixed",
        top: manualPopoverPos.y,
        left: manualPopoverPos.x,
        width: POP_WIDTH,
      }
    : popoverAutoStyle;
  const warningStyle = manualWarningPos
    ? {
        position: "fixed",
        top: manualWarningPos.y,
        left: manualWarningPos.x,
        width: WARNING_WIDTH,
      }
    : warningAutoStyle;

  const title = t(step.titleKey);
  const body = t(step.bodyKey);
  const nextLabel = isLastStep ? t("tutorialFinish") : t("tutorialNext");
  const stepCounterLabel = t("tutorialStepCounter")
    .replace("{current}", String(currentStepIndex + 1))
    .replace("{total}", String(TUTORIAL_STEPS.length));
  const sectionCounterLabel = t("tutorialSectionProgress")
    .replace("{current}", String(completedSections))
    .replace("{total}", String(TUTORIAL_SECTIONS.length));
  const mhProgressLabel = t("tutorialMhProgress")
    .replace("{current}", String(mhPlacedCount))
    .replace("{total}", String(MH_TARGET_SLOTS.length));

  return (
    <div className="tutorial-root" aria-modal="true" role="dialog">
      <div className="tutorial-mask" style={maskStyle} onClick={(e) => e.stopPropagation()} />

      {targetRects.map((rect) => (
        <div
          key={`${step.id}-${rect.zone}`}
          className="tutorial-highlight-ring"
          style={{
            top: rect.top - 8,
            left: rect.left - 8,
            width: rect.width + 16,
            height: rect.height + 16,
          }}
        />
      ))}

      {arrowLine && (
        <svg className="tutorial-arrow-overlay" viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}>
          <defs>
            <marker
              id="tutorial-arrow-head"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L9,3 z" fill="#f0c040" />
            </marker>
          </defs>
          <path
            d={`M ${arrowLine.x1} ${arrowLine.y1} C ${arrowLine.cx1} ${arrowLine.cy1}, ${arrowLine.cx2} ${arrowLine.cy2}, ${arrowLine.x2} ${arrowLine.y2}`}
            className="tutorial-arrow-path"
            markerEnd="url(#tutorial-arrow-head)"
          />
        </svg>
      )}

      <div className="tutorial-popover" style={popoverStyle}>
        <div
          className="tutorial-popover-drag-handle"
          onPointerDown={(e) => startDrag("main", e)}
        >
          <div className="tutorial-popover-counter">{stepCounterLabel}</div>
          <div className="tutorial-popover-title">{title}</div>
        </div>
        <div className="tutorial-popover-body">{body}</div>
        {step.id === "board-place-mh-sequence" && (
          <div className="tutorial-inline-progress">{mhProgressLabel}</div>
        )}
        <div className="tutorial-checklist">
          <div className="tutorial-checklist-header">{sectionCounterLabel}</div>
          {sectionStatus.map((entry) => (
            <button
              key={entry.sectionKey}
              className={`tutorial-checklist-item tutorial-checklist-btn${entry.done ? " done" : ""}${entry.active ? " active" : ""}`}
              onClick={() => jumpToSection(entry.sectionKey)}
              type="button"
            >
              <span>{entry.done ? "✓" : entry.active ? "•" : "○"}</span>
              <span>{t(`tutorialSection_${entry.sectionKey}`)}</span>
            </button>
          ))}
        </div>
        <div className="tutorial-popover-actions">
          {step.advanceOn === "click" ? (
            <button
              className="tutorial-btn-next tutorial-btn-next--highlighted"
              onClick={advanceStep}
            >
              {nextLabel}
            </button>
          ) : (
            <span className="tutorial-waiting-indicator">{t("tutorialWaiting")}</span>
          )}
        </div>
      </div>

      {!isLastStep && (
        <button className="tutorial-exit-btn" onClick={exitTutorial}>
          {t("tutorialExit")}
        </button>
      )}

      {warningNotice && (
        <div className="tutorial-warning-popover" style={warningStyle}>
          <div
            className="tutorial-warning-drag-handle"
            onPointerDown={(e) => startDrag("warning", e)}
          >
            {t("tutorialUnexpectedTitle")}
          </div>
          <div className="tutorial-warning-body">{t("tutorialUnexpectedBody")}</div>
          <div className="tutorial-warning-actions">
            <button className="tutorial-warning-btn" onClick={clearWarningNotice}>
              {t("tutorialDismiss")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
