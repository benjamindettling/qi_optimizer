// Delta-based history for build/sell/region/boost/harvest actions.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  REGION_GOODS_COSTS,
  REGION_SHARD_COSTS,
  REGION_SIZE,
  REGION_COLS,
  BOARD_WIDTH,
  BOARD_HEIGHT,
} from "../../config/boardConfig";
import {
  getBoostCostForTier,
  getUnlockCostForTier,
  isTierLocked,
} from "../../config/buildingTiers";
import { QA_BASE_PER_HOUR } from "../../config/gameDefaults";
import { computeSaleOrRefund } from "../../domain/economy/resourceTransactions";
import {
  aggregateHarvest,
  computeBuildingHarvest,
  finishProductionsReadyMap,
} from "../../domain/production/productionController";
import { computeStats } from "../../utils/stateUtils";
import { buildInitialGameState } from "../../config/initialState";
import { computePurchasePlans } from "../../utils/gameMath";
import { solveTilingMask } from "../../utils/tilingSolver";
import { buildTilingMask, buildTilingGroups, applyTilingSolution } from "../../utils/tilingTranslator";
import { allowShardLimitOverflow } from "../../utils/shards";

const ACTION_BUILD = "build";
const ACTION_BUILD_ADMIN = "buildAdmin";
const ACTION_SELL = "sell";
const ACTION_SELL_FULL = "sellFull";
const ACTION_SELL_ADMIN = "sellAdmin";
const ACTION_REGION_UNLOCK_GOODS = "regionUnlockGoods";
const ACTION_REGION_UNLOCK_SHARDS = "regionUnlockShards";
const ACTION_REGION_UNLOCK_ADMIN = "regionUnlockAdmin";
const ACTION_REGION_LOCK_ADMIN = "regionLockAdmin";
const ACTION_BOOST_UNLOCK = "boostUnlock";
const ACTION_BOOST_UNLOCK_ADMIN = "boostUnlockAdmin";
const ACTION_BOOST_READY = "boostReady";
const ACTION_BOOST_READY_ADMIN = "boostReadyAdmin";
const ACTION_HARVEST = "harvest";
const ACTION_MOVE = "move";
const ACTION_ADMIN_ADJUST = "adminAdjust";
const ACTION_GOODS_COST_ADMIN = "goodsCostAdmin";
const ACTION_SHARDS_COST_ADMIN = "shardsCostAdmin";
const ACTION_FINISH_PRODUCTIONS = "finishProductions";
const ACTION_HARVEST_ALL = "harvestAll";
const ACTION_GOODS_PURCHASE = "goodsPurchase";
const ACTION_GOODS_PURCHASE_ADMIN = "goodsPurchaseAdmin";
const ACTION_UNIT_PURCHASE = "unitPurchase";
const ACTION_UNIT_PURCHASE_ADMIN = "unitPurchaseAdmin";

const isBuildActionType = (type) =>
  type === ACTION_BUILD || type === ACTION_BUILD_ADMIN;

const rectanglesOverlap = (a, b) => {
  if (!a || !b) return false;
  const separated =
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y;
  return !separated;
};

const clampIndex = (value, max) =>
  Math.max(0, Math.min(max, Number(value) || 0));

const boostCostForDef = (def) => getBoostCostForTier(def?.tier);

const toNumber = (value) => (Number.isFinite(value) ? value : 0);

const isInfinityCost = (value) =>
  value === "Infinity" ||
  value === Infinity ||
  value === Number.POSITIVE_INFINITY;

const resolveCostIndex = (value, costList, fallbackIndex = 0) => {
  const maxIdx = (costList?.length ?? 1) - 1;
  if (!Array.isArray(costList) || maxIdx < 0) return clampIndex(fallbackIndex, 0);
  if (Number.isFinite(value)) {
    const idx = costList.findIndex((cost) => cost === value);
    if (idx >= 0) return clampIndex(idx, maxIdx);
  }
  if (isInfinityCost(value)) {
    const idx = costList.findIndex((cost) => isInfinityCost(cost));
    if (idx >= 0) return clampIndex(idx, maxIdx);
  }
  return clampIndex(fallbackIndex, maxIdx);
};

const normalizeMovePositions = (action) => {
  if (Array.isArray(action?.positions)) {
    return action.positions
      .filter(
        (p) =>
          Array.isArray(p) &&
          p.length >= 4 &&
          Number.isFinite(Number(p[0])) &&
          Number.isFinite(Number(p[1])) &&
          Number.isFinite(Number(p[2])) &&
          Number.isFinite(Number(p[3])),
      )
      .map((p) => [Number(p[0]), Number(p[1]), Number(p[2]), Number(p[3])]);
  }
  const xs = Array.isArray(action?.x) ? action.x : [];
  const ys = Array.isArray(action?.y) ? action.y : [];
  const xns = Array.isArray(action?.xn) ? action.xn : [];
  const yns = Array.isArray(action?.yn) ? action.yn : [];
  const positions = [];
  const count = Math.min(xs.length, ys.length, xns.length, yns.length);
  for (let i = 0; i < count; i += 1) {
    const fromX = Number(xs[i]);
    const fromY = Number(ys[i]);
    const toX = Number(xns[i]);
    const toY = Number(yns[i]);
    if (
      Number.isFinite(fromX) &&
      Number.isFinite(fromY) &&
      Number.isFinite(toX) &&
      Number.isFinite(toY)
    ) {
      positions.push([fromX, fromY, toX, toY]);
    }
  }
  return positions;
};

const normalizeQuantityMap = (mapLike) => {
  const next = {};
  if (!mapLike || typeof mapLike !== "object" || Array.isArray(mapLike)) return next;
  Object.entries(mapLike).forEach(([amountRaw, countRaw]) => {
    const amount = Number(amountRaw);
    const count = Number(countRaw);
    if (!Number.isFinite(amount) || amount <= 0) return;
    if (!Number.isFinite(count) || count <= 0) return;
    const amountKey = String(amount);
    next[amountKey] = (next[amountKey] ?? 0) + Math.floor(count);
  });
  return next;
};

const mergeQuantityMaps = (baseMap, appendedMap) => {
  const merged = { ...normalizeQuantityMap(baseMap) };
  const next = normalizeQuantityMap(appendedMap);
  Object.entries(next).forEach(([amount, count]) => {
    merged[amount] = (merged[amount] ?? 0) + count;
  });
  return merged;
};

const sumQuantityMap = (quantityMap) =>
  Object.entries(normalizeQuantityMap(quantityMap)).reduce(
    (sum, [amountRaw, count]) => sum + Number(amountRaw) * count,
    0,
  );

const extractQuantityMapFromAction = (action) => {
  const fromMap = normalizeQuantityMap(action?.q);
  if (Object.keys(fromMap).length > 0) return fromMap;
  const amount = Number(action?.quantity ?? action?.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) return {};
  const rawCount = action?.cost ? 1 : Number(action?.count ?? 1);
  if (!Number.isFinite(rawCount) || rawCount <= 0) return {};
  return { [String(amount)]: Math.floor(rawCount) };
};

export const useActionHistory = ({
  layout,
  readyMap,
  buildLocks,
  goodsUnlocks,
  shardUnlocks,
  libraryMap,
  shortIdMap,
  stats,
  qaHoursPerHarvest,
  infiniteResources,
  config,
  applySpend,
  applyRefund,
  setResources,
  setLayout,
  setReadyMap,
  setBuildLocks,
  setUnlockedRegions,
  setGoodsUnlocks,
  setShardUnlocks,
  nextIdRef,
  configStartResources,
  configRevision,
  townhallDef,
  setTimeStep,
}) => {
  // ============ TREE-BASED HISTORY STATE ============
  // Tree structure: nodes Map with {id, parentId, action, childrenIds[]}
  // Root node (id=0) has no action, parentId=null
  const [historyTree, setHistoryTree] = useState(() => ({
    nodes: new Map([[0, { id: 0, parentId: null, action: null, childrenIds: [] }]]),
    nextNodeId: 1,
  }));
  const [selectedNodeId, setSelectedNodeId] = useState(0);
  const [invalidSteps, setInvalidSteps] = useState([]);
  const [historyChecking, setHistoryChecking] = useState(false);
  
  // Node verification flags: Map<nodeId, { unfixable?, configFixable?, orderTBD?, greyedOut? }>
  const [nodeFlags, setNodeFlags] = useState(new Map());
  // Track which subtrees need verification after tree changes
  const [pendingVerification, setPendingVerification] = useState(null);
  
  // Legacy refs for compatibility
  const historyTreeRef = useRef(historyTree);
  const selectedNodeIdRef = useRef(selectedNodeId);
  const layoutRef = useRef(layout);
  const readyMapRef = useRef(readyMap);
  const buildLocksRef = useRef(buildLocks);
  const goodsUnlocksRef = useRef(goodsUnlocks);
  const shardUnlocksRef = useRef(shardUnlocks);
  const statsRef = useRef(stats);
  const qaHoursRef = useRef(qaHoursPerHarvest);
  const producerMap = useMemo(() => {
    const goods = {};
    const units = {};
    Object.values(libraryMap || {}).forEach((def) => {
      if (!def?.produces) return;
      if (def.category === "goods") goods[def.produces] = def;
      if (def.category === "military") units[def.produces] = def;
    });
    return { goods, units };
  }, [libraryMap]);
  const defIdToShortId = useMemo(() => {
    const map = {};
    Object.entries(shortIdMap || {}).forEach(([shortId, defId]) => {
      map[defId] = shortId;
    });
    return map;
  }, [shortIdMap]);

  useEffect(() => {
    historyTreeRef.current = historyTree;
  }, [historyTree]);

  useEffect(() => {
    selectedNodeIdRef.current = selectedNodeId;
  }, [selectedNodeId]);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    readyMapRef.current = readyMap;
  }, [readyMap]);

  useEffect(() => {
    buildLocksRef.current = buildLocks;
  }, [buildLocks]);

  useEffect(() => {
    goodsUnlocksRef.current = goodsUnlocks;
  }, [goodsUnlocks]);

  useEffect(() => {
    shardUnlocksRef.current = shardUnlocks;
  }, [shardUnlocks]);

  useEffect(() => {
    statsRef.current = stats;
  }, [stats]);

  useEffect(() => {
    qaHoursRef.current = qaHoursPerHarvest;
  }, [qaHoursPerHarvest]);

  // ============ TREE HELPER FUNCTIONS ============
  
  // Get path from root (node 0) to a given nodeId
  const getPathToNode = useCallback((nodeId) => {
    const { nodes } = historyTree;
    const path = [];
    let current = nodeId;
    while (current !== null && current !== undefined) {
      path.unshift(current);
      const node = nodes.get(current);
      if (!node) break;
      current = node.parentId;
    }
    return path;
  }, [historyTree]);

  // Get actions along path from root to nodeId (excluding root which has no action)
  const getActionsToNode = useCallback((nodeId) => {
    const { nodes } = historyTree;
    const path = getPathToNode(nodeId);
    const actions = [];
    for (const nId of path) {
      const node = nodes.get(nId);
      if (node?.action) {
        actions.push(node.action);
      }
    }
    return actions;
  }, [historyTree, getPathToNode]);

  // Convert tree to flat array format for TreeVisualizer
  // IMPORTANT: Uses historyTree state directly (not ref) to ensure immediate updates
  const getTreeNodesForVisualizer = useCallback(() => {
    const { nodes } = historyTree;
    const result = [];
    
    // DFS traversal to build flat array
    const visited = new Set();
    const dfs = (nodeId, parentId) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      
      const node = nodes.get(nodeId);
      if (!node) return;
      
      // Get flags for this node
      const flags = nodeFlags.get(nodeId) || {};
      
      result.push({
        id: nodeId,
        parentId: parentId,
        action: node.action,
        actionType: node.action?.type || "default",
        actionTitle: node.action?.title || "",
        // Include validity flags
        unfixable: flags.unfixable || false,
        configFixable: flags.configFixable || false,
        orderTBD: flags.orderTBD || false,
        orderFixable: flags.orderFixable || false,
        orderUnfixable: flags.orderUnfixable || false,
        greyedOut: flags.greyedOut || false,
        // Include deficits for configFixable nodes
        deficits: flags.deficits || null,
        // Include fixed layout for orderFixable nodes
        fixedLayout: flags.fixedLayout || null,
        layoutFixPlan: flags.layoutFixPlan || null,
      });
      
      for (const childId of node.childrenIds) {
        dfs(childId, nodeId);
      }
    };
    
    dfs(0, null);
    return result;
  }, [historyTree, nodeFlags]);

  const applyResourceDelta = useCallback(
    (delta, { force = false } = {}) => {
      if (infiniteResources && !force) return;
      if (!delta) return;
      setResources((prev) => {
        const nextGoods = { ...(prev.goods ?? {}) };
        if (delta.goods) {
          Object.entries(delta.goods).forEach(([key, value]) => {
            if (!value) return;
            nextGoods[key] = (nextGoods[key] ?? 0) + value;
          });
        }
        const nextUnits = { ...(prev.units ?? {}) };
        if (delta.units) {
          Object.entries(delta.units).forEach(([key, value]) => {
            if (!value) return;
            nextUnits[key] = (nextUnits[key] ?? 0) + value;
          });
        }
        return {
          ...prev,
          coins: (prev.coins ?? 0) + (delta.coins ?? 0),
          supplies: (prev.supplies ?? 0) + (delta.supplies ?? 0),
          chronos: (prev.chronos ?? 0) + (delta.chronos ?? 0),
          shards: (prev.shards ?? 0) + (delta.shards ?? 0),
          quantumActions:
            (prev.quantumActions ?? 0) + (delta.quantumActions ?? 0),
          goods: nextGoods,
          units: nextUnits,
        };
      });
    },
    [infiniteResources, setResources],
  );

  const ensureNextId = useCallback(
    (instanceId) => {
      if (!nextIdRef?.current || instanceId === undefined) return;
      if (nextIdRef.current <= instanceId) {
        nextIdRef.current = instanceId + 1;
      }
    },
    [nextIdRef],
  );

  const removeInstance = useCallback(
    (instanceId) => {
      setLayout((prev) => {
        const next = prev.filter((b) => b.id !== instanceId);
        layoutRef.current = next;
        return next;
      });
      setReadyMap((prev) => {
        const next = { ...prev };
        delete next[instanceId];
        readyMapRef.current = next;
        return next;
      });
      setBuildLocks((prev) => {
        const next = { ...prev };
        delete next[instanceId];
        buildLocksRef.current = next;
        return next;
      });
    },
    [setLayout, setReadyMap, setBuildLocks],
  );

  const addInstance = useCallback(
    (action, def, ready, locked, defIdOverride = null) => {
      const resolvedDefId = defIdOverride || action.defId || def?.defId;
      let instanceId = action.instanceId;
      if (instanceId === null || instanceId === undefined) {
        if (nextIdRef?.current) {
          instanceId = nextIdRef.current;
          nextIdRef.current += 1;
        } else {
          const maxId = (layoutRef.current || []).reduce(
            (max, item) => Math.max(max, item.id),
            0,
          );
          instanceId = maxId + 1;
        }
      } else {
        ensureNextId(instanceId);
      }
      const instance = {
        id: instanceId,
        defId: resolvedDefId,
        x: action.x,
        y: action.y,
        width: action.width ?? def.width,
        height: action.height ?? def.height,
      };
      setLayout((prev) => {
        const next = [...prev, instance];
        layoutRef.current = next;
        return next;
      });
      setReadyMap((prev) => {
        const next = { ...prev, [instance.id]: !!ready };
        readyMapRef.current = next;
        return next;
      });
      setBuildLocks((prev) => {
        const next = { ...prev, [instance.id]: !!locked };
        buildLocksRef.current = next;
        return next;
      });
    },
    [ensureNextId, nextIdRef, setLayout, setReadyMap, setBuildLocks],
  );

  const resolveDefId = useCallback(
    (action) =>
      action?.defId || (action?.shortId ? shortIdMap?.[action.shortId] : null),
    [shortIdMap],
  );

  const getRefund = useCallback(
    (defId) => computeSaleOrRefund({ defId }, libraryMap, false),
    [libraryMap],
  );

  const setRegionUnlocked = useCallback(
    (idx, value) => {
      if (idx === null || idx === undefined) return;
      setUnlockedRegions((prev) => {
        const next = [...prev];
        next[idx] = value;
        return next;
      });
    },
    [setUnlockedRegions],
  );

  const goodsCostAt = useCallback((idx) => {
    const maxIdx = REGION_GOODS_COSTS.length - 1;
    const safeIdx = clampIndex(idx, maxIdx);
    return toNumber(REGION_GOODS_COSTS[safeIdx]);
  }, []);

  const shardCostAt = useCallback((idx) => {
    const maxIdx = REGION_SHARD_COSTS.length - 1;
    const safeIdx = clampIndex(idx, maxIdx);
    return toNumber(REGION_SHARD_COSTS[safeIdx]);
  }, []);

  const setGoodsUnlockIndex = useCallback(
    (value) => {
      const maxIdx = REGION_GOODS_COSTS.length - 1;
      const next = clampIndex(value, maxIdx);
      goodsUnlocksRef.current = next;
      setGoodsUnlocks(next);
      return next;
    },
    [setGoodsUnlocks],
  );

  const setShardUnlockIndex = useCallback(
    (value) => {
      const maxIdx = REGION_SHARD_COSTS.length - 1;
      const next = clampIndex(value, maxIdx);
      shardUnlocksRef.current = next;
      setShardUnlocks(next);
      return next;
    },
    [setShardUnlocks],
  );

  const bumpGoodsUnlocks = useCallback(
    (delta) => setGoodsUnlockIndex((goodsUnlocksRef.current ?? 0) + delta),
    [setGoodsUnlockIndex],
  );

  const bumpShardUnlocks = useCallback(
    (delta) => setShardUnlockIndex((shardUnlocksRef.current ?? 0) + delta),
    [setShardUnlockIndex],
  );

  const computeFastBuyTotals = useCallback(
    (goodKey, amount) => {
      if (!goodKey || !amount || amount <= 0) return null;
      const def = Object.values(libraryMap ?? {}).find(
        (item) =>
          item?.category === "goods" &&
          item?.produces === goodKey &&
          item?.goodsCost,
      );
      if (!def) return null;
      const options = computePurchasePlans(def, amount);
      if (!options.length) return null;
      const best = options.reduce(
        (min, option) =>
          (option.totalCost ?? 0) < (min.totalCost ?? 0) ? option : min,
        options[0],
      );
      const totals = best.plan.reduce(
        (acc, entry) => ({
          coins: acc.coins + (entry.cost?.coins ?? 0),
          supplies: acc.supplies + (entry.cost?.supplies ?? 0),
        }),
        { coins: 0, supplies: 0 },
      );
      return totals;
    },
    [libraryMap],
  );

  const getPurchaseDelta = useCallback(
    (action, kind) => {
      const isGoods = kind === "goods";
      const key = isGoods
        ? action?.goodsKey ?? action?.key
        : action?.unitKey ?? action?.key;
      if (!key) return null;
      const quantityMap = extractQuantityMapFromAction(action);
      const entries = Object.entries(quantityMap);
      if (!entries.length) return null;
      const table = isGoods
        ? producerMap.goods[key]?.goodsCost
        : producerMap.units[key]?.unitCosts;
      const singleEntry = entries.length === 1;
      let coins = 0;
      let supplies = 0;
      let totalAmount = 0;
      entries.forEach(([amountRaw, count]) => {
        const amount = Number(amountRaw);
        if (!Number.isFinite(amount) || amount <= 0) return;
        const mappedCost =
          action?.costByAmount?.[amountRaw] ?? action?.costByAmount?.[amount];
        const unitCost = mappedCost ?? (singleEntry ? action?.cost : null) ?? table?.[amount];
        if (!unitCost) return;
        coins += (unitCost.coins ?? 0) * count;
        supplies += (unitCost.supplies ?? 0) * count;
        totalAmount += amount * count;
      });
      if (totalAmount <= 0) return null;
      return { key, totalAmount, coins, supplies };
    },
    [producerMap],
  );

  const findInstanceId = useCallback((action) => {
    const list = layoutRef.current || [];
    if (action.instanceId !== null && action.instanceId !== undefined) {
      const match = list.find((b) => b.id === action.instanceId);
      if (match) return action.instanceId;
    }
    const defId = resolveDefId(action);
    const match = list.find(
      (b) => b.defId === defId && b.x === action.x && b.y === action.y,
    );
    return match?.id ?? null;
  }, [resolveDefId]);

  const applyMoveAction = useCallback((action, direction) => {
    const moves = normalizeMovePositions(action);
    if (!moves.length) return;
    const map = new Map();
    moves.forEach(([x, y, xn, yn]) => {
      if (direction >= 0) {
        map.set(`${x},${y}`, { x: xn, y: yn });
      } else {
        map.set(`${xn},${yn}`, { x, y });
      }
    });
    if (!map.size) return;
    setLayout((prev) => {
      const next = prev.map((inst) => {
        const key = `${inst.x},${inst.y}`;
        const dest = map.get(key);
        if (!dest) return inst;
        return { ...inst, x: dest.x, y: dest.y };
      });
      layoutRef.current = next;
      return next;
    });
  }, [setLayout]);

  const applyAdminAdjust = useCallback(
    (action, direction) => {
      if (!action?.key && !action?.deltaByKey) return;
      const scaled = (delta) => (delta ?? 0) * direction;
      if (action.group === "goods") {
        const deltas = action.deltaByKey
          ? Object.fromEntries(
              Object.entries(action.deltaByKey).map(([k, v]) => [k, scaled(v)]),
            )
          : { [action.key]: scaled(action.delta) };
        applyResourceDelta({ goods: deltas }, { force: true });
        return;
      }
      if (action.group === "units") {
        const deltas = action.deltaByKey
          ? Object.fromEntries(
              Object.entries(action.deltaByKey).map(([k, v]) => [k, scaled(v)]),
            )
          : { [action.key]: scaled(action.delta) };
        applyResourceDelta({ units: deltas }, { force: true });
        return;
      }
      const delta = scaled(action.delta);
      applyResourceDelta({ [action.key]: delta }, { force: true });
    },
    [applyResourceDelta],
  );

  const qaBasePerHour = QA_BASE_PER_HOUR + Number(config?.qaBaseBonus ?? 0);
  const applyConfigBoosts = useCallback(
    (base) => {
      const coinBoostCfg = Number(config?.coinBoost ?? 0) / 100;
      const supplyBoostCfg = Number(config?.supplyBoost ?? 0) / 100;
      // Note: armyBoostRed/Blue now only come from decorations
      // Config attack/defense boosts are applied separately in StatsPanel
      return {
        ...base,
        coinBoost: (base.coinBoost ?? 0) + coinBoostCfg,
        supplyBoost: (base.supplyBoost ?? 0) + supplyBoostCfg,
        armyBoostRed: base.armyBoostRed ?? 0,
        armyBoostBlue: base.armyBoostBlue ?? 0,
      };
    },
    [config],
  );

  const applyFinishProductions = useCallback((skipResources = false) => {
    const nextReady = finishProductionsReadyMap(
      layoutRef.current || [],
      libraryMap,
      readyMapRef.current || {},
      buildLocksRef.current || {},
    );
    readyMapRef.current = nextReady;
    setReadyMap(nextReady);
    const baseQa = qaBasePerHour * (qaHoursRef.current ?? 0);
    if (baseQa > 0 && !skipResources) {
      applyResourceDelta({ quantumActions: baseQa });
    }
    setTimeStep?.((prev) => Math.min(23, (prev ?? 1) + 1));
  }, [applyResourceDelta, libraryMap, qaBasePerHour, setReadyMap, setTimeStep]);

  const applyHarvestAll = useCallback((skipResources = false) => {
    const layoutList = layoutRef.current || [];
    const readySnapshot = readyMapRef.current || {};
    const buildLocksSnapshot = buildLocksRef.current || {};
    const readyOnes = layoutList.filter((b) => readySnapshot[b.id] === true);
    const isFullHarvest = readyOnes.length === 0;
    const locksBefore = { ...buildLocksSnapshot };
    let buildLocksAfter = { ...buildLocksSnapshot };
    let unlockedAny = false;
    Object.keys(buildLocksAfter).forEach((key) => {
      if (buildLocksAfter[key]) {
        buildLocksAfter[key] = false;
        unlockedAny = true;
      }
    });
    if (unlockedAny) {
      buildLocksRef.current = buildLocksAfter;
      setBuildLocks(buildLocksAfter);
    }

    const effectiveStats = applyConfigBoosts(
      computeStats(layoutList, libraryMap),
    );
    const baseQa = qaBasePerHour * (qaHoursRef.current ?? 0);
    const extraQa = isFullHarvest ? baseQa : 0;
    const targets = isFullHarvest ? layoutList : readyOnes;

    const lockedIds = [];
    const harvestable = [];
    const lockedCulture = [];
    targets.forEach((inst) => {
      if (locksBefore[inst.id]) {
        const def = libraryMap[inst.defId];
        if (def?.category === "culture") {
          lockedCulture.push(inst);
        } else {
          lockedIds.push(inst.id);
        }
      } else {
        harvestable.push(inst);
      }
    });

    const total =
      harvestable.length > 0
        ? aggregateHarvest(harvestable, libraryMap, effectiveStats, {
            qaHoursPerHarvest: qaHoursRef.current ?? 0,
          })
        : { coins: 0, supplies: 0, chronos: 0, goods: {}, qa: 0 };
    const qaFromLockedCulture = lockedCulture.reduce(
      (acc, inst) =>
        acc +
        (libraryMap[inst.defId]?.quantumActions ?? 0) *
          (qaHoursRef.current ?? 0),
      0,
    );
    total.qa = (total.qa ?? 0) + qaFromLockedCulture + extraQa;

    if (!skipResources) {
      applyResourceDelta({
        coins: total.coins ?? 0,
        supplies: total.supplies ?? 0,
        chronos: total.chronos ?? 0,
        quantumActions: total.qa ?? 0,
        goods: total.goods ?? {},
      });
    }

    const harvestedIds = targets.map((inst) => inst.id);
    setReadyMap((prev) => {
      const next = { ...prev };
      harvestedIds.forEach((id) => {
        next[id] = false;
      });
      readyMapRef.current = next;
      return next;
    });

    const unlockIds = [...lockedIds, ...lockedCulture.map((inst) => inst.id)];
    if (unlockIds.length) {
      setBuildLocks((prev) => {
        const next = { ...prev };
        unlockIds.forEach((id) => {
          next[id] = false;
        });
        buildLocksRef.current = next;
        return next;
      });
    }

    if (isFullHarvest) {
      setTimeStep?.((prev) => Math.min(23, (prev ?? 1) + 1));
    }
  }, [
    applyConfigBoosts,
    applyResourceDelta,
    libraryMap,
    qaBasePerHour,
    setBuildLocks,
    setReadyMap,
    setTimeStep,
  ]);

  const applyHarvestDelta = useCallback(
    (delta, direction) => {
      if (!delta) return;
      const goods = {};
      if (delta.goods) {
        Object.entries(delta.goods).forEach(([key, value]) => {
          goods[key] = (value ?? 0) * direction;
        });
      }
      applyResourceDelta({
        coins: (delta.coins ?? 0) * direction,
        supplies: (delta.supplies ?? 0) * direction,
        chronos: (delta.chronos ?? 0) * direction,
        quantumActions: (delta.qa ?? 0) * direction,
        goods,
      });
    },
    [applyResourceDelta],
  );

  const computeHarvestDelta = useCallback(
    (defId) => {
      if (!defId) return null;
      const useStats = statsRef.current || {};
      const qaHours = qaHoursRef.current ?? 0;
      return computeBuildingHarvest(
        { defId },
        libraryMap,
        useStats,
        { qaHoursPerHarvest: qaHours },
      );
    },
    [libraryMap],
  );

  const applyForward = useCallback(
    (action) => {
      if (!action) return;
      const defId = resolveDefId(action);
      const def = defId ? libraryMap?.[defId] : null;
      switch (action.type) {
        case ACTION_BUILD:
        case ACTION_BUILD_ADMIN: {
          if (!def) return;
          if (action.type === ACTION_BUILD) {
            applySpend(def.cost);
          }
          addInstance(action, def, false, isTierLocked(def.tier), defId);
          return;
        }
        case ACTION_SELL:
        case ACTION_SELL_FULL:
        case ACTION_SELL_ADMIN: {
          if (!def) return;
          const refund = defId ? getRefund(defId) : null;
          if (!refund) return;
          // sellFull gets full refund, sell gets normal refund, sellAdmin gets nothing
          if (action.type === ACTION_SELL) {
            applyRefund(refund);
          } else if (action.type === ACTION_SELL_FULL) {
            // Full refund = original cost
            applyRefund(def.cost);
          }
          const id = findInstanceId(action);
          if (id === null || id === undefined) return;
          removeInstance(id);
          return;
        }
        case ACTION_REGION_UNLOCK_GOODS: {
          const currentIdx = goodsUnlocksRef.current ?? 0;
          const goodsCost = goodsCostAt(currentIdx);
          if (!action.admin) {
            if (!action.goodKey) return;
            applyResourceDelta({
              goods: { [action.goodKey]: -goodsCost },
            });
          }
          bumpGoodsUnlocks(1);
          setRegionUnlocked(action.regionIdx, true);
          return;
        }
        case ACTION_REGION_UNLOCK_SHARDS: {
          const currentIdx = shardUnlocksRef.current ?? 0;
          const shardCost = shardCostAt(currentIdx);
          if (!action.admin) {
            applyResourceDelta({ shards: -shardCost });
          }
          bumpShardUnlocks(1);
          setRegionUnlocked(action.regionIdx, true);
          return;
        }
        case ACTION_REGION_UNLOCK_ADMIN: {
          setRegionUnlocked(action.regionIdx, true);
          return;
        }
        case ACTION_REGION_LOCK_ADMIN: {
          setRegionUnlocked(action.regionIdx, false);
          if (action.method === "goods") {
            bumpGoodsUnlocks(-1);
          } else if (action.method === "shards") {
            bumpShardUnlocks(-1);
          }
          return;
        }
        case ACTION_GOODS_COST_ADMIN: {
          const nextIdx = Number.isFinite(action.nextIndex)
            ? action.nextIndex
            : resolveCostIndex(
                action.nextValue,
                REGION_GOODS_COSTS,
                goodsUnlocksRef.current ?? 0,
              );
          setGoodsUnlockIndex(nextIdx);
          return;
        }
        case ACTION_SHARDS_COST_ADMIN: {
          const nextIdx = Number.isFinite(action.nextIndex)
            ? action.nextIndex
            : resolveCostIndex(
                action.nextValue,
                REGION_SHARD_COSTS,
                shardUnlocksRef.current ?? 0,
              );
          setShardUnlockIndex(nextIdx);
          return;
        }
        case ACTION_BOOST_UNLOCK:
        case ACTION_BOOST_UNLOCK_ADMIN: {
          if (!def) return;
          const id = findInstanceId(action);
          if (id === null || id === undefined) return;
          if (action.type === ACTION_BOOST_UNLOCK) {
            applyResourceDelta({ shards: -getUnlockCostForTier(def?.tier) });
          }
          setBuildLocks((prev) => {
            const next = { ...prev, [id]: false };
            buildLocksRef.current = next;
            return next;
          });
          return;
        }
        case ACTION_BOOST_READY:
        case ACTION_BOOST_READY_ADMIN: {
          if (!def) return;
          const id = findInstanceId(action);
          if (id === null || id === undefined) return;
          if (action.type === ACTION_BOOST_READY) {
            const cost = boostCostForDef(def);
            applyResourceDelta({ shards: -cost });
          }
          setReadyMap((prev) => {
            const next = { ...prev, [id]: true };
            readyMapRef.current = next;
            return next;
          });
          return;
        }
        case ACTION_HARVEST: {
          const id = findInstanceId(action);
          if (id === null || id === undefined) return;
          const delta = computeHarvestDelta(defId);
          applyHarvestDelta(delta, 1);
          setReadyMap((prev) => {
            const next = { ...prev, [id]: false };
            readyMapRef.current = next;
            return next;
          });
          return;
        }
        case ACTION_FINISH_PRODUCTIONS: {
          applyFinishProductions(false);
          return;
        }
        case ACTION_HARVEST_ALL: {
          applyHarvestAll(false);
          return;
        }
        case ACTION_MOVE: {
          applyMoveAction(action, 1);
          return;
        }
        case ACTION_ADMIN_ADJUST: {
          applyAdminAdjust(action, 1);
          return;
        }
        case ACTION_GOODS_PURCHASE:
        case ACTION_GOODS_PURCHASE_ADMIN: {
          if (action.type === ACTION_GOODS_PURCHASE_ADMIN) return;
          const purchase = getPurchaseDelta(action, "goods");
          if (!purchase) return;
          applyResourceDelta({
            coins: -purchase.coins,
            supplies: -purchase.supplies,
            goods: { [purchase.key]: purchase.totalAmount },
          });
          return;
        }
        case ACTION_UNIT_PURCHASE:
        case ACTION_UNIT_PURCHASE_ADMIN: {
          if (action.type === ACTION_UNIT_PURCHASE_ADMIN) return;
          const purchase = getPurchaseDelta(action, "units");
          if (!purchase) return;
          applyResourceDelta({
            coins: -purchase.coins,
            supplies: -purchase.supplies,
            units: { [purchase.key]: purchase.totalAmount },
          });
          return;
        }
        default:
          return;
      }
    },
    [
      libraryMap,
      applySpend,
      addInstance,
      applyRefund,
      removeInstance,
      getRefund,
      setRegionUnlocked,
      goodsCostAt,
      shardCostAt,
      setGoodsUnlockIndex,
      setShardUnlockIndex,
      bumpGoodsUnlocks,
      bumpShardUnlocks,
      computeFastBuyTotals,
      applyResourceDelta,
      findInstanceId,
      computeHarvestDelta,
      applyHarvestDelta,
      applyFinishProductions,
      applyHarvestAll,
      applyMoveAction,
      applyAdminAdjust,
      producerMap,
      getPurchaseDelta,
      setReadyMap,
      setBuildLocks,
    ],
  );

  const applyBackward = useCallback(
    (action) => {
      if (!action) return;
      const defId = resolveDefId(action);
      const def = defId ? libraryMap?.[defId] : null;
      switch (action.type) {
        case ACTION_BUILD:
        case ACTION_BUILD_ADMIN: {
          if (!def) return;
          if (action.type === ACTION_BUILD) {
            applyRefund(def.cost);
          }
          const id = findInstanceId(action);
          if (id === null || id === undefined) return;
          removeInstance(id);
          return;
        }
        case ACTION_SELL:
        case ACTION_SELL_FULL:
        case ACTION_SELL_ADMIN: {
          if (!def) return;
          const refund = defId ? getRefund(defId) : null;
          if (!refund) return;
          // Reverse: sellFull spends original cost, sell spends refund amount, sellAdmin spends nothing
          if (action.type === ACTION_SELL) {
            applySpend(refund);
          } else if (action.type === ACTION_SELL_FULL) {
            applySpend(def.cost);
          }
          addInstance(
            action,
            def,
            action.harvestable ?? false,
            action.locked ?? isTierLocked(def.tier),
            defId,
          );
          return;
        }
        case ACTION_REGION_UNLOCK_GOODS: {
          setRegionUnlocked(action.regionIdx, false);
          const nextIdx = bumpGoodsUnlocks(-1);
          if (!action.admin) {
            if (!action.goodKey) return;
            const goodsCost = goodsCostAt(nextIdx);
            applyResourceDelta({
              goods: { [action.goodKey]: goodsCost },
            });
          }
          return;
        }
        case ACTION_REGION_UNLOCK_SHARDS: {
          setRegionUnlocked(action.regionIdx, false);
          const nextIdx = bumpShardUnlocks(-1);
          if (!action.admin) {
            const shardCost = shardCostAt(nextIdx);
            applyResourceDelta({ shards: shardCost });
          }
          return;
        }
        case ACTION_REGION_UNLOCK_ADMIN: {
          setRegionUnlocked(action.regionIdx, false);
          return;
        }
        case ACTION_REGION_LOCK_ADMIN: {
          setRegionUnlocked(action.regionIdx, true);
          if (action.method === "goods") {
            bumpGoodsUnlocks(1);
          } else if (action.method === "shards") {
            bumpShardUnlocks(1);
          }
          return;
        }
        case ACTION_GOODS_COST_ADMIN: {
          const prevIdx = Number.isFinite(action.prevIndex)
            ? action.prevIndex
            : resolveCostIndex(
                action.prevValue,
                REGION_GOODS_COSTS,
                goodsUnlocksRef.current ?? 0,
              );
          setGoodsUnlockIndex(prevIdx);
          return;
        }
        case ACTION_SHARDS_COST_ADMIN: {
          const prevIdx = Number.isFinite(action.prevIndex)
            ? action.prevIndex
            : resolveCostIndex(
                action.prevValue,
                REGION_SHARD_COSTS,
                shardUnlocksRef.current ?? 0,
              );
          setShardUnlockIndex(prevIdx);
          return;
        }
        case ACTION_BOOST_UNLOCK:
        case ACTION_BOOST_UNLOCK_ADMIN: {
          if (!def) return;
          const id = findInstanceId(action);
          if (id === null || id === undefined) return;
          if (action.type === ACTION_BOOST_UNLOCK) {
            applyResourceDelta({ shards: getUnlockCostForTier(def?.tier) });
          }
          setBuildLocks((prev) => {
            const next = { ...prev, [id]: true };
            buildLocksRef.current = next;
            return next;
          });
          return;
        }
        case ACTION_BOOST_READY:
        case ACTION_BOOST_READY_ADMIN: {
          if (!def) return;
          const id = findInstanceId(action);
          if (id === null || id === undefined) return;
          if (action.type === ACTION_BOOST_READY) {
            const cost = boostCostForDef(def);
            applyResourceDelta({ shards: cost });
          }
          setReadyMap((prev) => {
            const next = { ...prev, [id]: false };
            readyMapRef.current = next;
            return next;
          });
          return;
        }
        case ACTION_HARVEST: {
          const id = findInstanceId(action);
          if (id === null || id === undefined) return;
          const delta = computeHarvestDelta(defId);
          applyHarvestDelta(delta, -1);
          setReadyMap((prev) => {
            const next = { ...prev, [id]: true };
            readyMapRef.current = next;
            return next;
          });
          return;
        }
        case ACTION_FINISH_PRODUCTIONS: {
          return;
        }
        case ACTION_HARVEST_ALL: {
          return;
        }
        case ACTION_MOVE: {
          applyMoveAction(action, -1);
          return;
        }
        case ACTION_ADMIN_ADJUST: {
          applyAdminAdjust(action, -1);
          return;
        }
        case ACTION_GOODS_PURCHASE:
        case ACTION_GOODS_PURCHASE_ADMIN: {
          if (action.type === ACTION_GOODS_PURCHASE_ADMIN) return;
          const purchase = getPurchaseDelta(action, "goods");
          if (!purchase) return;
          applyResourceDelta({
            coins: purchase.coins,
            supplies: purchase.supplies,
            goods: { [purchase.key]: -purchase.totalAmount },
          });
          return;
        }
        case ACTION_UNIT_PURCHASE:
        case ACTION_UNIT_PURCHASE_ADMIN: {
          if (action.type === ACTION_UNIT_PURCHASE_ADMIN) return;
          const purchase = getPurchaseDelta(action, "units");
          if (!purchase) return;
          applyResourceDelta({
            coins: purchase.coins,
            supplies: purchase.supplies,
            units: { [purchase.key]: -purchase.totalAmount },
          });
          return;
        }
        default:
          return;
      }
    },
    [
      libraryMap,
      applyRefund,
      removeInstance,
      applySpend,
      addInstance,
      getRefund,
      setRegionUnlocked,
      setGoodsUnlockIndex,
      setShardUnlockIndex,
      bumpGoodsUnlocks,
      bumpShardUnlocks,
      goodsCostAt,
      shardCostAt,
      computeFastBuyTotals,
      applyResourceDelta,
      findInstanceId,
      computeHarvestDelta,
      applyHarvestDelta,
      applyMoveAction,
      applyAdminAdjust,
      producerMap,
      getPurchaseDelta,
      setReadyMap,
      setBuildLocks,
    ],
  );

  const computeStatsForLayout = useCallback(
    (layoutSnapshot, locksSnapshot) => {
      const unlocked = (layoutSnapshot || []).filter(
        (inst) => !locksSnapshot?.[inst.id],
      );
      const base = computeStats(unlocked, libraryMap);
      const lockedReq = (layoutSnapshot || []).reduce((acc, inst) => {
        if (!locksSnapshot?.[inst.id]) return acc;
        const def = libraryMap?.[inst.defId];
        if (!def || def.category === "housing") return acc;
        const req = def.requiresPeople ?? 0;
        return req > 0 ? acc + req : acc;
      }, 0);
      const withLocks = lockedReq
        ? { ...base, peopleReq: (base.peopleReq ?? 0) + lockedReq }
        : base;
      const coinBoostCfg = Number(config?.coinBoost ?? 0) / 100;
      const supplyBoostCfg = Number(config?.supplyBoost ?? 0) / 100;
      // Note: armyBoostRed/Blue now only come from decorations
      // Config attack/defense boosts are applied separately in StatsPanel
      return {
        ...withLocks,
        coinBoost: (withLocks.coinBoost ?? 0) + coinBoostCfg,
        supplyBoost: (withLocks.supplyBoost ?? 0) + supplyBoostCfg,
        armyBoostRed: withLocks.armyBoostRed ?? 0,
        armyBoostBlue: withLocks.armyBoostBlue ?? 0,
      };
    },
    [libraryMap, config],
  );

  const validateHistory = useCallback(() => {
    // For tree-based history, get actions from current path
    const list = getActionsToNode(selectedNodeId);
    const base = buildInitialGameState({ libraryMap, townhallDef });
    const seedResources = configStartResources || base.resources || {};
    const resources = {
      coins: seedResources.coins ?? 0,
      supplies: seedResources.supplies ?? 0,
      chronos: seedResources.chronos ?? 0,
      shards: seedResources.shards ?? 0,
      quantumActions: seedResources.quantumActions ?? 0,
      goods: { ...(seedResources.goods ?? {}) },
      units: { ...(seedResources.units ?? {}) },
    };
    let layoutSim = [...(base.layout ?? [])];
    let readySim = { ...(base.readyMap ?? {}) };
    let buildLocksSim = { ...(base.buildLocks ?? {}) };
    if (!Object.keys(buildLocksSim).length) {
      layoutSim.forEach((inst) => {
        buildLocksSim[inst.id] = isTierLocked(libraryMap?.[inst.defId]?.tier);
      });
    }
    let unlockedRegionsSim = [...(base.unlockedRegions ?? [])];
    let goodsUnlocksSim = base.goodsUnlocks ?? 0;
    let shardUnlocksSim = base.shardUnlocks ?? 0;
    let timeStepSim = base.timeStep ?? 1;
    let nextIdSim =
      layoutSim.reduce((max, inst) => Math.max(max, inst.id), 0) + 1;

    const resolveDefIdSim = (action) =>
      action?.defId || (action?.shortId ? shortIdMap?.[action.shortId] : null);

    const applyResourceDeltaSim = (delta, { force = false } = {}) => {
      // NOTE: We no longer check infiniteResources here.
      // Tree simulations should always calculate resources based on what
      // actually happened (using action.admin flag), not current mode.
      if (!delta) return;
      resources.coins += delta.coins ?? 0;
      resources.supplies += delta.supplies ?? 0;
      resources.chronos += delta.chronos ?? 0;
      resources.shards += delta.shards ?? 0;
      resources.quantumActions += delta.quantumActions ?? 0;
      if (delta.goods) {
        Object.entries(delta.goods).forEach(([key, value]) => {
          resources.goods[key] = (resources.goods[key] ?? 0) + value;
        });
      }
      if (delta.units) {
        Object.entries(delta.units).forEach(([key, value]) => {
          resources.units[key] = (resources.units[key] ?? 0) + value;
        });
      }
    };

    const applySpendSim = (cost) => {
      if (!cost) return;
      applyResourceDeltaSim({
        coins: -(cost.coins ?? 0),
        supplies: -(cost.supplies ?? 0),
        chronos: -(cost.chronos ?? 0),
      }, { force: true });
    };

    const applyRefundSim = (refund) => {
      if (!refund) return;
      applyResourceDeltaSim({
        coins: refund.coins ?? 0,
        supplies: refund.supplies ?? 0,
        chronos: refund.chronos ?? 0,
      }, { force: true });
    };

    const findSimInstance = (action) => {
      if (action.instanceId !== null && action.instanceId !== undefined) {
        return layoutSim.find((inst) => inst.id === action.instanceId) || null;
      }
      const defId = resolveDefIdSim(action);
      return (
        layoutSim.find(
          (inst) => inst.defId === defId && inst.x === action.x && inst.y === action.y,
        ) || null
      );
    };

    const removeSimInstance = (id) => {
      layoutSim = layoutSim.filter((inst) => inst.id !== id);
      delete readySim[id];
      delete buildLocksSim[id];
    };

    const addSimInstance = (action, def, defId) => {
      const id =
        action.instanceId !== null && action.instanceId !== undefined
          ? action.instanceId
          : nextIdSim++;
      const instance = {
        id,
        defId,
        x: action.x,
        y: action.y,
        width: action.width ?? def.width,
        height: action.height ?? def.height,
      };
      layoutSim = [...layoutSim, instance];
      readySim[id] = false;
      buildLocksSim[id] = isTierLocked(def.tier);
    };

    const applyMoveSim = (action) => {
      const moves = normalizeMovePositions(action);
      if (!moves.length) return;
      const map = new Map();
      moves.forEach(([x, y, xn, yn]) => {
        map.set(`${x},${y}`, { x: xn, y: yn });
      });
      if (!map.size) return;
      layoutSim = layoutSim.map((inst) => {
        const key = `${inst.x},${inst.y}`;
        const dest = map.get(key);
        if (!dest) return inst;
        return { ...inst, x: dest.x, y: dest.y };
      });
    };

    const applyAdminAdjustSim = (action) => {
      if (!action) return;
      const delta = action.delta ?? 0;
      if (action.group === "goods") {
        const deltas = action.deltaByKey || { [action.key]: delta };
        applyResourceDeltaSim({ goods: deltas }, { force: true });
        return;
      }
      if (action.group === "units") {
        const deltas = action.deltaByKey || { [action.key]: delta };
        applyResourceDeltaSim({ units: deltas }, { force: true });
        return;
      }
      if (action.key) {
        applyResourceDeltaSim({ [action.key]: delta }, { force: true });
      }
    };

    const applyFinishProductionsSim = (skipResources = false) => {
      readySim = finishProductionsReadyMap(
        layoutSim,
        libraryMap,
        readySim,
        buildLocksSim,
      );
      const baseQa = qaBasePerHour * (qaHoursPerHarvest ?? 0);
      if (baseQa > 0 && !skipResources) {
        applyResourceDeltaSim({ quantumActions: baseQa });
      }
      timeStepSim = Math.min(23, (timeStepSim ?? 1) + 1);
    };

    const applyHarvestAllSim = (skipResources = false) => {
      const readyOnes = layoutSim.filter((b) => readySim[b.id] === true);
      const isFullHarvest = readyOnes.length === 0;
      const locksBefore = { ...buildLocksSim };
      Object.keys(buildLocksSim).forEach((key) => {
        if (buildLocksSim[key]) buildLocksSim[key] = false;
      });

      const effectiveStats = applyConfigBoosts(
        computeStats(layoutSim, libraryMap),
      );
      const baseQa = qaBasePerHour * (qaHoursPerHarvest ?? 0);
      const extraQa = isFullHarvest ? baseQa : 0;
      const targets = isFullHarvest ? layoutSim : readyOnes;

      const lockedIds = [];
      const harvestable = [];
      const lockedCulture = [];
      targets.forEach((inst) => {
        if (locksBefore[inst.id]) {
          const def = libraryMap[inst.defId];
          if (def?.category === "culture") {
            lockedCulture.push(inst);
          } else {
            lockedIds.push(inst.id);
          }
        } else {
          harvestable.push(inst);
        }
      });

      const total =
        harvestable.length > 0
          ? aggregateHarvest(harvestable, libraryMap, effectiveStats, {
              qaHoursPerHarvest: qaHoursPerHarvest ?? 0,
            })
          : { coins: 0, supplies: 0, chronos: 0, goods: {}, qa: 0 };
      const qaFromLockedCulture = lockedCulture.reduce(
        (acc, inst) =>
          acc +
          (libraryMap[inst.defId]?.quantumActions ?? 0) *
            (qaHoursPerHarvest ?? 0),
        0,
      );
      total.qa = (total.qa ?? 0) + qaFromLockedCulture + extraQa;

      if (!skipResources) {
        applyResourceDeltaSim({
          coins: total.coins ?? 0,
          supplies: total.supplies ?? 0,
          chronos: total.chronos ?? 0,
          quantumActions: total.qa ?? 0,
          goods: total.goods ?? {},
        });
      }

      targets.forEach((inst) => {
        readySim[inst.id] = false;
      });
      [...lockedIds, ...lockedCulture.map((inst) => inst.id)].forEach(
        (id) => {
          buildLocksSim[id] = false;
        },
      );
      if (isFullHarvest) {
        timeStepSim = Math.min(23, (timeStepSim ?? 1) + 1);
      }
    };

    const hasNegativeResources = () => {
      if (resources.coins < 0) return true;
      if (resources.supplies < 0) return true;
      if (resources.chronos < 0) return true;
      if (!allowShardLimitOverflow(config) && resources.shards < 0) return true;
      if (resources.quantumActions < 0) return true;
      if (Object.values(resources.goods).some((v) => (v ?? 0) < 0)) return true;
      if (Object.values(resources.units).some((v) => (v ?? 0) < 0)) return true;
      return false;
    };

    const isStepInvalid = () => {
      const statsSnapshot = computeStatsForLayout(layoutSim, buildLocksSim);
      const freePeople =
        (statsSnapshot.people ?? 0) - (statsSnapshot.peopleReq ?? 0);
      return hasNegativeResources() || freePeople < 0;
    };

    const invalid = [];
    if (isStepInvalid()) invalid.push(0);

    list.forEach((action, idx) => {
      const defId = resolveDefIdSim(action);
      const def = defId ? libraryMap?.[defId] : null;
      switch (action.type) {
        case ACTION_BUILD:
        case ACTION_BUILD_ADMIN: {
          if (!def) break;
          if (action.type === ACTION_BUILD) {
            applySpendSim(def.cost);
          }
          addSimInstance(action, def, defId);
          break;
        }
        case ACTION_SELL:
        case ACTION_SELL_FULL:
        case ACTION_SELL_ADMIN: {
          if (!def) break;
          const refund = getRefund(defId);
          if (action.type === ACTION_SELL) {
            applyRefundSim(refund);
          } else if (action.type === ACTION_SELL_FULL) {
            applyRefundSim(def.cost);
          }
          const target = findSimInstance(action);
          if (target) removeSimInstance(target.id);
          break;
        }
        case ACTION_REGION_UNLOCK_GOODS: {
          const goodsCost = goodsCostAt(goodsUnlocksSim);
          if (!action.admin) {
            if (!action.goodKey) break;
            applyResourceDeltaSim({
              goods: { [action.goodKey]: -goodsCost },
            });
          }
          goodsUnlocksSim += 1;
          if (action.regionIdx !== null && action.regionIdx !== undefined) {
            unlockedRegionsSim[action.regionIdx] = true;
          }
          break;
        }
        case ACTION_REGION_UNLOCK_SHARDS: {
          const shardCost = shardCostAt(shardUnlocksSim);
          if (!action.admin) {
            applyResourceDeltaSim({ shards: -shardCost });
          }
          shardUnlocksSim += 1;
          if (action.regionIdx !== null && action.regionIdx !== undefined) {
            unlockedRegionsSim[action.regionIdx] = true;
          }
          break;
        }
        case ACTION_REGION_UNLOCK_ADMIN: {
          if (action.regionIdx !== null && action.regionIdx !== undefined) {
            unlockedRegionsSim[action.regionIdx] = true;
          }
          break;
        }
        case ACTION_REGION_LOCK_ADMIN: {
          if (action.regionIdx !== null && action.regionIdx !== undefined) {
            unlockedRegionsSim[action.regionIdx] = false;
          }
          if (action.method === "goods") {
            goodsUnlocksSim = clampIndex(
              goodsUnlocksSim - 1,
              REGION_GOODS_COSTS.length - 1,
            );
          } else if (action.method === "shards") {
            shardUnlocksSim = clampIndex(
              shardUnlocksSim - 1,
              REGION_SHARD_COSTS.length - 1,
            );
          }
          break;
        }
        case ACTION_GOODS_COST_ADMIN: {
          const nextIdx = Number.isFinite(action.nextIndex)
            ? action.nextIndex
            : resolveCostIndex(
                action.nextValue,
                REGION_GOODS_COSTS,
                goodsUnlocksSim,
              );
          goodsUnlocksSim = clampIndex(
            nextIdx,
            REGION_GOODS_COSTS.length - 1,
          );
          break;
        }
        case ACTION_SHARDS_COST_ADMIN: {
          const nextIdx = Number.isFinite(action.nextIndex)
            ? action.nextIndex
            : resolveCostIndex(
                action.nextValue,
                REGION_SHARD_COSTS,
                shardUnlocksSim,
              );
          shardUnlocksSim = clampIndex(
            nextIdx,
            REGION_SHARD_COSTS.length - 1,
          );
          break;
        }
        case ACTION_BOOST_UNLOCK:
        case ACTION_BOOST_UNLOCK_ADMIN: {
          if (!def) break;
          const target = findSimInstance(action);
          if (!target) break;
          if (action.type === ACTION_BOOST_UNLOCK) {
            applyResourceDeltaSim({ shards: -getUnlockCostForTier(def?.tier) });
          }
          buildLocksSim[target.id] = false;
          break;
        }
        case ACTION_BOOST_READY:
        case ACTION_BOOST_READY_ADMIN: {
          if (!def) break;
          const target = findSimInstance(action);
          if (!target) break;
          if (action.type === ACTION_BOOST_READY) {
            const cost = boostCostForDef(def);
            applyResourceDeltaSim({ shards: -cost });
          }
          readySim[target.id] = true;
          break;
        }
        case ACTION_HARVEST: {
          const target = findSimInstance(action);
          if (!target) break;
          const statsSnapshot = computeStatsForLayout(
            layoutSim,
            buildLocksSim,
          );
          const qaHours = Number(qaHoursPerHarvest ?? 0);
          const delta = computeBuildingHarvest(
            { defId: target.defId },
            libraryMap,
            statsSnapshot,
            { qaHoursPerHarvest: qaHours },
          );
          applyResourceDeltaSim({
            coins: delta.coins ?? 0,
            supplies: delta.supplies ?? 0,
            chronos: delta.chronos ?? 0,
            quantumActions: delta.qa ?? 0,
            goods: delta.goods ?? {},
          });
          readySim[target.id] = false;
          break;
        }
        case ACTION_FINISH_PRODUCTIONS: {
          applyFinishProductionsSim(false);
          break;
        }
        case ACTION_HARVEST_ALL: {
          applyHarvestAllSim(false);
          break;
        }
        case ACTION_MOVE: {
          applyMoveSim(action);
          break;
        }
        case ACTION_ADMIN_ADJUST: {
          applyAdminAdjustSim(action);
          break;
        }
        case ACTION_GOODS_PURCHASE:
        case ACTION_GOODS_PURCHASE_ADMIN: {
          if (action.type === ACTION_GOODS_PURCHASE_ADMIN) break;
          const purchase = getPurchaseDelta(action, "goods");
          if (!purchase) break;
          applyResourceDeltaSim({
            coins: -purchase.coins,
            supplies: -purchase.supplies,
            goods: { [purchase.key]: purchase.totalAmount },
          });
          break;
        }
        case ACTION_UNIT_PURCHASE:
        case ACTION_UNIT_PURCHASE_ADMIN: {
          if (action.type === ACTION_UNIT_PURCHASE_ADMIN) break;
          const purchase = getPurchaseDelta(action, "units");
          if (!purchase) break;
          applyResourceDeltaSim({
            coins: -purchase.coins,
            supplies: -purchase.supplies,
            units: { [purchase.key]: purchase.totalAmount },
          });
          break;
        }
        default:
          break;
      }
      if (isStepInvalid()) invalid.push(idx + 1);
    });

    return invalid;
  }, [
    getActionsToNode,
    selectedNodeId,
    libraryMap,
    townhallDef,
    configStartResources,
    shortIdMap,
    computeStatsForLayout,
    getRefund,
    goodsCostAt,
    shardCostAt,
    computeFastBuyTotals,
    qaHoursPerHarvest,
    applyConfigBoosts,
    producerMap,
    getPurchaseDelta,
    qaBasePerHour,
  ]);

  useEffect(() => {
    if (configRevision === undefined || configRevision === null) return;
    setHistoryChecking(true);
    const timer = setTimeout(() => {
      const invalid = validateHistory();
      setInvalidSteps(invalid);
      setHistoryChecking(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [configRevision, validateHistory]);

  const computeStateAtNode = useCallback(
    (targetNodeId) => {
      // Get all actions on the path from root to target node
      const actionsOnPath = getActionsToNode(targetNodeId);
      const base = buildInitialGameState({ libraryMap, townhallDef });
      const seedResources = configStartResources || base.resources || {};
      const resources = {
        coins: seedResources.coins ?? 0,
        supplies: seedResources.supplies ?? 0,
        chronos: seedResources.chronos ?? 0,
        shards: seedResources.shards ?? 0,
        quantumActions: seedResources.quantumActions ?? 0,
        goods: { ...(seedResources.goods ?? {}) },
        units: { ...(seedResources.units ?? {}) },
      };
      let layoutSim = [...(base.layout ?? [])];
      let readySim = { ...(base.readyMap ?? {}) };
      let buildLocksSim = { ...(base.buildLocks ?? {}) };
      if (!Object.keys(buildLocksSim).length) {
        layoutSim.forEach((inst) => {
          buildLocksSim[inst.id] = isTierLocked(libraryMap?.[inst.defId]?.tier);
        });
      }
      let unlockedRegionsSim = [...(base.unlockedRegions ?? [])];
      let goodsUnlocksSim = base.goodsUnlocks ?? 0;
      let shardUnlocksSim = base.shardUnlocks ?? 0;
      let timeStepSim = base.timeStep ?? 1;
      let nextIdSim =
        layoutSim.reduce((max, inst) => Math.max(max, inst.id), 0) + 1;

      const resolveDefIdSim = (action) =>
        action?.defId || (action?.shortId ? shortIdMap?.[action.shortId] : null);

      const applyResourceDeltaSim = (delta, { force = false } = {}) => {
        // NOTE: We no longer check infiniteResources here.
        // Tree simulations should always calculate resources based on what
        // actually happened (using action.admin flag), not current mode.
        if (!delta) return;
        resources.coins += delta.coins ?? 0;
        resources.supplies += delta.supplies ?? 0;
        resources.chronos += delta.chronos ?? 0;
        resources.shards += delta.shards ?? 0;
        resources.quantumActions += delta.quantumActions ?? 0;
        if (delta.goods) {
          Object.entries(delta.goods).forEach(([key, value]) => {
            resources.goods[key] = (resources.goods[key] ?? 0) + value;
          });
        }
        if (delta.units) {
          Object.entries(delta.units).forEach(([key, value]) => {
            resources.units[key] = (resources.units[key] ?? 0) + value;
          });
        }
      };

      const applySpendSim = (cost) => {
        if (!cost) return;
        applyResourceDeltaSim({
          coins: -(cost.coins ?? 0),
          supplies: -(cost.supplies ?? 0),
          chronos: -(cost.chronos ?? 0),
        }, { force: true });
      };

      const applyRefundSim = (refund) => {
        if (!refund) return;
        applyResourceDeltaSim({
          coins: refund.coins ?? 0,
          supplies: refund.supplies ?? 0,
          chronos: refund.chronos ?? 0,
        }, { force: true });
      };

      const findSimInstance = (action) => {
        if (action.instanceId !== null && action.instanceId !== undefined) {
          return layoutSim.find((inst) => inst.id === action.instanceId) || null;
        }
        const defId = resolveDefIdSim(action);
        return (
          layoutSim.find(
            (inst) => inst.defId === defId && inst.x === action.x && inst.y === action.y,
          ) || null
        );
      };

      const removeSimInstance = (id) => {
        layoutSim = layoutSim.filter((inst) => inst.id !== id);
        delete readySim[id];
        delete buildLocksSim[id];
      };

      const addSimInstance = (action, def, defId) => {
        const id =
          action.instanceId !== null && action.instanceId !== undefined
            ? action.instanceId
            : nextIdSim++;
        const instance = {
          id,
          defId,
          x: action.x,
          y: action.y,
          width: action.width ?? def.width,
          height: action.height ?? def.height,
        };
        layoutSim = [...layoutSim, instance];
        readySim[id] = false;
        buildLocksSim[id] = isTierLocked(def.tier);
      };

      const applyMoveSim = (action) => {
        const moves = normalizeMovePositions(action);
        if (!moves.length) return;
        const map = new Map();
        moves.forEach(([x, y, xn, yn]) => {
          map.set(`${x},${y}`, { x: xn, y: yn });
        });
        if (!map.size) return;
        layoutSim = layoutSim.map((inst) => {
          const key = `${inst.x},${inst.y}`;
          const dest = map.get(key);
          if (!dest) return inst;
          return { ...inst, x: dest.x, y: dest.y };
        });
      };

      const applyAdminAdjustSim = (action) => {
        if (!action) return;
        const delta = action.delta ?? 0;
        if (action.group === "goods") {
          const deltas = action.deltaByKey || { [action.key]: delta };
          applyResourceDeltaSim({ goods: deltas }, { force: true });
          return;
        }
        if (action.group === "units") {
          const deltas = action.deltaByKey || { [action.key]: delta };
          applyResourceDeltaSim({ units: deltas }, { force: true });
          return;
        }
        if (action.key) {
          applyResourceDeltaSim({ [action.key]: delta }, { force: true });
        }
      };

      const applyFinishProductionsSim = (skipResources = false) => {
        readySim = finishProductionsReadyMap(
          layoutSim,
          libraryMap,
          readySim,
          buildLocksSim,
        );
        const baseQa = qaBasePerHour * (qaHoursPerHarvest ?? 0);
        if (baseQa > 0 && !skipResources) {
          applyResourceDeltaSim({ quantumActions: baseQa });
        }
        timeStepSim = Math.min(23, (timeStepSim ?? 1) + 1);
      };

      const applyHarvestAllSim = (skipResources = false) => {
        const readyOnes = layoutSim.filter((b) => readySim[b.id] === true);
        const isFullHarvest = readyOnes.length === 0;
        const locksBefore = { ...buildLocksSim };
        Object.keys(buildLocksSim).forEach((key) => {
          if (buildLocksSim[key]) buildLocksSim[key] = false;
        });

        const effectiveStats = applyConfigBoosts(
          computeStats(layoutSim, libraryMap),
        );
        const baseQa = qaBasePerHour * (qaHoursPerHarvest ?? 0);
        const extraQa = isFullHarvest ? baseQa : 0;
        const targets = isFullHarvest ? layoutSim : readyOnes;

        const lockedIds = [];
        const harvestable = [];
        const lockedCulture = [];
        targets.forEach((inst) => {
          if (locksBefore[inst.id]) {
            const def = libraryMap[inst.defId];
            if (def?.category === "culture") {
              lockedCulture.push(inst);
            } else {
              lockedIds.push(inst.id);
            }
          } else {
            harvestable.push(inst);
          }
        });

        const total =
          harvestable.length > 0
            ? aggregateHarvest(harvestable, libraryMap, effectiveStats, {
                qaHoursPerHarvest: qaHoursPerHarvest ?? 0,
              })
            : { coins: 0, supplies: 0, chronos: 0, goods: {}, qa: 0 };
        const qaFromLockedCulture = lockedCulture.reduce(
          (acc, inst) =>
            acc +
            (libraryMap[inst.defId]?.quantumActions ?? 0) *
              (qaHoursPerHarvest ?? 0),
          0,
        );
        total.qa = (total.qa ?? 0) + qaFromLockedCulture + extraQa;

        if (!skipResources) {
          applyResourceDeltaSim({
            coins: total.coins ?? 0,
            supplies: total.supplies ?? 0,
            chronos: total.chronos ?? 0,
            quantumActions: total.qa ?? 0,
            goods: total.goods ?? {},
          });
        }

        targets.forEach((inst) => {
          readySim[inst.id] = false;
        });
        [...lockedIds, ...lockedCulture.map((inst) => inst.id)].forEach(
          (id) => {
            buildLocksSim[id] = false;
          },
        );
        if (isFullHarvest) {
          timeStepSim = Math.min(23, (timeStepSim ?? 1) + 1);
        }
      };

      // Iterate over actions on the path from root to target node
      for (const action of actionsOnPath) {
        const defId = resolveDefIdSim(action);
        const def = defId ? libraryMap?.[defId] : null;
        switch (action.type) {
          case ACTION_BUILD:
          case ACTION_BUILD_ADMIN: {
            if (!def) break;
            if (action.type === ACTION_BUILD) {
              applySpendSim(def.cost);
            }
            addSimInstance(action, def, defId);
            break;
          }
          case ACTION_SELL:
          case ACTION_SELL_FULL:
          case ACTION_SELL_ADMIN: {
            if (!def) break;
            const refund = getRefund(defId);
            if (action.type === ACTION_SELL) {
              applyRefundSim(refund);
            } else if (action.type === ACTION_SELL_FULL) {
              applyRefundSim(def.cost);
            }
            const target = findSimInstance(action);
            if (target) removeSimInstance(target.id);
            break;
          }
          case ACTION_REGION_UNLOCK_GOODS: {
            const goodsCost = goodsCostAt(goodsUnlocksSim);
            if (!action.admin) {
              if (!action.goodKey) break;
              applyResourceDeltaSim({
                goods: { [action.goodKey]: -goodsCost },
              });
            }
            goodsUnlocksSim += 1;
            if (action.regionIdx !== null && action.regionIdx !== undefined) {
              unlockedRegionsSim[action.regionIdx] = true;
            }
            break;
          }
          case ACTION_REGION_UNLOCK_SHARDS: {
            const shardCost = shardCostAt(shardUnlocksSim);
            if (!action.admin) {
              applyResourceDeltaSim({ shards: -shardCost });
            }
            shardUnlocksSim += 1;
            if (action.regionIdx !== null && action.regionIdx !== undefined) {
              unlockedRegionsSim[action.regionIdx] = true;
            }
            break;
          }
          case ACTION_REGION_UNLOCK_ADMIN: {
            if (action.regionIdx !== null && action.regionIdx !== undefined) {
              unlockedRegionsSim[action.regionIdx] = true;
            }
            break;
          }
          case ACTION_REGION_LOCK_ADMIN: {
            if (action.regionIdx !== null && action.regionIdx !== undefined) {
              unlockedRegionsSim[action.regionIdx] = false;
            }
            if (action.method === "goods") {
              goodsUnlocksSim = clampIndex(
                goodsUnlocksSim - 1,
                REGION_GOODS_COSTS.length - 1,
              );
            } else if (action.method === "shards") {
              shardUnlocksSim = clampIndex(
                shardUnlocksSim - 1,
                REGION_SHARD_COSTS.length - 1,
              );
            }
            break;
          }
          case ACTION_GOODS_COST_ADMIN: {
            const nextIdx = Number.isFinite(action.nextIndex)
              ? action.nextIndex
              : resolveCostIndex(
                  action.nextValue,
                  REGION_GOODS_COSTS,
                  goodsUnlocksSim,
                );
            goodsUnlocksSim = clampIndex(
              nextIdx,
              REGION_GOODS_COSTS.length - 1,
            );
            break;
          }
          case ACTION_SHARDS_COST_ADMIN: {
            const nextIdx = Number.isFinite(action.nextIndex)
              ? action.nextIndex
              : resolveCostIndex(
                  action.nextValue,
                  REGION_SHARD_COSTS,
                  shardUnlocksSim,
                );
            shardUnlocksSim = clampIndex(
              nextIdx,
              REGION_SHARD_COSTS.length - 1,
            );
            break;
          }
          case ACTION_BOOST_UNLOCK:
          case ACTION_BOOST_UNLOCK_ADMIN: {
            if (!def) break;
            const target = findSimInstance(action);
            if (!target) break;
            if (action.type === ACTION_BOOST_UNLOCK) {
              applyResourceDeltaSim({ shards: -getUnlockCostForTier(def?.tier) });
            }
            buildLocksSim[target.id] = false;
            break;
          }
          case ACTION_BOOST_READY:
          case ACTION_BOOST_READY_ADMIN: {
            if (!def) break;
            const target = findSimInstance(action);
            if (!target) break;
            if (action.type === ACTION_BOOST_READY) {
              const cost = boostCostForDef(def);
              applyResourceDeltaSim({ shards: -cost });
            }
            readySim[target.id] = true;
            break;
          }
          case ACTION_HARVEST: {
            const target = findSimInstance(action);
            if (!target) break;
            const statsSnapshot = computeStatsForLayout(
              layoutSim,
              buildLocksSim,
            );
            const qaHours = Number(qaHoursPerHarvest ?? 0);
            const delta = computeBuildingHarvest(
              { defId: target.defId },
              libraryMap,
              statsSnapshot,
              { qaHoursPerHarvest: qaHours },
            );
            applyResourceDeltaSim({
              coins: delta.coins ?? 0,
              supplies: delta.supplies ?? 0,
              chronos: delta.chronos ?? 0,
              quantumActions: delta.qa ?? 0,
              goods: delta.goods ?? {},
            });
            readySim[target.id] = false;
            break;
          }
          case ACTION_FINISH_PRODUCTIONS: {
            applyFinishProductionsSim(false);
            break;
          }
          case ACTION_HARVEST_ALL: {
            applyHarvestAllSim(false);
            break;
          }
          case ACTION_MOVE: {
            applyMoveSim(action);
            break;
          }
          case ACTION_ADMIN_ADJUST: {
            applyAdminAdjustSim(action);
            break;
          }
          case ACTION_GOODS_PURCHASE:
          case ACTION_GOODS_PURCHASE_ADMIN: {
            if (action.type === ACTION_GOODS_PURCHASE_ADMIN) break;
            const purchase = getPurchaseDelta(action, "goods");
            if (!purchase) break;
            applyResourceDeltaSim({
              coins: -purchase.coins,
              supplies: -purchase.supplies,
              goods: { [purchase.key]: purchase.totalAmount },
            });
            break;
          }
          case ACTION_UNIT_PURCHASE:
          case ACTION_UNIT_PURCHASE_ADMIN: {
            if (action.type === ACTION_UNIT_PURCHASE_ADMIN) break;
            const purchase = getPurchaseDelta(action, "units");
            if (!purchase) break;
            applyResourceDeltaSim({
              coins: -purchase.coins,
              supplies: -purchase.supplies,
              units: { [purchase.key]: purchase.totalAmount },
            });
            break;
          }
          default:
            break;
        }
      }

      // Compute stats for free population check
      const stats = computeStats(layoutSim, libraryMap);
      
      return {
        resources,
        layout: layoutSim,
        readyMap: readySim,
        buildLocks: buildLocksSim,
        unlockedRegions: unlockedRegionsSim,
        goodsUnlocks: goodsUnlocksSim,
        shardUnlocks: shardUnlocksSim,
        timeStep: timeStepSim,
        nextId: nextIdSim,
        stats,
      };
    },
    [
      getActionsToNode,
      libraryMap,
      townhallDef,
      configStartResources,
      shortIdMap,
      computeStatsForLayout,
      getRefund,
      goodsCostAt,
      shardCostAt,
      computeFastBuyTotals,
      qaHoursPerHarvest,
      applyConfigBoosts,
      producerMap,
      getPurchaseDelta,
      qaBasePerHour,
    ],
  );

  const isPlacementInsideUnlocked = useCallback((inst, unlockedRegions) => {
    if (!inst) return false;
    const x = Number(inst.x);
    const y = Number(inst.y);
    const width = Number(inst.width);
    const height = Number(inst.height);
    if (
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !Number.isFinite(width) ||
      !Number.isFinite(height)
    ) {
      return false;
    }
    if (x < 0 || y < 0 || x + width > BOARD_WIDTH || y + height > BOARD_HEIGHT) {
      return false;
    }
    for (let cy = y; cy < y + height; cy += 1) {
      for (let cx = x; cx < x + width; cx += 1) {
        const regionIdx =
          Math.floor(cx / REGION_SIZE) + REGION_COLS * Math.floor(cy / REGION_SIZE);
        if (!unlockedRegions?.[regionIdx]) {
          return false;
        }
      }
    }
    return true;
  }, []);

  const solveLayoutWithMovableSet = useCallback((layoutSnapshot, movableIds, unlockedRegions) => {
    if (!Array.isArray(layoutSnapshot) || !layoutSnapshot.length) return [];

    const movableIdSet =
      movableIds instanceof Set ? movableIds : new Set(movableIds || []);
    const fixedInstances = [];
    const movableInstances = [];
    layoutSnapshot.forEach((inst) => {
      if (!inst) return;
      if (movableIdSet.has(inst.id)) {
        movableInstances.push(inst);
      } else {
        fixedInstances.push(inst);
      }
    });

    if (!movableInstances.length) return null;

    const isCellUnlocked = (x, y) => {
      const regionIdx =
        Math.floor(x / REGION_SIZE) + REGION_COLS * Math.floor(y / REGION_SIZE);
      return !!unlockedRegions?.[regionIdx];
    };
    const mask = buildTilingMask(BOARD_WIDTH, BOARD_HEIGHT, isCellUnlocked);
    const workingMask = mask.map((row) => [...row]);

    for (const inst of fixedInstances) {
      const width = Number(inst.width);
      const height = Number(inst.height);
      const x = Number(inst.x);
      const y = Number(inst.y);
      if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (x < 0 || y < 0 || x + width > BOARD_WIDTH || y + height > BOARD_HEIGHT) {
        return null;
      }
      for (let cy = y; cy < y + height; cy += 1) {
        for (let cx = x; cx < x + width; cx += 1) {
          if (!workingMask[cy]?.[cx]) return null;
          workingMask[cy][cx] = false;
        }
      }
    }

    const { groups, blocks } = buildTilingGroups(movableInstances);
    if (!blocks.length) return null;
    const solution = solveTilingMask(workingMask, blocks, { allowGaps: true });
    if (!solution) return null;

    const maxId = Math.max(0, ...layoutSnapshot.map((inst) => Number(inst?.id ?? 0)));
    const result = applyTilingSolution(solution, groups, maxId + 1);
    if (!result?.layout) return null;

    return [...fixedInstances, ...result.layout];
  }, []);

  const solveLayoutWithAllMovable = useCallback((layoutSnapshot, unlockedRegions) => {
    if (!Array.isArray(layoutSnapshot) || !layoutSnapshot.length) return [];
    const isCellUnlocked = (x, y) => {
      const regionIdx =
        Math.floor(x / REGION_SIZE) + REGION_COLS * Math.floor(y / REGION_SIZE);
      return !!unlockedRegions?.[regionIdx];
    };
    const mask = buildTilingMask(BOARD_WIDTH, BOARD_HEIGHT, isCellUnlocked);
    const { groups, blocks } = buildTilingGroups(layoutSnapshot);
    if (!blocks.length) return [];
    const solution = solveTilingMask(mask, blocks, { allowGaps: true });
    if (!solution) return null;
    const maxId = Math.max(0, ...layoutSnapshot.map((inst) => Number(inst?.id ?? 0)));
    const result = applyTilingSolution(solution, groups, maxId + 1);
    return result?.layout || null;
  }, []);

  const getConsecutiveBuildChain = useCallback((startNodeId, nodes) => {
    const chain = [];
    let currentId = startNodeId;
    while (currentId !== null && currentId !== undefined) {
      const node = nodes.get(currentId);
      if (!node || !isBuildActionType(node.action?.type)) break;
      chain.push(currentId);
      if ((node.childrenIds?.length ?? 0) !== 1) break;
      const childId = node.childrenIds[0];
      const child = nodes.get(childId);
      if (!child || !isBuildActionType(child.action?.type)) break;
      currentId = childId;
    }
    return chain;
  }, []);

  const buildOrderFixPlan = useCallback(
    (startNodeId, unlockedRegions) => {
      const nodes = historyTree.nodes;
      const startNode = nodes.get(startNodeId);
      if (!startNode || !isBuildActionType(startNode.action?.type)) return null;

      const chainNodeIds = getConsecutiveBuildChain(startNodeId, nodes);
      if (!chainNodeIds.length) return null;

      const chainStartNode = nodes.get(chainNodeIds[0]);
      const chainParentId = chainStartNode?.parentId ?? 0;
      const preChainState = computeStateAtNode(chainParentId);
      if (!preChainState?.layout) return null;

      let previousLayout = preChainState.layout;
      let chainEndState = preChainState;
      const chainEntries = [];

      for (const nodeId of chainNodeIds) {
        const node = nodes.get(nodeId);
        if (!node?.action) continue;
        const nodeState = computeStateAtNode(nodeId);
        if (!nodeState?.layout) continue;
        const previousIds = new Set(previousLayout.map((inst) => inst.id));
        let added = nodeState.layout.find((inst) => !previousIds.has(inst.id)) || null;

        if (!added) {
          const action = node.action;
          const actionDefId =
            action.defId || (action.shortId ? shortIdMap?.[action.shortId] : null);
          added =
            nodeState.layout.find((inst) => {
              if (previousIds.has(inst.id)) return false;
              if (actionDefId && inst.defId !== actionDefId) return false;
              return inst.x === action.x && inst.y === action.y;
            }) || null;
        }

        if (added) {
          const originalXRaw = Number(node.action.x);
          const originalYRaw = Number(node.action.y);
          chainEntries.push({
            nodeId,
            instanceId: added.id,
            defId: added.defId,
            width: added.width,
            height: added.height,
            originalX: Number.isFinite(originalXRaw) ? originalXRaw : added.x,
            originalY: Number.isFinite(originalYRaw) ? originalYRaw : added.y,
          });
        }

        previousLayout = nodeState.layout;
        chainEndState = nodeState;
      }

      if (!chainEntries.length) return null;

      const finalLayout = chainEndState.layout || [];
      const finalById = new Map(finalLayout.map((inst) => [inst.id, inst]));
      const preChainLayout = preChainState.layout || [];

      const fixedForDetection = [...preChainLayout];
      const sortableNodeIds = [];
      const sortableInstanceIds = new Set();

      for (const entry of chainEntries) {
        const placed = finalById.get(entry.instanceId);
        if (!placed) continue;

        const candidate = {
          ...placed,
          x: entry.originalX,
          y: entry.originalY,
          width: entry.width,
          height: entry.height,
        };

        let problematic = !isPlacementInsideUnlocked(candidate, unlockedRegions);
        if (!problematic) {
          for (const fixedInst of fixedForDetection) {
            if (rectanglesOverlap(candidate, fixedInst)) {
              problematic = true;
              break;
            }
          }
        }

        if (problematic) {
          sortableNodeIds.push(entry.nodeId);
          sortableInstanceIds.add(entry.instanceId);
        } else {
          fixedForDetection.push(candidate);
        }
      }

      const buildPlanFromLayout = (solvedLayout, mode) => {
        if (!Array.isArray(solvedLayout) || !solvedLayout.length) return null;
        const solvedById = new Map(solvedLayout.map((inst) => [inst.id, inst]));
        const solvedList = [...solvedLayout];
        const updateNodeIds =
          mode === "partial"
            ? new Set(sortableNodeIds)
            : new Set(chainEntries.map((entry) => entry.nodeId));

        const usedSolvedIds = new Set();
        const reserveSolvedById = (id) => {
          const solvedInst = solvedById.get(id);
          if (!solvedInst || usedSolvedIds.has(solvedInst.id)) return false;
          usedSolvedIds.add(solvedInst.id);
          return true;
        };
        const findUnusedSolvedForEntry = (entry, { samePosition = false } = {}) => {
          // Prefer identity match first.
          const byId = solvedById.get(entry.instanceId);
          if (byId && !usedSolvedIds.has(byId.id)) {
            if (
              (!entry.defId || byId.defId === entry.defId) &&
              byId.width === entry.width &&
              byId.height === entry.height
            ) {
              if (!samePosition || (byId.x === entry.originalX && byId.y === entry.originalY)) {
                return byId;
              }
            }
          }
          return (
            solvedList.find((inst) => {
              if (!inst || usedSolvedIds.has(inst.id)) return false;
              if (entry.defId && inst.defId !== entry.defId) return false;
              if (inst.width !== entry.width || inst.height !== entry.height) return false;
              if (samePosition && (inst.x !== entry.originalX || inst.y !== entry.originalY)) {
                return false;
              }
              return true;
            }) || null
          );
        };

        // Reserve pre-chain buildings first so slot assignment for chain builds
        // can never accidentally consume those positions.
        if (mode === "full" || mode === "partial") {
          for (const preInst of preChainLayout) {
            reserveSolvedById(preInst.id);
          }
        }

        // Reserve all chain buildings that are intentionally fixed in partial mode.
        if (mode === "partial") {
          for (const entry of chainEntries) {
            if (updateNodeIds.has(entry.nodeId)) continue;
            const fixedMatch = findUnusedSolvedForEntry(entry, { samePosition: true });
            if (!fixedMatch) return null;
            usedSolvedIds.add(fixedMatch.id);
          }
        }

        const buildUpdates = [];
        for (const entry of chainEntries) {
          if (!updateNodeIds.has(entry.nodeId)) continue;
          let solvedInst = solvedById.get(entry.instanceId);
          if (solvedInst && usedSolvedIds.has(solvedInst.id)) {
            solvedInst = null;
          }
          if (!solvedInst) {
            solvedInst = findUnusedSolvedForEntry(entry);
          }
          if (!solvedInst) return null;
          usedSolvedIds.add(solvedInst.id);
          buildUpdates.push({
            nodeId: entry.nodeId,
            instanceId: entry.instanceId,
            defId: entry.defId,
            fromX: entry.originalX,
            fromY: entry.originalY,
            x: solvedInst.x,
            y: solvedInst.y,
          });
        }

        const moveOperations = [];
        if (mode === "full") {
          for (const preInst of preChainLayout) {
            const solvedInst = solvedById.get(preInst.id);
            if (!solvedInst) continue;
            if (preInst.x === solvedInst.x && preInst.y === solvedInst.y) continue;
            moveOperations.push({
              id: preInst.id,
              defId: preInst.defId,
              fromX: preInst.x,
              fromY: preInst.y,
              toX: solvedInst.x,
              toY: solvedInst.y,
              width: solvedInst.width,
              height: solvedInst.height,
            });
          }
        }

        return {
          mode,
          chainStartNodeId: chainNodeIds[0],
          chainEndNodeId: chainNodeIds[chainNodeIds.length - 1],
          chainBuildNodeIds: chainEntries.map((entry) => entry.nodeId),
          sortableBuildNodeIds: sortableNodeIds,
          buildUpdates,
          moveOperations,
          fixedLayout: solvedLayout,
        };
      };

      if (sortableInstanceIds.size > 0) {
        const partialLayout = solveLayoutWithMovableSet(
          finalLayout,
          sortableInstanceIds,
          unlockedRegions,
        );
        if (partialLayout) {
          const plan = buildPlanFromLayout(partialLayout, "partial");
          if (plan) return plan;
        }
      }

      const fullLayout = solveLayoutWithAllMovable(finalLayout, unlockedRegions);
      if (fullLayout) {
        return buildPlanFromLayout(fullLayout, "full");
      }

      return null;
    },
    [
      historyTree,
      computeStateAtNode,
      shortIdMap,
      getConsecutiveBuildChain,
      isPlacementInsideUnlocked,
      solveLayoutWithMovableSet,
      solveLayoutWithAllMovable,
    ],
  );

  // Verify a node's state for validity issues
  // Returns: { unfixable?: bool, configFixable?: bool, orderTBD?: bool, orderFixable?: bool, orderUnfixable?: bool, fixedLayout?: array, layoutFixPlan?: object }
  // action: the action that led to this state (needed to determine if build action caused the issue)
  const verifyNodeState = useCallback(
    (nodeId, state, action = null) => {
      const { resources, layout, unlockedRegions, stats } = state;
      const flags = {};

      // Track resource deficits for configFixable (needed for fix suggestions)
      const deficits = {};

      // Check for unfixable issues - negative free population
      // Free population = total population - required population
      if (stats) {
        const freePopulation = (stats.people ?? 0) - (stats.peopleReq ?? 0);
        if (freePopulation < 0) {
          flags.unfixable = true;
        }
      }

      // Check for order issues (buildings overlap or out of bounds)
      let hasOrderIssue = false;

      // First check for overlaps between buildings
      for (let i = 0; i < layout.length; i += 1) {
        const a = layout[i];
        for (let j = i + 1; j < layout.length; j += 1) {
          const b = layout[j];
          if (rectanglesOverlap(a, b)) {
            hasOrderIssue = true;
            break;
          }
        }
        if (hasOrderIssue) break;
      }

      // Check if any building is in a locked region / outside board
      if (!hasOrderIssue) {
        for (const inst of layout) {
          if (!isPlacementInsideUnlocked(inst, unlockedRegions)) {
            hasOrderIssue = true;
            break;
          }
        }
      }

      // If there's an order issue, determine if it's fixable
      if (hasOrderIssue) {
        const actionType = action?.type;
        if (isBuildActionType(actionType)) {
          const fixPlan = buildOrderFixPlan(nodeId, unlockedRegions);
          if (fixPlan?.fixedLayout) {
            flags.orderFixable = true;
            flags.fixedLayout = fixPlan.fixedLayout;
            flags.layoutFixPlan = fixPlan;
          } else {
            flags.orderUnfixable = true;
          }
        } else {
          // Non-build action (move, etc.) - just mark as orderTBD for now
          flags.orderTBD = true;
        }
      }

      // Check for configFixable issues (money, supplies, goods, shards negative)
      // Only mark as configFixable if not already unfixable or has order issues (priority order)
      if ((resources.coins ?? 0) < 0) {
        deficits.coins = Math.abs(resources.coins);
      }
      if ((resources.supplies ?? 0) < 0) {
        deficits.supplies = Math.abs(resources.supplies);
      }
      if (!allowShardLimitOverflow(config) && (resources.shards ?? 0) < 0) {
        deficits.shards = Math.abs(resources.shards);
      }
      // Check all goods
      if (resources.goods) {
        for (const [key, value] of Object.entries(resources.goods)) {
          if ((value ?? 0) < 0) {
            if (!deficits.goods) deficits.goods = {};
            deficits.goods[key] = Math.abs(value);
          }
        }
      }

      // Only set configFixable if there are deficits and no higher priority issues
      const hasDeficits =
        Object.keys(deficits).length > 0 ||
        (deficits.goods && Object.keys(deficits.goods).length > 0);
      const hasOrderFlags = flags.orderTBD || flags.orderFixable || flags.orderUnfixable;
      if (hasDeficits && !flags.unfixable && !hasOrderFlags) {
        flags.configFixable = true;
        flags.deficits = deficits;
      }

      return flags;
    },
    [buildOrderFixPlan, config, isPlacementInsideUnlocked],
  );

  // Verify a subtree starting from a given node
  // Sets nodeFlags for all nodes in the subtree
  const verifySubtree = useCallback((startNodeId) => {
    const { nodes } = historyTree;
    
    // Start fresh for the subtree being verified
    setNodeFlags((prevFlags) => {
      const newFlags = new Map(prevFlags);
      
      // BFS through subtree, stopping when we hit a "cut off" point
      const queue = [{ nodeId: startNodeId, parentGreyedOut: false }];
      
      while (queue.length > 0) {
        const { nodeId, parentGreyedOut } = queue.shift();
        const node = nodes.get(nodeId);
        if (!node) continue;
        
        let currentFlags = {};
        
        if (parentGreyedOut) {
          // Parent was flagged as unfixable or configFixable, so this node is greyed out
          currentFlags.greyedOut = true;
        } else {
          // Compute state at this node and verify it
          const state = computeStateAtNode(nodeId);
          // Pass the node's action to verifyNodeState so it can determine fix strategy
          const verifyResult = verifyNodeState(nodeId, state, node.action);
          currentFlags = { ...verifyResult };
          
          // If unfixable or configFixable or has order issues, all children will be greyed out
          if (verifyResult.unfixable || verifyResult.configFixable || 
              verifyResult.orderTBD || verifyResult.orderFixable || verifyResult.orderUnfixable) {
            currentFlags.greyedOut = false; // This node itself is not greyed, but children will be
          }
        }
        
        newFlags.set(nodeId, currentFlags);
        
        // Queue children - grey out if parent has any blocking issue
        const childrenGreyedOut = parentGreyedOut || 
          currentFlags.unfixable || currentFlags.configFixable ||
          currentFlags.orderTBD || currentFlags.orderFixable || currentFlags.orderUnfixable;
        for (const childId of node.childrenIds) {
          queue.push({ nodeId: childId, parentGreyedOut: childrenGreyedOut });
        }
      }
      
      return newFlags;
    });
  }, [historyTree, computeStateAtNode, verifyNodeState]);

  // Effect to handle pending verifications after tree changes
  useEffect(() => {
    if (pendingVerification === null) return;
    
    // Small timeout to ensure historyTree state is updated
    const timer = setTimeout(() => {
      verifySubtree(pendingVerification);
      setPendingVerification(null);
    }, 10);
    
    return () => clearTimeout(timer);
  }, [pendingVerification, verifySubtree]);

  // Re-evaluate entire tree when config changes (account config or savefile config)
  useEffect(() => {
    if (configRevision === undefined || configRevision === null) return;
    // Verify from root (node 0) to check entire tree
    const timer = setTimeout(() => {
      verifySubtree(0);
    }, 50);
    return () => clearTimeout(timer);
  }, [configRevision, verifySubtree]);

  // Update board state when selectedNodeId changes (happens from recordHistoryAction and jumpToHistory)
  useEffect(() => {
    const nextState = computeStateAtNode(selectedNodeId);
    layoutRef.current = nextState.layout;
    readyMapRef.current = nextState.readyMap;
    buildLocksRef.current = nextState.buildLocks;
    goodsUnlocksRef.current = nextState.goodsUnlocks;
    shardUnlocksRef.current = nextState.shardUnlocks;
    setLayout(nextState.layout);
    setReadyMap(nextState.readyMap);
    setBuildLocks(nextState.buildLocks);
    setUnlockedRegions(nextState.unlockedRegions);
    setGoodsUnlocks(nextState.goodsUnlocks);
    setShardUnlocks(nextState.shardUnlocks);
    setResources(nextState.resources);
    if (nextIdRef?.current !== undefined) {
      nextIdRef.current = nextState.nextId;
    }
    setTimeStep?.(nextState.timeStep);
  }, [selectedNodeId, computeStateAtNode]);

  const recordHistoryAction = useCallback(
    (action) => {
      const startNodeIdRaw = selectedNodeIdRef.current;
      const startNodeId = Number.isFinite(startNodeIdRaw)
        ? startNodeIdRaw
        : 0;
      const rawActions = Array.isArray(action) ? action : [action];
      const preparedActions = rawActions
        .filter(Boolean)
        .map((entry) => {
          const nextAction = { ...entry };

          // Clean up action object
          const isSellAction =
            nextAction.type === ACTION_SELL ||
            nextAction.type === ACTION_SELL_ADMIN;
          if (!isSellAction) {
            delete nextAction.instanceId;
          }
          delete nextAction.ready;
          delete nextAction.locked;
          delete nextAction.readyBefore;
          delete nextAction.lockedBefore;
          if (
            nextAction.type === ACTION_BUILD ||
            nextAction.type === ACTION_BUILD_ADMIN
          ) {
            delete nextAction.width;
            delete nextAction.height;
          }
          if (!nextAction.shortId && nextAction.defId) {
            const shortId = defIdToShortId[nextAction.defId];
            if (shortId) {
              nextAction.shortId = shortId;
              delete nextAction.defId;
            }
          }

          const isGoodsPurchaseType =
            nextAction.type === ACTION_GOODS_PURCHASE ||
            nextAction.type === ACTION_GOODS_PURCHASE_ADMIN;
          const isUnitPurchaseType =
            nextAction.type === ACTION_UNIT_PURCHASE ||
            nextAction.type === ACTION_UNIT_PURCHASE_ADMIN;
          const isPurchaseType = isGoodsPurchaseType || isUnitPurchaseType;

          if (nextAction.type === ACTION_MOVE) {
            const positions = normalizeMovePositions(nextAction).filter(
              ([x, y, xn, yn]) => x !== xn || y !== yn,
            );
            if (!positions.length) return null;
            nextAction.positions = positions;
            delete nextAction.x;
            delete nextAction.y;
            delete nextAction.xn;
            delete nextAction.yn;
          }

          if (isPurchaseType) {
            const keyField = isGoodsPurchaseType ? "goodsKey" : "unitKey";
            const key = nextAction[keyField] ?? nextAction.key;
            const quantityMap = extractQuantityMapFromAction(nextAction);
            if (!key || !Object.keys(quantityMap).length) return null;
            nextAction[keyField] = key;
            nextAction.key = key;
            nextAction.q = quantityMap;
            nextAction.quantity = sumQuantityMap(quantityMap);
            delete nextAction.amount;
            delete nextAction.count;
          }

          return nextAction;
        })
        .filter(Boolean);

      if (!preparedActions.length) return;

      setHistoryTree((prev) => {
        const nodes = new Map(prev.nodes);
        let currentNodeId = nodes.has(startNodeId) ? startNodeId : 0;
        let nextNodeId = prev.nextNodeId;

        preparedActions.forEach((nextAction) => {
          const currentNode = nodes.get(currentNodeId);
          if (!currentNode) return;

          const isPurchaseType =
            nextAction.type === ACTION_GOODS_PURCHASE ||
            nextAction.type === ACTION_GOODS_PURCHASE_ADMIN ||
            nextAction.type === ACTION_UNIT_PURCHASE ||
            nextAction.type === ACTION_UNIT_PURCHASE_ADMIN;

          // Merge only same-kind consecutive purchases (same goods/unit key).
          if (currentNode.action) {
            const currentAction = currentNode.action;
            const currentPurchaseKey =
              currentAction.key ??
              currentAction.goodsKey ??
              currentAction.unitKey;
            const nextPurchaseKey =
              nextAction.key ?? nextAction.goodsKey ?? nextAction.unitKey;
            if (
              isPurchaseType &&
              currentAction.type === nextAction.type &&
              currentPurchaseKey &&
              nextPurchaseKey &&
              currentPurchaseKey === nextPurchaseKey
            ) {
              const mergedQ = mergeQuantityMaps(
                extractQuantityMapFromAction(currentAction),
                nextAction.q,
              );
              if (Object.keys(mergedQ).length) {
                const merged = {
                  ...currentAction,
                  q: mergedQ,
                  quantity: sumQuantityMap(mergedQ),
                };
                nodes.set(currentNodeId, { ...currentNode, action: merged });
                return;
              }
            }
          }

          // Create new node as child (appended in sequence)
          const newNode = {
            id: nextNodeId,
            parentId: currentNodeId,
            action: nextAction,
            childrenIds: [],
          };
          nodes.set(nextNodeId, newNode);

          const updatedParent = {
            ...currentNode,
            childrenIds: [...currentNode.childrenIds, nextNodeId],
          };
          nodes.set(currentNodeId, updatedParent);

          currentNodeId = nextNodeId;
          nextNodeId += 1;
        });

        setSelectedNodeId(currentNodeId);
        return { nodes, nextNodeId };
      });
    },
    [defIdToShortId],
  );

  const jumpToHistory = useCallback(
    (targetNodeId) => {
      const { nodes } = historyTree;
      const currentNodeId = selectedNodeIdRef.current;
      
      if (!nodes.has(targetNodeId) || targetNodeId === currentNodeId) return;

      // Set selected node - the useEffect will update the board state
      setSelectedNodeId(targetNodeId);
    },
    [historyTree],
  );

  // Make a branch the "top" (main) branch by moving it to index 0 at each parent
  const makeTopBranch = useCallback(
    (nodeId) => {
      if (nodeId == null || nodeId === 0) return;
      
      setHistoryTree((prev) => {
        const nodes = new Map(prev.nodes);
        
        // Walk up from nodeId to root, reordering children at each step
        let currentId = nodeId;
        while (currentId != null) {
          const node = nodes.get(currentId);
          if (!node) break;
          
          const parentId = node.parentId;
          if (parentId == null) break;
          
          const parent = nodes.get(parentId);
          if (!parent) break;
          
          const childrenIds = parent.childrenIds;
          const currentIndex = childrenIds.indexOf(currentId);
          
          // If not already at index 0, move to front
          if (currentIndex > 0) {
            const newChildrenIds = [
              currentId,
              ...childrenIds.slice(0, currentIndex),
              ...childrenIds.slice(currentIndex + 1),
            ];
            nodes.set(parentId, { ...parent, childrenIds: newChildrenIds });
          }
          
          currentId = parentId;
        }
        
        return { ...prev, nodes };
      });
    },
    [],
  );

  // Load a serialized tree (from saved data)
  const loadHistoryTree = useCallback((serializedTree, targetNodeId = 0) => {
    setHistoryTree(serializedTree);
    setSelectedNodeId(targetNodeId);
  }, []);

  // Copy a subtree from one node to another (used for drag-and-drop in tree visualizer)
  // Copies sourceNodeId and all its descendants as new children of targetNodeId
  const copyBranchTo = useCallback((sourceNodeId, targetNodeId) => {
    if (sourceNodeId == null || targetNodeId == null) return;
    if (sourceNodeId === 0 || sourceNodeId === targetNodeId) return;
    
    setHistoryTree((prev) => {
      const nodes = new Map(prev.nodes);
      let nextId = prev.nextNodeId;
      
      const sourceNode = nodes.get(sourceNodeId);
      const targetNode = nodes.get(targetNodeId);
      if (!sourceNode || !targetNode) return prev;
      
      // Check that target is not a descendant of source (would create cycle)
      const isDescendant = (ancestorId, checkId) => {
        let cur = checkId;
        while (cur != null) {
          if (cur === ancestorId) return true;
          const node = nodes.get(cur);
          cur = node?.parentId;
        }
        return false;
      };
      if (isDescendant(sourceNodeId, targetNodeId)) return prev;
      
      // Deep copy the subtree rooted at sourceNodeId
      const idMapping = new Map(); // oldId -> newId
      const toCopy = [sourceNodeId];
      const copiedNodes = [];
      
      while (toCopy.length > 0) {
        const oldId = toCopy.shift();
        const oldNode = nodes.get(oldId);
        if (!oldNode) continue;
        
        const newId = nextId++;
        idMapping.set(oldId, newId);
        
        // Copy the node with new ID (parentId will be fixed after)
        copiedNodes.push({
          oldId,
          newId,
          oldParentId: oldNode.parentId,
          action: oldNode.action ? { ...oldNode.action } : null,
          oldChildrenIds: [...oldNode.childrenIds],
        });
        
        // Queue children for copying
        for (const childId of oldNode.childrenIds) {
          toCopy.push(childId);
        }
      }
      
      // Create new nodes with correct parent/children references
      for (const copied of copiedNodes) {
        const newParentId = copied.oldId === sourceNodeId 
          ? targetNodeId 
          : idMapping.get(copied.oldParentId);
        const newChildrenIds = copied.oldChildrenIds.map(oldChildId => idMapping.get(oldChildId));
        
        const newNode = {
          id: copied.newId,
          parentId: newParentId,
          action: copied.action,
          childrenIds: newChildrenIds,
        };
        nodes.set(copied.newId, newNode);
      }
      
      // Add root of copied subtree to target's children
      const rootNewId = idMapping.get(sourceNodeId);
      const updatedTarget = {
        ...targetNode,
        childrenIds: [...targetNode.childrenIds, rootNewId],
      };
      nodes.set(targetNodeId, updatedTarget);
      
      return { nodes, nextNodeId: nextId };
    });
    
    // Trigger verification for the newly copied subtree (starting from target node)
    setPendingVerification(targetNodeId);
  }, []);

  // Delete a node and optionally its entire subtree
  // If deleteSubtree is true: delete node and all descendants
  // If deleteSubtree is false: delete only the node, re-parent its children to node's parent
  const deleteNode = useCallback((nodeId, deleteSubtree = true) => {
    if (nodeId == null || nodeId === 0) return; // Can't delete root
    
    setHistoryTree((prev) => {
      const nodes = new Map(prev.nodes);
      const nodeToDelete = nodes.get(nodeId);
      if (!nodeToDelete) return prev;
      
      const parentId = nodeToDelete.parentId;
      const parentNode = nodes.get(parentId);
      if (!parentNode) return prev; // Shouldn't happen for non-root nodes
      
      if (deleteSubtree) {
        // Collect all nodes in subtree using BFS
        const toDelete = new Set();
        const queue = [nodeId];
        while (queue.length > 0) {
          const id = queue.shift();
          toDelete.add(id);
          const node = nodes.get(id);
          if (node) {
            for (const childId of node.childrenIds) {
              queue.push(childId);
            }
          }
        }
        
        // Delete all nodes in subtree
        for (const id of toDelete) {
          nodes.delete(id);
        }
        
        // Remove nodeId from parent's children
        const updatedParent = {
          ...parentNode,
          childrenIds: parentNode.childrenIds.filter(id => id !== nodeId),
        };
        nodes.set(parentId, updatedParent);
      } else {
        // Delete only this node, re-parent its children
        const childrenToReparent = nodeToDelete.childrenIds;
        
        // Update children to point to new parent
        for (const childId of childrenToReparent) {
          const child = nodes.get(childId);
          if (child) {
            nodes.set(childId, { ...child, parentId });
          }
        }
        
        // Replace this node in parent's children with the node's children
        const nodeIndex = parentNode.childrenIds.indexOf(nodeId);
        const newParentChildren = [
          ...parentNode.childrenIds.slice(0, nodeIndex),
          ...childrenToReparent,
          ...parentNode.childrenIds.slice(nodeIndex + 1),
        ];
        nodes.set(parentId, { ...parentNode, childrenIds: newParentChildren });
        
        // Delete the node itself
        nodes.delete(nodeId);
      }
      
      return { ...prev, nodes };
    });
    
    // Store parent before deleting for verification
    const parentIdForVerify = historyTree.nodes.get(nodeId)?.parentId ?? 0;
    
    // Move selection to parent of deleted node
    setSelectedNodeId((currentId) => {
      if (currentId === nodeId) {
        const node = historyTree.nodes.get(nodeId);
        return node?.parentId ?? 0;
      }
      return currentId;
    });
    
    // Trigger verification for the affected subtree (children that got re-parented)
    // We verify from the parent node since the children are now attached there
    setPendingVerification(parentIdForVerify);
  }, [historyTree]);

  // Apply a layout fix for an order-fixable node.
  // Supports:
  // - new fix plans with explicit per-node build updates
  // - legacy single-node fixedLayout fallback
  const applyLayoutFix = useCallback((nodeId, fixedLayout, fixPlan = null) => {
    if (nodeId == null || nodeId === 0) return;

    setHistoryTree((prev) => {
      const nodes = new Map(prev.nodes);
      const nodeToFix = nodes.get(nodeId);
      if (!nodeToFix?.action) return prev;

      const normalizedPlan =
        fixPlan && typeof fixPlan === "object" ? fixPlan : null;

      if (Array.isArray(normalizedPlan?.buildUpdates)) {
        normalizedPlan.buildUpdates.forEach((update) => {
          const targetNode = nodes.get(update.nodeId);
          if (!targetNode?.action) return;
          if (!isBuildActionType(targetNode.action.type)) return;
          const nextAction = {
            ...targetNode.action,
            x: update.x,
            y: update.y,
          };
          nodes.set(update.nodeId, { ...targetNode, action: nextAction });
        });

        const moveOperations = Array.isArray(normalizedPlan.moveOperations)
          ? normalizedPlan.moveOperations
          : [];

        if (moveOperations.length > 0) {
          const chainStartNodeId = normalizedPlan.chainStartNodeId ?? nodeId;
          const chainStartNode = nodes.get(chainStartNodeId);
          const parentId = chainStartNode?.parentId;
          const parentNode = nodes.get(parentId);
          if (!chainStartNode || parentId == null || !parentNode) {
            return { ...prev, nodes };
          }

          const chainIndex = parentNode.childrenIds.indexOf(chainStartNodeId);
          if (chainIndex < 0) return { ...prev, nodes };

          const nextId = prev.nextNodeId;
          const bundledMoveAction = {
            type: ACTION_MOVE,
            positions: moveOperations.map((m) => [m.fromX, m.fromY, m.toX, m.toY]),
          };

          const moveNode = {
            id: nextId,
            parentId,
            action: bundledMoveAction,
            childrenIds: [chainStartNodeId],
          };
          nodes.set(nextId, moveNode);

          const updatedParentChildren = [...parentNode.childrenIds];
          updatedParentChildren.splice(chainIndex, 1, nextId);
          nodes.set(parentId, { ...parentNode, childrenIds: updatedParentChildren });

          nodes.set(chainStartNodeId, { ...chainStartNode, parentId: nextId });

          return { nodes, nextNodeId: nextId + 1 };
        }

        return { ...prev, nodes };
      }

      // Legacy fallback: update only this node from fixedLayout.
      const originalAction = nodeToFix.action;
      if (!isBuildActionType(originalAction.type)) return prev;
      if (!Array.isArray(fixedLayout) || !fixedLayout.length) return prev;

      const buildDefId =
        originalAction.defId || (originalAction.shortId ? shortIdMap?.[originalAction.shortId] : null);
      const originalX = Number(originalAction.x);
      const originalY = Number(originalAction.y);

      const candidates = fixedLayout.filter((inst) => {
        if (!inst) return false;
        if (buildDefId && inst.defId !== buildDefId) return false;
        return true;
      });
      if (!candidates.length) return prev;

      const exact = candidates.find((inst) => inst.x === originalX && inst.y === originalY);
      const fallback = exact
        ? exact
        : candidates.reduce((best, inst) => {
            const dx = Number(inst.x) - originalX;
            const dy = Number(inst.y) - originalY;
            const dist = Math.abs(dx) + Math.abs(dy);
            if (!best) return { inst, dist };
            return dist < best.dist ? { inst, dist } : best;
          }, null)?.inst;

      if (!fallback) return prev;

      nodes.set(nodeId, {
        ...nodeToFix,
        action: {
          ...originalAction,
          x: fallback.x,
          y: fallback.y,
        },
      });

      return { ...prev, nodes };
    });

    const verifyFrom =
      fixPlan && typeof fixPlan === "object" && fixPlan.chainStartNodeId != null
        ? fixPlan.chainStartNodeId
        : nodeId;
    setPendingVerification(verifyFrom);
  }, [shortIdMap]);

  return {
    historyIndex: selectedNodeId,
    historyTree,
    computeStateAtNode,
    setHistoryTree,
    setSelectedNodeId,
    historyNodes: getTreeNodesForVisualizer,
    historyInvalidSteps: invalidSteps,
    historyChecking,
    recordHistoryAction,
    jumpToHistory,
    makeTopBranch,
    loadHistoryTree,
    copyBranchTo,
    deleteNode,
    applyLayoutFix,
    nodeFlags,
    verifySubtree,
  };
};
