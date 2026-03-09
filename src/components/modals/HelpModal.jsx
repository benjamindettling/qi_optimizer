import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { useTutorial } from "../../context/TutorialContext";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import "./HelpModal.css";

const INFO_POPUP_WIDTH = 440;
const INFO_POPUP_HEIGHT = 300;
const EDGE_PADDING = 12;

const HELP_TOPICS = [
  {
    id: "stats-main",
    titleKey: "helpTopicStatsMainTitle",
    bodyKey: "helpTopicStatsMainBody",
    targetIds: ["stats-coins", "stats-supplies", "stats-chronos"],
    mode: "union",
  },
  {
    id: "stats-shards",
    titleKey: "helpTopicStatsShardsTitle",
    bodyKey: "helpTopicStatsShardsBody",
    targetIds: ["stats-shards"],
    mode: "union",
  },
  {
    id: "stats-qa",
    titleKey: "helpTopicStatsQaTitle",
    bodyKey: "helpTopicStatsQaBody",
    targetIds: ["stats-qa"],
    mode: "union",
  },
  {
    id: "stats-goods",
    titleKey: "helpTopicStatsGoodsTitle",
    bodyKey: "helpTopicStatsGoodsBody",
    targetIds: ["stats-goods-item"],
    mode: "union",
  },
  {
    id: "stats-units",
    titleKey: "helpTopicStatsUnitsTitle",
    bodyKey: "helpTopicStatsUnitsBody",
    targetIds: ["stats-units-item"],
    mode: "union",
  },
  {
    id: "stats-army-boost",
    titleKey: "helpTopicStatsArmyTitle",
    bodyKey: "helpTopicStatsArmyBody",
    targetIds: ["stats-army-boost"],
    mode: "union",
  },
  {
    id: "stats-happiness",
    titleKey: "helpTopicStatsHappinessTitle",
    bodyKey: "helpTopicStatsHappinessBody",
    targetIds: ["stats-happiness-current", "stats-happiness-tiers"],
    mode: "split",
  },
  {
    id: "stats-multipliers",
    titleKey: "helpTopicStatsMultipliersTitle",
    bodyKey: "helpTopicStatsMultipliersBody",
    targetIds: ["stats-multipliers"],
    mode: "union",
  },
  {
    id: "stats-population",
    titleKey: "helpTopicStatsPopulationTitle",
    bodyKey: "helpTopicStatsPopulationBody",
    targetIds: ["stats-population"],
    mode: "union",
  },
  {
    id: "step-time",
    titleKey: "helpTopicStepTimeTitle",
    bodyKey: "helpTopicStepTimeBody",
    targetIds: ["step-time-display"],
    mode: "union",
  },
  {
    id: "step-save",
    titleKey: "helpTopicStepSaveTitle",
    bodyKey: "helpTopicStepSaveBody",
    targetIds: ["step-save-name"],
    mode: "union",
  },
  {
    id: "step-skip",
    titleKey: "helpTopicStepSkipTitle",
    bodyKey: "helpTopicStepSkipBody",
    targetIds: ["step-skip-buttons"],
    mode: "union",
  },
  {
    id: "btn-save",
    titleKey: "helpTopicBtnSaveTitle",
    bodyKey: "helpTopicBtnSaveBody",
    targetIds: ["btn-save"],
    mode: "union",
  },
  {
    id: "btn-load",
    titleKey: "helpTopicBtnLoadTitle",
    bodyKey: "helpTopicBtnLoadBody",
    targetIds: ["btn-load"],
    mode: "union",
  },
  {
    id: "btn-online",
    titleKey: "helpTopicBtnOnlineTitle",
    bodyKey: "helpTopicBtnOnlineBody",
    targetIds: ["btn-online"],
    mode: "union",
  },
  {
    id: "btn-admin",
    titleKey: "helpTopicBtnAdminTitle",
    bodyKey: "helpTopicBtnAdminBody",
    targetIds: ["btn-admin"],
    mode: "union",
  },
  {
    id: "btn-profile",
    titleKey: "helpTopicBtnProfileTitle",
    bodyKey: "helpTopicBtnProfileBody",
    targetIds: ["btn-profile"],
    mode: "union",
  },
  {
    id: "profile-account-overview",
    titleKey: "helpTopicProfileAccountTitle",
    bodyKey: "helpTopicProfileAccountBody",
    targetIds: ["profile-tab-account", "profile-window-account"],
    mode: "split",
  },
  {
    id: "profile-config-overview",
    titleKey: "helpTopicProfileConfigTitle",
    bodyKey: "helpTopicProfileConfigBody",
    targetIds: ["profile-tab-config", "profile-window-config"],
    mode: "split",
  },
  {
    id: "profile-preferences-overview",
    titleKey: "helpTopicProfilePreferencesTitle",
    bodyKey: "helpTopicProfilePreferencesBody",
    targetIds: ["profile-tab-preferences"],
    mode: "union",
  },
  {
    id: "profile-pref-shards-limit",
    titleKey: "helpTopicProfilePrefShardsLimitTitle",
    bodyKey: "helpTopicProfilePrefShardsLimitBody",
    targetIds: ["profile-pref-shards-limit"],
    mode: "union",
  },
  {
    id: "profile-pref-shard-count-question",
    titleKey: "helpTopicProfilePrefShardCountQuestionTitle",
    bodyKey: "helpTopicProfilePrefShardCountQuestionBody",
    targetIds: ["profile-pref-shard-count-question"],
    mode: "union",
  },
  {
    id: "profile-pref-shard-count-spent",
    titleKey: "helpTopicProfilePrefShardCountSpentTitle",
    bodyKey: "helpTopicProfilePrefShardCountSpentBody",
    targetIds: ["profile-pref-shard-count-spent"],
    mode: "union",
  },
  {
    id: "profile-pref-shard-count-stock",
    titleKey: "helpTopicProfilePrefShardCountLeftOverTitle",
    bodyKey: "helpTopicProfilePrefShardCountLeftOverBody",
    targetIds: ["profile-pref-shard-count-stock"],
    mode: "union",
  },
  {
    id: "profile-pref-shard-limit-question",
    titleKey: "helpTopicProfilePrefShardLimitQuestionTitle",
    bodyKey: "helpTopicProfilePrefShardLimitQuestionBody",
    targetIds: ["profile-pref-shard-limit-question"],
    mode: "union",
  },
  {
    id: "profile-pref-shard-limit-overflow-yes",
    titleKey: "helpTopicProfilePrefShardLimitSoftTitle",
    bodyKey: "helpTopicProfilePrefShardLimitSoftBody",
    targetIds: ["profile-pref-shard-limit-overflow-yes"],
    mode: "union",
  },
  {
    id: "profile-pref-shard-limit-overflow-no",
    titleKey: "helpTopicProfilePrefShardLimitHardTitle",
    bodyKey: "helpTopicProfilePrefShardLimitHardBody",
    targetIds: ["profile-pref-shard-limit-overflow-no"],
    mode: "union",
  },
  {
    id: "profile-pref-tree-delete-single",
    titleKey: "helpTopicProfilePrefTreeDeleteSingleTitle",
    bodyKey: "helpTopicProfilePrefTreeDeleteSingleBody",
    targetIds: ["profile-pref-tree-delete-single"],
    mode: "union",
  },
  {
    id: "profile-pref-tree-delete-branch",
    titleKey: "helpTopicProfilePrefTreeDeleteBranchTitle",
    bodyKey: "helpTopicProfilePrefTreeDeleteBranchBody",
    targetIds: ["profile-pref-tree-delete-branch"],
    mode: "union",
  },
  {
    id: "profile-pref-outer-skip",
    titleKey: "helpTopicProfilePrefOuterSkipTitle",
    bodyKey: "helpTopicProfilePrefOuterSkipBody",
    targetIds: ["profile-pref-outer-skip"],
    mode: "union",
  },
  {
    id: "profile-pref-board-orientation",
    titleKey: "helpTopicProfilePrefBoardOrientationTitle",
    bodyKey: "helpTopicProfilePrefBoardOrientationBody",
    targetIds: ["profile-pref-board-orientation"],
    mode: "union",
  },
  {
    id: "profile-pref-color-theme",
    titleKey: "helpTopicProfilePrefColorThemeTitle",
    bodyKey: "helpTopicProfilePrefColorThemeBody",
    targetIds: ["profile-pref-color-theme"],
    mode: "union",
  },
  {
    id: "profile-premium-overview",
    titleKey: "helpTopicProfilePremiumTitle",
    bodyKey: "helpTopicProfilePremiumBody",
    targetIds: ["profile-tab-premium", "profile-window-premium"],
    mode: "split",
  },
  {
    id: "board-tool-move",
    titleKey: "helpTopicBoardToolMoveTitle",
    bodyKey: "helpTopicBoardToolMoveBody",
    targetIds: ["board-tool-move"],
    mode: "union",
  },
  {
    id: "board-tool-sell",
    titleKey: "helpTopicBoardToolSellTitle",
    bodyKey: "helpTopicBoardToolSellBody",
    targetIds: ["board-tool-sell"],
    mode: "union",
  },
  {
    id: "board-tool-boost",
    titleKey: "helpTopicBoardToolBoostTitle",
    bodyKey: "helpTopicBoardToolBoostBody",
    targetIds: ["board-tool-boost"],
    mode: "union",
  },
  {
    id: "board-tool-shop",
    titleKey: "helpTopicBoardToolShopTitle",
    bodyKey: "helpTopicBoardToolShopBody",
    targetIds: ["board-tool-shop"],
    mode: "union",
  },
  {
    id: "board-tool-finish",
    titleKey: "helpTopicBoardToolFinishTitle",
    bodyKey: "helpTopicBoardToolFinishBody",
    targetIds: ["board-tool-finish"],
    mode: "union",
  },
  {
    id: "board-tool-harvest-all",
    titleKey: "helpTopicBoardToolHarvestAllTitle",
    bodyKey: "helpTopicBoardToolHarvestAllBody",
    targetIds: ["board-tool-harvest-all"],
    mode: "union",
  },
  {
    id: "board-townhall",
    titleKey: "helpTopicBoardTownhallTitle",
    bodyKey: "helpTopicBoardTownhallBody",
    targetIds: ["board-townhall"],
    mode: "union",
  },
  {
    id: "board-region-unlockable",
    titleKey: "helpTopicBoardRegionUnlockableTitle",
    bodyKey: "helpTopicBoardRegionUnlockableBody",
    targetIds: [],
    targetIdPrefix: "board-region-unlockable-",
    mode: "target",
  },
  {
    id: "board-region-locked",
    titleKey: "helpTopicBoardRegionLockedTitle",
    bodyKey: "helpTopicBoardRegionLockedBody",
    targetIds: [],
    targetIdPrefix: "board-region-locked-",
    mode: "target",
  },
  {
    id: "tree-toolbar-branch-hider",
    titleKey: "helpTopicTreeBranchHiderTitle",
    bodyKey: "helpTopicTreeBranchHiderBody",
    targetIds: ["tree-toolbar-branch-hider"],
    mode: "union",
  },
  {
    id: "tree-toolbar-action-grouper",
    titleKey: "helpTopicTreeActionGrouperTitle",
    bodyKey: "helpTopicTreeActionGrouperBody",
    targetIds: ["tree-toolbar-action-grouper"],
    mode: "union",
  },
  {
    id: "tree-toolbar-top-branch",
    titleKey: "helpTopicTreeTopBranchTitle",
    bodyKey: "helpTopicTreeTopBranchBody",
    targetIds: ["tree-toolbar-top-branch"],
    mode: "union",
  },
  {
    id: "tree-toolbar-delete",
    titleKey: "helpTopicTreeDeleteTitle",
    bodyKey: "helpTopicTreeDeleteBody",
    targetIds: ["tree-toolbar-delete"],
    mode: "union",
  },
  {
    id: "tree-zoom-controls",
    titleKey: "helpTopicTreeZoomTitle",
    bodyKey: "helpTopicTreeZoomBody",
    targetIds: ["tree-zoom-controls"],
    mode: "union",
  },
  {
    id: "tree-focus-button",
    titleKey: "helpTopicTreeFocusTitle",
    bodyKey: "helpTopicTreeFocusBody",
    targetIds: ["tree-focus-button"],
    mode: "union",
  },
  {
    id: "tree-canvas",
    titleKey: "helpTopicTreeCanvasTitle",
    bodyKey: "helpTopicTreeCanvasBody",
    targetIds: ["tree-canvas"],
    mode: "union",
  },
  {
    id: "notes-log",
    titleKey: "helpTopicNotesLogTitle",
    bodyKey: "helpTopicNotesLogBody",
    targetIds: ["notes-log"],
    mode: "union",
  },
  {
    id: "notes-tools-header",
    titleKey: "helpTopicNotesToolsHeaderTitle",
    bodyKey: "helpTopicNotesToolsHeaderBody",
    targetIds: ["notes-tools-header"],
    mode: "union",
  },
  {
    id: "notes-tool-refund",
    titleKey: "helpTopicNotesRefundTitle",
    bodyKey: "helpTopicNotesRefundBody",
    targetIds: ["notes-tool-refund"],
    mode: "union",
  },
  {
    id: "notes-tool-highlight",
    titleKey: "helpTopicNotesHighlightTitle",
    bodyKey: "helpTopicNotesHighlightBody",
    targetIds: ["notes-tool-highlight"],
    mode: "union",
  },
  {
    id: "notes-tool-screenshot",
    titleKey: "helpTopicNotesScreenshotTitle",
    bodyKey: "helpTopicNotesScreenshotBody",
    targetIds: ["notes-tool-screenshot"],
    mode: "union",
  },
  {
    id: "notes-tool-pdf",
    titleKey: "helpTopicNotesPdfTitle",
    bodyKey: "helpTopicNotesPdfBody",
    targetIds: ["notes-tool-pdf"],
    mode: "union",
  },
  {
    id: "notes-tool-find-worst",
    titleKey: "helpTopicNotesFindWorstTitle",
    bodyKey: "helpTopicNotesFindWorstBody",
    targetIds: ["notes-tool-find-worst"],
    mode: "union",
  },
];

const HELP_TOPIC_BY_ID = HELP_TOPICS.reduce((acc, topic) => {
  acc[topic.id] = topic;
  return acc;
}, {});

const HELP_ID_TO_TOPIC = HELP_TOPICS.reduce((acc, topic) => {
  (topic.targetIds || []).forEach((targetId) => {
    acc[targetId] = topic.id;
  });
  return acc;
}, {});

const HELP_PREFIX_TO_TOPIC = HELP_TOPICS.reduce((acc, topic) => {
  if (topic.targetIdPrefix) {
    acc.push({
      prefix: topic.targetIdPrefix,
      topicId: topic.id,
    });
  }
  return acc;
}, []);

const toRect = (domRect) => ({
  top: domRect.top,
  left: domRect.left,
  width: domRect.width,
  height: domRect.height,
});

const toUnionRect = (rects) => {
  if (!rects.length) return null;
  const top = Math.min(...rects.map((rect) => rect.top));
  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.left + rect.width));
  const bottom = Math.max(...rects.map((rect) => rect.top + rect.height));
  return {
    top,
    left,
    width: right - left,
    height: bottom - top,
  };
};

const isElement = (value) =>
  typeof Element !== "undefined" && value instanceof Element;

const asElement = (value) => {
  if (isElement(value)) return value;
  return value?.parentElement ?? null;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const OVERLAP_PADDING = 6;

const rectsOverlap = (a, b, padding = 0) =>
  a.left < b.left + b.width + padding &&
  a.left + a.width + padding > b.left &&
  a.top < b.top + b.height + padding &&
  a.top + a.height + padding > b.top;

const overlapArea = (a, b) => {
  const xOverlap =
    Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left));
  const yOverlap =
    Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
  return xOverlap * yOverlap;
};

const getVisibleModalRects = () =>
  Array.from(document.querySelectorAll(".modal .modal-card"))
    .map((el) => toRect(el.getBoundingClientRect()))
    .filter((rect) => rect.width > 0 && rect.height > 0);

export function HelpModal({ open, onClose }) {
  const { lang } = useLang();
  const { startTutorial } = useTutorial();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const mainRef = useRef(null);
  const dragStateRef = useRef({
    active: false,
    pointerId: null,
    offsetX: 0,
    offsetY: 0,
  });

  const [hoveredTopicId, setHoveredTopicId] = useState(null);
  const [hoveredTargetId, setHoveredTargetId] = useState(null);
  const [infoTopicId, setInfoTopicId] = useState(null);
  const [infoTargetId, setInfoTargetId] = useState(null);
  const [infoAnchorRect, setInfoAnchorRect] = useState(null);
  const [mainPosition, setMainPosition] = useState({ left: 24, top: 24 });

  const clearInfoPopup = useCallback(() => {
    setInfoTopicId(null);
    setInfoTargetId(null);
    setInfoAnchorRect(null);
  }, []);

  const centerMainWindow = useCallback(() => {
    if (!mainRef.current || typeof window === "undefined") return;
    const panelRect = mainRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const centeredLeft = clamp(
      (viewportWidth - panelRect.width) / 2,
      EDGE_PADDING,
      viewportWidth - panelRect.width - EDGE_PADDING,
    );
    const centeredTop = clamp(
      (viewportHeight - panelRect.height) / 2,
      EDGE_PADDING,
      viewportHeight - panelRect.height - EDGE_PADDING,
    );
    const centered = {
      left: centeredLeft,
      top: centeredTop,
      width: panelRect.width,
      height: panelRect.height,
    };

    const modalRects = getVisibleModalRects();
    const intersectsModal = modalRects.some((rect) =>
      rectsOverlap(centered, rect, OVERLAP_PADDING),
    );
    if (!intersectsModal) {
      setMainPosition({ left: centeredLeft, top: centeredTop });
      return;
    }

    const candidates = [
      { left: EDGE_PADDING, top: EDGE_PADDING },
      {
        left: viewportWidth - panelRect.width - EDGE_PADDING,
        top: EDGE_PADDING,
      },
      {
        left: EDGE_PADDING,
        top: viewportHeight - panelRect.height - EDGE_PADDING,
      },
      {
        left: viewportWidth - panelRect.width - EDGE_PADDING,
        top: viewportHeight - panelRect.height - EDGE_PADDING,
      },
      { left: centeredLeft, top: EDGE_PADDING },
      {
        left: centeredLeft,
        top: viewportHeight - panelRect.height - EDGE_PADDING,
      },
    ].map((candidate) => ({
      left: clamp(candidate.left, EDGE_PADDING, viewportWidth - panelRect.width - EDGE_PADDING),
      top: clamp(candidate.top, EDGE_PADDING, viewportHeight - panelRect.height - EDGE_PADDING),
      width: panelRect.width,
      height: panelRect.height,
    }));

    const firstNonOverlapping = candidates.find((candidate) =>
      !modalRects.some((rect) => rectsOverlap(candidate, rect, OVERLAP_PADDING)),
    );

    if (firstNonOverlapping) {
      setMainPosition({
        left: firstNonOverlapping.left,
        top: firstNonOverlapping.top,
      });
      return;
    }

    const leastOverlapping = candidates.reduce(
      (best, candidate) => {
        const score = modalRects.reduce(
          (sum, rect) => sum + overlapArea(candidate, rect),
          0,
        );
        if (score < best.score) return { candidate, score };
        return best;
      },
      { candidate: centered, score: Number.POSITIVE_INFINITY },
    );

    setMainPosition({
      left: leastOverlapping.candidate.left,
      top: leastOverlapping.candidate.top,
    });
  }, []);

  const resolveTopicFromTarget = useCallback((target) => {
    const targetEl = asElement(target);
    if (!targetEl) return null;
    if (targetEl.closest("[data-help-ui='true']")) return null;
    const helpEl = targetEl.closest("[data-help-id]");
    if (!helpEl) return null;
    const helpId = helpEl.getAttribute("data-help-id");
    const exactTopicId = HELP_ID_TO_TOPIC[helpId];
    if (exactTopicId) {
      return { topicId: exactTopicId, targetId: helpId };
    }
    const prefixTopic = HELP_PREFIX_TO_TOPIC.find((entry) =>
      helpId.startsWith(entry.prefix),
    );
    if (!prefixTopic) return null;
    return { topicId: prefixTopic.topicId, targetId: helpId };
  }, []);

  const getTopicRects = useCallback((topicId, targetId = null) => {
    if (!topicId) return [];
    const topic = HELP_TOPIC_BY_ID[topicId];
    if (!topic) return [];

    if (topic.mode === "target") {
      if (!targetId) return [];
      const targetNode = document.querySelector(
        `[data-help-id="${targetId}"]`,
      );
      if (!targetNode) return [];
      const rect = toRect(targetNode.getBoundingClientRect());
      return rect.width > 0 && rect.height > 0 ? [rect] : [];
    }

    const elements = (topic.targetIds || []).flatMap((targetId) =>
      Array.from(document.querySelectorAll(`[data-help-id="${targetId}"]`)),
    );
    const uniqueElements = Array.from(new Set(elements));
    const rects = uniqueElements
      .map((el) => toRect(el.getBoundingClientRect()))
      .filter((rect) => rect.width > 0 && rect.height > 0);

    if (!rects.length) return [];
    if (topic.mode === "split") return rects;
    const unionRect = toUnionRect(rects);
    return unionRect ? [unionRect] : [];
  }, []);

  const openTopicInfo = useCallback(
    (topic) => {
      if (!topic?.topicId) return;
      const rects = getTopicRects(topic.topicId, topic.targetId);
      setInfoTopicId(topic.topicId);
      setInfoTargetId(topic.targetId ?? null);
      setInfoAnchorRect(rects[0] ?? null);
    },
    [getTopicRects],
  );

  const handleHeaderPointerDown = (event) => {
    if (event.button !== 0) return;
    const targetEl = asElement(event.target);
    if (targetEl?.closest("button")) return;
    const rect = mainRef.current?.getBoundingClientRect();
    if (!rect) return;
    dragStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
    };
  };

  useEffect(() => {
    if (!open) {
      setHoveredTopicId(null);
      setHoveredTargetId(null);
      clearInfoPopup();
      dragStateRef.current.active = false;
      return;
    }

    const rafId = requestAnimationFrame(centerMainWindow);
    return () => cancelAnimationFrame(rafId);
  }, [centerMainWindow, clearInfoPopup, open]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerMove = (event) => {
      const dragState = dragStateRef.current;
      if (dragState.active && dragState.pointerId === event.pointerId) {
        const panelRect = mainRef.current?.getBoundingClientRect();
        if (!panelRect) return;
        const nextLeft = clamp(
          event.clientX - dragState.offsetX,
          EDGE_PADDING,
          window.innerWidth - panelRect.width - EDGE_PADDING,
        );
        const nextTop = clamp(
          event.clientY - dragState.offsetY,
          EDGE_PADDING,
          window.innerHeight - panelRect.height - EDGE_PADDING,
        );
        setMainPosition({ left: nextLeft, top: nextTop });
        event.preventDefault();
        return;
      }

      const resolvedTopic = resolveTopicFromTarget(event.target);
      const nextTopicId = resolvedTopic?.topicId ?? null;
      const nextTargetId = resolvedTopic?.targetId ?? null;
      setHoveredTopicId((prev) => (prev === nextTopicId ? prev : nextTopicId));
      setHoveredTargetId((prev) =>
        prev === nextTargetId ? prev : nextTargetId,
      );
    };

    const handlePointerUp = (event) => {
      const dragState = dragStateRef.current;
      if (!dragState.active || dragState.pointerId !== event.pointerId) return;
      dragStateRef.current = {
        active: false,
        pointerId: null,
        offsetX: 0,
        offsetY: 0,
      };
    };

    const blockAndRoutePointer = (event) => {
      const targetEl = asElement(event.target);
      if (!targetEl) return;

      if (targetEl.closest("[data-help-toggle='true']")) {
        clearInfoPopup();
        return;
      }
      if (targetEl.closest('[data-help-id="btn-language"]')) {
        clearInfoPopup();
        return;
      }

      const isHelpUi = !!targetEl.closest("[data-help-ui='true']");
      const isInfoPopup = !!targetEl.closest(".help-inspect-info");

      if (isInfoPopup) {
        clearInfoPopup();
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();
        return;
      }

      if (isHelpUi) {
        clearInfoPopup();
        return;
      }

      const resolvedTopic = resolveTopicFromTarget(targetEl);
      if (resolvedTopic) {
        openTopicInfo(resolvedTopic);
      } else {
        clearInfoPopup();
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };

    const blockAppClicks = (event) => {
      const targetEl = asElement(event.target);
      if (!targetEl) return;
      if (targetEl.closest("[data-help-toggle='true']")) return;
      if (targetEl.closest('[data-help-id="btn-language"]')) return;
      if (targetEl.closest("[data-help-ui='true']")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
    };

    const handleKeyDown = (event) => {
      if (event.key !== "Escape") return;
      if (infoTopicId) {
        clearInfoPopup();
        return;
      }
      onClose?.();
    };

    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerUp, true);
    window.addEventListener("pointerdown", blockAndRoutePointer, true);
    window.addEventListener("click", blockAppClicks, true);
    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerUp, true);
      window.removeEventListener("pointerdown", blockAndRoutePointer, true);
      window.removeEventListener("click", blockAppClicks, true);
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    clearInfoPopup,
    infoTopicId,
    onClose,
    open,
    openTopicInfo,
    resolveTopicFromTarget,
  ]);

  const activeTopicId = hoveredTopicId || infoTopicId;
  const activeTargetId = hoveredTopicId ? hoveredTargetId : infoTargetId;
  const infoTopic = infoTopicId ? HELP_TOPIC_BY_ID[infoTopicId] : null;
  const highlightRects = useMemo(
    () => getTopicRects(activeTopicId, activeTargetId),
    [activeTargetId, activeTopicId, getTopicRects],
  );

  const infoPosition = useMemo(() => {
    const viewportWidth =
      typeof window === "undefined" ? 1280 : window.innerWidth;
    const viewportHeight =
      typeof window === "undefined" ? 720 : window.innerHeight;

    if (!infoAnchorRect) {
      return {
        left: clamp(
          viewportWidth - INFO_POPUP_WIDTH - EDGE_PADDING,
          EDGE_PADDING,
          viewportWidth - INFO_POPUP_WIDTH - EDGE_PADDING,
        ),
        top: clamp(
          120,
          EDGE_PADDING,
          viewportHeight - INFO_POPUP_HEIGHT - EDGE_PADDING,
        ),
      };
    }

    const preferredLeft = infoAnchorRect.left + infoAnchorRect.width + 16;
    const fallbackLeft = infoAnchorRect.left - INFO_POPUP_WIDTH - 16;
    const left =
      preferredLeft + INFO_POPUP_WIDTH <= viewportWidth - EDGE_PADDING
        ? preferredLeft
        : fallbackLeft >= EDGE_PADDING
          ? fallbackLeft
          : viewportWidth - INFO_POPUP_WIDTH - EDGE_PADDING;

    const top = clamp(
      infoAnchorRect.top,
      EDGE_PADDING,
      viewportHeight - INFO_POPUP_HEIGHT - EDGE_PADDING,
    );

    return { left, top };
  }, [infoAnchorRect]);

  const handleStartTutorial = () => {
    startTutorial(0);
    onClose?.();
  };

  if (!open) return null;

  return (
    <div className="help-inspect-root" data-help-ui="true">
      {highlightRects.map((rect, idx) => (
        <div
          key={`${rect.left}-${rect.top}-${idx}`}
          className="help-inspect-highlight"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        />
      ))}

      <div
        className="help-inspect-main modal-card"
        data-help-ui="true"
        ref={mainRef}
        style={{
          left: mainPosition.left,
          top: mainPosition.top,
        }}
      >
        <div
          className="help-inspect-header"
          data-help-ui="true"
          onPointerDown={handleHeaderPointerDown}
        >
          <h3>{t("helpInspectTitle")}</h3>
          <button
            type="button"
            className="help-inspect-close"
            onClick={onClose}
            aria-label={t("helpInspectCloseAria")}
          >
            <X size={18} />
          </button>
        </div>

        <p className="help-inspect-intro">
          {t("helpInspectIntroPrefix")}{" "}
          <button
            type="button"
            className="help-inspect-tutorial-btn"
            onClick={handleStartTutorial}
          >
            {t("helpInspectTutorialButton")}
          </button>{" "}
          {t("helpInspectIntroSuffix")}
        </p>
      </div>

      {infoTopic && (
        <div
          className="help-inspect-info modal-card"
          style={{
            left: infoPosition.left,
            top: infoPosition.top,
          }}
          data-help-ui="true"
        >
          <h4>{t(infoTopic.titleKey)}</h4>
          <p>{t(infoTopic.bodyKey)}</p>
        </div>
      )}
    </div>
  );
}
