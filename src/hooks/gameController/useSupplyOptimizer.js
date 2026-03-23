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

const initialOptimizerState = {
  running: false,
  phase: "idle",
  evalCount: 0,
  currentSetup: null,
  bestSetup: null,
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

const normalizeInstance = (instance, libraryMap) => {
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

const computeSupplyHarvest = (stats, currentResources) =>
  (1.5 + 0.1 * stats.numbAlchemists + 0.2 * stats.numbBreweries) *
    (BASE_BAKERY_SUPPLIES * stats.numbBakeries +
      BASE_ALCHEMIST_SUPPLIES * stats.numbAlchemists) +
  50000 +
  toNumber(currentResources.supplies);

const addControlledBuilding = (ctx, defId) => {
  const def = ctx.defById[defId];
  if (!def) return false;
  if (!canAffordCost(ctx.currentResources, def.cost)) return false;
  spendCost(ctx.currentResources, def.cost);
  ctx.controlledList.push({
    id: ctx.syntheticNextId++,
    defId,
    width: toNumber(def.size?.[0]) || toNumber(def.width),
    height: toNumber(def.size?.[1]) || toNumber(def.height),
  });
  return true;
};

const removeControlledAtIndex = (ctx, index) => {
  if (index < 0 || index >= ctx.controlledList.length) return null;
  const removed = ctx.controlledList[index];
  const def = ctx.defById[removed.defId];
  if (def) {
    refundCost(ctx.currentResources, def.cost);
  }
  ctx.controlledList.splice(index, 1);
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
  const supplyHarvest = computeSupplyHarvest(stats, ctx.currentResources);
  ctx.currentSetup = buildSetupSnapshot(
    ctx.controlledList,
    ctx.libraryMap,
    supplyHarvest,
  );

  if (ctx.bestSetup === null || supplyHarvest > ctx.bestSupplyHarvest) {
    ctx.bestSupplyHarvest = supplyHarvest;
    ctx.bestSetup = cloneSetupSnapshot(ctx.currentSetup);
    ctx.bestAlchemists = stats.numbAlchemists;
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
    .map((instance) => normalizeInstance(instance, libraryMap))
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
    bestSupplyHarvest: Number.NEGATIVE_INFINITY,
    bestAlchemists: 0,
    done: false,
    mask: buildTilingMask(BOARD_WIDTH, BOARD_HEIGHT, isCellUnlockedFn),
    syntheticNextId,
  };

  const hasRequiredDefs = requiredDefIds.every((defId) => !!ctx.defById[defId]);
  if (!hasRequiredDefs) {
    ctx.done = true;
    return ctx;
  }

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

      evalCountRef.current = 0;
      runningRef.current = true;

      setOptimizerState((prev) => ({
        ...prev,
        running: true,
        phase: "running",
        evalCount: 0,
        currentSetup: createdNew ? null : prev.currentSetup,
        bestSetup: createdNew ? null : prev.bestSetup,
      }));

      if (liveCounterTimerRef.current) {
        clearInterval(liveCounterTimerRef.current);
      }
      liveCounterTimerRef.current = setInterval(() => {
        setOptimizerState((prev) =>
          prev.phase !== "running"
            ? prev
            : {
                ...prev,
                evalCount: evalCountRef.current,
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
          applyPauseOrDoneState("done");
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
    [applyPauseOrDoneState, ensureContext],
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

  return {
    modalOpen,
    optimizerState,
    openSupplyOptimizer,
    closeSupplyOptimizer,
    stepOnce,
    stepFew,
    finish,
  };
};
