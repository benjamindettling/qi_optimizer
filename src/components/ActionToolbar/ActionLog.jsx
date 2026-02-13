// Auto-generated action log between checkpoints
import { useMemo } from "react";
import "./ActionLog.css";

// Action types that should NOT appear in the log
const IGNORED_TYPES = new Set([
  "move",
  "adminAdjust",
  "goodsCostAdmin",
  "shardsCostAdmin",
  "regionLockAdmin",
  // Admin variants of actions
  "buildAdmin",
  "sellAdmin",
  "sellFull",
  "boostUnlockAdmin",
  "boostReadyAdmin",
  "goodsPurchaseAdmin",
  "unitPurchaseAdmin",
  "regionUnlockAdmin",
]);

// Checkpoint action types (finishProductions = separator)
const CHECKPOINT_TYPES = new Set(["finishProductions"]);

// Full harvest types (collect all)
const HARVEST_ALL_TYPES = new Set(["harvestAll", "harvestAllAdmin"]);

/**
 * Format an action for display in the log
 * @returns {{ text: string, color: string } | null}
 */
function formatAction(action, libraryMap, shortIdMap) {
  if (!action) return null;
  const type = action.type || "";

  // Skip ignored actions
  if (IGNORED_TYPES.has(type)) return null;

  // Resolve building definition if needed
  const resolveShortName = (act) => {
    const defId =
      act?.defId || (act?.shortId ? shortIdMap?.[act.shortId] : null);
    if (!defId || !libraryMap) return "?";
    const def = libraryMap[defId];
    return def?.short || def?.name || "?";
  };

  // Build actions
  if (type === "build") {
    return { text: `+1 ${resolveShortName(action)}`, color: "green" };
  }

  // Sell actions
  if (type === "sell") {
    return { text: `-1 ${resolveShortName(action)}`, color: "red" };
  }

  // Boost unlock (unlock building)
  if (type === "boostUnlock") {
    return { text: `→ unlock ${resolveShortName(action)}`, color: "yellow" };
  }

  // Boost ready (finish production)
  if (type === "boostReady") {
    return { text: `→ boost ${resolveShortName(action)}`, color: "yellow" };
  }

  // Goods purchase
  if (type === "goodsPurchase") {
    const amount = action.amount ?? action.count ?? 1;
    const good = action.goodKey || action.good || "?";
    return { text: `+${amount} ${good}`, color: "turquoise" };
  }

  // Unit purchase
  if (type === "unitPurchase") {
    const amount = action.amount ?? action.count ?? 1;
    const unit = action.unitKey || action.unit || "?";
    return { text: `+${amount} ${unit}`, color: "turquoise" };
  }

  // Region unlock
  if (
    type === "regionUnlock" ||
    type === "regionUnlockGoods" ||
    type === "regionUnlockShards"
  ) {
    const method =
      action.method ||
      (type === "regionUnlockGoods"
        ? "goods"
        : type === "regionUnlockShards"
          ? "shards"
          : "?");

    let methodLabel = method;
    if (method === "goods" && action.goodKey) {
      methodLabel = action.goodKey;
    } else if (method === "shards") {
      methodLabel = "Scherben";
    }

    // If fastbuy was used, show the purchase first
    const entries = [];
    if (action.fastBuyAmount && action.goodKey) {
      entries.push({
        text: `+${action.fastBuyAmount} ${action.goodKey}`,
        color: "turquoise",
        isSubEntry: true,
      });
    }
    entries.push({
      text: `+1 Region (${methodLabel})`,
      color: "blue",
    });
    return entries;
  }

  // Harvest all (collect all)
  if (HARVEST_ALL_TYPES.has(type)) {
    return { text: "→ Einsammeln", color: "harvest" };
  }

  // Finish productions (separator - skip from entries, handled separately)
  if (CHECKPOINT_TYPES.has(type)) {
    return { text: "───────────", color: "separator", isSeparator: true };
  }

  // Single harvest (not typically shown, but just in case)
  if (type === "harvest") {
    return { text: `→ harvest ${resolveShortName(action)}`, color: "yellow" };
  }

  return null;
}

/**
 * ActionLog - displays the actions between the previous and next checkpoints
 */
export function ActionLog({
  historyTree,
  selectedNodeId,
  libraryMap,
  shortIdMap,
}) {
  // Compute the log entries
  const entries = useMemo(() => {
    if (!historyTree?.nodes) {
      return [];
    }

    const { nodes } = historyTree;

    // Build path from root to selected node
    const pathToSelected = [];
    let current = selectedNodeId;
    while (current !== null && current !== undefined) {
      pathToSelected.unshift(current);
      const node = nodes.get(current);
      if (!node) break;
      current = node.parentId;
    }

    // Check if selected node is a checkpoint
    const selectedNode = nodes.get(selectedNodeId);
    const selectedIsCheckpoint =
      selectedNode?.action && CHECKPOINT_TYPES.has(selectedNode.action.type);

    // Find start: last finishProductions BEFORE selectedNodeId (exclusive)
    // If selected IS a checkpoint, start from selectedNodeId itself (show section after)
    let startIdx = 0;
    for (let i = 0; i < pathToSelected.length; i++) {
      const nodeId = pathToSelected[i];
      if (nodeId === selectedNodeId) {
        if (selectedIsCheckpoint) {
          // Start from selected checkpoint (show section after it)
          startIdx = i;
        }
        break;
      }
      const node = nodes.get(nodeId);
      if (node?.action && CHECKPOINT_TYPES.has(node.action.type)) {
        startIdx = i + 1; // Start AFTER the checkpoint
      }
    }

    // Find end: next finishProductions AFTER selectedNodeId (exclusive), or end of branch
    // For now, we follow the main branch (first child) forward
    let forwardPath = [...pathToSelected];
    let lastNodeId = pathToSelected[pathToSelected.length - 1];

    // Extend forward following first child until we hit a checkpoint or end
    let nextNode = nodes.get(lastNodeId);
    while (nextNode && nextNode.childrenIds.length > 0) {
      const nextId = nextNode.childrenIds[0]; // Follow first child (main branch)
      const child = nodes.get(nextId);
      if (!child) break;

      forwardPath.push(nextId);

      // Stop if this is a checkpoint
      if (child.action && CHECKPOINT_TYPES.has(child.action.type)) {
        break;
      }
      nextNode = child;
    }

    // Build entries from startIdx of pathToSelected to end of forwardPath
    const logEntries = [];

    // Determine which node IDs to include
    const relevantNodeIds = [];
    for (let i = startIdx; i < forwardPath.length; i++) {
      const nodeId = forwardPath[i];
      const node = nodes.get(nodeId);
      if (!node?.action) continue;

      // Stop if we hit a checkpoint that's after our selected node
      if (
        CHECKPOINT_TYPES.has(node.action.type) &&
        i > pathToSelected.indexOf(selectedNodeId)
      ) {
        break;
      }

      relevantNodeIds.push(nodeId);
    }

    // Format each action
    for (let i = 0; i < relevantNodeIds.length; i++) {
      const nodeId = relevantNodeIds[i];
      const node = nodes.get(nodeId);
      const formatted = formatAction(node.action, libraryMap, shortIdMap);

      if (!formatted) continue;

      // Handle arrays (like region unlock with fastbuy)
      const formattedArray = Array.isArray(formatted) ? formatted : [formatted];

      for (const entry of formattedArray) {
        if (entry.isSeparator) continue; // Skip separators in the middle

        logEntries.push({
          ...entry,
          nodeId,
          isHighlighted: nodeId === selectedNodeId && !entry.isSubEntry,
        });
      }
    }

    return logEntries;
  }, [historyTree, selectedNodeId, libraryMap, shortIdMap]);

  return (
    <div className="action-log-card">
      <label className="action-log-label">Log</label>
      <div className="action-log-list">
        {entries.length === 0 ? (
          <div className="action-log-empty">Keine Aktionen</div>
        ) : (
          entries.map((entry, idx) => (
            <div
              key={`${entry.nodeId}-${idx}`}
              className={`action-log-entry color-${entry.color}${entry.isHighlighted ? " highlighted" : ""}${entry.isSubEntry ? " sub-entry" : ""}`}
            >
              {entry.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
