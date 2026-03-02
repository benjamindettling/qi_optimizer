// Git-like tree visualizer component for history navigation
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from "react";
import * as d3 from "d3";
import { Focus, ZoomIn, ZoomOut } from "lucide-react";
import { ACTION_COLORS } from "../../config/colors";
import { useTutorialGate } from "../../hooks/useTutorialGate";
import "./TreeVisualizer.css";

// Checkpoint action types - these divide the tree into columns
// Note: harvestAll with title "Rest einsammeln" is NOT a checkpoint, only "Volle Ernte"
const CHECKPOINT_TYPES = new Set(["harvestFull", "boostAll"]);

// Check if a node is a checkpoint (considering title for harvestAll)
const isCheckpointNode = (actionType, actionTitle) => {
  if (
    actionType === "harvestFull" ||
    actionType === "harvestAll" ||
    actionType === "harvestAllAdmin"
  ) {
    // Only full harvest is a checkpoint, not "Rest einsammeln"
    return actionTitle === "Volle Ernte";
  }
  return CHECKPOINT_TYPES.has(actionType);
};

// Shape types for special nodes
const TRIANGLE_TYPES = new Set([
  "harvestFull",
  "boostAll",
  "harvestAll",
  "finishProductions",
]);
const SQUARE_TYPES = new Set([
  "regionUnlock",
  "regionUnlockGoods",
  "regionUnlockShards",
  "regionUnlockAdmin",
  "regionLockAdmin",
]);

// Actions that should never be bundled
const NEVER_BUNDLE = new Set(["finishProductions"]);

// Admin adjust group - these can bundle together
const ADMIN_ADJUST_GROUP = new Set([
  "adminAdjust",
  "goodsCostAdmin",
  "shardsCostAdmin",
]);

// Get the bundle key for an action type
// Returns the key used to determine if two actions can be bundled together
const getBundleKey = (actionType) => {
  if (NEVER_BUNDLE.has(actionType)) return null; // Never bundle
  if (ADMIN_ADJUST_GROUP.has(actionType)) return "adminAdjust"; // Group these together
  return actionType; // Exact match required
};

const ZOOM_MIN_SCALE = 0.05;
const ZOOM_MAX_SCALE = 1;
const TREE_SETTINGS_STORAGE_KEY = "qi_tree_visualizer_settings_v1";

const DEFAULT_TREE_SETTINGS = {
  branchFocusMode: false,
  horizontalCollapse: false,
  selectionFocusMode: false,
  relativeZoom: 1,
};

const loadTreeSettings = () => {
  if (typeof window === "undefined") return DEFAULT_TREE_SETTINGS;
  try {
    const raw = window.localStorage.getItem(TREE_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_TREE_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      branchFocusMode:
        typeof parsed?.branchFocusMode === "boolean"
          ? parsed.branchFocusMode
          : DEFAULT_TREE_SETTINGS.branchFocusMode,
      horizontalCollapse:
        typeof parsed?.horizontalCollapse === "boolean"
          ? parsed.horizontalCollapse
          : DEFAULT_TREE_SETTINGS.horizontalCollapse,
      selectionFocusMode:
        typeof parsed?.selectionFocusMode === "boolean"
          ? parsed.selectionFocusMode
          : DEFAULT_TREE_SETTINGS.selectionFocusMode,
      relativeZoom: Math.max(
        0,
        Math.min(
          1,
          Number.isFinite(parsed?.relativeZoom)
            ? parsed.relativeZoom
            : DEFAULT_TREE_SETTINGS.relativeZoom,
        ),
      ),
    };
  } catch {
    return DEFAULT_TREE_SETTINGS;
  }
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * TreeVisualizer - A git branch-like horizontal tree for history navigation
 * With checkpoint support and auto-centering
 */
export const TreeVisualizer = forwardRef(function TreeVisualizer(
  {
    nodes = [],
    selectedId = null,
    onSelectNode,
    onMakeTop,
    onCopyBranch, // (sourceNodeId, targetNodeId) => void - copy sourceNode as child of targetNode
    onDeleteNode, // (nodeId, deleteSubtree, options?) => void - delete single node or full branch
    deleteMode = false,
    onDeleteModeChange,
    onZoomLevelChange, // ({ relativeZoom, selectionFocusMode }) => void
    onFixNode, // (nodeId, deficits) => void - called when Fix button is clicked
    actionColors = {},
    width: propWidth,
    height: propHeight,
  },
  ref,
) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const apiRef = useRef(null);
  const treeLocked = useTutorialGate("tree");

  // Track container size dynamically
  const [containerSize, setContainerSize] = useState({
    width: propWidth || 400,
    height: propHeight || 300,
  });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setContainerSize({ width, height });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Use container size or prop size
  const width = containerSize.width;
  const height = containerSize.height;

  const initialTreeSettingsRef = useRef(null);
  if (initialTreeSettingsRef.current == null) {
    initialTreeSettingsRef.current = loadTreeSettings();
  }
  const [branchFocusMode, setBranchFocusMode] = useState(
    initialTreeSettingsRef.current.branchFocusMode,
  );
  const [horizontalCollapse, setHorizontalCollapse] = useState(
    initialTreeSettingsRef.current.horizontalCollapse,
  ); // Bundle consecutive same-type actions
  const [selectionFocusMode, setSelectionFocusMode] = useState(
    initialTreeSettingsRef.current.selectionFocusMode,
  );
  const [relativeZoom, setRelativeZoom] = useState(
    initialTreeSettingsRef.current.relativeZoom,
  ); // 0 = fit tree, 1 = selected-node zoom
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [internalSelected, setInternalSelected] = useState(selectedId);
  const [branchPopup, setBranchPopup] = useState(null); // { parentId, children, selectedIndex }
  const [currentTransform, setCurrentTransform] = useState(d3.zoomIdentity);
  const currentTransformRef = useRef(d3.zoomIdentity);
  const selectionFocusModeRef = useRef(true);
  const prevRelativeZoomRef = useRef(1);

  // Store positions for fix button overlay
  const [nodePositions, setNodePositions] = useState(new Map());

  // Drag state for node dragging
  const [dragState, setDragState] = useState(null); // { nodeId, startX, startY, currentX, currentY, hasMoved }
  const [dropTarget, setDropTarget] = useState(null); // nodeId of potential drop target
  const dragScrollRef = useRef(null); // RAF id for auto-scroll
  const isDraggingRef = useRef(false); // Track if actively dragging
  const dragThreshold = 5; // Pixels of movement before considering it a drag
  const [deleteHoverNodeId, setDeleteHoverNodeId] = useState(null);
  const [deleteHoverBranch, setDeleteHoverBranch] = useState(null); // { parentId, childId }

  // Config matching treeHistory
  const cfg = useMemo(
    () => ({
      leftPadding: 40,
      depthSpacing: 50,
      rowSpacing: 38,
      topPadding: 48,
      unitX: 50,
      nodeRadius: 14,
      checkpointSpacing: 0, // Extra spacing after checkpoint
    }),
    [],
  );

  // Sync external selection - update during render instead of effect
  const prevSelectedRef = useRef(selectedId);
  if (prevSelectedRef.current !== selectedId) {
    prevSelectedRef.current = selectedId;
    // Schedule state updates for next tick to avoid immediate re-render
    Promise.resolve().then(() => {
      setInternalSelected(selectedId);
      setSelectedEdge(null);
      setBranchPopup(null);
    });
  }

  useEffect(() => {
    selectionFocusModeRef.current = selectionFocusMode;
  }, [selectionFocusMode]);

  useEffect(() => {
    if (deleteMode) {
      setBranchPopup(null);
      setSelectedEdge(null);
      return;
    }
    setDeleteHoverNodeId(null);
    setDeleteHoverBranch(null);
  }, [deleteMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        TREE_SETTINGS_STORAGE_KEY,
        JSON.stringify({
          branchFocusMode,
          horizontalCollapse,
          selectionFocusMode,
          relativeZoom,
        }),
      );
    } catch {
      // Ignore storage write errors.
    }
  }, [
    branchFocusMode,
    horizontalCollapse,
    selectionFocusMode,
    relativeZoom,
  ]);

  // Build internal structure from flat nodes array
  const {
    internalNodes,
    internalLinks,
    childrenMap,
    rootId,
    nodeMap,
  } = useMemo(() => {
    if (!nodes || nodes.length === 0) {
      return {
        internalNodes: [],
        internalLinks: [],
        childrenMap: new Map(),
        rootId: null,
        nodeMap: new Map(),
      };
    }

    const nodeMap = new Map();
    const childrenMap = new Map();
    const parentMap = new Map();
    const internalNodes = [];
    const internalLinks = [];

    nodes.forEach((node) => {
      const isCheckpoint = isCheckpointNode(node.actionType, node.actionTitle);
      const isTriangle = TRIANGLE_TYPES.has(node.actionType);
      const isSquare = SQUARE_TYPES.has(node.actionType);
      const shape = isTriangle ? "triangle" : isSquare ? "square" : "circle";

      // Determine node color based on validity flags
      let nodeColor = actionColors[node.actionType] || ACTION_COLORS.default;
      if (node.greyedOut) {
        nodeColor = "#9ca3af"; // Grey for greyed out nodes
      }

      const internalNode = {
        id: node.id,
        x: 0,
        y: 0,
        color: nodeColor,
        actionType: node.actionType,
        isCheckpoint,
        shape,
        data: node,
        // Include validity flags
        unfixable: node.unfixable,
        configFixable: node.configFixable,
        orderTBD: node.orderTBD,
        orderFixable: node.orderFixable,
        orderUnfixable: node.orderUnfixable,
        greyedOut: node.greyedOut,
        // Include deficits for configFixable nodes
        deficits: node.deficits,
        // Include fixed layout for orderFixable nodes
        fixedLayout: node.fixedLayout,
        layoutFixPlan: node.layoutFixPlan,
      };
      nodeMap.set(node.id, internalNode);
      internalNodes.push(internalNode);

      if (node.parentId != null && nodeMap.has(node.parentId)) {
        parentMap.set(node.id, node.parentId);

        if (!childrenMap.has(node.parentId)) {
          childrenMap.set(node.parentId, []);
        }
        const siblings = childrenMap.get(node.parentId);
        const childIndex = siblings.length;
        siblings.push({ id: node.id, order: childIndex });

        internalLinks.push({
          id: `link_${node.parentId}_${node.id}`,
          source: node.parentId,
          target: node.id,
          kind: childIndex === 0 ? "cont" : "fork",
          order: childIndex,
        });
      }
    });

    // Find root (node with no parent)
    let rootId = null;
    for (const n of internalNodes) {
      if (!parentMap.has(n.id)) {
        rootId = n.id;
        break;
      }
    }

    return {
      internalNodes,
      internalLinks,
      childrenMap,
      rootId,
      nodeMap,
    };
  }, [nodes, actionColors]);

  // Helpers
  const sourceId = (l) =>
    typeof l.source === "string" ? l.source : (l.source?.id ?? l.source);
  const targetId = (l) =>
    typeof l.target === "string" ? l.target : (l.target?.id ?? l.target);

  // Collapsed model for horizontal collapse:
  // - bundleInfo marks hidden nodes within a same-type linear chain
  // - display* maps represent the compact tree made only from visible nodes
  const collapseModel = useMemo(() => {
    const info = new Map();

    if (!horizontalCollapse) {
      for (const node of internalNodes) {
        info.set(node.id, {
          bundleCount: 1,
          isHidden: false,
          bundleType: null,
        });
      }

      const displayChildrenMap = new Map();
      const displayParentMap = new Map();
      const displayNodeIds = new Set();
      for (const node of internalNodes) displayNodeIds.add(node.id);
      for (const [pId, kids] of childrenMap) {
        displayChildrenMap.set(
          pId,
          kids.map((k, idx) => ({ id: k.id, order: idx })),
        );
        for (const k of kids) displayParentMap.set(k.id, pId);
      }
      const displayLinks = internalLinks.map((l) => ({
        ...l,
        source: sourceId(l),
        target: targetId(l),
      }));

      return {
        bundleInfo: info,
        displayChildrenMap,
        displayParentMap,
        displayNodeIds,
        displayRootId: rootId,
        displayLinks,
      };
    }

    const processed = new Set();

    const processChain = (startId) => {
      let cur = startId;
      while (cur != null && !processed.has(cur)) {
        processed.add(cur);
        const curNode = nodeMap.get(cur);
        if (!curNode) break;

        const curBundleKey = getBundleKey(curNode.actionType);

        if (curBundleKey === null) {
          info.set(cur, { bundleCount: 1, isHidden: false, bundleType: null });
          const kids = childrenMap.get(cur) ?? [];
          for (const kid of kids) processChain(kid.id);
          cur = null;
          continue;
        }

        const bundle = [cur];
        let next = cur;
        while (true) {
          const kids = childrenMap.get(next) ?? [];
          if (kids.length !== 1) break;

          const nextNode = nodeMap.get(kids[0].id);
          if (!nextNode) break;

          const nextBundleKey = getBundleKey(nextNode.actionType);
          if (nextBundleKey !== curBundleKey) break;
          if (processed.has(kids[0].id)) break;

          processed.add(kids[0].id);
          bundle.push(kids[0].id);
          next = kids[0].id;
        }

        for (let i = 0; i < bundle.length - 1; i++) {
          info.set(bundle[i], {
            bundleCount: 1,
            isHidden: true,
            bundleType: curBundleKey,
          });
        }
        info.set(bundle[bundle.length - 1], {
          bundleCount: bundle.length,
          isHidden: false,
          bundleType: curBundleKey,
        });

        const lastInBundle = bundle[bundle.length - 1];
        const kids = childrenMap.get(lastInBundle) ?? [];
        for (const kid of kids) processChain(kid.id);
        cur = null;
      }
    };

    if (rootId != null) processChain(rootId);

    for (const node of internalNodes) {
      if (!info.has(node.id)) {
        info.set(node.id, {
          bundleCount: 1,
          isHidden: false,
          bundleType: null,
        });
      }
    }

    const resolveVisibleDescendant = (startId) => {
      let cur = startId;
      const seen = new Set();
      while (cur != null && info.get(cur)?.isHidden) {
        if (seen.has(cur)) break;
        seen.add(cur);
        const kids = childrenMap.get(cur) ?? [];
        cur = kids.length > 0 ? kids[0].id : null;
      }
      return cur;
    };

    const displayChildrenMap = new Map();
    const displayParentMap = new Map();
    const displayNodeIds = new Set();
    for (const node of internalNodes) {
      if (!info.get(node.id)?.isHidden) displayNodeIds.add(node.id);
    }

    for (const node of internalNodes) {
      if (info.get(node.id)?.isHidden) continue;
      const kids = childrenMap.get(node.id) ?? [];
      const visibleKids = [];
      const seenKids = new Set();

      for (const k of kids) {
        const visibleKid = resolveVisibleDescendant(k.id);
        if (visibleKid == null || visibleKid === node.id) continue;
        if (seenKids.has(visibleKid)) continue;
        seenKids.add(visibleKid);
        visibleKids.push({ id: visibleKid, order: visibleKids.length });
      }

      if (visibleKids.length > 0) {
        displayChildrenMap.set(node.id, visibleKids);
        for (const k of visibleKids) displayParentMap.set(k.id, node.id);
      }
    }

    let displayRootId = rootId;
    if (displayRootId != null && info.get(displayRootId)?.isHidden) {
      displayRootId = resolveVisibleDescendant(displayRootId);
    }

    const displayLinks = [];
    for (const [pId, kids] of displayChildrenMap) {
      kids.forEach((k, idx) => {
        displayLinks.push({
          id: `link_${pId}_${k.id}_collapsed`,
          source: pId,
          target: k.id,
          kind: idx === 0 ? "cont" : "fork",
          order: idx,
        });
      });
    }

    return {
      bundleInfo: info,
      displayChildrenMap,
      displayParentMap,
      displayNodeIds,
      displayRootId,
      displayLinks,
    };
  }, [horizontalCollapse, internalNodes, internalLinks, childrenMap, nodeMap, rootId]);

  const activeChildrenMap = collapseModel.displayChildrenMap;
  const activeParentMap = collapseModel.displayParentMap;
  const activeRootId = collapseModel.displayRootId;
  const activeLinks = collapseModel.displayLinks;
  const bundleInfo = collapseModel.bundleInfo;
  const activeNodeIds = collapseModel.displayNodeIds;

  const resolveCollapsedSelection = useCallback(
    (nodeId) => {
      if (!horizontalCollapse || nodeId == null) return nodeId;
      let cur = nodeId;
      const seen = new Set();
      while (cur != null && bundleInfo.get(cur)?.isHidden) {
        if (seen.has(cur)) break;
        seen.add(cur);
        const kids = childrenMap.get(cur) ?? [];
        cur = kids.length > 0 ? kids[0].id : null;
      }
      return cur ?? nodeId;
    },
    [horizontalCollapse, bundleInfo, childrenMap],
  );

  useEffect(() => {
    if (!horizontalCollapse || internalSelected == null) return;
    const resolved = resolveCollapsedSelection(internalSelected);
    if (resolved != null && resolved !== internalSelected) {
      setInternalSelected(resolved);
      setSelectedEdge(null);
      setBranchPopup(null);
      onSelectNode?.(resolved);
    }
  }, [
    horizontalCollapse,
    internalSelected,
    resolveCollapsedSelection,
    onSelectNode,
  ]);

  // Compute checkpoint groups - which "wave" each node belongs to
  // checkpointsBefore = number of checkpoints on path from root to node (exclusive of node itself)
  const computeCheckpointGroups = useCallback(() => {
    const checkpointsBefore = new Map();
    if (activeRootId == null) return { checkpointsBefore, maxGroup: 0 };

    const queue = [{ id: activeRootId, cpCount: 0 }];
    let maxGroup = 0;

    while (queue.length > 0) {
      const { id, cpCount } = queue.shift();
      checkpointsBefore.set(id, cpCount);
      maxGroup = Math.max(maxGroup, cpCount);

      const node = nodeMap.get(id);
      const isCP = node?.isCheckpoint ?? false;
      const nextCount = isCP ? cpCount + 1 : cpCount;

      for (const k of activeChildrenMap.get(id) ?? []) {
        queue.push({ id: k.id, cpCount: nextCount });
      }
    }

    return { checkpointsBefore, maxGroup };
  }, [activeChildrenMap, activeRootId, nodeMap]);

  // Navigation: step forward along main branch from a node
  const stepForward = useCallback(
    (fromNodeId) => {
      const fromId = resolveCollapsedSelection(fromNodeId);
      const kids = activeChildrenMap.get(fromId) ?? [];
      if (kids.length === 0) return null;
      if (kids.length === 1) return resolveCollapsedSelection(kids[0].id);
      // Multiple children - return info for popup
      return { branch: true, parentId: fromId, children: kids };
    },
    [activeChildrenMap, resolveCollapsedSelection],
  );

  // Navigation: step backward along the path
  const stepBackward = useCallback(
    (fromNodeId) => {
      const fromId = resolveCollapsedSelection(fromNodeId);
      return activeParentMap.get(fromId) ?? null;
    },
    [activeParentMap, resolveCollapsedSelection],
  );

  // Navigation: jump to previous checkpoint's parent
  const jumpToPrevCheckpoint = useCallback(
    (fromNodeId) => {
      // Find path from root to current node
      const pathToNode = [];
      let cur = resolveCollapsedSelection(fromNodeId);
      while (cur != null) {
        pathToNode.unshift(cur);
        cur = activeParentMap.get(cur);
      }

      // Find checkpoints on this path, before current node
      let lastCheckpointParent = null;
      for (let i = 0; i < pathToNode.length - 1; i++) {
        const node = nodeMap.get(pathToNode[i]);
        if (node?.isCheckpoint) {
          // Get parent of this checkpoint
          lastCheckpointParent =
            activeParentMap.get(pathToNode[i]) ?? pathToNode[i];
        }
      }

      // If current node is a checkpoint, find the checkpoint before it
      const currentNode = nodeMap.get(fromNodeId);
      if (currentNode?.isCheckpoint) {
        // Look for checkpoint before this one
        for (let i = pathToNode.length - 2; i >= 0; i--) {
          const node = nodeMap.get(pathToNode[i]);
          if (node?.isCheckpoint) {
            return activeParentMap.get(pathToNode[i]) ?? pathToNode[i];
          }
        }
        return activeRootId; // No previous checkpoint, go to root
      }

      return lastCheckpointParent ?? activeRootId;
    },
    [activeParentMap, nodeMap, activeRootId, resolveCollapsedSelection],
  );

  // Navigation: jump to next checkpoint's parent (along main branch from current)
  const jumpToNextCheckpoint = useCallback(
    (fromNodeId) => {
      // Start from current node
      let cur = resolveCollapsedSelection(fromNodeId);
      const currentNode = nodeMap.get(cur);

      // If we're exactly on a checkpoint, skip it
      if (currentNode?.isCheckpoint) {
        const kids = activeChildrenMap.get(cur) ?? [];
        cur = kids.length > 0 ? kids[0].id : null;
      }

      // Also check: if the first child is a checkpoint, we're "right before" it
      // In that case, skip that checkpoint and find the one after
      const firstKids = activeChildrenMap.get(cur) ?? [];
      if (firstKids.length > 0) {
        const firstChild = nodeMap.get(firstKids[0].id);
        if (firstChild?.isCheckpoint) {
          // Skip past this checkpoint
          const nextKids = activeChildrenMap.get(firstKids[0].id) ?? [];
          cur = nextKids.length > 0 ? nextKids[0].id : null;
        }
      }

      while (cur != null) {
        const node = nodeMap.get(cur);
        if (node?.isCheckpoint) {
          // Return parent of this checkpoint
          return activeParentMap.get(cur) ?? cur;
        }
        const kids = activeChildrenMap.get(cur) ?? [];
        cur = kids.length > 0 ? kids[0].id : null;
      }

      // No next checkpoint found - go to end of main branch
      let endNode = resolveCollapsedSelection(fromNodeId);
      let cur2 = resolveCollapsedSelection(fromNodeId);
      while (cur2 != null) {
        endNode = cur2;
        const kids = activeChildrenMap.get(cur2) ?? [];
        cur2 = kids.length > 0 ? kids[0].id : null;
      }
      return endNode;
    },
    [nodeMap, activeChildrenMap, activeParentMap, resolveCollapsedSelection],
  );

  // Check if a node is on the main branch (first child path from root)
  const isOnMainBranch = useCallback(
    (nodeId) => {
      let cur = activeRootId;
      while (cur != null) {
        if (cur === nodeId) return true;
        const kids = activeChildrenMap.get(cur) ?? [];
        cur = kids.length > 0 ? kids[0].id : null;
      }
      return false;
    },
    [activeRootId, activeChildrenMap],
  );

  // Compute depths (distance from root within each checkpoint group)
  const computeDepths = useCallback(() => {
    const depth = new Map();
    const depthSinceCheckpoint = new Map();
    const { checkpointsBefore, maxGroup } = computeCheckpointGroups();
    if (activeRootId == null)
      return { depth, depthSinceCheckpoint, checkpointsBefore, maxGroup };

    // Track depth relative to last checkpoint on each path
    const queue = [activeRootId];
    depth.set(activeRootId, 0);
    depthSinceCheckpoint.set(activeRootId, 0);

    while (queue.length) {
      const cur = queue.shift();
      const curDepth = depth.get(cur) ?? 0;
      const curNode = nodeMap.get(cur);
      const curIsCP = curNode?.isCheckpoint ?? false;
      const curDepthSinceCP = depthSinceCheckpoint.get(cur) ?? 0;

      for (const k of activeChildrenMap.get(cur) ?? []) {
        depth.set(k.id, curDepth + 1);
        // Reset depth counter after checkpoint, otherwise increment
        depthSinceCheckpoint.set(k.id, curIsCP ? 1 : curDepthSinceCP + 1);
        queue.push(k.id);
      }
    }

    return { depth, depthSinceCheckpoint, checkpointsBefore, maxGroup };
  }, [activeChildrenMap, activeRootId, nodeMap, computeCheckpointGroups]);

  // Compute branch counts for row allocation
  const computeBranchCounts = useCallback(
    (visibleNodes, showAll) => {
      const memo = new Map();

      const dfs = (id) => {
        if (memo.has(id)) return memo.get(id);
        const kids = activeChildrenMap.get(id) ?? [];
        const visibleKids = showAll
          ? kids
          : kids.filter((k) => visibleNodes.has(k.id));
        if (visibleKids.length === 0) {
          memo.set(id, 1);
          return 1;
        }
        let total = 0;
        for (const k of visibleKids) total += dfs(k.id);
        memo.set(id, total);
        return total;
      };

      if (activeRootId != null) dfs(activeRootId);
      return memo;
    },
    [activeChildrenMap, activeRootId],
  );

  // Compute row starts
  const computeRowStarts = useCallback(
    (branchCounts, visibleNodes, showAll) => {
      const starts = new Map();

      const dfs = (id, startRow) => {
        starts.set(id, startRow);
        let cursor = startRow;
        const kids = activeChildrenMap.get(id) ?? [];
        const visibleKids = showAll
          ? kids
          : kids.filter((k) => visibleNodes.has(k.id));
        for (const k of visibleKids) {
          const rows = branchCounts.get(k.id) ?? 1;
          dfs(k.id, cursor);
          cursor += rows;
        }
      };

      if (activeRootId != null) dfs(activeRootId, 0);
      return starts;
    },
    [activeChildrenMap, activeRootId],
  );

  // Compute visibility (focus mode)
  const computeVisibility = useCallback(() => {
    if (!branchFocusMode || internalSelected == null) {
      return { visibleNodes: new Set(), hiddenEdgeHints: [], showAll: true };
    }

    const visible = new Set();
    const hiddenEdgeHints = [];
    const selectedNodeId = resolveCollapsedSelection(internalSelected);
    if (selectedNodeId == null) {
      return { visibleNodes: new Set(), hiddenEdgeHints: [], showAll: true };
    }

    // Path from root to selected
    const pathToSelected = [];
    let current = selectedNodeId;
    while (current != null) {
      pathToSelected.unshift(current);
      current = activeParentMap.get(current);
    }
    const pathSet = new Set(pathToSelected);

    // Path indices for hints
    const pathIndices = [];
    for (let i = 1; i < pathToSelected.length; i++) {
      const pId = pathToSelected[i - 1];
      const nodeId = pathToSelected[i];
      const kids = activeChildrenMap.get(pId) ?? [];
      const idx = kids.findIndex((k) => k.id === nodeId);
      pathIndices.push({ nodeId, parentId: pId, childIndex: idx });
    }

    // Main branch helper
    const addMainBranch = (startId) => {
      let cur = startId;
      while (cur != null) {
        visible.add(cur);
        const kids = activeChildrenMap.get(cur) ?? [];
        if (kids.length === 0) break;
        cur = kids[0].id;
      }
    };

    // Add main branch from root
    if (activeRootId != null) addMainBranch(activeRootId);

    // Add path to selected
    for (const nodeId of pathToSelected) visible.add(nodeId);

    // Add main branch from selected downward
    addMainBranch(selectedNodeId);

    // Add direct children of selected
    const selectedKids = activeChildrenMap.get(selectedNodeId) ?? [];
    for (const kid of selectedKids) visible.add(kid.id);

    // Hints along path - check for hidden siblings
    for (const step of pathIndices) {
      const { parentId, childIndex } = step;
      const kids = activeChildrenMap.get(parentId) ?? [];
      // hasAbove: there are siblings above index 0 (index 0 is always visible as main branch)
      // We show hint if childIndex > 0 AND there's a sibling between main branch and us
      const hasAbove = childIndex > 1; // siblings between index 0 and childIndex
      // hasBelow: siblings below our current index
      const hasBelow = childIndex < kids.length - 1;
      if (hasAbove || hasBelow) {
        hiddenEdgeHints.push({
          parentId,
          targetChildIndex: childIndex,
          hasAbove,
          hasBelow,
        });
      }
    }

    // Hints on main branch from root - for hidden branches off the main trunk
    const addMainBranchHints = (startId) => {
      let cur = startId;
      while (cur != null) {
        const kids = activeChildrenMap.get(cur) ?? [];
        // Skip if this node is ON the path to selected (hints already handled above)
        if (pathSet.has(cur)) {
          cur = kids.length > 0 ? kids[0].id : null;
          continue;
        }
        // On main branch but not on path: show hint if there are hidden branches
        if (kids.length > 1) {
          hiddenEdgeHints.push({
            parentId: cur,
            targetChildIndex: 0,
            hasAbove: false,
            hasBelow: true,
          });
        }
        cur = kids.length > 0 ? kids[0].id : null;
      }
    };
    if (activeRootId != null) addMainBranchHints(activeRootId);

    // Hints along the main branch DOWNWARD from selected node
    // This catches hidden branches below the selected node (like K2 in R-S-C-K1/K2)
    const addSelectedBranchHints = () => {
      let cur = selectedNodeId;
      while (cur != null) {
        const kids = activeChildrenMap.get(cur) ?? [];
        if (kids.length === 0) break;

        // If there are multiple children, the ones after index 0 are hidden
        if (kids.length > 1) {
          hiddenEdgeHints.push({
            parentId: cur,
            targetChildIndex: 0,
            hasAbove: false,
            hasBelow: true,
          });
        }

        // Move to first child (main branch continues)
        cur = kids[0].id;
      }
    };
    addSelectedBranchHints();

    return { visibleNodes: visible, hiddenEdgeHints, showAll: false };
  }, [
    branchFocusMode,
    internalSelected,
    activeParentMap,
    activeChildrenMap,
    activeRootId,
    resolveCollapsedSelection,
  ]);

  // Compute node positions with checkpoint synchronization
  // Checkpoints act as "barriers" - all parallel branches must reach a checkpoint
  // before the checkpoint line can be drawn
  const computePositions = useCallback(
    (visibleNodes, showAll) => {
      const { depth, depthSinceCheckpoint, checkpointsBefore, maxGroup } =
        computeDepths();
      const branchCounts = computeBranchCounts(visibleNodes, showAll);
      const rowStarts = computeRowStarts(branchCounts, visibleNodes, showAll);

      // Group nodes by checkpointsBefore
      const groups = new Map(); // groupNum -> nodeIds[]
      for (const n of internalNodes) {
        if (!activeNodeIds.has(n.id)) continue;
        const group = checkpointsBefore.get(n.id) ?? 0;
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(n);
      }

      // For each group, find the max depth of NON-checkpoint nodes
      // This determines where the checkpoint line must be placed
      const groupMaxDepth = new Map();
      for (const [groupNum, nodes] of groups) {
        let maxD = 0;
        for (const n of nodes) {
          // Only count non-checkpoint nodes for determining barrier position
          if (!n.isCheckpoint) {
            maxD = Math.max(maxD, depthSinceCheckpoint.get(n.id) ?? 0);
          }
        }
        groupMaxDepth.set(groupNum, maxD);
      }

      // Calculate checkpoint line X positions
      // Each checkpoint line is placed after the furthest non-checkpoint node in that group
      const checkpointLineX = new Map();
      let accumulatedX = cfg.leftPadding;

      for (let g = 0; g <= maxGroup; g++) {
        const maxD = groupMaxDepth.get(g) ?? 0;
        // Checkpoint line is after the max depth in this group
        const lineX = accumulatedX + (maxD + 1) * cfg.unitX;
        checkpointLineX.set(g, lineX);
        // Next group starts after the checkpoint line + some spacing
        accumulatedX = lineX + cfg.checkpointSpacing;
      }

      const positions = new Map();
      const checkpointXPositions = [];

      for (const n of internalNodes) {
        if (!activeNodeIds.has(n.id)) continue;
        const group = checkpointsBefore.get(n.id) ?? 0;
        const row = rowStarts.get(n.id) ?? 0;
        const y = cfg.topPadding + row * cfg.rowSpacing;

        let x;
        if (n.isCheckpoint) {
          // Checkpoint nodes sit on the checkpoint line
          x = checkpointLineX.get(group);
          checkpointXPositions.push(x);
        } else {
          // Non-checkpoint nodes: position based on depth since last checkpoint
          const baseX =
            group > 0
              ? checkpointLineX.get(group - 1) + cfg.checkpointSpacing
              : cfg.leftPadding;
          const dSinceCP =
            depthSinceCheckpoint.get(n.id) ?? depth.get(n.id) ?? 0;
          x = baseX + dSinceCP * cfg.unitX;
        }

        positions.set(n.id, { x, y, checkpointGroup: group });
      }

      // Build child index map for edges
      const childIndexMap = new Map();
      for (const [pId, kids] of activeChildrenMap) {
        kids.forEach((k, idx) => childIndexMap.set(`${pId}|${k.id}`, idx));
      }

      // Deduplicate checkpoint X positions
      const uniqueCheckpointX = [...new Set(checkpointXPositions)].sort(
        (a, b) => a - b,
      );

      return {
        positions,
        depth,
        rowStarts,
        childIndexMap,
        checkpointXPositions: uniqueCheckpointX,
      };
    },
    [
      computeDepths,
      computeBranchCounts,
      computeRowStarts,
      internalNodes,
      activeChildrenMap,
      activeNodeIds,
      cfg,
    ],
  );

  const isNodeRenderable = useCallback(
    (nodeId, visibleNodes, showAll) => {
      if (!activeNodeIds.has(nodeId)) return false;
      if (!showAll && !visibleNodes.has(nodeId)) return false;
      const bundle = bundleInfo.get(nodeId);
      return !bundle?.isHidden;
    },
    [bundleInfo, activeNodeIds],
  );

  const computeZoomMetrics = useCallback(() => {
    const { visibleNodes, showAll } = computeVisibility();
    const { positions } = computePositions(visibleNodes, showAll);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const node of internalNodes) {
      if (!isNodeRenderable(node.id, visibleNodes, showAll)) continue;
      const pos = positions.get(node.id);
      if (!pos) continue;
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x);
      minY = Math.min(minY, pos.y);
      maxY = Math.max(maxY, pos.y);
    }

    if (minX === Infinity) return null;

    const padding = 60;
    const bounds = {
      minX: minX - padding,
      maxX: maxX + padding,
      minY: minY - padding,
      maxY: maxY + padding,
    };
    const contentWidth = Math.max(bounds.maxX - bounds.minX, 1);
    const contentHeight = Math.max(bounds.maxY - bounds.minY, 1);
    const fitScale = Math.min(
      width / contentWidth,
      height / contentHeight,
      ZOOM_MAX_SCALE,
    );

    return { positions, bounds, fitScale };
  }, [
    computeVisibility,
    computePositions,
    internalNodes,
    isNodeRenderable,
    width,
    height,
  ]);

  const relativeToScale = useCallback((relative, fitScale) => {
    const r = clamp(relative, 0, 1);
    return fitScale + (ZOOM_MAX_SCALE - fitScale) * r;
  }, []);

  const scaleToRelative = useCallback((scale, fitScale) => {
    const denom = ZOOM_MAX_SCALE - fitScale;
    if (denom <= 0.000001) return 1;
    return clamp((scale - fitScale) / denom, 0, 1);
  }, []);

  const clampTransformToBounds = useCallback(
    (scale, desiredX, desiredY, bounds) => {
      const contentWidth = (bounds.maxX - bounds.minX) * scale;
      const contentHeight = (bounds.maxY - bounds.minY) * scale;

      let x = desiredX;
      let y = desiredY;

      if (contentWidth <= width) {
        x = (width - contentWidth) / 2 - bounds.minX * scale;
      } else {
        const minTx = width - bounds.maxX * scale;
        const maxTx = -bounds.minX * scale;
        x = clamp(x, minTx, maxTx);
      }

      if (contentHeight <= height) {
        y = (height - contentHeight) / 2 - bounds.minY * scale;
      } else {
        const minTy = height - bounds.maxY * scale;
        const maxTy = -bounds.minY * scale;
        y = clamp(y, minTy, maxTy);
      }

      return d3.zoomIdentity.translate(x, y).scale(scale);
    },
    [width, height],
  );

  const applyTransform = useCallback((nextTransform, duration = 0) => {
    const api = apiRef.current;
    if (!api) return;

    const { svg, zoom } = api;
    svg.interrupt();
    if (duration > 0) {
      svg.transition().duration(duration).call(zoom.transform, nextTransform);
    } else {
      svg.call(zoom.transform, nextTransform);
    }
  }, []);

  // Initialize D3
  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    svg.selectAll("*").remove();

    const gRoot = svg.append("g").attr("class", "tree-root");
    const gCheckpoints = gRoot.append("g").attr("class", "checkpoints");
    const gLinks = gRoot.append("g").attr("class", "links");
    const gNodes = gRoot.append("g").attr("class", "nodes");
    const gLabels = svg.append("g").attr("class", "checkpoint-labels");

    const zoom = d3
      .zoom()
      .scaleExtent([ZOOM_MIN_SCALE, ZOOM_MAX_SCALE])
      .filter((event) => {
        if (isDraggingRef.current || event.ctrlKey) return false;
        if (event.type === "mousedown") {
          if (event.button === 0) {
            const target = event.target;
            if (
              target.closest(
                ".node-group, .square-group, .triangle-group, .edge-hit",
              )
            ) {
              return false;
            }
          }
          return event.button === 0 || event.button === 1;
        }
        return true;
      })
      .on("zoom", (event) => {
        gRoot.attr("transform", event.transform);
        currentTransformRef.current = event.transform;
        setCurrentTransform(event.transform);

        if (event.sourceEvent && selectionFocusModeRef.current) {
          setSelectionFocusMode(false);
        }
      });

    svg.call(zoom);

    apiRef.current = {
      svg,
      gRoot,
      gCheckpoints,
      gLinks,
      gNodes,
      gLabels,
      zoom,
    };

    return () => {
      svg.on(".zoom", null);
      svg.selectAll("*").remove();
    };
  }, [width, height]);

  // Focus mode: keep selected node in view and preserve relative zoom across tree size changes.
  useEffect(() => {
    if (!selectionFocusMode) return;
    const metrics = computeZoomMetrics();
    if (!metrics) return;

    const scale = relativeToScale(relativeZoom, metrics.fitScale);
    const selectedPos =
      internalSelected != null ? metrics.positions.get(internalSelected) : null;
    const anchorX = selectedPos
      ? selectedPos.x
      : (metrics.bounds.minX + metrics.bounds.maxX) / 2;
    const anchorY = selectedPos
      ? selectedPos.y
      : (metrics.bounds.minY + metrics.bounds.maxY) / 2;
    const desiredX = width / 2 - anchorX * scale;
    const desiredY = height / 2 - anchorY * scale;

    const nextTransform = clampTransformToBounds(
      scale,
      desiredX,
      desiredY,
      metrics.bounds,
    );
    const zoomChanged = Math.abs(relativeZoom - prevRelativeZoomRef.current) > 0.000001;
    prevRelativeZoomRef.current = relativeZoom;
    applyTransform(nextTransform, zoomChanged ? 0 : 180);
  }, [
    selectionFocusMode,
    relativeZoom,
    internalSelected,
    width,
    height,
    computeZoomMetrics,
    relativeToScale,
    clampTransformToBounds,
    applyTransform,
  ]);

  // ============ DRAG AND DROP HANDLERS ============

  // Get positions for hit testing during drag
  const getPositionsRef = useRef(null);
  useEffect(() => {
    const { visibleNodes, showAll } = computeVisibility();
    const { positions } = computePositions(visibleNodes, showAll);
    getPositionsRef.current = positions;
  }, [computeVisibility, computePositions]);

  // Find node at screen position
  const findNodeAtPosition = useCallback(
    (screenX, screenY) => {
      const positions = getPositionsRef.current;
      if (!positions || !apiRef.current) return null;

      const transform = currentTransformRef.current;
      const hitRadius = cfg.nodeRadius * 1.5; // Slightly larger hit area

      for (const [nodeId, pos] of positions) {
        // Transform node position to screen coordinates
        const nodeScreenX = pos.x * transform.k + transform.x;
        const nodeScreenY = pos.y * transform.k + transform.y;

        const dx = screenX - nodeScreenX;
        const dy = screenY - nodeScreenY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= hitRadius * transform.k) {
          return nodeId;
        }
      }
      return null;
    },
    [cfg.nodeRadius],
  );

  // Auto-scroll when dragging near edges
  const startAutoScroll = useCallback(
    (mouseX, mouseY) => {
      if (!containerRef.current || !apiRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const edgeThreshold = 50; // Pixels from edge to start scrolling
      const maxSpeed = 15; // Max pixels per frame

      const autoScrollTick = () => {
        if (!isDraggingRef.current || !apiRef.current) {
          dragScrollRef.current = null;
          return;
        }

        const { svg, zoom } = apiRef.current;
        let dx = 0;
        let dy = 0;

        // Calculate scroll speed based on distance from edge
        const leftDist = mouseX - rect.left;
        const rightDist = rect.right - mouseX;
        const topDist = mouseY - rect.top;
        const bottomDist = rect.bottom - mouseY;

        if (leftDist < edgeThreshold) {
          dx = maxSpeed * (1 - leftDist / edgeThreshold);
        } else if (rightDist < edgeThreshold) {
          dx = -maxSpeed * (1 - rightDist / edgeThreshold);
        }

        if (topDist < edgeThreshold) {
          dy = maxSpeed * (1 - topDist / edgeThreshold);
        } else if (bottomDist < edgeThreshold) {
          dy = -maxSpeed * (1 - bottomDist / edgeThreshold);
        }

        if (dx !== 0 || dy !== 0) {
          const transform = currentTransformRef.current;
          const newTransform = transform.translate(
            dx / transform.k,
            dy / transform.k,
          );
          svg.call(zoom.transform, newTransform);
        }

        dragScrollRef.current = requestAnimationFrame(autoScrollTick);
      };

      if (dragScrollRef.current) {
        cancelAnimationFrame(dragScrollRef.current);
      }
      dragScrollRef.current = requestAnimationFrame(autoScrollTick);
    },
    [],
  );

  const stopAutoScroll = useCallback(() => {
    if (dragScrollRef.current) {
      cancelAnimationFrame(dragScrollRef.current);
      dragScrollRef.current = null;
    }
  }, []);

  const clearDeleteHover = useCallback(() => {
    setDeleteHoverNodeId(null);
    setDeleteHoverBranch(null);
  }, []);

  const collectSubtreeNodeIds = useCallback(
    (rootNodeId) => {
      if (rootNodeId == null) return new Set();
      const result = new Set();
      const queue = [rootNodeId];

      while (queue.length > 0) {
        const nodeId = queue.shift();
        if (result.has(nodeId)) continue;
        result.add(nodeId);
        const children = activeChildrenMap.get(nodeId) ?? [];
        children.forEach((child) => queue.push(child.id));
      }
      return result;
    },
    [activeChildrenMap],
  );

  const handleDeleteAction = useCallback(
    (nodeId, deleteSubtree) => {
      if (!deleteMode || nodeId == null || nodeId === 0) return;
      let targetNodeId = nodeId;
      let bundleNodeIds = null;
      if (deleteSubtree && horizontalCollapse) {
        const bundle = bundleInfo.get(nodeId);
        if (bundle?.bundleCount > 1) {
          let cur = nodeId;
          const seen = new Set();
          while (cur != null && !seen.has(cur)) {
            seen.add(cur);
            const parentId = nodeMap.get(cur)?.data?.parentId;
            if (parentId == null || !bundleInfo.get(parentId)?.isHidden) break;
            cur = parentId;
          }
          targetNodeId = cur ?? nodeId;
        }
      }
      if (!deleteSubtree && horizontalCollapse) {
        const bundle = bundleInfo.get(nodeId);
        if (bundle?.bundleCount > 1) {
          const chain = [nodeId];
          let cur = nodeId;
          const seen = new Set([nodeId]);
          while (cur != null) {
            const parentId = nodeMap.get(cur)?.data?.parentId;
            if (parentId == null || seen.has(parentId)) break;
            if (!bundleInfo.get(parentId)?.isHidden) break;
            chain.push(parentId);
            seen.add(parentId);
            cur = parentId;
          }
          bundleNodeIds = chain;
        }
      }
      if (targetNodeId === 0) return;
      onDeleteNode?.(targetNodeId, deleteSubtree, { bundleNodeIds });
      clearDeleteHover();
      setBranchPopup(null);
      setSelectedEdge(null);
    },
    [
      deleteMode,
      onDeleteNode,
      clearDeleteHover,
      horizontalCollapse,
      bundleInfo,
      nodeMap,
    ],
  );

  // Handle drag start on a node
  const handleDragStart = useCallback((nodeId, event) => {
    if (deleteMode) return;
    // Don't allow dragging the root node (id 0)
    if (nodeId === 0) return;

    event.preventDefault();
    event.stopPropagation();

    isDraggingRef.current = true;
    const rect = containerRef.current?.getBoundingClientRect();
    const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
    const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;

    setDragState({
      nodeId,
      startX: clientX - (rect?.left ?? 0),
      startY: clientY - (rect?.top ?? 0),
      currentX: clientX - (rect?.left ?? 0),
      currentY: clientY - (rect?.top ?? 0),
      hasMoved: false, // Track if mouse actually moved beyond threshold
    });
  }, [deleteMode]);

  // Handle drag move
  const handleDragMove = useCallback(
    (event) => {
      if (!dragState || !isDraggingRef.current) return;

      const rect = containerRef.current?.getBoundingClientRect();
      const clientX = event.clientX ?? event.touches?.[0]?.clientX ?? 0;
      const clientY = event.clientY ?? event.touches?.[0]?.clientY ?? 0;
      const x = clientX - (rect?.left ?? 0);
      const y = clientY - (rect?.top ?? 0);

      // Check if we've moved beyond the threshold
      const dx = x - dragState.startX;
      const dy = y - dragState.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const hasMoved = dragState.hasMoved || distance > dragThreshold;
      if (hasMoved && !dragState.hasMoved && selectionFocusModeRef.current) {
        setSelectionFocusMode(false);
      }

      setDragState((prev) =>
        prev ? { ...prev, currentX: x, currentY: y, hasMoved } : null,
      );

      // Only show drop targets and indicator if we've actually moved
      if (hasMoved) {
        // Find potential drop target
        const targetId = findNodeAtPosition(x, y);
        // Can't drop on self
        if (targetId !== null && targetId !== dragState.nodeId) {
          setDropTarget(targetId);
        } else {
          setDropTarget(null);
        }

        // Start auto-scroll near edges
        startAutoScroll(clientX, clientY);
      }
    },
    [dragState, findNodeAtPosition, startAutoScroll, dragThreshold],
  );

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    stopAutoScroll();

    const wasDragging = dragState?.hasMoved;

    if (wasDragging && dropTarget !== null && onCopyBranch) {
      // Copy the dragged node's subtree as a new child of the drop target
      onCopyBranch(dragState.nodeId, dropTarget);
    }

    // If it wasn't a real drag (just a click), select the node
    if (dragState && !wasDragging) {
      const selectedNodeId = resolveCollapsedSelection(dragState.nodeId);
      setInternalSelected(selectedNodeId);
      setSelectedEdge(null);
      setBranchPopup(null);
      onSelectNode?.(selectedNodeId);
    }

    setDragState(null);
    setDropTarget(null);
    // Reset dragging ref after a microtask so click handler sees it was dragging
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 0);
  }, [
    dragState,
    dropTarget,
    onCopyBranch,
    stopAutoScroll,
    onSelectNode,
    resolveCollapsedSelection,
  ]);

  // Global mouse/touch event listeners for drag
  useEffect(() => {
    if (!dragState) return;

    const handleMove = (e) => handleDragMove(e);
    const handleEnd = () => handleDragEnd();

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("mouseup", handleEnd);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("touchend", handleEnd);
    window.addEventListener("touchcancel", handleEnd);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener("mouseup", handleEnd);
      window.removeEventListener("touchmove", handleMove);
      window.removeEventListener("touchend", handleEnd);
      window.removeEventListener("touchcancel", handleEnd);
    };
  }, [dragState, handleDragMove, handleDragEnd]);

  // Render tree
  useEffect(() => {
    const api = apiRef.current;
    if (!api || internalNodes.length === 0) return;

    const { gCheckpoints, gLinks, gNodes } = api;

    const { visibleNodes, hiddenEdgeHints, showAll } = computeVisibility();
    const { positions, childIndexMap, checkpointXPositions } = computePositions(
      visibleNodes,
      showAll,
    );

    // Store positions for fix button overlay
    setNodePositions(positions);

    const getChildIndex = (l) =>
      childIndexMap.get(`${sourceId(l)}|${targetId(l)}`) ?? 0;

    // Filter visible (also filter out hidden bundle nodes)
    const isNodeVisible = (n) => {
      if (!activeNodeIds.has(n.id)) return false;
      if (!showAll && !visibleNodes.has(n.id)) return false;
      const bundle = bundleInfo.get(n.id);
      if (bundle?.isHidden) return false;
      return true;
    };
    const visibleLinksArr = showAll
      ? activeLinks.filter((l) => {
          const tBundle = bundleInfo.get(targetId(l));
          return !tBundle?.isHidden;
        })
      : activeLinks.filter((l) => {
          const sId = sourceId(l);
          const tId = targetId(l);
          if (!visibleNodes.has(sId) || !visibleNodes.has(tId)) return false;
          const tBundle = bundleInfo.get(tId);
          return !tBundle?.isHidden;
        });
    const visibleNodesArr = showAll
      ? internalNodes.filter(isNodeVisible)
      : internalNodes.filter(isNodeVisible);

    // Link path generator
    const linkPath = (l) => {
      const sId = sourceId(l);
      const tId = targetId(l);
      const sPos = positions.get(sId);
      const tPos = positions.get(tId);
      if (!sPos || !tPos) return "";

      const sx = sPos.x,
        sy = sPos.y;
      const tx = tPos.x,
        ty = tPos.y;
      const idx = getChildIndex(l);

      // Main branch (idx 0) or same row: straight line
      if (idx === 0 || Math.abs(ty - sy) < 1) {
        return `M ${sx} ${sy} L ${tx} ${ty}`;
      }

      // Fork: elbow path
      const elbowX = sx + Math.min(cfg.depthSpacing * 0.7, (tx - sx) * 0.5);
      return `M ${sx} ${sy} L ${elbowX} ${sy} L ${elbowX} ${ty} L ${tx} ${ty}`;
    };

    // Clear and redraw links
    gLinks.selectAll("*").remove();

    // Determine which edge is highlighted (from popup selection or selectedEdge)
    const highlightedEdge = branchPopup
      ? {
          parentId: branchPopup.parentId,
          childIndex: branchPopup.selectedIndex,
        }
      : selectedEdge;

    // Sort links: selected last (on top), then gold (main branch)
    const sortedLinks = [...visibleLinksArr].sort((a, b) => {
      const aIdx = getChildIndex(a);
      const bIdx = getChildIndex(b);
      const aIsSelected =
        highlightedEdge?.parentId === sourceId(a) &&
        (activeChildrenMap.get(sourceId(a)) ?? [])[highlightedEdge.childIndex]
          ?.id ===
          targetId(a);
      const bIsSelected =
        highlightedEdge?.parentId === sourceId(b) &&
        (activeChildrenMap.get(sourceId(b)) ?? [])[highlightedEdge.childIndex]
          ?.id ===
          targetId(b);

      if (aIsSelected && !bIsSelected) return 1;
      if (!aIsSelected && bIsSelected) return -1;
      if (aIdx === 0 && bIdx !== 0) return 1;
      if (aIdx !== 0 && bIdx === 0) return -1;
      return 0;
    });

    const linkKey = (parentId, childId) => `${parentId}|${childId}`;
    const highlightedDeleteNodes =
      deleteMode && deleteHoverBranch?.childId != null
        ? collectSubtreeNodeIds(deleteHoverBranch.childId)
        : new Set();
    const highlightedDeleteEdges = new Set();
    if (deleteMode && deleteHoverBranch?.childId != null) {
      if (deleteHoverBranch.parentId != null) {
        highlightedDeleteEdges.add(
          linkKey(deleteHoverBranch.parentId, deleteHoverBranch.childId),
        );
      }
      highlightedDeleteNodes.forEach((nodeId) => {
        const children = activeChildrenMap.get(nodeId) ?? [];
        children.forEach((child) =>
          highlightedDeleteEdges.add(linkKey(nodeId, child.id)),
        );
      });
    }

    // Draw edges
    gLinks
      .selectAll("path.edge")
      .data(sortedLinks, (d) => d.id)
      .join("path")
      .attr("class", "edge")
      .attr("data-edge-parent-id", (d) => sourceId(d))
      .attr("data-edge-child-id", (d) => targetId(d))
      .attr("fill", "none")
      .attr("d", linkPath)
      .attr("stroke-width", (d) => {
        const sId = sourceId(d);
        const tId = targetId(d);
        if (deleteMode && highlightedDeleteEdges.has(linkKey(sId, tId))) {
          return 3.5;
        }
        if (highlightedEdge?.parentId === sId) {
          const kids = activeChildrenMap.get(sId) ?? [];
          if (kids[highlightedEdge.childIndex]?.id === tId) return 3;
        }
        return getChildIndex(d) === 0 ? 1.5 : 1.5;
      })
      .attr("stroke", (d) => {
        const sId = sourceId(d);
        const tId = targetId(d);
        const idx = getChildIndex(d);

        if (deleteMode && highlightedDeleteEdges.has(linkKey(sId, tId))) {
          return "#ef4444";
        }

        // Check if target node is greyed out
        const targetNode = nodeMap.get(tId);
        if (targetNode?.greyedOut) {
          return "#9ca3af"; // Grey for links to greyed out nodes
        }

        if (highlightedEdge?.parentId === sId) {
          const kids = activeChildrenMap.get(sId) ?? [];
          if (kids[highlightedEdge.childIndex]?.id === tId) return "#000000";
        }
        return idx === 0 ? "#ffffff" : "#9aa4b2";
      });

    gLinks
      .selectAll("path.edge-hit")
      .data(deleteMode ? sortedLinks : [], (d) => `hit_${d.id}`)
      .join("path")
      .attr("class", "edge-hit")
      .attr("data-edge-parent-id", (d) => sourceId(d))
      .attr("data-edge-child-id", (d) => targetId(d))
      .attr("fill", "none")
      .attr("d", linkPath)
      .attr("stroke", "transparent")
      .attr("stroke-width", 14)
      .style("cursor", "pointer")
      .on("mouseenter", (event, d) => {
        event.stopPropagation();
        const childId = targetId(d);
        if (childId === 0) return;
        setDeleteHoverNodeId(null);
        setDeleteHoverBranch({
          parentId: sourceId(d),
          childId,
        });
      })
      .on("mouseleave", (event, d) => {
        event.stopPropagation();
        const edgeParentId = sourceId(d);
        const edgeChildId = targetId(d);
        setDeleteHoverBranch((prev) =>
          prev &&
          prev.parentId === edgeParentId &&
          prev.childId === edgeChildId
            ? null
            : prev,
        );
      })
      .on("mousedown", (event, d) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.stopPropagation();
        handleDeleteAction(targetId(d), true);
      })
      .on("touchstart", (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        handleDeleteAction(targetId(d), true);
      })
      .on("click", (event, d) => {
        // Fallback for assistive/device cases where click is still dispatched.
        event.preventDefault();
        event.stopPropagation();
        handleDeleteAction(targetId(d), true);
      });

    // Hint lines for hidden branches
    if (!showAll) {
      const hintData = [];
      for (const hint of hiddenEdgeHints) {
        const pPos = positions.get(hint.parentId);
        const kids = activeChildrenMap.get(hint.parentId) ?? [];
        const targetKid = kids[hint.targetChildIndex];
        const tPos = targetKid ? positions.get(targetKid.id) : null;
        if (!pPos || !tPos) continue;

        const sx = pPos.x,
          sy = pPos.y;
        const tx = tPos.x,
          ty = tPos.y;
        const elbowX = sx + Math.min(cfg.depthSpacing * 0.7, (tx - sx) * 0.5);
        const hintLen = cfg.rowSpacing * 0.4;

        if (hint.hasAbove) {
          hintData.push({
            id: `hint_a_${hint.parentId}_${hint.targetChildIndex}`,
            x1: elbowX,
            y1: sy,
            x2: elbowX,
            y2: sy - hintLen,
          });
        }
        if (hint.hasBelow) {
          const hintY = hint.targetChildIndex === 0 ? sy : ty;
          hintData.push({
            id: `hint_b_${hint.parentId}_${hint.targetChildIndex}`,
            x1: elbowX,
            y1: hintY,
            x2: elbowX,
            y2: hintY + hintLen,
          });
        }
      }

      gLinks
        .selectAll("line.hint")
        .data(hintData, (d) => d.id)
        .join("line")
        .attr("class", "hint")
        .attr("x1", (d) => d.x1)
        .attr("y1", (d) => d.y1)
        .attr("x2", (d) => d.x2)
        .attr("y2", (d) => d.y2)
        .attr("stroke", "#9aa4b2")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "3 3")
        .attr("opacity", 0.6);
    }

    // Draw checkpoint vertical lines - very long for zoomed out view
    gCheckpoints.selectAll("*").remove();
    // Also add root line at x = cfg.leftPadding
    const allLinePositions = [cfg.leftPadding, ...(checkpointXPositions || [])];
    const lineExtent = 10000; // Very long lines for zoom out

    gCheckpoints
      .selectAll("line.checkpoint-line")
      .data(allLinePositions)
      .join("line")
      .attr("class", "checkpoint-line")
      .attr("x1", (d) => d)
      .attr("y1", -lineExtent)
      .attr("x2", (d) => d)
      .attr("y2", lineExtent)
      .attr("stroke", (d, i) =>
        i === 0 ? "#60a5fa" : actionColors.checkpoint || "#004d4d",
      )
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "8 4")
      .attr("opacity", 0.5);

    // Update checkpoint labels (in fixed position group)
    const { gLabels } = api;
    if (gLabels) {
      gLabels.selectAll("*").remove();
      const labelY = height - 20; // Fixed at bottom of viewport

      allLinePositions.forEach((xPos, i) => {
        // Transform x position to screen coordinates
        const screenX = xPos * currentTransform.k + currentTransform.x;

        // Only show if visible in viewport
        if (screenX >= -20 && screenX <= width + 20) {
          gLabels
            .append("text")
            .attr("class", "checkpoint-label")
            .attr("x", screenX)
            .attr("y", labelY)
            .attr("text-anchor", "middle")
            .attr(
              "fill",
              i === 0 ? "#60a5fa" : actionColors.checkpoint || "#004d4d",
            )
            .attr("font-size", "14px")
            .attr("font-weight", "bold")
            .text(i + 1);
        }
      });
    }

    // Draw nodes - clear and redraw with different shapes
    gNodes.selectAll("*").remove();

    // Helper to create triangle path
    const trianglePath = (x, y, r) => {
      const h = r * 1.5; // Height
      const w = r * 1.3; // Half-width
      return `M ${x - w} ${y + h * 0.5} L ${x + w} ${y + h * 0.5} L ${x} ${y - h * 0.6} Z`;
    };

    // Helper for node stroke based on selection, drop target, and validity flags
    const getNodeStroke = (d) => {
      if (deleteMode && deleteHoverNodeId === d.id) return "#ef4444";
      if (deleteMode && highlightedDeleteNodes.has(d.id)) return "#ef4444";
      if (dropTarget === d.id) return "#fbbf24"; // Yellow for drop target
      if (d.id === internalSelected) return "#000000";
      // Validity flag colors (priority order: unfixable > orderUnfixable > orderTBD/orderFixable > configFixable)
      if (d.unfixable || d.orderUnfixable) return "#ef4444"; // Red for unfixable
      if (d.orderTBD || d.orderFixable) return "#f97316"; // Orange for order issues
      if (d.configFixable) return "#ec4899"; // Pink for configFixable
      return "#ffffff";
    };
    const getNodeStrokeWidth = (d) => {
      if (deleteMode && deleteHoverNodeId === d.id) return 4;
      if (deleteMode && highlightedDeleteNodes.has(d.id)) return 3.5;
      if (dropTarget === d.id) return 4;
      if (d.id === internalSelected) return 3;
      // Validity flags get thicker stroke
      if (
        d.unfixable ||
        d.configFixable ||
        d.orderTBD ||
        d.orderFixable ||
        d.orderUnfixable
      )
        return 3;
      return 2;
    };
    const getNodeFill = (d) => {
      if (!deleteMode || !highlightedDeleteNodes.has(d.id)) return d.color;
      const mixed = d3.interpolateRgb(d.color || "#1f2937", "#ef4444")(0.32);
      return mixed;
    };
    const getDisplayNodeLabel = (d) => {
      const bundle = bundleInfo.get(d.id);
      if (bundle && bundle.bundleCount > 1) return String(bundle.bundleCount);
      return d.data?.nodeLabel || "";
    };
    const isBundleCountNode = (d) => {
      const bundle = bundleInfo.get(d.id);
      return !!bundle && bundle.bundleCount > 1;
    };
    // Helper for text fill color based on validity flags
    const getTextFill = (d) => {
      if (isBundleCountNode(d)) return "#ffffff";
      if (d.unfixable || d.orderUnfixable) return "#ef4444"; // Red for unfixable
      if (d.orderTBD || d.orderFixable) return "#f97316"; // Orange for order issues
      if (d.configFixable) return "#ec4899"; // Pink for configFixable
      return "#ffffff"; // Default white
    };
    const getNodeScale = (d) => {
      if (dropTarget === d.id) return 1.3; // Enlarge drop target
      if (dragState?.nodeId === d.id) return 0.9; // Slightly shrink dragged node
      return 1;
    };
    const getNodeCursor = (d) => {
      if (!deleteMode) return "pointer";
      return d.id === 0 ? "not-allowed" : "pointer";
    };
    // Helper for tooltip text (includes bundle count when collapsed)
    const getTooltip = (d) => {
      const bundle = bundleInfo.get(d.id);
      if (bundle && bundle.bundleCount > 1) {
        // Show bundle count + action type (use bundleType which normalizes adminAdjust group)
        const typeLabel = bundle.bundleType || d.actionType || "action";
        return `${bundle.bundleCount} ${typeLabel}`;
      }
      return d.data?.actionTooltip || "";
    };

    // Separate nodes by shape
    const circles = visibleNodesArr.filter((d) => d.shape === "circle");
    const squares = visibleNodesArr.filter((d) => d.shape === "square");
    const triangles = visibleNodesArr.filter((d) => d.shape === "triangle");

    // Draw circles with optional text labels or icons
    gNodes
      .selectAll("g.node-group")
      .data(circles, (d) => d.id)
      .join(
        (enter) => {
          const g = enter.append("g").attr("class", "node-group");
          g.append("circle")
            .attr("r", cfg.nodeRadius)
            .attr("fill", getNodeFill)
            .attr("stroke", getNodeStroke)
            .attr("stroke-width", getNodeStrokeWidth)
            .style("cursor", getNodeCursor);

          // Add text label if present
          g.filter((d) => !!getDisplayNodeLabel(d))
            .append("text")
            .attr("class", "node-label")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", getTextFill)
            .attr("font-size", (d) => (isBundleCountNode(d) ? "12px" : "9px"))
            .attr("font-weight", (d) => (isBundleCountNode(d) ? "900" : "bold"))
            .attr("paint-order", (d) => (isBundleCountNode(d) ? "stroke" : null))
            .attr("stroke", (d) => (isBundleCountNode(d) ? "#111827" : "none"))
            .attr("stroke-width", (d) => (isBundleCountNode(d) ? 0.9 : 0))
            .attr("pointer-events", "none")
            .text((d) => getDisplayNodeLabel(d));

          // Add icon if present (and no label)
          g.filter((d) => d.data?.nodeIcon && !getDisplayNodeLabel(d))
            .append("image")
            .attr("class", "node-icon")
            .attr("href", (d) => d.data?.nodeIcon || "")
            .attr("width", cfg.nodeRadius * 1.4)
            .attr("height", cfg.nodeRadius * 1.4)
            .attr("x", -cfg.nodeRadius * 0.7)
            .attr("y", -cfg.nodeRadius * 0.7)
            .attr("pointer-events", "none");

          g.append("title").text(getTooltip);
          return g;
        },
        (update) => {
          update
            .select("circle")
            .attr("fill", getNodeFill)
            .attr("stroke", getNodeStroke)
            .attr("stroke-width", getNodeStrokeWidth)
            .style("cursor", getNodeCursor);
          update
            .select("text.node-label")
            .text((d) => getDisplayNodeLabel(d))
            .attr("fill", getTextFill)
            .attr("font-size", (d) => (isBundleCountNode(d) ? "12px" : "9px"))
            .attr("font-weight", (d) => (isBundleCountNode(d) ? "900" : "bold"))
            .attr("paint-order", (d) => (isBundleCountNode(d) ? "stroke" : null))
            .attr("stroke", (d) => (isBundleCountNode(d) ? "#111827" : "none"))
            .attr("stroke-width", (d) => (isBundleCountNode(d) ? 0.9 : 0));
          update
            .select("image.node-icon")
            .attr("href", (d) => d.data?.nodeIcon || "");
          update.select("title").text(getTooltip);
          return update;
        },
      )
      .attr("data-node-id", (d) => d.id)
      .attr("transform", (d) => {
        const pos = positions.get(d.id);
        const scale = getNodeScale(d);
        return `translate(${pos?.x ?? 0}, ${pos?.y ?? 0}) scale(${scale})`;
      })
      .on("click", (event, d) => {
        // Don't handle click if we just finished dragging
        if (isDraggingRef.current) return;
        if (deleteMode) {
          event.preventDefault();
          event.stopPropagation();
          handleDeleteAction(d.id, false);
          return;
        }
        setInternalSelected(d.id);
        setSelectedEdge(null);
        setBranchPopup(null);
        onSelectNode?.(d.id);
      })
      .on("mouseenter", (_event, d) => {
        if (!deleteMode || d.id === 0) return;
        setDeleteHoverBranch(null);
        setDeleteHoverNodeId(d.id);
      })
      .on("mouseleave", (_event, d) => {
        if (!deleteMode) return;
        setDeleteHoverNodeId((prev) => (prev === d.id ? null : prev));
      })
      .on("mousedown", (event, d) => {
        if (deleteMode) return;
        // Start drag on mousedown (not click)
        if (event.button === 0 && d.id !== 0) {
          // Left click only, not root
          handleDragStart(d.id, event);
        }
      })
      .on("touchstart", (event, d) => {
        if (deleteMode) return;
        if (d.id !== 0) {
          handleDragStart(d.id, event);
        }
      });

    // Draw squares (rectangles) with optional icons for region unlocks
    const sqSize = cfg.nodeRadius * 1.6;
    gNodes
      .selectAll("g.square-group")
      .data(squares, (d) => d.id)
      .join(
        (enter) => {
          const g = enter.append("g").attr("class", "square-group");
          g.append("rect")
            .attr("width", sqSize)
            .attr("height", sqSize)
            .attr("x", -sqSize / 2)
            .attr("y", -sqSize / 2)
            .attr("rx", 2)
            .attr("fill", getNodeFill)
            .attr("stroke", getNodeStroke)
            .attr("stroke-width", getNodeStrokeWidth)
            .style("cursor", getNodeCursor);

          // Add icon if present (for region unlocks)
          g.filter((d) => d.data?.nodeIcon && !isBundleCountNode(d))
            .append("image")
            .attr("class", "node-icon")
            .attr("href", (d) => d.data?.nodeIcon || "")
            .attr("width", sqSize * 0.7)
            .attr("height", sqSize * 0.7)
            .attr("x", -sqSize * 0.35)
            .attr("y", -sqSize * 0.35)
            .attr("pointer-events", "none");

          g.filter(isBundleCountNode)
            .append("text")
            .attr("class", "node-label node-label-bundle-count")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", "#ffffff")
            .attr("font-size", "12px")
            .attr("font-weight", "900")
            .attr("paint-order", "stroke")
            .attr("stroke", "#111827")
            .attr("stroke-width", 0.9)
            .attr("pointer-events", "none")
            .text((d) => getDisplayNodeLabel(d));

          g.append("title").text(getTooltip);
          return g;
        },
        (update) => {
          update
            .select("rect")
            .attr("fill", getNodeFill)
            .attr("stroke", getNodeStroke)
            .attr("stroke-width", getNodeStrokeWidth)
            .style("cursor", getNodeCursor);
          update
            .select("image.node-icon")
            .attr("href", (d) => d.data?.nodeIcon || "");
          update.select("text.node-label").text((d) => getDisplayNodeLabel(d));
          update.select("title").text(getTooltip);
          return update;
        },
      )
      .attr("data-node-id", (d) => d.id)
      .attr("transform", (d) => {
        const pos = positions.get(d.id);
        const scale = getNodeScale(d);
        return `translate(${pos?.x ?? 0}, ${pos?.y ?? 0}) scale(${scale})`;
      })
      .on("click", (event, d) => {
        if (isDraggingRef.current) return;
        if (deleteMode) {
          event.preventDefault();
          event.stopPropagation();
          handleDeleteAction(d.id, false);
          return;
        }
        setInternalSelected(d.id);
        setSelectedEdge(null);
        setBranchPopup(null);
        onSelectNode?.(d.id);
      })
      .on("mouseenter", (_event, d) => {
        if (!deleteMode || d.id === 0) return;
        setDeleteHoverBranch(null);
        setDeleteHoverNodeId(d.id);
      })
      .on("mouseleave", (_event, d) => {
        if (!deleteMode) return;
        setDeleteHoverNodeId((prev) => (prev === d.id ? null : prev));
      })
      .on("mousedown", (event, d) => {
        if (deleteMode) return;
        if (event.button === 0 && d.id !== 0) {
          handleDragStart(d.id, event);
        }
      })
      .on("touchstart", (event, d) => {
        if (deleteMode) return;
        if (d.id !== 0) {
          handleDragStart(d.id, event);
        }
      });

    // Draw triangles (checkpoints)
    gNodes
      .selectAll("g.triangle-group")
      .data(triangles, (d) => d.id)
      .join(
        (enter) => {
          const g = enter.append("g").attr("class", "triangle-group");
          g.append("path")
            .attr("class", "triangle")
            .attr("d", trianglePath(0, 0, cfg.nodeRadius * 1.2))
            .attr("fill", getNodeFill)
            .attr("stroke", getNodeStroke)
            .attr("stroke-width", getNodeStrokeWidth)
            .style("cursor", getNodeCursor);
          g.filter(isBundleCountNode)
            .append("text")
            .attr("class", "node-label node-label-bundle-count")
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "central")
            .attr("fill", "#ffffff")
            .attr("font-size", "12px")
            .attr("font-weight", "900")
            .attr("paint-order", "stroke")
            .attr("stroke", "#111827")
            .attr("stroke-width", 0.9)
            .attr("pointer-events", "none")
            .text((d) => getDisplayNodeLabel(d));
          g.append("title").text(getTooltip);
          return g;
        },
        (update) => {
          update
            .select("path")
            .attr("fill", getNodeFill)
            .attr("stroke", getNodeStroke)
            .attr("stroke-width", getNodeStrokeWidth)
            .style("cursor", getNodeCursor);
          update.select("text.node-label").text((d) => getDisplayNodeLabel(d));
          update.select("title").text(getTooltip);
          return update;
        },
      )
      .attr("data-node-id", (d) => d.id)
      .attr("transform", (d) => {
        const pos = positions.get(d.id);
        const scale = getNodeScale(d);
        return `translate(${pos?.x ?? 0}, ${pos?.y ?? 0}) scale(${scale})`;
      })
      .on("click", (event, d) => {
        if (isDraggingRef.current) return;
        if (deleteMode) {
          event.preventDefault();
          event.stopPropagation();
          handleDeleteAction(d.id, false);
          return;
        }
        setInternalSelected(d.id);
        setSelectedEdge(null);
        setBranchPopup(null);
        onSelectNode?.(d.id);
      })
      .on("mouseenter", (_event, d) => {
        if (!deleteMode || d.id === 0) return;
        setDeleteHoverBranch(null);
        setDeleteHoverNodeId(d.id);
      })
      .on("mouseleave", (_event, d) => {
        if (!deleteMode) return;
        setDeleteHoverNodeId((prev) => (prev === d.id ? null : prev));
      })
      .on("mousedown", (event, d) => {
        if (deleteMode) return;
        if (event.button === 0 && d.id !== 0) {
          handleDragStart(d.id, event);
        }
      })
      .on("touchstart", (event, d) => {
        if (deleteMode) return;
        if (d.id !== 0) {
          handleDragStart(d.id, event);
        }
      });
  }, [
    internalNodes,
    activeLinks,
    activeNodeIds,
    internalSelected,
    branchFocusMode,
    selectedEdge,
    branchPopup,
    activeChildrenMap,
    nodeMap,
    bundleInfo,
    cfg,
    computeVisibility,
    computePositions,
    onSelectNode,
    width,
    height,
    currentTransform,
    actionColors,
    dropTarget,
    dragState,
    deleteMode,
    deleteHoverNodeId,
    deleteHoverBranch,
    collectSubtreeNodeIds,
    handleDeleteAction,
    handleDragStart,
  ]);

  // Navigation handlers
  const handleStepBack = useCallback(() => {
    setBranchPopup(null);
    const target = stepBackward(internalSelected);
    if (target != null) {
      setInternalSelected(target);
      setSelectedEdge(null);
      onSelectNode?.(target);
    }
  }, [internalSelected, stepBackward, onSelectNode]);

  const handleStepForward = useCallback(() => {
    const result = stepForward(internalSelected);
    if (result === null) return;

    if (typeof result === "object" && result.branch) {
      // Multiple branches - show popup
      setBranchPopup({
        parentId: result.parentId,
        children: result.children,
        selectedIndex: 0,
      });
      setSelectedEdge(null);
    } else {
      // Single child - navigate directly
      setBranchPopup(null);
      setInternalSelected(result);
      setSelectedEdge(null);
      onSelectNode?.(result);
    }
  }, [internalSelected, stepForward, onSelectNode]);

  const handleJumpPrevCheckpoint = useCallback(() => {
    setBranchPopup(null);
    const target = jumpToPrevCheckpoint(internalSelected);
    if (target != null) {
      setInternalSelected(target);
      setSelectedEdge(null);
      onSelectNode?.(target);
    }
  }, [internalSelected, jumpToPrevCheckpoint, onSelectNode]);

  const handleJumpNextCheckpoint = useCallback(() => {
    setBranchPopup(null);
    const target = jumpToNextCheckpoint(internalSelected);
    if (target != null) {
      setInternalSelected(target);
      setSelectedEdge(null);
      onSelectNode?.(target);
    }
  }, [internalSelected, jumpToNextCheckpoint, onSelectNode]);

  // Popup branch selection
  const handleSelectBranch = useCallback(
    (index) => {
      if (!branchPopup) return;
      const targetId = branchPopup.children[index]?.id;
      if (targetId != null) {
        setBranchPopup(null);
        setInternalSelected(targetId);
        setSelectedEdge(null);
        onSelectNode?.(targetId);
      }
    },
    [branchPopup, onSelectNode],
  );

  const handlePopupHover = useCallback(
    (index) => {
      if (!branchPopup) return;
      setBranchPopup((prev) =>
        prev ? { ...prev, selectedIndex: index } : null,
      );
    },
    [branchPopup],
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      if (deleteMode && e.key === "Escape") {
        e.preventDefault();
        clearDeleteHover();
        onDeleteModeChange?.(false);
        return;
      }

      const isShift = e.shiftKey;

      // If popup is open, handle popup navigation
      if (branchPopup) {
        if (e.key === "ArrowUp") {
          e.preventDefault();
          const newIdx = Math.max(0, branchPopup.selectedIndex - 1);
          setBranchPopup((prev) =>
            prev ? { ...prev, selectedIndex: newIdx } : null,
          );
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          const newIdx = Math.min(
            branchPopup.children.length - 1,
            branchPopup.selectedIndex + 1,
          );
          setBranchPopup((prev) =>
            prev ? { ...prev, selectedIndex: newIdx } : null,
          );
        } else if (e.key === " " || e.key === "ArrowRight") {
          e.preventDefault();
          handleSelectBranch(branchPopup.selectedIndex);
        } else if (e.key === "Escape" || e.key === "ArrowLeft") {
          e.preventDefault();
          setBranchPopup(null);
        }
        return;
      }

      // Regular navigation
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (isShift) {
          handleJumpPrevCheckpoint();
        } else {
          handleStepBack();
        }
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        if (isShift) {
          handleJumpNextCheckpoint();
        } else {
          handleStepForward();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    internalSelected,
    branchPopup,
    handleStepBack,
    handleStepForward,
    handleJumpPrevCheckpoint,
    handleJumpNextCheckpoint,
    handleSelectBranch,
    deleteMode,
    clearDeleteHover,
    onDeleteModeChange,
  ]);

  // Compute if current node is on main branch for Top button
  const currentOnMainBranch = useMemo(() => {
    return internalSelected ? isOnMainBranch(internalSelected) : true;
  }, [internalSelected, isOnMainBranch]);

  const displayedRelativeZoom = useMemo(() => {
    if (selectionFocusMode) return relativeZoom;
    const metrics = computeZoomMetrics();
    if (!metrics) return relativeZoom;
    return scaleToRelative(currentTransform.k, metrics.fitScale);
  }, [
    selectionFocusMode,
    relativeZoom,
    computeZoomMetrics,
    scaleToRelative,
    currentTransform.k,
  ]);

  useEffect(() => {
    onZoomLevelChange?.({
      relativeZoom: displayedRelativeZoom,
      selectionFocusMode,
    });
  }, [displayedRelativeZoom, onZoomLevelChange, selectionFocusMode]);

  const handleZoomSliderChange = useCallback(
    (event) => {
      const nextRelative = clamp(Number(event.target.value) / 100, 0, 1);
      if (selectionFocusMode) {
        setRelativeZoom(nextRelative);
        return;
      }

      const metrics = computeZoomMetrics();
      if (!metrics) return;

      const current = currentTransformRef.current;
      const nextScale = relativeToScale(nextRelative, metrics.fitScale);
      const centerX = width / 2;
      const centerY = height / 2;
      const worldX = (centerX - current.x) / current.k;
      const worldY = (centerY - current.y) / current.k;
      const nextX = centerX - worldX * nextScale;
      const nextY = centerY - worldY * nextScale;

      applyTransform(d3.zoomIdentity.translate(nextX, nextY).scale(nextScale));
    },
    [
      selectionFocusMode,
      computeZoomMetrics,
      relativeToScale,
      width,
      height,
      applyTransform,
    ],
  );

  const handleToggleSelectionFocusMode = useCallback(() => {
    if (selectionFocusMode) {
      setSelectionFocusMode(false);
      return;
    }

    const metrics = computeZoomMetrics();
    if (metrics) {
      const nextRelative = scaleToRelative(
        currentTransformRef.current.k,
        metrics.fitScale,
      );
      setRelativeZoom(nextRelative);
    }
    setSelectionFocusMode(true);
  }, [selectionFocusMode, computeZoomMetrics, scaleToRelative]);

  // Compatibility API for external callers.
  const handleZoomIn = useCallback(() => {
    setSelectionFocusMode(true);
    setRelativeZoom(1);
  }, []);

  // Compatibility API for external callers.
  const handleZoomOut = useCallback(() => {
    setSelectionFocusMode(true);
    setRelativeZoom(0);
  }, []);

  // Expose control methods via ref
  useImperativeHandle(
    ref,
    () => ({
      zoomIn: handleZoomIn,
      zoomOut: handleZoomOut,
      setFocusMode: (next) => setBranchFocusMode(!!next),
      setHorizontalCollapse: (next) => setHorizontalCollapse(!!next),
      setSelectionFocusMode: (next) => setSelectionFocusMode(!!next),
      toggleFocusMode: () => setBranchFocusMode((f) => !f),
      toggleHorizontalCollapse: () => setHorizontalCollapse((h) => !h),
      makeTop: () => onMakeTop?.(internalSelected),
      // State for toolbar
      get zoomedOut() {
        return displayedRelativeZoom <= 0.001;
      },
      get autoCenter() {
        return selectionFocusMode;
      },
      get focusMode() {
        return branchFocusMode;
      },
      get horizontalCollapse() {
        return horizontalCollapse;
      },
      get currentOnMainBranch() {
        return currentOnMainBranch;
      },
    }),
    [
      handleZoomIn,
      handleZoomOut,
      displayedRelativeZoom,
      selectionFocusMode,
      branchFocusMode,
      horizontalCollapse,
      currentOnMainBranch,
      onMakeTop,
      setBranchFocusMode,
      setHorizontalCollapse,
      setSelectionFocusMode,
      internalSelected,
    ],
  );

  // Compute fix button positions for fixable nodes (configFixable or orderFixable)
  const fixButtonNodes = useMemo(() => {
    const buttons = [];
    for (const node of internalNodes) {
      const pos = nodePositions.get(node.id);
      if (!pos) continue;

      // Transform tree coordinates to screen coordinates
      const screenX = pos.x * currentTransform.k + currentTransform.x;
      const screenY = pos.y * currentTransform.k + currentTransform.y;

      // Show Fix button for configFixable (pink) - no higher priority flags
      if (
        node.configFixable &&
        !node.unfixable &&
        !node.orderTBD &&
        !node.orderFixable &&
        !node.orderUnfixable
      ) {
        buttons.push({
          id: node.id,
          x: screenX,
          y: screenY,
          type: "config",
          deficits: node.deficits,
          color: "#ec4899", // Pink
        });
      }
      // Show Fix button for orderFixable (orange) - no higher priority flags
      else if (node.orderFixable && !node.unfixable && !node.orderUnfixable) {
        buttons.push({
          id: node.id,
          x: screenX,
          y: screenY,
          type: "order",
          fixedLayout: node.fixedLayout,
          layoutFixPlan: node.layoutFixPlan,
          color: "#f97316", // Orange
        });
      }
    }
    return buttons;
  }, [internalNodes, nodePositions, currentTransform]);

  return (
    <div
      className={`tree-visualizer${treeLocked ? " tutorial-zone-locked" : ""}${deleteMode ? " delete-mode" : ""}`}
    >
      {/* Tree canvas */}
      <div className="tree-canvas-wrapper" ref={containerRef}>
        <svg ref={svgRef} />

        {branchPopup && (
          <div className="branch-popup">
            <div className="branch-popup-title">Branch wählen:</div>
            <div className="branch-popup-buttons">
              {branchPopup.children.map((child, idx) => (
                <button
                  key={child.id}
                  className={`branch-popup-btn ${idx === branchPopup.selectedIndex ? "selected" : ""}`}
                  onClick={() => handleSelectBranch(idx)}
                  onMouseEnter={() => handlePopupHover(idx)}
                >
                  {idx}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fix buttons for fixable nodes */}
        {fixButtonNodes.map((btn) => (
          <button
            key={`fix-${btn.id}`}
            className="fix-node-btn"
            data-tutorial-zone="tree-fix-btn"
            style={{
              position: "absolute",
              left: btn.x,
              top: btn.y - 30, // Position above the node
              transform: "translateX(-50%)",
              background: btn.color,
              borderColor: btn.color,
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (btn.type === "config") {
                onFixNode?.(btn.id, { type: "config", deficits: btn.deficits });
              } else if (btn.type === "order") {
                onFixNode?.(btn.id, {
                  type: "order",
                  fixedLayout: btn.fixedLayout,
                  layoutFixPlan: btn.layoutFixPlan,
                });
              }
            }}
            title={
              btn.type === "config"
                ? "Config-Fix vorschlagen"
                : "Layout-Fix vorschlagen"
            }
          >
            Fix
          </button>
        ))}

        {/* Drag indicator - only show after threshold movement */}
        {dragState?.hasMoved && (
          <div
            className="drag-indicator"
            style={{
              left: dragState.currentX,
              top: dragState.currentY,
            }}
          >
            <div className="drag-indicator-node" />
            <div className="drag-indicator-label">
              {dropTarget !== null ? "Hier einfügen" : "Ziehe zu einem Knoten"}
            </div>
          </div>
        )}
      </div>

      <div className="tree-zoom-controls" data-tutorial-zone="tree-zoom-controls">
        <div className="tree-zoom-slider-row">
          <ZoomOut size={16} aria-hidden="true" />
          <input
            data-tutorial-zone="tree-zoom-slider"
            type="range"
            min="0"
            max="100"
            step="0.1"
            value={displayedRelativeZoom * 100}
            onInput={handleZoomSliderChange}
            className="tree-zoom-slider"
            aria-label="Tree zoom level"
            title="Zoomstufe"
          />
          <ZoomIn size={16} aria-hidden="true" />
        </div>
        <button
          className={`tree-focus-toggle ${selectionFocusMode ? "active" : ""}`}
          data-tutorial-zone="tree-node-focus-btn"
          onClick={handleToggleSelectionFocusMode}
          title={
            selectionFocusMode
              ? "Node-Fokus aktiv"
              : "Node-Fokus deaktiviert"
          }
          aria-label="Toggle node focus mode"
        >
          <Focus size={18} />
        </button>
      </div>
    </div>
  );
});
