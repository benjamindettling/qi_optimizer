// Auto-generated action log between checkpoints
import { useMemo } from "react";
import { useLang } from "../../context/LanguageContext";
import { getBuildingName } from "../../utils/buildingName";
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
const BOOST_HARVEST_TYPES = new Set(["boostReady", "harvest", ...HARVEST_ALL_TYPES]);

function resolveActionShortName(action, libraryMap, shortIdMap, lang) {
  const defId = action?.defId || (action?.shortId ? shortIdMap?.[action.shortId] : null);
  if (!defId || !libraryMap) return "?";
  const def = libraryMap[defId];
  return getBuildingName(def, lang, "short");
}

function getChainDescriptor(action, libraryMap, shortIdMap, lang) {
  if (!action) return null;
  const type = action.type || "";

  if (type === "build") {
    const shortName = resolveActionShortName(action, libraryMap, shortIdMap, lang);
    return {
      chainKind: "build",
      bucketKey: shortName,
      color: "green",
      textForCount: (count) => `+${count} ${shortName}`,
    };
  }

  if (type === "sell") {
    const shortName = resolveActionShortName(action, libraryMap, shortIdMap, lang);
    return {
      chainKind: "sell",
      bucketKey: shortName,
      color: "red",
      textForCount: (count) => `-${count} ${shortName}`,
    };
  }

  if (type === "boostUnlock") {
    const shortName = resolveActionShortName(action, libraryMap, shortIdMap, lang);
    return {
      chainKind: "unlock",
      bucketKey: shortName,
      color: "yellow",
      textForCount: (count) => `${count}x unlock ${shortName}`,
    };
  }

  if (BOOST_HARVEST_TYPES.has(type)) {
    const isBoost = type === "boostReady";
    const isHarvestAll = HARVEST_ALL_TYPES.has(type);
    const target = isHarvestAll
      ? "all"
      : resolveActionShortName(action, libraryMap, shortIdMap, lang);
    const op = isBoost ? "boost" : "harvest";
    return {
      chainKind: "boostHarvest",
      bucketKey: `${op}|${target}`,
      color: isBoost ? "yellow" : "harvest",
      textForCount: (count) => `${count}x ${op} ${target}`,
    };
  }

  return null;
}

function getPurchaseTotal(action) {
  if (
    action?.q &&
    typeof action.q === "object" &&
    !Array.isArray(action.q)
  ) {
    return Object.entries(action.q).reduce((sum, [amountRaw, countRaw]) => {
      const amount = Number(amountRaw);
      const count = Number(countRaw);
      if (!Number.isFinite(amount) || amount <= 0) return sum;
      if (!Number.isFinite(count) || count <= 0) return sum;
      return sum + amount * count;
    }, 0);
  }
  const quantity = Number(
    action?.quantity ?? action?.amount ?? action?.count ?? 0,
  );
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

/**
 * Format an action for display in the log
 * @returns {{ text: string, color: string } | null}
 */
function formatAction(action, libraryMap, shortIdMap, lang) {
  if (!action) return null;
  const type = action.type || "";

  // Skip ignored actions
  if (IGNORED_TYPES.has(type)) return null;

  // Build actions
  if (type === "build") {
    return { text: `+1 ${resolveActionShortName(action, libraryMap, shortIdMap, lang)}`, color: "green" };
  }

  // Sell actions
  if (type === "sell") {
    return { text: `-1 ${resolveActionShortName(action, libraryMap, shortIdMap, lang)}`, color: "red" };
  }

  // Boost unlock (unlock building)
  if (type === "boostUnlock") {
    return { text: `→ unlock ${resolveActionShortName(action, libraryMap, shortIdMap, lang)}`, color: "yellow" };
  }

  // Boost ready (finish production)
  if (type === "boostReady") {
    return { text: `→ boost ${resolveActionShortName(action, libraryMap, shortIdMap, lang)}`, color: "yellow" };
  }

  // Goods purchase
  if (type === "goodsPurchase") {
    const amount = getPurchaseTotal(action);
    const good = action.goodKey || action.key || action.good || "?";
    return { text: `+${amount} ${good}`, color: "turquoise" };
  }

  // Unit purchase
  if (type === "unitPurchase") {
    const amount = getPurchaseTotal(action);
    const unit = action.unitKey || action.key || action.unit || "?";
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
    } else if (method === "goods") {
      methodLabel = lang === "EN" ? "Goods" : "Güter";
    } else if (method === "shards") {
      methodLabel = lang === "EN" ? "Shards" : "Scherben";
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
    return { text: `→ harvest ${resolveActionShortName(action, libraryMap, shortIdMap, lang)}`, color: "yellow" };
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
  const { lang } = useLang();
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

    let pendingChain = null; // { kind, order: string[], buckets: Map<string, bucket> }
    const flushPendingChain = () => {
      if (!pendingChain) return;
      for (const key of pendingChain.order) {
        const bucket = pendingChain.buckets.get(key);
        if (!bucket) continue;
        logEntries.push({
          text: bucket.textForCount(bucket.count),
          color: bucket.color,
          nodeId: bucket.lastNodeId,
          isHighlighted: bucket.includesSelected,
        });
      }
      pendingChain = null;
    };

    // Format each action
    for (let i = 0; i < relevantNodeIds.length; i++) {
      const nodeId = relevantNodeIds[i];
      const node = nodes.get(nodeId);
      const descriptor = getChainDescriptor(
        node?.action,
        libraryMap,
        shortIdMap,
        lang,
      );
      if (descriptor) {
        if (!pendingChain || pendingChain.kind !== descriptor.chainKind) {
          flushPendingChain();
          pendingChain = {
            kind: descriptor.chainKind,
            order: [],
            buckets: new Map(),
          };
        }

        const existing = pendingChain.buckets.get(descriptor.bucketKey);
        if (existing) {
          existing.count += 1;
          existing.lastNodeId = nodeId;
          if (nodeId === selectedNodeId) existing.includesSelected = true;
        } else {
          pendingChain.order.push(descriptor.bucketKey);
          pendingChain.buckets.set(descriptor.bucketKey, {
            count: 1,
            color: descriptor.color,
            textForCount: descriptor.textForCount,
            lastNodeId: nodeId,
            includesSelected: nodeId === selectedNodeId,
          });
        }
        continue;
      }

      flushPendingChain();
      const formatted = formatAction(node.action, libraryMap, shortIdMap, lang);

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
    flushPendingChain();

    return logEntries;
  }, [historyTree, selectedNodeId, libraryMap, shortIdMap, lang]);

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
