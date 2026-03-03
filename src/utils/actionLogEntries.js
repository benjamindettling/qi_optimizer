import { getBuildingName } from "./buildingName";

const IGNORED_TYPES = new Set([
  "move",
  "adminAdjust",
  "goodsCostAdmin",
  "shardsCostAdmin",
  "regionLockAdmin",
  "buildAdmin",
  "sellAdmin",
  "sellFull",
  "boostUnlockAdmin",
  "boostReadyAdmin",
  "goodsPurchaseAdmin",
  "unitPurchaseAdmin",
  "regionUnlockAdmin",
]);

const CHECKPOINT_TYPES = new Set([
  "finishProductions",
  "finishProductionsAdmin",
]);
const HARVEST_ALL_TYPES = new Set(["harvestAll", "harvestAllAdmin"]);
const BOOST_HARVEST_TYPES = new Set([
  "boostReady",
  "harvest",
  ...HARVEST_ALL_TYPES,
]);

function resolveActionBuildingName(action, libraryMap, shortIdMap, lang) {
  const defId =
    action?.defId || (action?.shortId ? shortIdMap?.[action.shortId] : null);
  if (!defId || !libraryMap) return "?";
  const def = libraryMap[defId];
  return getBuildingName(def, lang, "name");
}

function resolveRegionMethodLabel(action, lang) {
  const type = action?.type || "";
  const method =
    action?.method ||
    (type === "regionUnlockGoods"
      ? "goods"
      : type === "regionUnlockShards"
        ? "shards"
        : "?");

  if (method === "goods" && action?.goodKey) {
    return action.goodKey;
  }
  if (method === "goods") {
    return lang === "EN" ? "Goods" : "Güter";
  }
  if (method === "shards") {
    return lang === "EN" ? "Shards" : "Scherben";
  }
  return method;
}

function formatRegionCount(count, methodLabel, lang) {
  if (lang === "EN") {
    return `+${count} ${count === 1 ? "Region" : "Regions"} (${methodLabel})`;
  }
  return `+${count} ${count === 1 ? "Region" : "Regionen"} (${methodLabel})`;
}

function getChainDescriptor(action, libraryMap, shortIdMap, lang) {
  if (!action) return null;
  const type = action.type || "";

  if (type === "build") {
    const buildingName = resolveActionBuildingName(
      action,
      libraryMap,
      shortIdMap,
      lang,
    );
    return {
      chainKind: "build",
      bucketKey: buildingName,
      color: "green",
      textForCount: (count) => `+${count} ${buildingName}`,
    };
  }

  if (type === "sell") {
    const buildingName = resolveActionBuildingName(
      action,
      libraryMap,
      shortIdMap,
      lang,
    );
    return {
      chainKind: "sell",
      bucketKey: buildingName,
      color: "red",
      textForCount: (count) => `-${count} ${buildingName}`,
    };
  }

  if (type === "boostUnlock") {
    const buildingName = resolveActionBuildingName(
      action,
      libraryMap,
      shortIdMap,
      lang,
    );
    return {
      chainKind: "unlock",
      bucketKey: buildingName,
      color: "yellow",
      textForCount: (count) => `${count}x unlock ${buildingName}`,
    };
  }

  if (
    type === "regionUnlock" ||
    type === "regionUnlockGoods" ||
    type === "regionUnlockShards"
  ) {
    const methodLabel = resolveRegionMethodLabel(action, lang);
    return {
      chainKind: "regionUnlock",
      bucketKey: methodLabel,
      color: "blue",
      textForCount: (count) => formatRegionCount(count, methodLabel, lang),
    };
  }

  if (BOOST_HARVEST_TYPES.has(type)) {
    const isBoost = type === "boostReady";
    const isHarvestAll = HARVEST_ALL_TYPES.has(type);
    const target = isHarvestAll
      ? lang === "EN"
        ? "all"
        : "alles"
      : resolveActionBuildingName(action, libraryMap, shortIdMap, lang);
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
  if (action?.q && typeof action.q === "object" && !Array.isArray(action.q)) {
    return Object.entries(action.q).reduce((sum, [amountRaw, countRaw]) => {
      const amount = Number(amountRaw);
      const count = Number(countRaw);
      if (!Number.isFinite(amount) || amount <= 0) return sum;
      if (!Number.isFinite(count) || count <= 0) return sum;
      return sum + amount * count;
    }, 0);
  }

  const quantity = Number(action?.quantity ?? action?.amount ?? action?.count ?? 0);
  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function formatAction(action, libraryMap, shortIdMap, lang) {
  if (!action) return null;
  const type = action.type || "";

  if (IGNORED_TYPES.has(type)) return null;

  if (type === "build") {
    return {
      text: `+1 ${resolveActionBuildingName(action, libraryMap, shortIdMap, lang)}`,
      color: "green",
    };
  }

  if (type === "sell") {
    return {
      text: `-1 ${resolveActionBuildingName(action, libraryMap, shortIdMap, lang)}`,
      color: "red",
    };
  }

  if (type === "boostUnlock") {
    return {
      text: `-> unlock ${resolveActionBuildingName(action, libraryMap, shortIdMap, lang)}`,
      color: "yellow",
    };
  }

  if (type === "boostReady") {
    return {
      text: `-> boost ${resolveActionBuildingName(action, libraryMap, shortIdMap, lang)}`,
      color: "yellow",
    };
  }

  if (type === "goodsPurchase") {
    const amount = getPurchaseTotal(action);
    const good = action.goodKey || action.key || action.good || "?";
    return { text: `+${amount} ${good}`, color: "turquoise" };
  }

  if (type === "unitPurchase") {
    const amount = getPurchaseTotal(action);
    const unit = action.unitKey || action.key || action.unit || "?";
    return { text: `+${amount} ${unit}`, color: "turquoise" };
  }

  if (HARVEST_ALL_TYPES.has(type)) {
    return {
      text: lang === "EN" ? "-> harvest all" : "-> alles einsammeln",
      color: "harvest",
    };
  }

  if (CHECKPOINT_TYPES.has(type)) {
    return {
      text: "-----------",
      color: "separator",
      isSeparator: true,
    };
  }

  if (type === "harvest") {
    return {
      text: `-> harvest ${resolveActionBuildingName(action, libraryMap, shortIdMap, lang)}`,
      color: "yellow",
    };
  }

  return null;
}

export function buildActionLogEntries({
  historyTree,
  selectedNodeId,
  libraryMap,
  shortIdMap,
  lang,
}) {
  if (!historyTree?.nodes) {
    return [];
  }

  const { nodes } = historyTree;
  const pathToSelected = [];
  let current = selectedNodeId;
  while (current !== null && current !== undefined) {
    pathToSelected.unshift(current);
    const node = nodes.get(current);
    if (!node) break;
    current = node.parentId;
  }

  const selectedNode = nodes.get(selectedNodeId);
  const selectedIsCheckpoint =
    selectedNode?.action && CHECKPOINT_TYPES.has(selectedNode.action.type);

  let startIdx = 0;
  for (let i = 0; i < pathToSelected.length; i += 1) {
    const nodeId = pathToSelected[i];
    if (nodeId === selectedNodeId) {
      if (selectedIsCheckpoint) {
        startIdx = i;
      }
      break;
    }
    const node = nodes.get(nodeId);
    if (node?.action && CHECKPOINT_TYPES.has(node.action.type)) {
      startIdx = i + 1;
    }
  }

  const forwardPath = [...pathToSelected];
  let lastNodeId = pathToSelected[pathToSelected.length - 1];
  let nextNode = nodes.get(lastNodeId);

  while (nextNode && nextNode.childrenIds.length > 0) {
    const nextId = nextNode.childrenIds[0];
    const child = nodes.get(nextId);
    if (!child) break;

    forwardPath.push(nextId);
    if (child.action && CHECKPOINT_TYPES.has(child.action.type)) {
      break;
    }
    nextNode = child;
  }

  const relevantNodeIds = [];
  for (let i = 0; i < forwardPath.length; i += 1) {
    const nodeId = forwardPath[i];
    const node = nodes.get(nodeId);
    if (!node?.action) continue;

    if (
      CHECKPOINT_TYPES.has(node.action.type) &&
      i > pathToSelected.indexOf(selectedNodeId)
    ) {
      break;
    }

    if (i >= startIdx) {
      relevantNodeIds.push(nodeId);
    }
  }

  const logEntries = [];
  let pendingChain = null;

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

  for (let i = 0; i < relevantNodeIds.length; i += 1) {
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
    const formatted = formatAction(node?.action, libraryMap, shortIdMap, lang);
    if (!formatted) continue;

    const formattedArray = Array.isArray(formatted) ? formatted : [formatted];
    for (const entry of formattedArray) {
      if (entry.isSeparator) continue;
      logEntries.push({
        ...entry,
        nodeId,
        isHighlighted: nodeId === selectedNodeId && !entry.isSubEntry,
      });
    }
  }
  flushPendingChain();

  return logEntries;
}
