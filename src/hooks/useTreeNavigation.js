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

// Check if two nodes can be bundled together
const canBundle = (node1, node2) => {
  if (!node1 || !node2) return false;
  const key1 = getBundleKey(node1.actionType);
  const key2 = getBundleKey(node2.actionType);
  return key1 !== null && key1 === key2;
};

export function useTreeNavigation(nodes, selectedId, onSelectNode, skipToEnd = true, horizontalCollapse = false) {
  // Build parent/children maps from nodes
  const { childrenMap, parentMap, nodeMap } = useMemo(() => {
    const childrenMap = new Map();
    const parentMap = new Map();
    const nodeMap = new Map();

    for (const node of nodes) {
      nodeMap.set(node.id, node);
      if (node.parentId != null) {
        parentMap.set(node.id, node.parentId);
        if (!childrenMap.has(node.parentId)) {
          childrenMap.set(node.parentId, []);
        }
        childrenMap.get(node.parentId).push({ id: node.id });
      }
    }

    return { childrenMap, parentMap, nodeMap };
  }, [nodes]);

  // Step forward along main branch (with optional bundle skipping)
  const stepForward = useCallback(() => {
    const kids = childrenMap.get(selectedId) ?? [];
    if (kids.length === 0) return;
    
    let targetId = kids[0].id;
    
    // If horizontal collapse is active, skip to end of bundle
    if (horizontalCollapse) {
      const currentNode = nodeMap.get(selectedId);
      let nextNode = nodeMap.get(targetId);
      
      // Keep moving forward while we can bundle
      while (nextNode && canBundle(currentNode, nextNode)) {
        const nextKids = childrenMap.get(targetId) ?? [];
        if (nextKids.length === 0) break;
        const nextNextNode = nodeMap.get(nextKids[0].id);
        if (!canBundle(currentNode, nextNextNode)) break;
        targetId = nextKids[0].id;
        nextNode = nextNextNode;
      }
    }
    
    onSelectNode?.(targetId);
  }, [childrenMap, selectedId, onSelectNode, horizontalCollapse, nodeMap]);

  // Step backward (with optional bundle skipping)
  const stepBackward = useCallback(() => {
    const parent = parentMap.get(selectedId);
    if (parent == null) return;
    
    let targetId = parent;
    
    // If horizontal collapse is active, skip to start of bundle
    if (horizontalCollapse) {
      const currentNode = nodeMap.get(selectedId);
      let parentNode = nodeMap.get(parent);
      
      // Keep moving backward while we can bundle
      while (parentNode && canBundle(currentNode, parentNode)) {
        const grandparent = parentMap.get(targetId);
        if (grandparent == null) break;
        const grandparentNode = nodeMap.get(grandparent);
        if (!canBundle(currentNode, grandparentNode)) break;
        targetId = grandparent;
        parentNode = grandparentNode;
      }
    }
    
    onSelectNode?.(targetId);
  }, [parentMap, selectedId, onSelectNode, horizontalCollapse, nodeMap]);

  // Jump to previous checkpoint (or start of branch if none)
  // skipToEnd=true (Ende des Checkpoints): Check current node first, if checkpoint go 1 left
  // skipToEnd=false (Anfang des Checkpoints): Find next checkpoint that's not current, stay there
  const jumpToPrevCheckpoint = useCallback(() => {
    // Build path from root to current node
    const pathToNode = [];
    let cur = selectedId;
    while (cur != null) {
      pathToNode.unshift(cur);
      cur = parentMap.get(cur);
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
      onSelectNode?.(pathToNode[0]);
    } else {
      // Strategy: "Anfang des Checkpoints"
      // Find previous checkpoint that's not the current node, stay exactly there
      for (let i = currentIndex - 1; i >= 0; i--) {
        const n = nodeMap.get(pathToNode[i]);
        if (isCheckpointAction(n)) {
          onSelectNode?.(pathToNode[i]);
          return;
        }
      }
      
      // No checkpoint found - jump to start (root)
      onSelectNode?.(pathToNode[0]);
    }
  }, [selectedId, parentMap, nodeMap, onSelectNode, skipToEnd]);

  // Jump to next checkpoint (or end of branch if none)
  // skipToEnd=true (Ende des Checkpoints): Move 2 nodes first, then check, land before checkpoint
  // skipToEnd=false (Anfang des Checkpoints): Find next checkpoint that's not current, stay there
  const jumpToNextCheckpoint = useCallback(() => {
    const firstKids = childrenMap.get(selectedId) ?? [];
    if (firstKids.length === 0) return; // Already at end
    
    if (skipToEnd) {
      // Strategy: "Ende des Checkpoints"
      // Move 2 nodes first before checking for checkpoints
      let cur = firstKids[0].id;
      let prevId = selectedId;
      let prevPrevId = selectedId;
      const visited = new Set([selectedId]);
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
        
        const kids = childrenMap.get(cur) ?? [];
        if (kids.length === 0) {
          // Reached end of branch without finding checkpoint - stay here
          onSelectNode?.(cur);
          return;
        }
        
        // Move to next node
        prevPrevId = prevId;
        prevId = cur;
        cur = kids[0].id;
        stepsTaken++;
      }
      
      // Fallback - jump to last valid position
      onSelectNode?.(prevId);
    } else {
      // Strategy: "Anfang des Checkpoints"
      // Find next checkpoint that's not the current node, stay exactly there
      let cur = firstKids[0].id;
      const visited = new Set([selectedId]);
      
      while (cur != null && !visited.has(cur)) {
        visited.add(cur);
        const curNode = nodeMap.get(cur);
        
        if (isCheckpointAction(curNode)) {
          // Found checkpoint - stay exactly there
          onSelectNode?.(cur);
          return;
        }
        
        const kids = childrenMap.get(cur) ?? [];
        if (kids.length === 0) {
          // Reached end of branch without finding checkpoint - stay here
          onSelectNode?.(cur);
          return;
        }
        
        cur = kids[0].id;
      }
    }
  }, [selectedId, childrenMap, nodeMap, onSelectNode, skipToEnd]);

  return {
    stepForward,
    stepBackward,
    jumpToPrevCheckpoint,
    jumpToNextCheckpoint,
    hasParent: parentMap.has(selectedId),
    hasChildren: (childrenMap.get(selectedId)?.length ?? 0) > 0,
  };
}
