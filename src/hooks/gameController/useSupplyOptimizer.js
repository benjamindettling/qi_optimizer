import { useCallback, useEffect, useRef, useState } from "react";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../../config/boardConfig";
import { solveTilingMask } from "../../utils/tilingSolver";
import { buildTilingGroups, buildTilingMask } from "../../utils/tilingTranslator";
import { getBuildingName } from "../../utils/buildingName";

const DEF_IDS = {
  ALCHEMIST: "production:alchemistenlabor",
  BREWERY: "production:brauerei",
  BAKERY: "production:baeckerei",
  HOUSING_CLAPBOARD: "housing:schindelhaus",
  HOUSING_FRAMEWORK: "housing:fachwerkhaus",
  HOUSING_MULTI: "housing:mehrgeschossiges_haus",
  CULTURE_DOCTOR: "culture:doktor",
  CULTURE_CARTOGRAPHER: "culture:kartograph",
  CULTURE_PILLORY: "culture:pranger",
  CULTURE_GALLOW: "culture:galgen",
  CULTURE_CHURCH: "culture:kirche",
  TOWNHALL: "townhall:rathaus",
};

const BASE_ALCHEMIST_SUPPLIES = 14400;
const BASE_BAKERY_SUPPLIES = 60000;

const HOUSING_PRIORITY = [
  DEF_IDS.HOUSING_CLAPBOARD,
  DEF_IDS.HOUSING_FRAMEWORK,
  DEF_IDS.HOUSING_MULTI,
];

const CULTURE_PRIORITY = [
  DEF_IDS.CULTURE_DOCTOR,
  DEF_IDS.CULTURE_CARTOGRAPHER,
  DEF_IDS.CULTURE_PILLORY,
  DEF_IDS.CULTURE_GALLOW,
  DEF_IDS.CULTURE_CHURCH,
];

const HOUSING_PRIORITY_BY_ID = Object.freeze({
  [DEF_IDS.HOUSING_CLAPBOARD]: 1,
  [DEF_IDS.HOUSING_FRAMEWORK]: 2,
  [DEF_IDS.HOUSING_MULTI]: 3,
});

const CULTURE_PRIORITY_BY_ID = Object.freeze({
  [DEF_IDS.CULTURE_DOCTOR]: 1,
  [DEF_IDS.CULTURE_CARTOGRAPHER]: 2,
  [DEF_IDS.CULTURE_PILLORY]: 3,
  [DEF_IDS.CULTURE_GALLOW]: 4,
  [DEF_IDS.CULTURE_CHURCH]: 5,
});

const CONTROLLED_BUILDING_ORDER = [
  DEF_IDS.ALCHEMIST,
  DEF_IDS.BREWERY,
  DEF_IDS.HOUSING_CLAPBOARD,
  DEF_IDS.HOUSING_FRAMEWORK,
  DEF_IDS.HOUSING_MULTI,
  DEF_IDS.CULTURE_DOCTOR,
  DEF_IDS.CULTURE_CARTOGRAPHER,
  DEF_IDS.CULTURE_PILLORY,
  DEF_IDS.CULTURE_GALLOW,
  DEF_IDS.CULTURE_CHURCH,
];

const CONTROLLED_HOUSING_SET = new Set(HOUSING_PRIORITY);
const CONTROLLED_CULTURE_SET = new Set(CULTURE_PRIORITY);
const SUPPLY_CHEAP_SET = new Set([
  DEF_IDS.HOUSING_MULTI,
  "housing:gutshaus",
  DEF_IDS.CULTURE_CHURCH,
  DEF_IDS.BREWERY,
]);

const initialOptimizerState = {
  running: false,
  phase: "idle",
  evalCount: 0,
  currentSetup: null,
  bestSetup: null,
  finalResources: null,
  debugEvents: [],
};

const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const cloneResources = (resources) => ({
  coins: toNumber(resources?.coins),
  supplies: toNumber(resources?.supplies),
  chronos: toNumber(resources?.chronos),
});

const normalizeCost = (cost) => ({
  coins: toNumber(cost?.coins),
  supplies: toNumber(cost?.supplies),
  chronos: toNumber(cost?.chronos),
});

const getSellCost = (cost) => {
  const normalizedCost = normalizeCost(cost);
  return {
    coins: Math.floor(normalizedCost.coins * 0.25),
    supplies: Math.floor(normalizedCost.supplies * 0.25),
    chronos: Math.floor(normalizedCost.chronos * 0.25),
  };
};

const canAffordCost = (resources, cost) => {
  const normalizedCost = normalizeCost(cost);
  return (
    resources.coins - normalizedCost.coins >= 0 &&
    resources.supplies - normalizedCost.supplies >= 0 &&
    resources.chronos - normalizedCost.chronos >= 0
  );
};

const spendCost = (resources, cost) => {
  const normalizedCost = normalizeCost(cost);
  resources.coins -= normalizedCost.coins;
  resources.supplies -= normalizedCost.supplies;
  resources.chronos -= normalizedCost.chronos;
};

const refundCost = (resources, cost) => {
  const normalizedCost = normalizeCost(cost);
  resources.coins += normalizedCost.coins;
  resources.supplies += normalizedCost.supplies;
  resources.chronos += normalizedCost.chronos;
};

const getLang = () => {
  if (typeof window === "undefined") return "DE";
  try {
    return localStorage.getItem("qi_lang") === "EN" ? "EN" : "DE";
  } catch {
    return "DE";
  }
};

export const normalizeOptimizerInstance = (instance, libraryMap) => {
  if (!instance?.defId) return null;
  const def = libraryMap?.[instance.defId];
  const width = toNumber(instance.width) || toNumber(def?.size?.[0]) || toNumber(def?.width);
  const height = toNumber(instance.height) || toNumber(def?.size?.[1]) || toNumber(def?.height);
  if (width <= 0 || height <= 0) return null;
  return {
    ...instance,
    width,
    height,
  };
};

const buildSetupSnapshot = (controlledList, libraryMap, supplyHarvest) => {
  const counts = new Map();
  controlledList.forEach((entry) => {
    counts.set(entry.defId, (counts.get(entry.defId) || 0) + 1);
  });
  const lang = getLang();
  const buildings = CONTROLLED_BUILDING_ORDER.map((defId) => {
    const count = counts.get(defId) || 0;
    if (!count) return null;
    const def = libraryMap?.[defId];
    return {
      defId,
      count,
      name: getBuildingName(def, lang, "name"),
    };
  }).filter(Boolean);
  return {
    buildings,
    supplyHarvest,
  };
};

const cloneSetupSnapshot = (snapshot) => {
  if (!snapshot) return null;
  return {
    ...snapshot,
    buildings: (snapshot.buildings || []).map((entry) => ({ ...entry })),
  };
};

const cloneLayoutSnapshot = (layout) =>
  (layout || []).map((instance) => ({ ...instance }));

const cloneSupplyResultPayload = (payload) => {
  if (!payload) return null;
  return {
    supplyResultLayout: cloneLayoutSnapshot(payload.supplyResultLayout),
    supplyResultResources: cloneResources(payload.supplyResultResources),
    preExistingLayout: cloneLayoutSnapshot(payload.preExistingLayout),
    originalStartLayout: cloneLayoutSnapshot(payload.originalStartLayout),
    bestSupplyHarvest: payload.bestSupplyHarvest ?? null,
    bestHarvestResults: payload.bestHarvestResults
      ? { ...payload.bestHarvestResults }
      : null,
  };
};

const getCount = (map, defId) => map[defId] || 0;

const adjustCount = (map, defId, delta) => {
  map[defId] = Math.max(0, getCount(map, defId) + delta);
};

const getAddCostForDefId = (ctx, defId) => {
  const def = ctx.defById[defId] || ctx.libraryMap?.[defId];
  if (!def) return null;
  if (SUPPLY_CHEAP_SET.has(defId)) {
    return normalizeCost(def.cost);
  }
  const soldCount = getCount(ctx.soldAtStartCountByDefId, defId);
  const restoredCount = getCount(ctx.restoredActiveCountByDefId, defId);
  if (restoredCount < soldCount) {
    return getSellCost(def.cost);
  }
  return normalizeCost(def.cost);
};

const pickRemovalIndexForRequestedEntry = (ctx, requestedIndex) => {
  if (requestedIndex < 0 || requestedIndex >= ctx.controlledList.length) return -1;
  const requested = ctx.controlledList[requestedIndex];
  if (!requested) return -1;
  if (SUPPLY_CHEAP_SET.has(requested.defId)) return requestedIndex;
  if (requested.origin !== "restored") return requestedIndex;
  for (let i = ctx.controlledList.length - 1; i >= 0; i -= 1) {
    const candidate = ctx.controlledList[i];
    if (!candidate) continue;
    if (candidate.defId !== requested.defId) continue;
    if (candidate.origin === "new") return i;
  }
  return requestedIndex;
};

const getStats = (preExistingLayout, controlledList, libraryMap) => {
  const fullLayout = [...preExistingLayout, ...controlledList];
  let totalPeople = 0;
  let totalPeopleReq = 0;
  let happinessProvided = 0;
  let numbAlchemists = 0;
  let numbBreweries = 0;
  let numbBakeries = 0;

  fullLayout.forEach((instance) => {
    const def = libraryMap?.[instance.defId];
    if (!def) return;
    totalPeople += toNumber(def.people);
    totalPeopleReq += toNumber(def.requiresPeople);
    happinessProvided += toNumber(def.happiness);
    if (instance.defId === DEF_IDS.ALCHEMIST) numbAlchemists += 1;
    if (instance.defId === DEF_IDS.BREWERY) numbBreweries += 1;
    if (instance.defId === DEF_IDS.BAKERY) numbBakeries += 1;
  });

  const freePop = totalPeople - totalPeopleReq;
  const happinessRequired = Math.max(totalPeopleReq, totalPeople);
  const hasHappiness150 = happinessProvided >= 2 * happinessRequired;

  return {
    fullLayout,
    totalPeople,
    totalPeopleReq,
    freePop,
    happinessProvided,
    happinessRequired,
    hasHappiness150,
    numbAlchemists,
    numbBreweries,
    numbBakeries,
  };
};

const runFitsCheck = (mask, fullLayout) => {
  const { blocks } = buildTilingGroups(fullLayout, []);
  const placements = solveTilingMask(mask, blocks, { allowGaps: true });
  return placements !== null;
};

const computeSupplyHarvest = (stats) => {
  const supplyMult = 1.5 + 0.1 * stats.numbAlchemists + 0.2 * stats.numbBreweries;
  return Math.round(BASE_BAKERY_SUPPLIES * supplyMult) * stats.numbBakeries +
    Math.round(BASE_ALCHEMIST_SUPPLIES * supplyMult) * stats.numbAlchemists;
};

/**
 * Compute the post-harvest resource totals for the supply result layout.
 * Supply stage applies supply output and chronos from supply-producing buildings.
 * Coin harvesting is deferred to the money stage.
 *
 * Returns counts of FH, CH, MH, EH for use by money optimizer.
 */
const computeHarvestResults = (
  fullLayout,
  libraryMap,
  currentResources,
  supplyHarvest,
  debugEvents,
  supplyMult,
) => {
  const HAPPINESS_MULT = 1.5;
  const coins = toNumber(currentResources.coins);
  let totalChronos = 0;
  let fhCount = 0;
  let chCount = 0;
  let mhCount = 0;
  let ehCount = 0;

  fullLayout.forEach((instance) => {
    const def = libraryMap?.[instance.defId];
    if (!def) return;

    // Track housing counts
    if (instance.defId === "housing:fachwerkhaus") fhCount += 1;
    else if (instance.defId === "housing:schindelhaus") chCount += 1;
    else if (instance.defId === "housing:mehrgeschossiges_haus") mhCount += 1;
    else if (instance.defId === "housing:gutshaus") ehCount += 1;

    const name = debugEvents ? getBuildingName(def, getLang(), "name") : "";
    let supBase = 0;
    let supResult = 0;
    let chronBase = 0;
    let chronResult = 0;

    if (instance.defId === DEF_IDS.ALCHEMIST) {
      supBase = BASE_ALCHEMIST_SUPPLIES;
      supResult = Math.round(supBase * (supplyMult ?? 0));
    } else if (instance.defId === DEF_IDS.BAKERY) {
      supBase = BASE_BAKERY_SUPPLIES;
      supResult = Math.round(supBase * (supplyMult ?? 0));
    }

    if (
      instance.defId === DEF_IDS.ALCHEMIST ||
      instance.defId === DEF_IDS.BAKERY
    ) {
      chronBase = toNumber(def.production?.chronos);
      if (chronBase > 0) {
        chronResult = Math.round(chronBase * HAPPINESS_MULT);
        totalChronos += chronResult;
      }
    }

    if (debugEvents && (supBase > 0 || chronBase > 0)) {
      debugEvents.push({
        type: "supply_building",
        name,
        defId: instance.defId,
        supplyBase: supBase,
        supplyMult: supplyMult ?? 0,
        supplyResult: supResult,
        chronosBase: chronBase,
        chronosMult: HAPPINESS_MULT,
        chronosResult: chronResult,
      });
    }
  });

  const chronos = toNumber(currentResources.chronos) + totalChronos;

  if (debugEvents) {
    debugEvents.push({
      type: "supply_harvest_totals",
      supplyMult: supplyMult ?? 0,
      supplyHarvest: toNumber(supplyHarvest),
      totalCoins: 0,
      totalChronos,
      chronosMult: HAPPINESS_MULT,
    });
  }

  return {
    coins,
    supplies: toNumber(supplyHarvest),
    chronos,
    chronosHarvest: totalChronos,
    fhCount,
    chCount,
    mhCount,
    ehCount,
  };
};

const addControlledBuilding = (ctx, defId) => {
  const def = ctx.defById[defId];
  if (!def) return false;
  const addCost = getAddCostForDefId(ctx, defId);
  if (!addCost || !canAffordCost(ctx.currentResources, addCost)) return false;
  spendCost(ctx.currentResources, addCost);
  const soldCount = getCount(ctx.soldAtStartCountByDefId, defId);
  const restoredCount = getCount(ctx.restoredActiveCountByDefId, defId);
  const origin =
    !SUPPLY_CHEAP_SET.has(defId) && restoredCount < soldCount ? "restored" : "new";
  if (origin === "restored") {
    adjustCount(ctx.restoredActiveCountByDefId, defId, 1);
  } else {
    adjustCount(ctx.newActiveCountByDefId, defId, 1);
  }
  ctx.controlledList.push({
    id: ctx.syntheticNextId++,
    defId,
    width: toNumber(def.size?.[0]) || toNumber(def.width),
    height: toNumber(def.size?.[1]) || toNumber(def.height),
    origin,
  });
  return true;
};

const removeControlledAtIndex = (ctx, index) => {
  const effectiveIndex = pickRemovalIndexForRequestedEntry(ctx, index);
  if (effectiveIndex < 0 || effectiveIndex >= ctx.controlledList.length) return null;
  const removed = ctx.controlledList[effectiveIndex];
  const def = ctx.defById[removed.defId] || ctx.libraryMap?.[removed.defId];
  if (def) {
    if (SUPPLY_CHEAP_SET.has(removed.defId)) {
      refundCost(ctx.currentResources, def.cost);
      adjustCount(ctx.newActiveCountByDefId, removed.defId, -1);
    } else if (removed.origin === "restored") {
      refundCost(ctx.currentResources, getSellCost(def.cost));
      adjustCount(ctx.restoredActiveCountByDefId, removed.defId, -1);
    } else {
      refundCost(ctx.currentResources, def.cost);
      adjustCount(ctx.newActiveCountByDefId, removed.defId, -1);
    }
  }
  ctx.controlledList.splice(effectiveIndex, 1);
  return removed;
};

const removeAllControlledMatching = (ctx, predicate) => {
  for (let i = ctx.controlledList.length - 1; i >= 0; i -= 1) {
    if (predicate(ctx.controlledList[i])) {
      removeControlledAtIndex(ctx, i);
    }
  }
};

const terminate = (ctx) => {
  ctx.done = true;
};

const addHighestAffordableFromList = (ctx, list) => {
  for (let i = 0; i < list.length; i += 1) {
    if (addControlledBuilding(ctx, list[i])) return list[i];
  }
  return null;
};

const hasAnyAffordableFromList = (ctx, resources, defIds) =>
  defIds.some((defId) => {
    const addCost = getAddCostForDefId(ctx, defId);
    return !!addCost && canAffordCost(resources, addCost);
  });

const canAdvanceAfterAddingBrewery = (ctx) => {
  const breweryDef = ctx.defById[DEF_IDS.BREWERY];
  if (!breweryDef || !canAffordCost(ctx.currentResources, breweryDef.cost)) {
    return false;
  }

  const nextResources = cloneResources(ctx.currentResources);
  spendCost(nextResources, breweryDef.cost);

  const previewControlled = ctx.controlledList
    .filter(
      (entry) =>
        !CONTROLLED_HOUSING_SET.has(entry.defId) &&
        !CONTROLLED_CULTURE_SET.has(entry.defId),
    )
    .map((entry) => ({ ...entry }));
  previewControlled.push({
    id: -1,
    defId: DEF_IDS.BREWERY,
    width: toNumber(breweryDef.size?.[0]) || toNumber(breweryDef.width),
    height: toNumber(breweryDef.size?.[1]) || toNumber(breweryDef.height),
  });

  const previewStats = getStats(ctx.currentLayout, previewControlled, ctx.libraryMap);
  if (
    previewStats.freePop < 0 &&
    !hasAnyAffordableFromList(ctx, nextResources, HOUSING_PRIORITY)
  ) {
    return false;
  }
  if (
    !previewStats.hasHappiness150 &&
    !hasAnyAffordableFromList(ctx, nextResources, CULTURE_PRIORITY)
  ) {
    return false;
  }
  return true;
};

const removeOneLowestPriorityCultureNotChurch = (ctx) => {
  let selectedIndex = -1;
  let selectedPriority = -Infinity;
  for (let i = 0; i < ctx.controlledList.length; i += 1) {
    const defId = ctx.controlledList[i].defId;
    const priority = CULTURE_PRIORITY_BY_ID[defId];
    if (!priority || defId === DEF_IDS.CULTURE_CHURCH) continue;
    if (priority > selectedPriority) {
      selectedPriority = priority;
      selectedIndex = i;
    }
  }
  if (selectedIndex < 0) return null;
  const removed = removeControlledAtIndex(ctx, selectedIndex);
  return {
    removed,
    removedPriority: selectedPriority,
  };
};

const removeOneLowestPriorityHousingNotMulti = (ctx) => {
  let selectedIndex = -1;
  let selectedPriority = -Infinity;
  for (let i = 0; i < ctx.controlledList.length; i += 1) {
    const defId = ctx.controlledList[i].defId;
    const priority = HOUSING_PRIORITY_BY_ID[defId];
    if (!priority || defId === DEF_IDS.HOUSING_MULTI) continue;
    if (priority > selectedPriority) {
      selectedPriority = priority;
      selectedIndex = i;
    }
  }
  if (selectedIndex < 0) return null;
  const removed = removeControlledAtIndex(ctx, selectedIndex);
  return {
    removed,
    removedPriority: selectedPriority,
  };
};

const addCultureOfPriorityUntilSatisfied = (ctx, targetPriority) => {
  const defId = CULTURE_PRIORITY[targetPriority - 1];
  if (!defId) return false;
  while (true) {
    const stats = getStats(ctx.currentLayout, ctx.controlledList, ctx.libraryMap);
    if (stats.hasHappiness150) return true;
    if (!addControlledBuilding(ctx, defId)) return false;
  }
};

const addHousingOfPriorityUntilSatisfied = (ctx, targetPriority) => {
  const defId = HOUSING_PRIORITY[targetPriority - 1];
  if (!defId) return false;
  while (true) {
    const stats = getStats(ctx.currentLayout, ctx.controlledList, ctx.libraryMap);
    if (stats.freePop >= 0) return true;
    if (!addControlledBuilding(ctx, defId)) return false;
  }
};

const evaluateCurrentSetup = (ctx, stats) => {
  const supplyMult = 1.5 + 0.1 * stats.numbAlchemists + 0.2 * stats.numbBreweries;
  const supplyHarvestNet = computeSupplyHarvest(stats);
  ctx.currentSetup = buildSetupSnapshot(
    ctx.controlledList,
    ctx.libraryMap,
    supplyHarvestNet,
  );

  const isBestEval = ctx.bestSetup === null || supplyHarvestNet > ctx.bestSupplyHarvest;
  ctx.debugEvents.push({
    type: "evaluation",
    supplyHarvest: supplyHarvestNet,
    isBest: isBestEval,
    alchemists: stats.numbAlchemists,
    breweries: stats.numbBreweries,
    resources: cloneResources(ctx.currentResources),
  });

  if (isBestEval) {
    ctx.bestSupplyHarvest = supplyHarvestNet;
    ctx.bestSetup = cloneSetupSnapshot(ctx.currentSetup);
    ctx.bestControlledList = ctx.controlledList.map((entry) => ({ ...entry }));
    ctx.bestResources = cloneResources(ctx.currentResources);
    ctx.bestAlchemists = stats.numbAlchemists;

    const supplyHarvestAbsolute = supplyHarvestNet + toNumber(ctx.currentResources.supplies);
    ctx.bestHarvestResults = computeHarvestResults(
      stats.fullLayout,
      ctx.libraryMap,
      ctx.currentResources,
      supplyHarvestAbsolute,
      ctx.debugEvents,
      supplyMult,
    );

    // Store chronosHarvest in bestSetup for display
    ctx.bestSetup.chronosHarvest = ctx.bestHarvestResults.chronosHarvest;

    return;
  }

  if (ctx.bestAlchemists - stats.numbAlchemists >= 4) {
    terminate(ctx);
  }
};

const runSingleDecisionStep = (ctx) => {
  if (ctx.done) return { evaluated: false, evaluationAlchemists: null };

  const stats = getStats(ctx.currentLayout, ctx.controlledList, ctx.libraryMap);

  if (stats.freePop < 0) {
    if (!addHighestAffordableFromList(ctx, HOUSING_PRIORITY)) {
      terminate(ctx);
    }
    return { evaluated: false, evaluationAlchemists: null };
  }

  if (!stats.hasHappiness150) {
    if (!addHighestAffordableFromList(ctx, CULTURE_PRIORITY)) {
      terminate(ctx);
    }
    return { evaluated: false, evaluationAlchemists: null };
  }

  const fits = runFitsCheck(ctx.mask, stats.fullLayout);
  if (fits) {
    evaluateCurrentSetup(ctx, stats);
    const evaluationAlchemists = stats.numbAlchemists;

    if (ctx.done) {
      return { evaluated: true, evaluationAlchemists };
    }

    if (!canAdvanceAfterAddingBrewery(ctx)) {
      terminate(ctx);
      return { evaluated: true, evaluationAlchemists };
    }

    if (!addControlledBuilding(ctx, DEF_IDS.BREWERY)) {
      terminate(ctx);
      return { evaluated: true, evaluationAlchemists };
    }

    removeAllControlledMatching(
      ctx,
      (entry) =>
        CONTROLLED_HOUSING_SET.has(entry.defId) ||
        CONTROLLED_CULTURE_SET.has(entry.defId),
    );

    return { evaluated: true, evaluationAlchemists };
  }

  const hasNonChurchCulture = ctx.controlledList.some(
    (entry) =>
      CONTROLLED_CULTURE_SET.has(entry.defId) &&
      entry.defId !== DEF_IDS.CULTURE_CHURCH,
  );
  if (hasNonChurchCulture) {
    const removed = removeOneLowestPriorityCultureNotChurch(ctx);
    if (!removed) {
      terminate(ctx);
      return { evaluated: false, evaluationAlchemists: null };
    }
    const targetPriority = removed.removedPriority + 1;
    if (!addCultureOfPriorityUntilSatisfied(ctx, targetPriority)) {
      terminate(ctx);
    }
    return { evaluated: false, evaluationAlchemists: null };
  }

  const hasNonMultiHousing = ctx.controlledList.some(
    (entry) =>
      CONTROLLED_HOUSING_SET.has(entry.defId) &&
      entry.defId !== DEF_IDS.HOUSING_MULTI,
  );
  if (hasNonMultiHousing) {
    removeAllControlledMatching(
      ctx,
      (entry) => entry.defId === DEF_IDS.CULTURE_CHURCH,
    );
    const removed = removeOneLowestPriorityHousingNotMulti(ctx);
    if (!removed) {
      terminate(ctx);
      return { evaluated: false, evaluationAlchemists: null };
    }
    const targetPriority = removed.removedPriority + 1;
    if (!addHousingOfPriorityUntilSatisfied(ctx, targetPriority)) {
      terminate(ctx);
    }
    return { evaluated: false, evaluationAlchemists: null };
  }

  const alchemistIndex = ctx.controlledList.findIndex(
    (entry) => entry.defId === DEF_IDS.ALCHEMIST,
  );
  if (alchemistIndex >= 0) {
    removeAllControlledMatching(
      ctx,
      (entry) =>
        CONTROLLED_HOUSING_SET.has(entry.defId) ||
        CONTROLLED_CULTURE_SET.has(entry.defId) ||
        entry.defId === DEF_IDS.BREWERY,
    );
    const remainingAlchemistIndex = ctx.controlledList.findIndex(
      (entry) => entry.defId === DEF_IDS.ALCHEMIST,
    );
    removeControlledAtIndex(ctx, remainingAlchemistIndex);
    return { evaluated: false, evaluationAlchemists: null };
  }

  terminate(ctx);
  return { evaluated: false, evaluationAlchemists: null };
};

const makeRunContext = ({ layout, resources, libraryMap, isCellUnlockedFn, nextIdRef }) => {
  const requiredDefIds = [
    DEF_IDS.ALCHEMIST,
    DEF_IDS.BREWERY,
    ...HOUSING_PRIORITY,
    ...CULTURE_PRIORITY,
  ];

  const defById = requiredDefIds.reduce((acc, defId) => {
    const def = libraryMap?.[defId];
    if (def) acc[defId] = def;
    return acc;
  }, {});

  const currentLayout = (layout || [])
    .map((instance) => normalizeOptimizerInstance(instance, libraryMap))
    .filter(Boolean);

  const maxExistingId = currentLayout.reduce(
    (maxId, entry) => Math.max(maxId, toNumber(entry.id)),
    0,
  );
  const syntheticNextId = Math.max(
    toNumber(nextIdRef?.current) || 1,
    maxExistingId + 1,
  );

  const ctx = {
    libraryMap,
    defById,
    currentResources: cloneResources(resources),
    currentLayout,
    controlledList: [],
    currentSetup: null,
    bestSetup: null,
    bestControlledList: [],
    bestResources: null,
    bestSupplyHarvest: Number.NEGATIVE_INFINITY,
    bestHarvestResults: null,
    bestAlchemists: 0,
    done: false,
    finalResources: null,
    mask: buildTilingMask(BOARD_WIDTH, BOARD_HEIGHT, isCellUnlockedFn),
    syntheticNextId,
    originalStartLayout: currentLayout.map((instance) => ({ ...instance })),
    soldAtStartCountByDefId: {},
    restoredActiveCountByDefId: {},
    newActiveCountByDefId: {},
    debugEvents: [],
  };

  const hasRequiredDefs = requiredDefIds.every((defId) => !!ctx.defById[defId]);
  if (!hasRequiredDefs) {
    ctx.done = true;
    return ctx;
  }

  const fixedLayout = [];
  ctx.currentLayout.forEach((instance) => {
    if (instance.defId === DEF_IDS.TOWNHALL) {
      fixedLayout.push(instance);
      return;
    }
    const def = ctx.libraryMap?.[instance.defId];
    if (!def) {
      fixedLayout.push(instance);
      return;
    }
    adjustCount(ctx.soldAtStartCountByDefId, instance.defId, 1);
    refundCost(ctx.currentResources, getSellCost(def.cost));
  });
  ctx.currentLayout = fixedLayout;

  while (addControlledBuilding(ctx, DEF_IDS.ALCHEMIST)) {
    // Add as many alchemists as possible.
  }

  return ctx;
};

const waitNextTick = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

export const useSupplyOptimizer = ({
  layout,
  resources,
  libraryMap,
  isCellUnlockedFn,
  nextIdRef,
  onSupplyComplete,
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [optimizerState, setOptimizerState] = useState(initialOptimizerState);

  const inputRef = useRef({
    layout,
    resources,
    libraryMap,
    isCellUnlockedFn,
    nextIdRef,
  });
  const contextRef = useRef(null);
  const runningRef = useRef(false);
  const evalCountRef = useRef(0);
  const liveCounterTimerRef = useRef(null);

  useEffect(() => {
    inputRef.current = {
      layout,
      resources,
      libraryMap,
      isCellUnlockedFn,
      nextIdRef,
    };
  }, [layout, resources, libraryMap, isCellUnlockedFn, nextIdRef]);

  useEffect(
    () => () => {
      if (liveCounterTimerRef.current) {
        clearInterval(liveCounterTimerRef.current);
        liveCounterTimerRef.current = null;
      }
    },
    [],
  );

  const ensureContext = useCallback(() => {
    if (contextRef.current && !contextRef.current.done) {
      return { context: contextRef.current, createdNew: false };
    }
    const nextContext = makeRunContext(inputRef.current);
    contextRef.current = nextContext;
    return { context: nextContext, createdNew: true };
  }, []);

  const applyPauseOrDoneState = useCallback((phase) => {
    const context = contextRef.current;
    setOptimizerState((prev) => ({
      ...prev,
      running: false,
      phase,
      evalCount: evalCountRef.current,
      currentSetup: cloneSetupSnapshot(context?.currentSetup) || prev.currentSetup,
      bestSetup: cloneSetupSnapshot(context?.bestSetup) || prev.bestSetup,
      finalResources: context?.finalResources
        ? cloneResources(context.finalResources)
        : prev.finalResources,
      debugEvents: context?.debugEvents ? [...context.debugEvents] : [],
    }));
  }, []);

  const runMode = useCallback(
    async (mode) => {
      if (runningRef.current) return;

      const { context, createdNew } = ensureContext();
      const baselineAlchemists =
        mode === "few"
          ? createdNew
            ? 0
            : getStats(
                context.currentLayout,
                context.controlledList,
                context.libraryMap,
              ).numbAlchemists
          : null;

      context.debugEvents = [];
      evalCountRef.current = 0;
      runningRef.current = true;

      setOptimizerState((prev) => ({
        ...prev,
        running: true,
        phase: "running",
        evalCount: 0,
        currentSetup: createdNew ? null : prev.currentSetup,
        bestSetup: createdNew ? null : prev.bestSetup,
        finalResources: createdNew ? null : prev.finalResources,
      }));

      if (liveCounterTimerRef.current) {
        clearInterval(liveCounterTimerRef.current);
      }
      liveCounterTimerRef.current = setInterval(() => {
        const liveContext = contextRef.current;
        setOptimizerState((prev) =>
          prev.phase !== "running"
            ? prev
            : {
                ...prev,
                evalCount: evalCountRef.current,
                currentSetup:
                  cloneSetupSnapshot(liveContext?.currentSetup) ||
                  prev.currentSetup,
                bestSetup:
                  cloneSetupSnapshot(liveContext?.bestSetup) || prev.bestSetup,
              },
        );
      }, 200);

      try {
        let shouldPause = false;

        while (!context.done) {
          const stepResult = runSingleDecisionStep(context);
          if (stepResult.evaluated) {
            evalCountRef.current += 1;

            if (mode === "once") {
              shouldPause = true;
            } else if (
              mode === "few" &&
              stepResult.evaluationAlchemists !== baselineAlchemists
            ) {
              shouldPause = true;
            }
          }

          if (context.done || shouldPause) break;
          await waitNextTick();
        }

        if (context.done) {
          const bestControlledList =
            context.bestControlledList?.length > 0
              ? context.bestControlledList
              : context.controlledList;
          const supplyResultLayout = [...context.currentLayout, ...bestControlledList]
            .map((instance) =>
              normalizeOptimizerInstance(instance, context.libraryMap),
            )
            .filter(Boolean)
            .map((instance) => ({ ...instance }));
          const preExistingLayout = context.currentLayout
            .map((instance) =>
              normalizeOptimizerInstance(instance, context.libraryMap),
            )
            .filter(Boolean)
            .map((instance) => ({ ...instance }));
          const supplyResultResources = cloneResources(
            context.bestResources || context.currentResources,
          );
          const supplyResultPayload = {
            supplyResultLayout,
            supplyResultResources,
            preExistingLayout,
            originalStartLayout: context.originalStartLayout,
            bestSupplyHarvest: context.bestSupplyHarvest,
            bestHarvestResults: context.bestHarvestResults
              ? { ...context.bestHarvestResults }
              : null,
          };
          context.finalResources = context.bestHarvestResults
            ? { ...context.bestHarvestResults }
            : cloneResources(supplyResultResources);
          applyPauseOrDoneState("done");
          onSupplyComplete?.(
            cloneSupplyResultPayload(supplyResultPayload),
            mode,
          );
        } else {
          applyPauseOrDoneState("paused");
        }
      } finally {
        runningRef.current = false;
        if (liveCounterTimerRef.current) {
          clearInterval(liveCounterTimerRef.current);
          liveCounterTimerRef.current = null;
        }
      }
    },
    [applyPauseOrDoneState, ensureContext, onSupplyComplete],
  );

  const openSupplyOptimizer = useCallback(() => {
    setModalOpen(true);
  }, []);

  const closeSupplyOptimizer = useCallback(() => {
    setModalOpen(false);
  }, []);

  const stepOnce = useCallback(() => runMode("once"), [runMode]);
  const stepFew = useCallback(() => runMode("few"), [runMode]);
  const finish = useCallback(() => runMode("finish"), [runMode]);
  const reset = useCallback(() => {
    contextRef.current = null;
    evalCountRef.current = 0;
    runningRef.current = false;
    if (liveCounterTimerRef.current) {
      clearInterval(liveCounterTimerRef.current);
      liveCounterTimerRef.current = null;
    }
    setOptimizerState(initialOptimizerState);
  }, []);

  return {
    modalOpen,
    optimizerState,
    openSupplyOptimizer,
    closeSupplyOptimizer,
    stepOnce,
    stepFew,
    finish,
    reset,
  };
};
