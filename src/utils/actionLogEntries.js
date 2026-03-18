import { REGION_GOODS_COSTS, REGION_SHARD_COSTS } from "../config/boardConfig";
import {
  getBoostCostForTier,
  getUnlockCostForTier,
} from "../config/buildingTiers";
import { T } from "../i18n/translations";
import { getBuildingName } from "./buildingName";
import { formatNumber } from "./formatNumber";

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
const HARVEST_TYPES = new Set(["harvest", ...HARVEST_ALL_TYPES]);
const BOOST_UNLOCK_TYPES = new Set(["boostUnlock", "boostUnlockAdmin"]);
const BOOST_READY_TYPES = new Set(["boostReady", "boostReadyAdmin"]);
const REGION_UNLOCK_GOODS_TYPES = new Set(["regionUnlockGoods"]);
const REGION_UNLOCK_SHARD_TYPES = new Set(["regionUnlockShards"]);

const getTranslator = (lang) => (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

function resolveActionDef(action, libraryMap, shortIdMap) {
  const defId =
    action?.defId || (action?.shortId ? shortIdMap?.[action.shortId] : null);
  if (!defId || !libraryMap) return null;
  return libraryMap[defId] ?? null;
}

function resolveActionBuildingName(action, libraryMap, shortIdMap, lang) {
  const def = resolveActionDef(action, libraryMap, shortIdMap);
  return def ? getBuildingName(def, lang, "name") : "?";
}

function resolveRegionMethodLabel(action, lang, t) {
  const type = action?.type || "";
  const method =
    action?.method ||
    (REGION_UNLOCK_GOODS_TYPES.has(type)
      ? "goods"
      : REGION_UNLOCK_SHARD_TYPES.has(type)
        ? "shards"
        : "?");

  if (method === "goods" && action?.goodKey) {
    return action.goodKey;
  }
  if (method === "goods") {
    return t("logGoodsLabel");
  }
  if (method === "shards") {
    return t("resourceShards");
  }
  return method;
}

function formatAmountLabel(value, unitLabel) {
  if (
    value === Infinity ||
    value === "Infinity" ||
    value === Number.POSITIVE_INFINITY
  ) {
    return `[Infinity ${unitLabel}]`;
  }
  return `[${formatNumber(value)} ${unitLabel}]`;
}

function formatRegionCount(count, methodLabel, lang, t) {
  const regionLabel =
    count === 1 ? t("logRegionSingular") : t("logRegionPlural");
  return `+${count} ${regionLabel} (${methodLabel})`;
}

function getActionCostMeta(action, libraryMap, shortIdMap, lang, counters, t) {
  const type = action?.type || "";

  if (REGION_UNLOCK_GOODS_TYPES.has(type)) {
    const costIndex = Math.min(
      counters.goodsUnlocks,
      REGION_GOODS_COSTS.length - 1,
    );
    const value = REGION_GOODS_COSTS[costIndex];
    const unitLabel = resolveRegionMethodLabel(action, lang, t);
    counters.goodsUnlocks += 1;
    return { value, unitLabel };
  }

  if (REGION_UNLOCK_SHARD_TYPES.has(type)) {
    const costIndex = Math.min(
      counters.shardUnlocks,
      REGION_SHARD_COSTS.length - 1,
    );
    const value = REGION_SHARD_COSTS[costIndex];
    counters.shardUnlocks += 1;
    return { value, unitLabel: t("resourceShards") };
  }

  if (BOOST_UNLOCK_TYPES.has(type)) {
    const def = resolveActionDef(action, libraryMap, shortIdMap);
    return {
      value: getUnlockCostForTier(def?.tier),
      unitLabel: t("resourceShards"),
    };
  }

  if (BOOST_READY_TYPES.has(type)) {
    const def = resolveActionDef(action, libraryMap, shortIdMap);
    return {
      value: getBoostCostForTier(def?.tier),
      unitLabel: t("resourceShards"),
    };
  }

  return null;
}

function getChainDescriptor(action, meta, libraryMap, shortIdMap, lang, t) {
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
      chainKind: "buildSell",
      actionKind: "build",
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
      chainKind: "buildSell",
      actionKind: "sell",
      bucketKey: buildingName,
      color: "red",
      textForCount: (count) => `-${count} ${buildingName}`,
    };
  }

  if (type === "boostUnlock" || type === "boostReady") {
    const buildingName = resolveActionBuildingName(
      action,
      libraryMap,
      shortIdMap,
      lang,
    );
    const amountSuffix = meta?.unitLabel
      ? ` ${formatAmountLabel(meta.value, meta.unitLabel)}`
      : "";
    return {
      chainKind: "boostHarvest",
      actionKind: "boost",
      bucketKey: buildingName,
      color: "yellow",
      addCost: true,
      textForCount: (count, totalCost) =>
        `${count}x ${t("logBoostAction")} ${buildingName}${
          totalCost?.unitLabel
            ? ` ${formatAmountLabel(totalCost.value, totalCost.unitLabel)}`
            : amountSuffix
        }`,
    };
  }

  if (
    type === "regionUnlock" ||
    REGION_UNLOCK_GOODS_TYPES.has(type) ||
    REGION_UNLOCK_SHARD_TYPES.has(type)
  ) {
    const methodLabel = resolveRegionMethodLabel(action, lang, t);
    return {
      chainKind: "regionUnlock",
      bucketKey: methodLabel,
      color: "blue",
      addCost: true,
      textForCount: (count, totalCost) =>
        `${formatRegionCount(count, methodLabel, lang, t)}${
          totalCost?.unitLabel
            ? ` ${formatAmountLabel(totalCost.value, totalCost.unitLabel)}`
            : ""
        }`,
    };
  }

  if (type === "harvest") {
    const buildingName = resolveActionBuildingName(
      action,
      libraryMap,
      shortIdMap,
      lang,
    );
    return {
      chainKind: "boostHarvest",
      actionKind: "harvest",
      bucketKey: buildingName,
      color: "harvest",
      textForCount: (count) => `${count}x ${t("logHarvestAction")} ${buildingName}`,
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

function formatAction(action, meta, libraryMap, shortIdMap, lang, t) {
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

  if (type === "boostUnlock" || type === "boostReady") {
    const buildingName = resolveActionBuildingName(
      action,
      libraryMap,
      shortIdMap,
      lang,
    );
    const amountSuffix = meta?.unitLabel
      ? ` ${formatAmountLabel(meta.value, meta.unitLabel)}`
      : "";
    return {
      text: `1x ${t("logBoostAction")} ${buildingName}${amountSuffix}`,
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
      text: t("logHarvestAll"),
      color: "harvestAll",
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
      text: `1x ${t("logHarvestAction")} ${resolveActionBuildingName(action, libraryMap, shortIdMap, lang)}`,
      color: "harvest",
    };
  }

  return null;
}

function createPendingChain(kind) {
  if (kind === "buildSell") {
    return {
      kind,
      buckets: new Map(),
      sellOrder: [],
      buildOrder: [],
    };
  }
  if (kind === "boostHarvest") {
    return {
      kind,
      events: [],
    };
  }
  return {
    kind,
    order: [],
    buckets: new Map(),
  };
}

function appendCost(existing, costMeta) {
  if (!costMeta?.unitLabel) return existing ?? null;
  if (!existing?.unitLabel) {
    return { value: costMeta.value ?? 0, unitLabel: costMeta.unitLabel };
  }
  return {
    value: (existing.value ?? 0) + (costMeta.value ?? 0),
    unitLabel: existing.unitLabel,
  };
}

function flushGenericChain(chain, targetEntries) {
  for (const key of chain.order) {
    const bucket = chain.buckets.get(key);
    if (!bucket) continue;
    targetEntries.push({
      text: bucket.textForCount(bucket.count, bucket.totalCost),
      color: bucket.color,
      nodeId: bucket.lastNodeId,
      isHighlighted: bucket.includesSelected,
    });
  }
}

function flushBuildSellChain(chain, targetEntries) {
  const orderedBucketIds = [...chain.sellOrder, ...chain.buildOrder];
  for (const bucketId of orderedBucketIds) {
    const bucket = chain.buckets.get(bucketId);
    if (!bucket) continue;
    targetEntries.push({
      text: bucket.textForCount(bucket.count),
      color: bucket.color,
      nodeId: bucket.lastNodeId,
      isHighlighted: bucket.includesSelected,
    });
  }
}

function upsertLogBucket(map, bucketKey, createBucket) {
  const existing = map.get(bucketKey);
  if (existing) return existing;
  const created = createBucket();
  map.set(bucketKey, created);
  return created;
}

function flushBoostHarvestChain(chain, targetEntries, t) {
  const boostQueueByBuilding = new Map();
  const boostOnlyByBuilding = new Map();
  const harvestOnlyByBuilding = new Map();
  const comboByBuilding = new Map();

  chain.events.forEach((event, index) => {
    if (event.actionKind === "boost") {
      if (!boostQueueByBuilding.has(event.buildingName)) {
        boostQueueByBuilding.set(event.buildingName, []);
      }
      boostQueueByBuilding.get(event.buildingName).push({ ...event, index });
      return;
    }

    if (event.actionKind !== "harvest") return;
    const queue = boostQueueByBuilding.get(event.buildingName) ?? [];
    if (queue.length > 0) {
      const matchedBoost = queue.shift();
      const combo = upsertLogBucket(
        comboByBuilding,
        event.buildingName,
        () => ({
          type: "combo",
          buildingName: event.buildingName,
          count: 0,
          totalCost: null,
          color: "yellow",
          firstIndex: matchedBoost.index,
          lastNodeId: event.nodeId,
          includesSelected: false,
        }),
      );
      combo.count += 1;
      combo.totalCost = appendCost(combo.totalCost, matchedBoost.costMeta);
      combo.firstIndex = Math.min(combo.firstIndex, matchedBoost.index);
      combo.lastNodeId = event.nodeId;
      combo.includesSelected =
        combo.includesSelected ||
        matchedBoost.includesSelected ||
        event.includesSelected;
      return;
    }

    const harvestOnly = upsertLogBucket(
      harvestOnlyByBuilding,
      event.buildingName,
      () => ({
        type: "harvestOnly",
        buildingName: event.buildingName,
        count: 0,
        color: "harvest",
        firstIndex: index,
        lastNodeId: event.nodeId,
        includesSelected: false,
      }),
    );
    harvestOnly.count += 1;
    harvestOnly.firstIndex = Math.min(harvestOnly.firstIndex, index);
    harvestOnly.lastNodeId = event.nodeId;
    harvestOnly.includesSelected =
      harvestOnly.includesSelected || event.includesSelected;
  });

  for (const [buildingName, queue] of boostQueueByBuilding) {
    for (const boostEvent of queue) {
      const boostOnly = upsertLogBucket(
        boostOnlyByBuilding,
        buildingName,
        () => ({
          type: "boostOnly",
          buildingName,
          count: 0,
          totalCost: null,
          color: "yellow",
          firstIndex: boostEvent.index,
          lastNodeId: boostEvent.nodeId,
          includesSelected: false,
        }),
      );
      boostOnly.count += 1;
      boostOnly.totalCost = appendCost(boostOnly.totalCost, boostEvent.costMeta);
      boostOnly.firstIndex = Math.min(boostOnly.firstIndex, boostEvent.index);
      boostOnly.lastNodeId = boostEvent.nodeId;
      boostOnly.includesSelected =
        boostOnly.includesSelected || boostEvent.includesSelected;
    }
  }

  const mergedBuckets = [
    ...boostOnlyByBuilding.values(),
    ...comboByBuilding.values(),
    ...harvestOnlyByBuilding.values(),
  ].sort((a, b) => a.firstIndex - b.firstIndex);

  for (const bucket of mergedBuckets) {
    if (bucket.type === "boostOnly") {
      const amountSuffix = bucket.totalCost?.unitLabel
        ? ` ${formatAmountLabel(bucket.totalCost.value, bucket.totalCost.unitLabel)}`
        : "";
      targetEntries.push({
        text: `${bucket.count}x ${t("logBoostAction")} ${bucket.buildingName}${amountSuffix}`,
        color: bucket.color,
        nodeId: bucket.lastNodeId,
        isHighlighted: bucket.includesSelected,
      });
      continue;
    }

    if (bucket.type === "combo") {
      const amountSuffix = bucket.totalCost?.unitLabel
        ? ` ${formatAmountLabel(bucket.totalCost.value, bucket.totalCost.unitLabel)}`
        : "";
      targetEntries.push({
        text: `${bucket.count}x ${t("logBoostHarvestAction")} ${bucket.buildingName}${amountSuffix}`,
        color: bucket.color,
        nodeId: bucket.lastNodeId,
        isHighlighted: bucket.includesSelected,
      });
      continue;
    }

    targetEntries.push({
      text: `${bucket.count}x ${t("logHarvestAction")} ${bucket.buildingName}`,
      color: bucket.color,
      nodeId: bucket.lastNodeId,
      isHighlighted: bucket.includesSelected,
    });
  }
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

  const t = getTranslator(lang);
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

  const actionMetaByNodeId = new Map();
  const counters = { goodsUnlocks: 0, shardUnlocks: 0 };
  for (let i = 0; i < forwardPath.length; i += 1) {
    const nodeId = forwardPath[i];
    const action = nodes.get(nodeId)?.action;
    if (!action) continue;
    const meta = getActionCostMeta(
      action,
      libraryMap,
      shortIdMap,
      lang,
      counters,
      t,
    );
    if (meta) {
      actionMetaByNodeId.set(nodeId, meta);
    }
  }

  const logEntries = [];
  let pendingChain = null;

  const flushPendingChain = () => {
    if (!pendingChain) return;
    if (pendingChain.kind === "buildSell") {
      flushBuildSellChain(pendingChain, logEntries);
    } else if (pendingChain.kind === "boostHarvest") {
      flushBoostHarvestChain(pendingChain, logEntries, t);
    } else {
      flushGenericChain(pendingChain, logEntries);
    }
    pendingChain = null;
  };

  for (let i = 0; i < relevantNodeIds.length; i += 1) {
    const nodeId = relevantNodeIds[i];
    const node = nodes.get(nodeId);
    const meta = actionMetaByNodeId.get(nodeId) ?? null;
    const descriptor = getChainDescriptor(
      node?.action,
      meta,
      libraryMap,
      shortIdMap,
      lang,
      t,
    );

    if (descriptor) {
      if (!pendingChain || pendingChain.kind !== descriptor.chainKind) {
        flushPendingChain();
        pendingChain = createPendingChain(descriptor.chainKind);
      }

      if (pendingChain.kind === "boostHarvest") {
        pendingChain.events.push({
          actionKind: descriptor.actionKind,
          buildingName: descriptor.bucketKey,
          costMeta:
            descriptor.addCost && meta?.unitLabel
              ? { value: meta.value ?? 0, unitLabel: meta.unitLabel }
              : null,
          nodeId,
          includesSelected: nodeId === selectedNodeId,
        });
        continue;
      }

      const bucketId =
        pendingChain.kind === "buildSell"
          ? `${descriptor.actionKind}:${descriptor.bucketKey}`
          : descriptor.bucketKey;
      const existing = pendingChain.buckets.get(bucketId);
      if (existing) {
        existing.count += 1;
        existing.lastNodeId = nodeId;
        if (nodeId === selectedNodeId) existing.includesSelected = true;
        if (descriptor.addCost && meta?.unitLabel) {
          existing.totalCost = {
            value: (existing.totalCost?.value ?? 0) + (meta.value ?? 0),
            unitLabel: meta.unitLabel,
          };
        }
      } else {
        if (pendingChain.kind === "buildSell") {
          if (descriptor.actionKind === "sell") {
            pendingChain.sellOrder.push(bucketId);
          } else {
            pendingChain.buildOrder.push(bucketId);
          }
        } else {
          pendingChain.order.push(bucketId);
        }
        pendingChain.buckets.set(bucketId, {
          count: 1,
          color: descriptor.color,
          textForCount: descriptor.textForCount,
          lastNodeId: nodeId,
          includesSelected: nodeId === selectedNodeId,
          totalCost:
            descriptor.addCost && meta?.unitLabel
              ? { value: meta.value ?? 0, unitLabel: meta.unitLabel }
              : null,
        });
      }
      continue;
    }

    flushPendingChain();
    const formatted = formatAction(
      node?.action,
      meta,
      libraryMap,
      shortIdMap,
      lang,
      t,
    );
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
