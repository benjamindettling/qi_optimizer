// Hook for tree navigation logic shared between TreeVisualizer and NavigationPanel
import { useCallback, useMemo } from "react";

// Check if a node is a checkpoint (boostAll = "Ernte" action)
const isCheckpointAction = (node) => {
  if (!node) return false;
  // boostAll is the "Boost Alle" / "Ernte" action that creates checkpoints
  return node.actionType === "boostAll";
};

// Actions that should never be bundled
const NEVER_BUNDLE = new Set(["finishProductions"]);

// Admin adjust group - these can bundle together
const ADMIN_ADJUST_GROUP = new Set(["adminAdjust", "goodsCostAdmin", "shardsCostAdmin"]);

// Get the bundle key for an action type
const getBundleKey = (actionType) => {
  if (NEVER_BUNDLE.has(actionType)) return null;
  if (ADMIN_ADJUST_GROUP.has(actionType)) return "adminAdjust";
  return actionType;
};

export function useTreeNavigation(nodes, selectedId, onSelectNode, skipToEnd = true, horizontalCollapse = false) {
  // Build parent/children maps from nodes
  const { childrenMap, nodeMap, rootId } = useMemo(() => {
    const childrenMap = new Map();
    const nodeMap = new Map();
    let rootId = null;

    for (const node of nodes) {
      nodeMap.set(node.id, node);
      if (node.parentId != null) {
        if (!childrenMap.has(node.parentId)) {
          childrenMap.set(node.parentId, []);
        }
        childrenMap.get(node.parentId).push({ id: node.id });
      } else if (rootId == null) {
        rootId = node.id;
      }
    }

    return { childrenMap, nodeMap, rootId };
  }, [nodes]);

  const collapseModel = useMemo(() => {
    const bundleInfo = new Map();

    if (!horizontalCollapse) {
      for (const node of nodes) {
        bundleInfo.set(node.id, { isHidden: false });
      }
    } else {
      const processed = new Set();

      const processChain = (startId) => {
        let cur = startId;
        while (cur != null && !processed.has(cur)) {
          processed.add(cur);
          const curNode = nodeMap.get(cur);
          if (!curNode) break;

          const curBundleKey = getBundleKey(curNode.actionType);
          if (curBundleKey === null) {
            bundleInfo.set(cur, { isHidden: false });
            for (const kid of childrenMap.get(cur) ?? []) processChain(kid.id);
            cur = null;
            continue;
          }

          const chain = [cur];
          let walk = cur;
          while (true) {
            const kids = childrenMap.get(walk) ?? [];
            if (kids.length !== 1) break;
            const nextId = kids[0].id;
            const nextNode = nodeMap.get(nextId);
            if (!nextNode) break;
            if (getBundleKey(nextNode.actionType) !== curBundleKey) break;
            if (processed.has(nextId)) break;
            processed.add(nextId);
            chain.push(nextId);
            walk = nextId;
          }

          for (let i = 0; i < chain.length - 1; i++) {
            bundleInfo.set(chain[i], { isHidden: true });
          }
          bundleInfo.set(chain[chain.length - 1], { isHidden: false });

          for (const kid of childrenMap.get(chain[chain.length - 1]) ?? []) {
            processChain(kid.id);
          }
          cur = null;
        }
      };

      if (rootId != null) processChain(rootId);
      for (const node of nodes) {
        if (!bundleInfo.has(node.id)) bundleInfo.set(node.id, { isHidden: false });
      }
    }

    const resolveVisible = (id) => {
      if (!horizontalCollapse || id == null) return id;
      let cur = id;
      const seen = new Set();
      while (cur != null && bundleInfo.get(cur)?.isHidden) {
        if (seen.has(cur)) break;
        seen.add(cur);
        const kids = childrenMap.get(cur) ?? [];
        cur = kids.length > 0 ? kids[0].id : null;
      }
      return cur ?? id;
    };

    const activeChildrenMap = new Map();
    const activeParentMap = new Map();

    const visibleIds = new Set();
    for (const node of nodes) {
      if (!bundleInfo.get(node.id)?.isHidden) visibleIds.add(node.id);
    }

    for (const nodeId of visibleIds) {
      const rawKids = childrenMap.get(nodeId) ?? [];
      const kids = [];
      const seen = new Set();
      for (const k of rawKids) {
        const visibleKid = resolveVisible(k.id);
        if (visibleKid == null || visibleKid === nodeId || seen.has(visibleKid)) continue;
        seen.add(visibleKid);
        kids.push({ id: visibleKid });
      }
      if (kids.length > 0) {
        activeChildrenMap.set(nodeId, kids);
        for (const k of kids) activeParentMap.set(k.id, nodeId);
      }
    }

    const activeRootId = resolveVisible(rootId);

    return {
      resolveVisible,
      activeChildrenMap,
      activeParentMap,
      activeRootId,
    };
  }, [horizontalCollapse, nodes, nodeMap, childrenMap, rootId]);

  const { resolveVisible, activeChildrenMap, activeParentMap, activeRootId } = collapseModel;
  const activeSelectedId = resolveVisible(selectedId);

  // Step forward along main branch
  const stepForward = useCallback(() => {
    const kids = activeChildrenMap.get(activeSelectedId) ?? [];
    if (kids.length === 0) return;
    onSelectNode?.(kids[0].id);
  }, [activeChildrenMap, activeSelectedId, onSelectNode]);

  // Step backward
  const stepBackward = useCallback(() => {
    const parent = activeParentMap.get(activeSelectedId);
    if (parent == null) return;
    onSelectNode?.(parent);
  }, [activeParentMap, activeSelectedId, onSelectNode]);

// Outer left skip:
// - skipToEnd=true: checkpoint mode (jump across checkpoints)
// - skipToEnd=false: tree mode (jump to root)
const jumpToPrevCheckpoint = useCallback(() => {
    // Build path from root to current node
    const pathToNode = [];
    let cur = activeSelectedId;
    while (cur != null) {
      pathToNode.unshift(cur);
      cur = activeParentMap.get(cur);
    }

    if (pathToNode.length === 0) return;
    const currentIndex = pathToNode.length - 1;
    
    if (skipToEnd) {
      // Strategy: "Ende des Checkpoints"
      // Check current node first - if it's a checkpoint, go 1 left
      const currentNode = nodeMap.get(pathToNode[currentIndex]);
      if (isCheckpointAction(currentNode) && currentIndex > 0) {
        onSelectNode?.(pathToNode[currentIndex - 1]);
        return;
      }
      
      // Otherwise search backwards for checkpoint, then go 1 before it
      for (let i = currentIndex - 1; i >= 0; i--) {
        const n = nodeMap.get(pathToNode[i]);
        if (isCheckpointAction(n)) {
          // Found a checkpoint - jump to ONE BEFORE it (i-1), or to it if at start
          const targetIndex = i > 0 ? i - 1 : 0;
          onSelectNode?.(pathToNode[targetIndex]);
          return;
        }
      }
      
      // No checkpoint found - jump to start (root)
      onSelectNode?.(pathToNode[0] ?? activeRootId);
    } else {
      // Strategy: "Ende des Baums"
      // Always jump to the root of the current tree.
      onSelectNode?.(pathToNode[0] ?? activeRootId);
    }
  }, [activeSelectedId, activeParentMap, nodeMap, onSelectNode, skipToEnd, activeRootId]);

  // Outer right skip:
  // - skipToEnd=true: checkpoint mode (jump across checkpoints)
  // - skipToEnd=false: tree mode (walk first-child chain to branch end)
  const jumpToNextCheckpoint = useCallback(() => {
    const firstKids = activeChildrenMap.get(activeSelectedId) ?? [];
    if (firstKids.length === 0) return; // Already at end
    
    if (skipToEnd) {
      // Strategy: "Ende des Checkpoints"
      // Move 2 nodes first before checking for checkpoints
      let cur = firstKids[0].id;
      let prevId = activeSelectedId;
      const visited = new Set([activeSelectedId]);
      let stepsTaken = 1;
      
      while (cur != null && !visited.has(cur)) {
        visited.add(cur);
        const curNode = nodeMap.get(cur);
        
        // Only check for checkpoint after moving at least 2 nodes
        if (stepsTaken >= 2 && isCheckpointAction(curNode)) {
          // Found checkpoint - jump to node BEFORE it (prevId)
          onSelectNode?.(prevId);
          return;
        }
        
        const kids = activeChildrenMap.get(cur) ?? [];
        if (kids.length === 0) {
          // Reached end of branch without finding checkpoint - stay here
          onSelectNode?.(cur);
          return;
        }
        
        // Move to next node
        prevId = cur;
        cur = kids[0].id;
        stepsTaken++;
      }
      
      // Fallback - jump to last valid position
      onSelectNode?.(prevId);
    } else {
      // Strategy: "Ende des Baums"
      let cur = activeSelectedId;
      const visited = new Set();

      while (cur != null && !visited.has(cur)) {
        visited.add(cur);
        const kids = activeChildrenMap.get(cur) ?? [];
        if (kids.length === 0) {
          onSelectNode?.(cur);
          return;
        }
        cur = kids[0].id;
      }

      onSelectNode?.(activeSelectedId);
    }
  }, [activeSelectedId, activeChildrenMap, nodeMap, onSelectNode, skipToEnd]);

  return {
    stepForward,
    stepBackward,
    jumpToPrevCheckpoint,
    jumpToNextCheckpoint,
    hasParent: activeParentMap.has(activeSelectedId),
    hasChildren: (activeChildrenMap.get(activeSelectedId)?.length ?? 0) > 0,
  };
}
