import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

/**
 * RULE-BASED BRANCH BOARD (stable, no tangling)
 *
 * Key goals implemented:
 * 1) No "repel drift": when not dragging, nodes sit exactly on their targets (hard constraint).
 * 2) Baseline columns: without checkpoints, column = graph distance from root (depth).
 * 3) Checkpoints create global segment columns:
 *    - Root is checkpoint #1 (always).
 *    - On each path (branch), checkpoints are ordinal (2,3,4...) by encounter order from root.
 *    - For each checkpoint segment k->k+1 we compute a GLOBAL width based on the LONGEST branch
 *      in that segment. If a branch has no checkpoint k+1, we treat its "theoretical next node"
 *      as the checkpoint (effective length = nodes+1).
 *    - Shorter branches are then spaced more loosely (never tightened) to fit that global width:
 *      x = Xk + (offset / effectiveLenBranch) * segmentWidth
 *      - If branch has actual checkpoint k+1, that node lands on X(k+1).
 *      - If not, the theoretical next would land on X(k+1).
 *    - Recomputed automatically whenever nodes/checkpoints change; checkpoint ordinals shift naturally.
 *
 * 4) Rows are deterministic from ordered children: children[0] stays straight, others go downward.
 * 5) Interactions:
 *    - Add: if selected has no continuation, adds continuation in same row; else creates a fork row.
 *    - Checkpoint: toggles checkpoint on selected (root always).
 *    - Flag: toggles red border; descendants of any flagged node are greyed out.
 *    - Delete: deletes selected + subtree (root protected).
 *    - Drag+Drop near another node: pop-duplicate target subtree onto dropped node.
 *
 * Notes:
 * - We keep a D3 simulation only for DRAG wiggle. When not dragging, we hard-set x/y to targets each tick.
 * - Main edges stay straight; fork edges bend downward with elbows.
 */

export default function App() {
  const svgRef = useRef(null);
  const apiRef = useRef(null);

  const width = 1200;
  const height = 580;

  const nodesRef = useRef([]);
  const linksRef = useRef([]);
  const checkpointSetRef = useRef(new Set());
  const flaggedRef = useRef(new Set());

  const dragRef = useRef({
    draggingId: null,
    candidateTargetId: null,
    lastSwapAt: 0,
  });

  const cloneCounterRef = useRef(0);

  const cfg = useMemo(
    () => ({
      // Your parameters
      leftPadding: 10,
      depthSpacing: 50,

      // Rows
      rowSpacing: 34,
      topPadding: 48,

      // Checkpoint spacing unit (multiplies by computed segment length)
      unitX: 50,

      // Tail after last checkpoint segment
      tailUnitX: 50,

      // Drag / snap / animation
      mergeSnapDist: 70,
      popStepMs: 95,

      // Rendering
      nodeRadius: 10,

      // Drag wiggle sim
      velocityDecay: 0.6,
      collidePadding: 6,
    }),
    []
  );

  const [nodes, setNodes] = useState(() => [
    { id: "n0", x: cfg.leftPadding, y: height / 2, color: "#111827", branchId: "b0" },
  ]);

  // kind: 'cont' continuation on same row, 'fork' starts new row
  const [links, setLinks] = useState(() => []);
  const [selectedId, setSelectedId] = useState("n0");

  const [checkpointSet, setCheckpointSet] = useState(() => new Set(["n0"]));
  const [flagged, setFlagged] = useState(() => new Set());

  const [previewMerge, setPreviewMerge] = useState(null); // {sourceId,targetId}
  const [selectedEdge, setSelectedEdge] = useState(null); // {parentId, childIndex} when in edge selection mode
  const [focusMode, setFocusMode] = useState(true); // When true, hide non-relevant branches

  function setLinksNormalized(updater) {
    setLinks((prev) => {
      const normalizedPrev = normalizeChildOrders(prev).links;
      const base = typeof updater === "function" ? updater(normalizedPrev) : updater;
      if (!base) return normalizedPrev;
      return normalizeChildOrders(base).links;
    });
  }

  useEffect(() => {
    nodesRef.current = nodes;
    linksRef.current = links;
    checkpointSetRef.current = checkpointSet;
    flaggedRef.current = flagged;
  }, [nodes, links, checkpointSet, flagged]);

  // ---------- Helpers ----------
  function sourceId(l) {
    return typeof l.source === "string" ? l.source : l.source.id;
  }
  function targetId(l) {
    return typeof l.target === "string" ? l.target : l.target.id;
  }

  function parentLinksOnly(allLinks) {
    return allLinks.filter((l) => l.kind === "cont" || l.kind === "fork" || l.kind == null);
  }

  function buildOrderedChildEntries(linksArr) {
    const grouped = new Map();

    parentLinksOnly(linksArr).forEach((l, idx) => {
      const s = sourceId(l);
      const t = targetId(l);
      if (!grouped.has(s)) grouped.set(s, []);
      grouped.get(s).push({
        link: l,
        idx,
        id: t,
        rawOrder: Number.isFinite(l.order) ? l.order : null,
        rawKind: l.kind ?? "fork",
      });
    });

    const ordered = new Map();

    const compare = (a, b) => {
      if (a.rawOrder != null && b.rawOrder != null) return a.rawOrder - b.rawOrder;
      if (a.rawOrder != null) return -1;
      if (b.rawOrder != null) return 1;
      if (a.rawKind === "cont" && b.rawKind !== "cont") return -1;
      if (a.rawKind !== "cont" && b.rawKind === "cont") return 1;
      return a.idx - b.idx;
    };

    for (const [parentId, entries] of grouped.entries()) {
      const sorted = entries.slice().sort(compare);
      const withDerived = sorted.map((entry, order) => ({
        ...entry,
        order,
        kind: order === 0 ? "cont" : "fork",
      }));
      ordered.set(parentId, withDerived);
    }

    return ordered;
  }

  function buildChildrenMap(linksArr) {
    const ordered = buildOrderedChildEntries(linksArr);
    const children = new Map();
    for (const [parentId, entries] of ordered.entries()) {
      children.set(
        parentId,
        entries.map((e) => e.id)
      );
    }
    return children;
  }

  function buildChildLinkMap(linksArr) {
    const ordered = buildOrderedChildEntries(linksArr);
    const children = new Map();
    for (const [parentId, entries] of ordered.entries()) {
      children.set(
        parentId,
        entries.map((e) => ({ id: e.id, kind: e.kind, order: e.order, linkId: e.link.id }))
      );
    }
    return children;
  }

  function buildParentMap(linksArr) {
    const pm = new Map();
    for (const l of parentLinksOnly(linksArr)) pm.set(targetId(l), sourceId(l));
    pm.delete("n0");
    return pm;
  }

  function subtreeOf(nodeId, linksArr) {
    const children = buildChildrenMap(linksArr);
    const out = new Set([nodeId]);
    const st = [nodeId];
    while (st.length) {
      const cur = st.pop();
      for (const c of children.get(cur) ?? []) {
        if (!out.has(c)) {
          out.add(c);
          st.push(c);
        }
      }
    }
    return out;
  }

  function computeDepths(nodesArr, linksArr) {
    const children = buildChildrenMap(linksArr);
    const depth = new Map([["n0", 0]]);
    const q = ["n0"];
    while (q.length) {
      const cur = q.shift();
      const d = depth.get(cur) ?? 0;
      for (const c of children.get(cur) ?? []) {
        if (!depth.has(c)) {
          depth.set(c, d + 1);
          q.push(c);
        }
      }
    }
    for (const n of nodesArr) if (!depth.has(n.id)) depth.set(n.id, 0);
    return depth;
  }

  function computeGreyedSet(flaggedSet, linksArr) {
    if (!flaggedSet || flaggedSet.size === 0) return new Set();
    const greyed = new Set();
    for (const f of flaggedSet) {
      const sub = subtreeOf(f, linksArr);
      sub.delete(f);
      for (const id of sub) greyed.add(id);
    }
    return greyed;
  }

  function randomColor() {
    const h = Math.random() * 360;
    return `hsl(${h.toFixed(0)}, 70%, 45%)`;
  }

  function nextCloneId(origId) {
    cloneCounterRef.current += 1;
    return `${origId}_c${cloneCounterRef.current}`;
  }

  function normalizeChildOrders(linksArr) {
    const ordered = buildOrderedChildEntries(linksArr);
    const updates = new Map();

    for (const entries of ordered.values()) {
      entries.forEach((entry, order) => {
        const desiredKind = order === 0 ? "cont" : "fork";
        const desiredOrder = order;
        const linkId = entry.link.id;
        if (!linkId) return;
        if (entry.link.kind !== desiredKind || entry.link.order !== desiredOrder) {
          updates.set(linkId, { kind: desiredKind, order: desiredOrder });
        }
      });
    }

    if (updates.size === 0) return { links: linksArr, changed: false };

    const next = linksArr.map((l) => {
      const upd = updates.get(l.id);
      if (!upd) return l;
      return { ...l, kind: upd.kind, order: upd.order };
    });

    return { links: next, changed: true };
  }

  // Compute which nodes are visible and which hint-edges to show
  function computeVisibility(selectedNodeId, linksArr, isFocusMode) {
    if (!isFocusMode) {
      // Show everything
      return { visibleNodes: new Set(), hiddenEdgeHints: [], showAll: true };
    }

    const children = buildChildLinkMap(linksArr);
    const parent = buildParentMap(linksArr);
    const visible = new Set(["n0"]);
    const hiddenEdgeHints = []; // {parentId, type: 'hidden', hasAbove, hasBelow}

    // 1. Find the path from root to selected node
    const pathToSelected = [];
    let current = selectedNodeId;
    while (current) {
      pathToSelected.unshift(current);
      current = parent.get(current);
    }
    const pathSet = new Set(pathToSelected);

    // 2. Determine the child index at each step of the path
    const pathIndices = []; // [{nodeId, parentId, childIndex}]
    for (let i = 1; i < pathToSelected.length; i++) {
      const parentId = pathToSelected[i - 1];
      const nodeId = pathToSelected[i];
      const kids = children.get(parentId) ?? [];
      const idx = kids.findIndex(k => k.id === nodeId);
      pathIndices.push({ nodeId, parentId, childIndex: idx });
    }

    // 3. Main branch (all children[0]) is always visible
    function addMainBranch(startId) {
      let cur = startId;
      while (cur) {
        visible.add(cur);
        const kids = children.get(cur) ?? [];
        if (kids.length === 0) break;
        cur = kids[0].id; // Follow child[0]
      }
    }
    addMainBranch("n0");

    // 4. Add path to selected node
    for (const nodeId of pathToSelected) {
      visible.add(nodeId);
    }

    // 5. From selected node, follow main branch (children[0]) downward
    addMainBranch(selectedNodeId);

    // 6. Add all direct children of selected node (so user can see navigation options)
    const selectedKids = children.get(selectedNodeId) ?? [];
    for (const kid of selectedKids) {
      visible.add(kid.id);
    }

    // 7. Compute hidden edge hints along the path to selected node
    // For each node on the path that has hidden children, add a hint
    for (const step of pathIndices) {
      const { parentId, childIndex } = step;
      const kids = children.get(parentId) ?? [];
      
      // Check if there are hidden nodes above (index < childIndex, excluding main branch at 0)
      const hasHiddenAbove = childIndex > 1; // indices 1 to childIndex-1 are hidden
      
      // Check if there are hidden nodes below (index > childIndex)
      const hasHiddenBelow = childIndex < kids.length - 1;
      
      if (hasHiddenAbove || hasHiddenBelow) {
        hiddenEdgeHints.push({
          parentId,
          targetChildIndex: childIndex,
          hasAbove: hasHiddenAbove,
          hasBelow: hasHiddenBelow
        });
      }
    }

    // 8. Add hints along the main branch (for hidden siblings when on subbranch)
    function addMainBranchHints(startId) {
      let cur = startId;
      while (cur) {
        // Skip if this node is on the path to selected (already handled above)
        if (pathSet.has(cur)) {
          const kids = children.get(cur) ?? [];
          if (kids.length > 0) {
            cur = kids[0].id;
          } else {
            break;
          }
          continue;
        }
        
        const kids = children.get(cur) ?? [];
        if (kids.length > 1) {
          // Main branch continues at index 0, so hidden nodes are below (indices 1+)
          hiddenEdgeHints.push({
            parentId: cur,
            targetChildIndex: 0,
            hasAbove: false,
            hasBelow: true
          });
        }
        if (kids.length > 0) {
          cur = kids[0].id;
        } else {
          break;
        }
      }
    }
    addMainBranchHints("n0");

    // 9. From selected node downward, hint hidden siblings (on main branch continuation)
    function addDownwardHints(nodeId) {
      const kids = children.get(nodeId) ?? [];
      // If this is the selected node, all its children are visible, no hint needed here
      if (nodeId === selectedNodeId) {
        if (kids.length > 0) {
          addDownwardHints(kids[0].id);
        }
        return;
      }
      
      if (kids.length > 1) {
        hiddenEdgeHints.push({
          parentId: nodeId,
          targetChildIndex: 0,
          hasAbove: false,
          hasBelow: true
        });
      }
      if (kids.length > 0) {
        addDownwardHints(kids[0].id);
      }
    }
    addDownwardHints(selectedNodeId);

    return { visibleNodes: visible, hiddenEdgeHints, showAll: false };
  }

  function computeBranchCounts(childrenMap, visibleNodes, showAll) {
    const memo = new Map();

    function dfs(id) {
      if (memo.has(id)) return memo.get(id);
      const kids = childrenMap.get(id) ?? [];
      const visibleKids = showAll ? kids : kids.filter(k => visibleNodes.has(k.id));
      if (visibleKids.length === 0) {
        memo.set(id, 1);
        return 1;
      }
      let total = 0;
      for (const k of visibleKids) total += dfs(k.id);
      memo.set(id, total);
      return total;
    }

    dfs("n0");
    return memo;
  }

  function computeRowStarts(childrenMap, branchCounts, visibleNodes, showAll) {
    const starts = new Map();

    function dfs(id, startRow) {
      starts.set(id, startRow);
      let cursor = startRow;
      const kids = childrenMap.get(id) ?? [];
      const visibleKids = showAll ? kids : kids.filter(k => visibleNodes.has(k.id));
      for (const k of visibleKids) {
        const rows = branchCounts.get(k.id) ?? 1;
        dfs(k.id, cursor);
        cursor += rows;
      }
    }

    dfs("n0", 0);
    return starts;
  }

  function computeRowLayout(nodesArr, linksArr, visibleNodes, showAll) {
    const children = buildChildLinkMap(linksArr);
    const branchCounts = computeBranchCounts(children, visibleNodes, showAll);
    const rowStarts = computeRowStarts(children, branchCounts, visibleNodes, showAll);
    const totalRows = branchCounts.get("n0") ?? 1;

    for (const n of nodesArr) {
      if (!branchCounts.has(n.id)) branchCounts.set(n.id, 1);
      if (!rowStarts.has(n.id)) rowStarts.set(n.id, 0);
    }

    const childIndex = new Map();
    for (const [parentId, kids] of children.entries()) {
      kids.forEach((k, idx) => childIndex.set(`${parentId}|${k.id}`, idx));
    }

    return { children, branchCounts, rowStarts, totalRows, childIndex };
  }

  function rowY(rowIndex) {
    const i = rowIndex ?? 0;
    return cfg.topPadding + i * cfg.rowSpacing;
  }

  function nextChildOrderFor(parentId, linksArr) {
    const kids = buildChildLinkMap(linksArr).get(parentId) ?? [];
    return kids.length;
  }

  function getChildIndex(parentId, childId, linksArr) {
    const kids = buildChildLinkMap(linksArr).get(parentId) ?? [];
    return kids.findIndex((k) => k.id === childId);
  }

  function applyChildOrder(parentId, orderedChildIds, linksArr) {
    const current = buildChildLinkMap(linksArr).get(parentId) ?? [];
    if (current.length <= 1) return linksArr;

    const childToLink = new Map(current.map((k) => [k.id, k.linkId]));
    const remaining = current.map((k) => k.id).filter((id) => !orderedChildIds.includes(id));
    const fullOrder = [...orderedChildIds.filter((id) => childToLink.has(id)), ...remaining];

    const updates = new Map();
    fullOrder.forEach((id, order) => {
      const linkId = childToLink.get(id);
      if (!linkId) return;
      updates.set(linkId, { order, kind: order === 0 ? "cont" : "fork" });
    });

    if (updates.size === 0) return linksArr;

    return linksArr.map((l) => {
      const upd = updates.get(l.id);
      if (!upd) return l;
      if (l.order === upd.order && l.kind === upd.kind) return l;
      return { ...l, order: upd.order, kind: upd.kind };
    });
  }

  function rotateChildToFront(parentId, childId, linksArr) {
    const current = buildChildLinkMap(linksArr).get(parentId) ?? [];
    const idx = current.findIndex((k) => k.id === childId);
    if (idx <= 0) return linksArr;
    const orderedIds = [childId, ...current.filter((k) => k.id !== childId).map((k) => k.id)];
    return applyChildOrder(parentId, orderedIds, linksArr);
  }

  // ---------- Checkpoint ordinal on a PATH (root-to-node) ----------
  // Root is always ordinal 1.
  // A checkpoint node increases ordinal for itself and all descendants.
  function computeCheckpointOrdinal(depthMap, parentMap, checkpoints) {
    const ord = new Map();
    ord.set("n0", 1);

    // process nodes by increasing depth
    const nodesByDepth = Array.from(depthMap.entries())
      .sort((a, b) => a[1] - b[1])
      .map(([id]) => id);

    for (const id of nodesByDepth) {
      if (id === "n0") continue;
      const p = parentMap.get(id);
      const pOrd = ord.get(p) ?? 1;

      // If node is a checkpoint, it increments ordinal relative to parent.
      const myOrd = pOrd + (checkpoints.has(id) ? 1 : 0);
      ord.set(id, myOrd);
    }
    return ord;
  }

  // ---------- Segment lengths (global) ----------
  // For each segment k (from checkpoint ordinal k to k+1):
  // segmentLen[k] = max over ALL root-to-leaf paths of:
  // - if checkpoint k+1 occurs: number of edges to reach it
  // - else: number of edges to leaf + 1 (theoretical checkpoint)
  //
  // We compute over the FULL tree using DFS, independent of rows.
  function computeGlobalSegmentLens(childrenMap, depthMap, checkpoints) {
    const segLen = new Map(); // k -> maxEffectiveSteps
    const isCheckpoint = (id) => id === "n0" || checkpoints.has(id);

    function dfs(id, currentOrd, lastCheckpointDepth) {
      const kids = childrenMap.get(id) ?? [];
      const d = depthMap.get(id) ?? 0;

      // If id itself is a checkpoint (excluding root), ordinal has already been applied in ord computation.
      // For segment length computation, we detect checkpoint transitions on edges:
      // when moving to child that IS checkpoint, that closes segment currentOrd at distance = depth(child)-lastCheckpointDepth.
      // We'll handle this in recursion by looking at child.
      if (kids.length === 0) {
        // leaf: closes current segment with +1 theoretical
        const steps = (d - lastCheckpointDepth) + 1;
        const prev = segLen.get(currentOrd) ?? 0;
        segLen.set(currentOrd, Math.max(prev, steps));
        return;
      }

      for (const c of kids) {
        const cd = depthMap.get(c) ?? (d + 1);
        if (isCheckpoint(c) && c !== "n0") {
          // closes segment currentOrd at this checkpoint with exact steps
          const steps = cd - lastCheckpointDepth;
          const prev = segLen.get(currentOrd) ?? 0;
          segLen.set(currentOrd, Math.max(prev, steps));
          // next segment begins at child checkpoint
          dfs(c, currentOrd + 1, cd);
        } else {
          dfs(c, currentOrd, lastCheckpointDepth);
        }
      }
    }

    // root as checkpoint ordinal 1
    dfs("n0", 1, depthMap.get("n0") ?? 0);

    // Ensure at least 1 for every seen segment
    for (const [k, v] of segLen.entries()) {
      if (v < 1) segLen.set(k, 1);
    }
    return segLen;
  }

  // ---------- Per-node X mapping using global segment widths ----------
  // For each node, we compute:
  // - its checkpoint ordinal ord(node)
  // - its segment start checkpoint node is the nearest checkpoint ancestor with ordinal = ord(node) or ord(node)-1?
  //   We treat node as belonging to segment ord(node) where segment k goes from checkpoint k to k+1.
  //
  // But: nodes that are checkpoint themselves (ordinal increases at the node) must land exactly at X[ord(node)].
  //
  // To space "more loosely" in short branches, we scale within segment width based on
  // the BRANCH PATH effective length in that segment:
  // - if that path reaches a checkpoint (k+1): m = edges to that checkpoint
  // - else: m = edges to leaf + 1 theoretical
  //
  // We implement this by computing, for every node, the distance in edges from the last checkpoint ancestor
  // in the current segment, and also the effective segment length m for its path. To keep x unique,
  // we compute these values along the unique parent chain (tree) — that is consistent and deterministic.
  function computeColumnsAndTargets(nodesArr, linksArr, checkpoints, visibleNodes, hiddenEdgeHints, showAll) {
    const children = buildChildrenMap(linksArr);
    const parent = buildParentMap(linksArr);
    const depthMap = computeDepths(nodesArr, linksArr);
    const rowLayout = computeRowLayout(nodesArr, linksArr, visibleNodes, showAll);
    const { rowStarts } = rowLayout;

    const ord = computeCheckpointOrdinal(depthMap, parent, checkpoints);
    const maxOrd = Math.max(...Array.from(ord.values()));

    const segLen = computeGlobalSegmentLens(children, depthMap, checkpoints);

    // Build checkpoint columns X[1..maxOrd+1] (include tail)
    const X = new Map();
    X.set(1, cfg.leftPadding);
    for (let k = 1; k <= maxOrd; k++) {
      const prevX = X.get(k) ?? cfg.leftPadding;
      const len = segLen.get(k) ?? 1;
      X.set(k + 1, prevX + len * cfg.unitX);
    }

    // To compute per-node local effective length m for its current segment,
    // we need (for each node) the endpoint in this segment along its path:
    // the next checkpoint node (ordinal+1) if it exists in its descendant path, else leaf.
    //
    // We'll compute "nextCheckpointDist" by a DFS that returns, for each node:
    // - for each segment ordinal k (current), distance in edges to the next checkpoint (k+1) on SOME path
    //   is ambiguous when branching. To keep deterministic, we take the *maximum* along descendants,
    //   matching "longest branch drives spacing".
    //
    // Then, for a given node in segment k, its effective m is:
    // - if a checkpoint exists downstream in that segment: distToNextCheckpointFromStartCheckpoint
    // - else: distToLeafFromStartCheckpoint + 1
    //
    // For stability and simplicity, we compute m for each node as the global segLen[k],
    // BUT we still space nodes "more loosely" by mapping offset / localM where localM is:
    // - if node's path actually hits checkpoint k+1: localM = exact steps to it
    // - else: localM = steps to leaf + 1
    //
    // We'll compute exact localM per node by following ONE representative path: the path to the deepest endpoint
    // within that segment (again deterministic: choose child with maximum depth to next checkpoint/leaf).
    //
    // This aligns with your “longest branch determines width; shorter ones spread out” rule.

    // Helper: choose best child within same segment to define representative "end" for local scaling.
    // We prefer a child that stays in same segment (ord unchanged) and maximizes depth to segment end;
    // if a child is checkpoint (ord+1), that ends immediately.
    const isCheckpoint = (id) => id === "n0" || checkpoints.has(id);

    // Compute segment-end distance from a node within its current segment:
    // returns {stepsToEnd, endsAtCheckpoint} where:
    // - endsAtCheckpoint: true if a checkpoint (ord+1) exists along chosen path
    // - stepsToEnd: edges from this node to that end node (checkpoint or leaf)
    //
    // This is memoized.
    const endMemo = new Map();

    function segmentEndInfo(id) {
      const k = ord.get(id) ?? 1;
      const key = `${id}|${k}`;
      if (endMemo.has(key)) return endMemo.get(key);

      const kids = children.get(id) ?? [];
      if (kids.length === 0) {
        const res = { stepsToEnd: 0, endsAtCheckpoint: false, endType: "leaf" };
        endMemo.set(key, res);
        return res;
      }

      // If any child is a checkpoint (and therefore ord would increase), then this segment can end in 1 step.
      // But if there is also a longer same-segment path, we choose the longer one to reflect spacing rule.
      let best = { stepsToEnd: 0, endsAtCheckpoint: false, endType: "leaf" };

      for (const c of kids) {
        const cOrd = ord.get(c) ?? k;
        if (cOrd === k + 1 && isCheckpoint(c)) {
          // ends at checkpoint in 1 edge
          const cand = { stepsToEnd: 1, endsAtCheckpoint: true, endType: "checkpoint" };
          if (cand.stepsToEnd > best.stepsToEnd) best = cand;
        } else if (cOrd === k) {
          const sub = segmentEndInfo(c);
          const cand = { stepsToEnd: 1 + sub.stepsToEnd, endsAtCheckpoint: sub.endsAtCheckpoint, endType: sub.endType };
          if (cand.stepsToEnd > best.stepsToEnd) best = cand;
        } else {
          // child jumped more than 1 (shouldn't), ignore
        }
      }

      endMemo.set(key, best);
      return best;
    }

    // Now compute targets for every node:
    // - Y is derived from ordered children + branch counts.
    // - X uses segment scaling from last checkpoint anchor.
    const targets = new Map();

    // Find last checkpoint ancestor for each node and its anchor ordinal.
    const lastCpMemo = new Map();
    function lastCheckpointAncestor(id) {
      if (id === "n0") return { cpId: "n0", cpOrd: 1 };
      if (lastCpMemo.has(id)) return lastCpMemo.get(id);
      const p = parent.get(id);
      if (!p) {
        const res = { cpId: "n0", cpOrd: 1 };
        lastCpMemo.set(id, res);
        return res;
      }

      // If parent is checkpoint (or root), that's the last checkpoint for child unless child itself is checkpoint
      if (p === "n0" || checkpoints.has(p)) {
        const res = { cpId: p, cpOrd: ord.get(p) ?? 1 };
        lastCpMemo.set(id, res);
        return res;
      }
      const res = lastCheckpointAncestor(p);
      lastCpMemo.set(id, res);
      return res;
    }

    for (const n of nodesArr) {
      const rowIndex = rowStarts.get(n.id) ?? 0;
      const bY = rowY(rowIndex);

      if (n.id === "n0") {
        const rootRow = rowStarts.get("n0") ?? 0;
        targets.set("n0", { tx: X.get(1) ?? cfg.leftPadding, ty: rowY(rootRow) });
        continue;
      }

      const myOrd = ord.get(n.id) ?? 1;

      // If node itself is checkpoint, it lands exactly on its checkpoint column.
      if (checkpoints.has(n.id)) {
        targets.set(n.id, { tx: X.get(myOrd) ?? cfg.leftPadding, ty: bY });
        continue;
      }

      // Otherwise, node lies in segment myOrd (from checkpoint myOrd to myOrd+1).
      // Anchor at last checkpoint ancestor (cpOrd should be myOrd)
      const { cpId, cpOrd } = lastCheckpointAncestor(n.id);
      const anchorX = X.get(cpOrd) ?? cfg.leftPadding;
      const nextX = X.get(cpOrd + 1) ?? (anchorX + (segLen.get(cpOrd) ?? 1) * cfg.unitX);
      const segWidth = nextX - anchorX;

      const offsetEdges = (depthMap.get(n.id) ?? 0) - (depthMap.get(cpId) ?? 0);

      // Effective length for scaling: if this segment ends at checkpoint on this chosen path, m = steps to that checkpoint;
      // else m = steps to leaf + 1 (theoretical checkpoint).
      //
      // We approximate local effective length from anchor checkpoint, not from current node:
      // m = segmentEndInfo(cpId).stepsToEnd if endsAtCheckpoint else stepsToEnd+1
      // This makes spacing consistent for nodes in the same segment on that path.
      const endInfo = segmentEndInfo(cpId);
      const m = endInfo.endsAtCheckpoint ? Math.max(1, endInfo.stepsToEnd) : Math.max(1, endInfo.stepsToEnd + 1);

      const frac = Math.min(1, Math.max(0, offsetEdges / m));
      const tx = anchorX + frac * segWidth;

      targets.set(n.id, { tx, ty: bY });
    }

    return { targets, depthMap, ord, X, maxOrd, rowLayout };
  }

  // ---------- Pop-duplicate subtree ----------
  function popDuplicateSubtree({ attachFromId, targetStartId }) {
    const nodesNow = nodesRef.current;
    const linksNow = linksRef.current;
    const byId = new Map(nodesNow.map((n) => [n.id, n]));
    const attach = byId.get(attachFromId);
    const target = byId.get(targetStartId);
    if (!attach || !target) return;

    // Snapshot the original order so the cloned subtree preserves it.
    const baseLinks = normalizeChildOrders(linksNow).links;

    const orderedChildrenOrig = buildChildLinkMap(baseLinks);
    const origChildOrder = new Map();
    for (const [parentId, kids] of orderedChildrenOrig.entries()) {
      kids.forEach((k) => origChildOrder.set(`${parentId}|${k.id}`, k.order));
    }

    const q = [targetStartId];
    const origToClone = new Map();
    const origParentForClone = new Map();

    origParentForClone.set(targetStartId, attachFromId);

    const step = () => {
      const nodesCur = nodesRef.current;
      const byIdCur = new Map(nodesCur.map((n) => [n.id, n]));

      const origId = q.shift();
      if (!origId) return;

      const origNode = byIdCur.get(origId);
      if (!origNode) {
        if (q.length) window.setTimeout(step, cfg.popStepMs);
        return;
      }

      const cloneId = nextCloneId(origId);
      origToClone.set(origId, cloneId);

      const cloneNode = {
        id: cloneId,
        x: (origNode.x ?? 0) + 8,
        y: (origNode.y ?? 0) + 6,
        color: origNode.color,
        branchId: origNode.branchId ?? "b0",
      };

      const parentOrig = origParentForClone.get(origId);
      const parentCloneOrAttach = origToClone.get(parentOrig) ?? parentOrig;
      if (!parentCloneOrAttach) {
        if (q.length) window.setTimeout(step, cfg.popStepMs);
        return;
      }

      const linkId = `p_${parentCloneOrAttach}_${cloneId}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
      const baseLink = {
        id: linkId,
        source: parentCloneOrAttach,
        target: cloneId,
      };

      setNodes((prev) => [...prev, cloneNode]);
      setLinksNormalized((prev) => {
        let order = nextChildOrderFor(parentCloneOrAttach, prev);
        if (origId !== targetStartId && parentOrig) {
          order = origChildOrder.get(`${parentOrig}|${origId}`) ?? order;
        }
        const kind = order === 0 ? "cont" : "fork";
        return [...prev, { ...baseLink, kind, order }];
      });

      // enqueue children in original order
      const kids = orderedChildrenOrig.get(origId) ?? [];
      for (const c of kids) {
        q.push(c.id);
        origParentForClone.set(c.id, origId);
      }

      if (apiRef.current?.sim) apiRef.current.sim.alpha(0.35).restart();

      if (q.length) window.setTimeout(step, cfg.popStepMs);
    };

    step();
  }

  // ---------- D3 init ----------
  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.attr("viewBox", `0 0 ${width} ${height}`).style("user-select", "none");

    const gRoot = svg.append("g").attr("class", "root");
    const gCheckpoint = gRoot.append("g").attr("class", "checkpoints");
    const gLinks = gRoot.append("g").attr("class", "links");
    const gPreview = gRoot.append("g").attr("class", "preview");
    const gNodes = gRoot.append("g").attr("class", "nodes");

    svg.call(
      d3
        .zoom()
        .scaleExtent([0.4, 2.0])
        .on("zoom", (event) => gRoot.attr("transform", event.transform))
    );

    const targetsRef = { current: null };

    // Minimal sim: only used during drag for smoothness; otherwise we hard-set positions each tick.
    const sim = d3
      .forceSimulation()
      .velocityDecay(cfg.velocityDecay)
      .force(
        "collide",
        d3.forceCollide().radius(cfg.nodeRadius + cfg.collidePadding).strength(0.2)
      );

    apiRef.current = { svg, gRoot, gCheckpoint, gLinks, gPreview, gNodes, sim, targetsRef };

    return () => {
      sim.stop();
      svg.on(".zoom", null);
      svg.selectAll("*").remove();
    };
  }, [cfg, height, width]);

  // ---------- Update render + layout ----------
  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;

    const { sim, gCheckpoint, gLinks, gPreview, gNodes, targetsRef } = api;
    gLinks.selectAll("*").remove();

    // Compute visibility
    const { visibleNodes, hiddenEdgeHints, showAll } = computeVisibility(selectedId, links, focusMode);
    
    const { targets, depthMap, ord, X, maxOrd, rowLayout } = computeColumnsAndTargets(nodes, links, checkpointSet, visibleNodes, hiddenEdgeHints, showAll);
    targetsRef.current = { targets, depthMap, ord, X, maxOrd, rowLayout, visibleNodes, showAll };

    const greyed = computeGreyedSet(flagged, links);
    const childIndexOf = (l) => rowLayout.childIndex.get(`${sourceId(l)}|${targetId(l)}`) ?? 0;
    
    // Filter visible links
    const visibleLinks = showAll ? links : links.filter(l => {
      const s = sourceId(l);
      const t = targetId(l);
      return visibleNodes.has(s) && visibleNodes.has(t);
    });

    const linkPathFor = (l) => {
      const sId = sourceId(l);
      const tId = targetId(l);
      const sNode = nodesRef.current.find((n) => n.id === sId);
      const tNode = nodesRef.current.find((n) => n.id === tId);
      if (!sNode || !tNode) return "";

      const sx = sNode.x ?? 0;
      const sy = sNode.y ?? 0;
      const tx = tNode.x ?? 0;
      const ty = tNode.y ?? 0;
      const dx = tx - sx;
      const idx = childIndexOf(l);

      if (idx === 0 || Math.abs(ty - sy) < 0.5 || dx <= 0) {
        return `M ${sx} ${sy} L ${tx} ${ty}`;
      }

      const elbowOffset = Math.min(cfg.depthSpacing * 0.7, dx * 0.5);
      let elbowX = sx + Math.max(12, elbowOffset);
      elbowX = Math.min(elbowX, tx - 6);
      if (elbowX <= sx) elbowX = sx + dx * 0.5;

      return `M ${sx} ${sy} L ${elbowX} ${sy} L ${elbowX} ${ty} L ${tx} ${ty}`;
    };

    // ----- draw checkpoint vertical lines (1..maxOrd+1 to show tail boundary) -----
    const cpLines = [];
    for (let k = 1; k <= maxOrd + 1; k++) {
      cpLines.push({ k, x: X.get(k) ?? cfg.leftPadding });
    }

    const cpSel = gCheckpoint.selectAll("line").data(cpLines, (d) => d.k);
    cpSel
      .enter()
      .append("line")
      .attr("y1", -5000)
      .attr("y2", 5000)
      .attr("stroke", "#111827")
      .attr("stroke-width", 1)
      .attr("opacity", 0.45)
      .merge(cpSel)
      .attr("x1", (d) => d.x)
      .attr("x2", (d) => d.x);

    cpSel.exit().remove();

    // ----- links (sorted by render priority) -----
    // Sort links so important edges render on top: gray forks first, then gold main branch, then selected black
    const sortedLinks = [...visibleLinks].sort((a, b) => {
      const aIdx = childIndexOf(a);
      const bIdx = childIndexOf(b);
      const aSrc = sourceId(a);
      const bSrc = sourceId(b);
      const aTgt = targetId(a);
      const bTgt = targetId(b);
      
      // Check if selected
      const aIsSelected = selectedEdge && selectedEdge.parentId === aSrc && 
                         rowLayout.children.get(aSrc)?.[selectedEdge.childIndex]?.id === aTgt;
      const bIsSelected = selectedEdge && selectedEdge.parentId === bSrc && 
                         rowLayout.children.get(bSrc)?.[selectedEdge.childIndex]?.id === bTgt;
      
      if (aIsSelected && !bIsSelected) return 1; // Selected edges last (on top)
      if (!aIsSelected && bIsSelected) return -1;
      
      // Main branch (idx 0) renders after fork branches
      if (aIdx === 0 && bIdx !== 0) return 1;
      if (aIdx !== 0 && bIdx === 0) return -1;
      
      return 0; // Keep original order for same priority
    });
    
    const linkSel = gLinks.selectAll("path.edge").data(sortedLinks, (d) => d.id);
    linkSel
      .enter()
      .append("path")
      .attr("class", "edge")
      .attr("fill", "none")
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round")
      .merge(linkSel)
      .sort((a, b) => {
        // Re-sort DOM elements to ensure correct z-order
        const aIdx = childIndexOf(a);
        const bIdx = childIndexOf(b);
        const aSrc = sourceId(a);
        const bSrc = sourceId(b);
        const aTgt = targetId(a);
        const bTgt = targetId(b);
        
        const aIsSelected = selectedEdge && selectedEdge.parentId === aSrc && 
                           rowLayout.children.get(aSrc)?.[selectedEdge.childIndex]?.id === aTgt;
        const bIsSelected = selectedEdge && selectedEdge.parentId === bSrc && 
                           rowLayout.children.get(bSrc)?.[selectedEdge.childIndex]?.id === bTgt;
        
        if (aIsSelected && !bIsSelected) return 1;
        if (!aIsSelected && bIsSelected) return -1;
        if (aIdx === 0 && bIdx !== 0) return 1;
        if (aIdx !== 0 && bIdx === 0) return -1;
        return 0;
      })
      .merge(linkSel)
      .attr("stroke-width", (d) => {
        const idx = childIndexOf(d);
        const sId = sourceId(d);
        const tId = targetId(d);
        
        // Check if this edge is selected
        if (selectedEdge && selectedEdge.parentId === sId) {
          const kids = rowLayout.children.get(sId) ?? [];
          const selectedChild = kids[selectedEdge.childIndex];
          if (selectedChild && selectedChild.id === tId) {
            return 4; // Selected edge is thicker
          }
        }
        
        return idx === 0 ? 2 : 2.2;
      })
      .attr("stroke", (l) => {
        const s = sourceId(l);
        const t = targetId(l);
        const idx = childIndexOf(l);
        
        // Check if this edge is selected (highest priority)
        if (selectedEdge && selectedEdge.parentId === s) {
          const kids = rowLayout.children.get(s) ?? [];
          const selectedChild = kids[selectedEdge.childIndex];
          if (selectedChild && selectedChild.id === t) {
            return "#000000"; // Selected edge is black
          }
        }
        
        // Greyed out nodes (second priority)
        if (greyed.has(s) || greyed.has(t)) return "#cbd5e1";
        
        // Main branch gold (third priority)
        if (idx === 0) return "#fbbf24";
        
        // Other branches gray
        return "#9aa4b2";
      })
      .attr("d", linkPathFor);
    linkSel.exit().remove();

    // ----- Hidden edge hints (fading dashed lines) -----
    const children = buildChildLinkMap(links);
    const hintEdgeData = [];
    
    if (!showAll) {
      for (const hint of hiddenEdgeHints) {
        const parentNode = nodesRef.current.find(n => n.id === hint.parentId);
        if (!parentNode) continue;
        
        const parentTarget = targets.get(hint.parentId);
        if (!parentTarget) continue;
        
        const kids = children.get(hint.parentId) ?? [];
        const targetChildId = kids[hint.targetChildIndex]?.id;
        if (!targetChildId) continue;
        
        const targetTarget = targets.get(targetChildId);
        if (!targetTarget) continue;
        
        const sx = parentTarget.tx;
        const sy = parentTarget.ty;
        const tx = targetTarget.tx;
        const ty = targetTarget.ty;
        
        // Calculate elbow point (where the edge bends)
        const dx = tx - sx;
        const elbowOffset = Math.min(cfg.depthSpacing * 0.7, dx * 0.5);
        let elbowX = sx + Math.max(12, elbowOffset);
        elbowX = Math.min(elbowX, tx - 6);
        if (elbowX <= sx) elbowX = sx + dx * 0.5;
        
        // The hint line goes vertically from the middle of the edge
        const hintLen = cfg.rowSpacing * 0.5;
        
        if (hint.hasAbove) {
          // Vertical line going UP from the elbow point
          hintEdgeData.push({
            id: `hint_above_${hint.parentId}_${hint.targetChildIndex}`,
            x1: elbowX,
            y1: sy,
            x2: elbowX,
            y2: sy - hintLen
          });
        }
        
        if (hint.hasBelow) {
          // Vertical line going DOWN from the elbow point
          // Position it at the vertical section of the edge
          const hintY = hint.targetChildIndex === 0 ? sy : ty;
          hintEdgeData.push({
            id: `hint_below_${hint.parentId}_${hint.targetChildIndex}`,
            x1: elbowX,
            y1: hintY,
            x2: elbowX,
            y2: hintY + hintLen
          });
        }
      }
    }
    
    const hintSel = gLinks.selectAll("line.hint").data(hintEdgeData, d => d.id);
    hintSel
      .enter()
      .append("line")
      .attr("class", "hint")
      .attr("stroke-linecap", "round")
      .merge(hintSel)
      .attr("x1", d => d.x1)
      .attr("y1", d => d.y1)
      .attr("x2", d => d.x2)
      .attr("y2", d => d.y2)
      .attr("stroke", "#9aa4b2")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4 4")
      .attr("opacity", 0.6);
    hintSel.exit().remove();

    // ----- preview dashed line -----
    const prevData = previewMerge ? [previewMerge] : [];
    const prevSel = gPreview.selectAll("line").data(prevData);
    prevSel
      .enter()
      .append("line")
      .attr("stroke", "#475569")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "6 5")
      .attr("pointer-events", "none")
      .merge(prevSel);
    prevSel.exit().remove();

    // ----- nodes -----
    // Filter visible nodes
    const visibleNodesArr = showAll ? nodes : nodes.filter(n => visibleNodes.has(n.id));
    const nodeSel = gNodes.selectAll("circle").data(visibleNodesArr, (d) => d.id);

    const nodeEnter = nodeSel
      .enter()
      .append("circle")
      .attr("r", cfg.nodeRadius)
      .attr("stroke-width", 3)
      .style("cursor", "grab")
      .on("click", (_, d) => setSelectedId(d.id));

    nodeEnter.append("title");

    // update titles
    gNodes
      .selectAll("circle")
      .select("title")
      .text((d) => {
        const depth = depthMap.get(d.id) ?? 0;
        const branches = rowLayout.branchCounts.get(d.id) ?? 1;
        return `Distance from root: ${depth} | Branches: ${branches}`;
      });

    // drag behavior
    const drag = d3
      .drag()
      .on("start", (event, d) => {
        event.sourceEvent?.stopPropagation?.();
        dragRef.current.draggingId = d.id;
        dragRef.current.candidateTargetId = null;

        d.fx = d.x;
        d.fy = d.y;
        d3.select(event.sourceEvent?.target).style("cursor", "grabbing");
        sim.alpha(0.25).restart();
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;

        // snap candidate
        let best = { id: null, dist: Infinity };
        for (const n of nodesRef.current) {
          if (n.id === d.id) continue;
          const dx = (n.x ?? 0) - event.x;
          const dy = (n.y ?? 0) - event.y;
          const dist = Math.hypot(dx, dy);
          if (dist < best.dist) best = { id: n.id, dist };
        }

        if (best.id && best.dist <= cfg.mergeSnapDist) {
          dragRef.current.candidateTargetId = best.id;
          setPreviewMerge({ sourceId: d.id, targetId: best.id });
        } else {
          dragRef.current.candidateTargetId = null;
          setPreviewMerge(null);
        }

        sim.alpha(0.25).restart();
      })
      .on("end", (event, d) => {
        d.fx = null;
        d.fy = null;
        d3.select(event.sourceEvent?.target).style("cursor", "grab");

        const t = dragRef.current.candidateTargetId;

        setPreviewMerge(null);
        dragRef.current.draggingId = null;
        dragRef.current.candidateTargetId = null;

        if (t) popDuplicateSubtree({ attachFromId: d.id, targetStartId: t });

        sim.alpha(0.05).restart();
      });

    nodeEnter.call(drag);
    nodeSel.exit().remove();

    // styling
    gNodes
      .selectAll("circle")
      .attr("fill", (d) => (greyed.has(d.id) ? "#e5e7eb" : d.color ?? "#111827"))
      .attr("stroke", (d) => {
        if (greyed.has(d.id)) return "#d1d5db";
        if (d.id === selectedId) return "#000000";
        if (flagged.has(d.id)) return "#ef4444";
        return "#cbd5e1";
      })
      .attr("stroke-width", (d) => {
        if (d.id === selectedId) return 6;
        if (checkpointSet.has(d.id)) return 4;
        return 3;
      });

    // Sim tick: hard-set positions for non-dragging nodes to eliminate drift.
    sim.nodes(nodes);
    sim.on("tick", () => {
      const draggingId = dragRef.current.draggingId;

      for (const n of nodesRef.current) {
        const tt = targets.get(n.id);
        if (!tt) continue;

        if (n.id === draggingId) {
          // dragged node stays where user puts it (fx/fy)
          continue;
        }

        // If node is in dragged subtree, we still let it be pulled by sim slightly,
        // but we hard-snap it after release.
        // For simplicity and zero drift, we snap all non-dragged nodes each tick:
        n.x = tt.tx;
        n.y = tt.ty;
        n.vx = 0;
        n.vy = 0;
      }

      // update links
      gLinks.selectAll("path").attr("d", linkPathFor);

      // update preview
      gPreview
        .selectAll("line")
        .attr("x1", (p) => nodesRef.current.find((n) => n.id === p.sourceId)?.x ?? 0)
        .attr("y1", (p) => nodesRef.current.find((n) => n.id === p.sourceId)?.y ?? 0)
        .attr("x2", (p) => nodesRef.current.find((n) => n.id === p.targetId)?.x ?? 0)
        .attr("y2", (p) => nodesRef.current.find((n) => n.id === p.targetId)?.y ?? 0);

      // update nodes
      gNodes
        .selectAll("circle")
        .attr("cx", (n) => n.x ?? 0)
        .attr("cy", (n) => n.y ?? 0);
    });

    sim.alpha(0.06).restart();
  }, [nodes, links, checkpointSet, flagged, previewMerge, cfg, selectedId, selectedEdge, focusMode]);

  // ---------- UI actions ----------
  function addNode() {
    const nodesNow = nodesRef.current;
    const byId = new Map(nodesNow.map((n) => [n.id, n]));
    const parent = byId.get(selectedId);
    if (!parent) return;

    const newId = `n${nodesNow.length}_${Date.now()}`;
    const newNode = {
      id: newId,
      x: (parent.x ?? cfg.leftPadding) + 16,
      y: (parent.y ?? height / 2) + (Math.random() * 10 - 5),
      color: randomColor(),
      branchId: parent.branchId,
    };

    const linkId = `e_${parent.id}_${newId}_${Date.now()}`;
    const baseLink = {
      id: linkId,
      source: parent.id,
      target: newId,
    };

    setNodes((prev) => [...prev, newNode]);
    setLinksNormalized((prev) => {
      const order = nextChildOrderFor(parent.id, prev);
      const kind = order === 0 ? "cont" : "fork";
      return [...prev, { ...baseLink, kind, order }];
    });
    setSelectedId(newId);
  }

  function toggleCheckpointSelected() {
    const id = selectedId;
    if (id === "n0") return;
    setCheckpointSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      next.add("n0");
      return next;
    });
  }

  function toggleFlagSelected() {
    const id = selectedId;
    setFlagged((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function deleteSelected() {
    const id = selectedId;
    if (id === "n0") return;

    const linksNow = linksRef.current;
    const toDelete = subtreeOf(id, linksNow);

    // pick new selection: parent if exists else root
    const parent = buildParentMap(linksNow);
    const newSel = parent.get(id) ?? "n0";

    setNodes((prev) => prev.filter((n) => !toDelete.has(n.id)));
    setLinksNormalized((prev) => prev.filter((l) => !toDelete.has(sourceId(l)) && !toDelete.has(targetId(l))));

    setCheckpointSet((prev) => {
      const next = new Set(prev);
      for (const del of toDelete) next.delete(del);
      next.add("n0");
      return next;
    });

    setFlagged((prev) => {
      const next = new Set(prev);
      for (const del of toDelete) next.delete(del);
      return next;
    });

    setSelectedId(newSel);
  }

  function promoteSelectedUp() {
    if (selectedId === "n0") return;

    const linksNow = linksRef.current;
    const normalized = normalizeChildOrders(linksNow);
    let nextLinks = normalized.links;
    let changed = normalized.changed;

    const parentMap = buildParentMap(nextLinks);
    let currentId = selectedId;
    let parentId = parentMap.get(currentId);

    while (parentId) {
      const idx = getChildIndex(parentId, currentId, nextLinks);
      if (idx > 0) {
        nextLinks = rotateChildToFront(parentId, currentId, nextLinks);
        changed = true;
        break;
      }
      currentId = parentId;
      parentId = parentMap.get(currentId);
    }

    if (changed) setLinks(nextLinks);
  }

  function promoteSelectedTop() {
    if (selectedId === "n0") return;

    const linksNow = linksRef.current;
    const normalized = normalizeChildOrders(linksNow);
    let nextLinks = normalized.links;
    let changed = normalized.changed;

    const parentMap = buildParentMap(nextLinks);
    let currentId = selectedId;
    let parentId = parentMap.get(currentId);

    while (parentId) {
      const idx = getChildIndex(parentId, currentId, nextLinks);
      if (idx > 0) {
        nextLinks = rotateChildToFront(parentId, currentId, nextLinks);
        changed = true;
      }
      currentId = parentId;
      parentId = parentMap.get(currentId);
    }

    if (changed) setLinks(nextLinks);
  }

  const canDelete = selectedId !== "n0";
  const isCheckpoint = selectedId === "n0" || checkpointSet.has(selectedId);
  const canPromote = selectedId !== "n0";

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const linksNow = linksRef.current;
      const children = buildChildLinkMap(linksNow);
      const parent = buildParentMap(linksNow);
      const kids = children.get(selectedId) ?? [];

      if (e.key === 'ArrowLeft') {
        // Go to parent node
        e.preventDefault();
        const parentId = parent.get(selectedId);
        if (parentId) {
          setSelectedId(parentId);
          setSelectedEdge(null);
        }
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (selectedEdge) {
          // Follow the selected edge to the child
          const targetChild = kids[selectedEdge.childIndex];
          if (targetChild) {
            setSelectedId(targetChild.id);
            setSelectedEdge(null);
          }
        } else {
          // Enter edge selection mode or go directly to child
          if (kids.length === 0) {
            // No children, do nothing
          } else if (kids.length === 1) {
            // Only one child, go directly
            setSelectedId(kids[0].id);
            setSelectedEdge(null);
          } else {
            // Multiple children, select edge to child 0 (main branch)
            setSelectedEdge({ parentId: selectedId, childIndex: 0 });
          }
        }
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        // Navigate between edges in edge selection mode
        if (selectedEdge && kids.length > 1) {
          e.preventDefault();
          const currentIndex = selectedEdge.childIndex;
          let newIndex;
          
          if (e.key === 'ArrowUp') {
            newIndex = currentIndex - 1;
            if (newIndex < 0) newIndex = kids.length - 1; // Wrap to bottom
          } else {
            newIndex = currentIndex + 1;
            if (newIndex >= kids.length) newIndex = 0; // Wrap to top
          }
          
          setSelectedEdge({ parentId: selectedId, childIndex: newIndex });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, selectedEdge]);

  return (
    <div style={{ fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <button
          onClick={() => setFocusMode(prev => !prev)}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: focusMode ? "1px solid #0284c7" : "1px solid #cbd5e1",
            background: focusMode ? "#e0f2fe" : "#ffffff",
            cursor: "pointer",
            fontWeight: 700,
            color: focusMode ? "#0369a1" : "#334155",
          }}
          title="Toggle focus mode - hide non-relevant branches"
        >
          {focusMode ? "Focus ✓" : "Focus"}
        </button>

        <button
          onClick={addNode}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            cursor: "pointer",
            fontWeight: 700,
          }}
        >
          Add
        </button>

        <button
          onClick={promoteSelectedUp}
          disabled={!canPromote}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: canPromote ? "1px solid #0f172a" : "1px solid #e5e7eb",
            background: canPromote ? "#e2e8f0" : "#f3f4f6",
            cursor: canPromote ? "pointer" : "not-allowed",
            fontWeight: 800,
            color: canPromote ? "#0f172a" : "#9ca3af",
            opacity: canPromote ? 1 : 0.7,
          }}
          title={canPromote ? "Promote selected branch by one level" : "Root cannot be promoted"}
        >
          Up
        </button>

        <button
          onClick={promoteSelectedTop}
          disabled={!canPromote}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: canPromote ? "1px solid #0f172a" : "1px solid #e5e7eb",
            background: canPromote ? "#cbd5e1" : "#f3f4f6",
            cursor: canPromote ? "pointer" : "not-allowed",
            fontWeight: 900,
            color: canPromote ? "#0f172a" : "#9ca3af",
            opacity: canPromote ? 1 : 0.7,
          }}
          title={canPromote ? "Promote selected branch to the top" : "Root cannot be promoted"}
        >
          Top
        </button>

        <button
          onClick={toggleCheckpointSelected}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #a16207",
            background: "#fef08a",
            cursor: selectedId === "n0" ? "not-allowed" : "pointer",
            fontWeight: 800,
            color: "#713f12",
            opacity: selectedId === "n0" ? 0.55 : 1,
          }}
          title={selectedId === "n0" ? "Root is always checkpoint #1" : "Toggle checkpoint"}
        >
          {isCheckpoint ? "Checkpoint ✓" : "Checkpoint"}
        </button>

        <button
          onClick={toggleFlagSelected}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #ef4444",
            background: "#fee2e2",
            cursor: "pointer",
            fontWeight: 800,
            color: "#991b1b",
          }}
        >
          {flagged.has(selectedId) ? "Unflag" : "Flag"}
        </button>

        <button
          onClick={deleteSelected}
          disabled={!canDelete}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: canDelete ? "1px solid #b91c1c" : "1px solid #e5e7eb",
            background: canDelete ? "#fee2e2" : "#f3f4f6",
            cursor: canDelete ? "pointer" : "not-allowed",
            fontWeight: 900,
            color: canDelete ? "#7f1d1d" : "#9ca3af",
          }}
          title={canDelete ? "Delete selected node and its subtree" : "Root cannot be deleted"}
        >
          Delete
        </button>

        <div style={{ color: "#334155", fontSize: 14 }}>
          Selected: <span style={{ fontWeight: 800 }}>{selectedId}</span>
          <span style={{ marginLeft: 10, color: "#64748b" }}>
            (Rows come from children order and branch counts. Hover for depth and branches.)
          </span>
        </div>
      </div>

      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          overflow: "hidden",
          background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
        }}
      >
        <svg ref={svgRef} width="100%" height={height} />
      </div>
    </div>
  );
}
