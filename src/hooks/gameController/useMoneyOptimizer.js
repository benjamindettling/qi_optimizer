import { useCallback, useEffect, useRef, useState } from "react";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../../config/boardConfig";
import { happinessTier } from "../../utils/gameMath";
import { solveTilingMask } from "../../utils/tilingSolver";
import { buildTilingGroups, buildTilingMask } from "../../utils/tilingTranslator";
import { normalizeOptimizerInstance } from "./useSupplyOptimizer";

const DEF_IDS = {
  MH: "housing:mehrgeschossiges_haus",
  EH: "housing:gutshaus",
  FH: "housing:fachwerkhaus",
  CH: "housing:schindelhaus",
  CHURCH: "culture:kirche",
  BREWERY: "production:brauerei",
  TOWNHALL: "townhall:rathaus",
};

const MONEY_REMOVABLE_SET = new Set([
  DEF_IDS.MH,
  DEF_IDS.EH,
  DEF_IDS.CHURCH,
  DEF_IDS.BREWERY,
]);

const BASE_MH = 12500;
const BASE_EH = 3750;

const initialOptimizerState = {
  running: false,
  phase: "idle",
  subPhase: "geometry",
  geomEvalCount: 0,
  harvestEvalCount: 0,
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

const sellCost = (cost) => {
  const normalized = normalizeCost(cost);
  return {
    coins: Math.floor(normalized.coins * 0.25),
    supplies: Math.floor(normalized.supplies * 0.25),
    chronos: Math.floor(normalized.chronos * 0.25),
  };
};

const spendCost = (resources, cost) => {
  const normalized = normalizeCost(cost);
  resources.coins -= normalized.coins;
  resources.supplies -= normalized.supplies;
  resources.chronos -= normalized.chronos;
};

const refundCost = (resources, cost) => {
  const normalized = normalizeCost(cost);
  resources.coins += normalized.coins;
  resources.supplies += normalized.supplies;
  resources.chronos += normalized.chronos;
};

const getBaselineAwareBuildCost = (count, originalCount, fullCost, quarterCost) => {
  const restored = Math.min(count, originalCount);
  const newlyBuilt = Math.max(0, count - originalCount);
  return {
    coins: restored * quarterCost.coins + newlyBuilt * fullCost.coins,
    supplies: restored * quarterCost.supplies + newlyBuilt * fullCost.supplies,
    chronos: restored * quarterCost.chronos + newlyBuilt * fullCost.chronos,
  };
};

const cloneLayout = (layout, libraryMap) =>
  (layout || [])
    .map((instance) => normalizeOptimizerInstance(instance, libraryMap))
    .filter(Boolean)
    .map((instance) => ({ ...instance }));

const countDefId = (layout, defId) =>
  (layout || []).reduce(
    (count, instance) => count + (instance.defId === defId ? 1 : 0),
    0,
  );

const getStats = (layout, libraryMap) => {
  let totalPeople = 0;
  let totalPeopleReq = 0;
  let happinessProvided = 0;
  (layout || []).forEach((instance) => {
    const def = libraryMap?.[instance.defId];
    if (!def) return;
    totalPeople += toNumber(def.people);
    totalPeopleReq += toNumber(def.requiresPeople);
    happinessProvided += toNumber(def.happiness);
  });
  const happinessRequired = Math.max(totalPeopleReq, totalPeople);
  return { totalPeople, totalPeopleReq, happinessProvided, happinessRequired };
};

const computeMoneyHarvest = (layout, libraryMap, happiness_boost) => {
  let globalCoinBoost = 0;
  (layout || []).forEach((instance) => {
    if (instance.defId === DEF_IDS.TOWNHALL) return;
    const def = libraryMap?.[instance.defId];
    if (def) globalCoinBoost += toNumber(def.coinBoost);
  });

  let totalCoins = 0;
  const coinMulti = happiness_boost + globalCoinBoost;
  (layout || []).forEach((instance) => {
    if (instance.defId === DEF_IDS.TOWNHALL) return;
    const def = libraryMap?.[instance.defId];
    if (!def) return;
    const baseCoin = toNumber(def.production?.coins);
    if (baseCoin <= 0) return;
    totalCoins += Math.round(baseCoin * coinMulti);
  });

  return totalCoins;
};

const computeHousingChronos = (layout, libraryMap, happiness_boost) => {
  let totalChronos = 0;
  (layout || []).forEach((instance) => {
    if (instance.defId === DEF_IDS.TOWNHALL) return;
    const def = libraryMap?.[instance.defId];
    if (!def || def.category !== "housing") return;
    const baseChronos = toNumber(def.production?.chronos);
    if (baseChronos <= 0) return;
    totalChronos += Math.round(baseChronos * happiness_boost);
  });
  return totalChronos;
};

const runFitsCheck = (mask, layout) => {
  const { blocks } = buildTilingGroups(layout, []);
  const placements = solveTilingMask(mask, blocks, { allowGaps: true });
  return placements !== null;
};

const addInstance = (ctx, layout, defId) => {
  const def = ctx.defById[defId];
  if (!def) return null;
  const instance = {
    id: ctx.syntheticNextId++,
    defId,
    width: toNumber(def.size?.[0]) || toNumber(def.width),
    height: toNumber(def.size?.[1]) || toNumber(def.height),
  };
  layout.push(instance);
  return instance;
};

const removeOneByDefId = (layout, defId) => {
  for (let i = layout.length - 1; i >= 0; i -= 1) {
    if (layout[i].defId === defId) {
      return layout.splice(i, 1)[0];
    }
  }
  return null;
};

const cloneMoneySetup = (setup) => (setup ? { ...setup } : null);

const waitNextTick = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });

const makeRunContext = ({
  supplyResultLayout,
  supplyResultResources,
  preExistingLayout,
  originalStartLayout,
  libraryMap,
  isCellUnlockedFn,
  nextIdRef,
  bestSupplyHarvest,
  bestHarvestResults,
}) => {
  const normalizedSupplyLayout = cloneLayout(supplyResultLayout, libraryMap);
  const normalizedPreExisting = cloneLayout(preExistingLayout, libraryMap);
  const normalizedOriginalStart = cloneLayout(
    originalStartLayout?.length ? originalStartLayout : preExistingLayout,
    libraryMap,
  );
  const supplyResources = cloneResources(supplyResultResources);
  if (!supplyResultResources) {
    return { done: true, finalResources: null };
  }

  const mhDef = libraryMap?.[DEF_IDS.MH];
  const ehDef = libraryMap?.[DEF_IDS.EH];
  const fhDef = libraryMap?.[DEF_IDS.FH];
  const chDef = libraryMap?.[DEF_IDS.CH];
  const churchDef = libraryMap?.[DEF_IDS.CHURCH];
  const breweryDef = libraryMap?.[DEF_IDS.BREWERY];
  const townhallDef = libraryMap?.[DEF_IDS.TOWNHALL];

  const maxExistingId = [
    ...normalizedSupplyLayout,
    ...normalizedPreExisting,
    ...normalizedOriginalStart,
  ].reduce((maxId, instance) => Math.max(maxId, toNumber(instance.id)), 0);

  const ctx = {
    libraryMap,
    mask: buildTilingMask(BOARD_WIDTH, BOARD_HEIGHT, isCellUnlockedFn),
    supplyResultLayout: normalizedSupplyLayout,
    preExistingLayout: normalizedPreExisting,
    originalStartLayout: normalizedOriginalStart,
    supplyResultResources: supplyResources,
    loopResources: cloneResources(supplyResources),
    defById: {
      [DEF_IDS.MH]: mhDef,
      [DEF_IDS.EH]: ehDef,
      [DEF_IDS.FH]: fhDef,
      [DEF_IDS.CH]: chDef,
      [DEF_IDS.CHURCH]: churchDef,
      [DEF_IDS.BREWERY]: breweryDef,
      [DEF_IDS.TOWNHALL]: townhallDef,
    },
    syntheticNextId: Math.max(toNumber(nextIdRef?.current) || 1, maxExistingId + 1),
    geometryBaseLayout: [],
    geometryLayout: [],
    geometryMhCount: 0,
    geometryChurchCount: 0,
    geometryMode: "fill",
    maxHousingSlots: [],
    maxSlots: 0,
    harvestEhOffset: 0,
    noImproveStreak: 0,
    bestMoneyHarvest: Number.NEGATIVE_INFINITY,
    bestChronosHarvest: 0,
    bestSetup: null,
    currentSetup: null,
    finalResources: null,
    subPhase: "geometry",
    done: false,
    bestSupplyHarvest: bestSupplyHarvest ?? null,
    bestHarvestResults: bestHarvestResults ?? null,
    debugEvents: [],
    priorMH: countDefId(normalizedOriginalStart, DEF_IDS.MH),
    priorEH: countDefId(normalizedOriginalStart, DEF_IDS.EH),
    priorFH: countDefId(normalizedOriginalStart, DEF_IDS.FH),
    priorCH: countDefId(normalizedOriginalStart, DEF_IDS.CH),
    finalMH: countDefId(normalizedSupplyLayout, DEF_IDS.MH),
    finalEH: countDefId(normalizedSupplyLayout, DEF_IDS.EH),
    finalFH: countDefId(normalizedSupplyLayout, DEF_IDS.FH),
    finalCH: countDefId(normalizedSupplyLayout, DEF_IDS.CH),
    finalChurches: countDefId(normalizedSupplyLayout, DEF_IDS.CHURCH),
  };

  if (!mhDef || !ehDef || !churchDef || !breweryDef) {
    ctx.done = true;
    return ctx;
  }

  const loopResources = cloneResources(ctx.loopResources);
  normalizedOriginalStart.forEach((instance) => {
    if (!MONEY_REMOVABLE_SET.has(instance.defId)) return;
    const def = ctx.defById[instance.defId] || ctx.libraryMap?.[instance.defId];
    if (!def) return;
    refundCost(loopResources, sellCost(def.cost));
  });
  ctx.loopResources = loopResources;

  ctx.geometryBaseLayout = normalizedSupplyLayout
    .filter((instance) => !MONEY_REMOVABLE_SET.has(instance.defId))
    .map((instance) => ({ ...instance }));

  ctx.geometryLayout = ctx.geometryBaseLayout.map((instance) => ({ ...instance }));
  ctx.geometryMhCount = countDefId(ctx.geometryLayout, DEF_IDS.MH);

  return ctx;
};

const runGeometryStep = (ctx, countersRef) => {
  if (ctx.subPhase !== "geometry" || ctx.done) return;

  if (ctx.geometryMode === "fill") {
    addInstance(ctx, ctx.geometryLayout, DEF_IDS.MH);
    const fits = runFitsCheck(ctx.mask, ctx.geometryLayout);
    countersRef.current.geomEvalCount += 1;
    if (fits) {
      ctx.geometryMhCount += 1;
      return;
    }
    removeOneByDefId(ctx.geometryLayout, DEF_IDS.MH);
    ctx.maxHousingSlots[0] = ctx.geometryMhCount;
    ctx.maxSlots = ctx.geometryMhCount;
    ctx.geometryMode = "swap";
    ctx.debugEvents.push({ type: "geometry_result", churchCount: 0, maxMH: ctx.geometryMhCount });
    return;
  }

  ctx.geometryChurchCount += 1;
  addInstance(ctx, ctx.geometryLayout, DEF_IDS.CHURCH);
  let swapFits = runFitsCheck(ctx.mask, ctx.geometryLayout);
  countersRef.current.geomEvalCount += 1;

  while (!swapFits && ctx.geometryMhCount > 0) {
    const removedMh = removeOneByDefId(ctx.geometryLayout, DEF_IDS.MH);
    if (!removedMh) break;
    ctx.geometryMhCount -= 1;
    swapFits = runFitsCheck(ctx.mask, ctx.geometryLayout);
    countersRef.current.geomEvalCount += 1;
  }

  ctx.maxHousingSlots[ctx.geometryChurchCount] = ctx.geometryMhCount;
  ctx.debugEvents.push({ type: "geometry_result", churchCount: ctx.geometryChurchCount, maxMH: ctx.geometryMhCount });
  if (ctx.geometryMhCount === 0) {
    ctx.subPhase = "harvest";
    ctx.harvestEhOffset = 0;
    if (ctx.maxSlots === 0) {
      ctx.finalResources = {
        coins: ctx.bestHarvestResults?.coins ?? ctx.supplyResultResources.coins,
        supplies: (ctx.bestHarvestResults?.supplies ?? ctx.supplyResultResources.supplies) + 50000,
        chronos: (ctx.bestHarvestResults?.chronos ?? ctx.supplyResultResources.chronos) + ctx.bestChronosHarvest + 15,
      };
      ctx.done = true;
    }
  }
};

const runHarvestIteration = (ctx, countersRef) => {
  if (ctx.done || ctx.subPhase !== "harvest") return;

  if (ctx.harvestEhOffset > ctx.maxSlots) {
    ctx.done = true;
    const bestMoneyHarvest = Number.isFinite(ctx.bestMoneyHarvest)
      ? ctx.bestMoneyHarvest
      : 0;
    ctx.finalResources = {
      coins:
        (ctx.bestHarvestResults?.coins ?? ctx.supplyResultResources.coins) +
        bestMoneyHarvest,
      supplies: (ctx.bestHarvestResults?.supplies ?? ctx.supplyResultResources.supplies) + 50000,
      chronos: (ctx.bestHarvestResults?.chronos ?? ctx.supplyResultResources.chronos) + ctx.bestChronosHarvest + 15,
    };
    return;
  }

  const start_MH = ctx.maxSlots - ctx.harvestEhOffset;
  const start_EH = ctx.harvestEhOffset;

  const workingResources = cloneResources(ctx.loopResources);
  const workingLayout = cloneLayout(ctx.geometryBaseLayout, ctx.libraryMap);

  for (let i = 0; i < start_MH; i += 1) {
    addInstance(ctx, workingLayout, DEF_IDS.MH);
  }
  for (let i = 0; i < start_EH; i += 1) {
    addInstance(ctx, workingLayout, DEF_IDS.EH);
  }

  const mhCost = toNumber(ctx.defById[DEF_IDS.MH]?.cost?.coins);
  const ehCost = toNumber(ctx.defById[DEF_IDS.EH]?.cost?.coins);
  const churchCost = toNumber(ctx.defById[DEF_IDS.CHURCH]?.cost?.coins);

  const mhCostAll = normalizeCost(ctx.defById[DEF_IDS.MH]?.cost);
  const ehCostAll = normalizeCost(ctx.defById[DEF_IDS.EH]?.cost);
  const churchCostAll = normalizeCost(ctx.defById[DEF_IDS.CHURCH]?.cost);

  const mhSell = Math.floor(mhCost * 0.25);
  const ehSell = Math.floor(ehCost * 0.25);
  const churchSell = Math.floor(churchCost * 0.25);
  const mhSellAll = sellCost(ctx.defById[DEF_IDS.MH]?.cost);
  const ehSellAll = sellCost(ctx.defById[DEF_IDS.EH]?.cost);

  // Rebuild the selected start setup directly in Working.
  // Since loop baseline already sold original removable buildings, restoring
  // up to prior count only pays back sell value; extra copies pay full cost.
  spendCost(
    workingResources,
    getBaselineAwareBuildCost(start_MH, ctx.priorMH, mhCostAll, mhSellAll),
  );
  spendCost(
    workingResources,
    getBaselineAwareBuildCost(start_EH, ctx.priorEH, ehCostAll, ehSellAll),
  );

  const mhChronosPer = toNumber(ctx.defById[DEF_IDS.MH]?.production?.chronos);
  const ehChronosPer = toNumber(ctx.defById[DEF_IDS.EH]?.production?.chronos);

  let numb_MH = start_MH;
  let numb_EH = start_EH;
  let c = 1;
  let numb_churches = 0;
  let workingChronos = 0;

  while (true) {
    const stats = getStats(workingLayout, ctx.libraryMap);
    const happyEnough =
      stats.happinessProvided >= 2 * stats.happinessRequired;
    if (happyEnough) {
      const happiness_boost = happinessTier(
        stats.happinessProvided,
        stats.happinessRequired,
      ).ratio;

      const harvestLayout = workingLayout.map((i) => ({ ...i }));
      const money_from_remaining = computeMoneyHarvest(
        harvestLayout,
        ctx.libraryMap,
        happiness_boost,
      );
      const chronos_from_remaining = computeHousingChronos(
        workingLayout,
        ctx.libraryMap,
        happiness_boost,
      );
      const chronosHarvest = workingChronos + chronos_from_remaining;

      const townhallDef = ctx.libraryMap?.[DEF_IDS.TOWNHALL];
      const townhallCoins = townhallDef?.production?.coins ?? 50000;

      let buildingDiff = 0;

      // Adj is only the end-position delta vs supply optimizer end-position.
      // Positive = sell/refund value gained, negative = purchase needed.
      if (numb_MH > ctx.finalMH) {
        buildingDiff += (numb_MH - ctx.finalMH) * mhSell;
        numb_MH = ctx.finalMH;
      }
      buildingDiff += (numb_MH * mhCost);
  
      if (numb_EH > ctx.finalEH) {
        buildingDiff += (numb_EH - ctx.finalEH) * ehSell;
        numb_EH = ctx.finalEH;
      }
      buildingDiff += (numb_EH * ehCost);
      
      if (numb_churches > ctx.finalChurches) {
        buildingDiff += (numb_churches - ctx.finalChurches) * churchSell;
        numb_churches = ctx.finalChurches;
      }
      buildingDiff += (numb_churches * churchCost);

      const total_coins_this_iteration =
        workingResources.coins + money_from_remaining + townhallCoins + buildingDiff;
      const moneyHarvest = total_coins_this_iteration - ctx.loopResources.coins;

      ctx.currentSetup = {
        start_MH,
        start_EH,
        numb_churches,
        moneyHarvest,
        chronosHarvest,
      };

      const isBestHarvest = ctx.bestSetup === null || moneyHarvest > ctx.bestMoneyHarvest;
      ctx.debugEvents.push({
        type: "harvest_eval",
        start_MH,
        start_EH,
        numb_churches,
        loopCoins: ctx.loopResources.coins,
        workingCoins: workingResources.coins,
        moneyFromProduction: money_from_remaining,
        townhallCoins,
        buildingDiff,
        totalCoins: total_coins_this_iteration,
        moneyHarvest,
        isBest: isBestHarvest,
      });

      if (isBestHarvest) {
        ctx.bestMoneyHarvest = moneyHarvest;
        ctx.bestChronosHarvest = chronosHarvest;
        ctx.bestSetup = cloneMoneySetup(ctx.currentSetup);
        ctx.noImproveStreak = 0;
      } else {
        ctx.noImproveStreak += 1;
      }

      countersRef.current.harvestEvalCount += 1;
      ctx.harvestEhOffset += 1;

      if (ctx.noImproveStreak >= 2 || ctx.harvestEhOffset > ctx.maxSlots) {
        ctx.done = true;
        const bestMoneyHarvest = Number.isFinite(ctx.bestMoneyHarvest)
          ? ctx.bestMoneyHarvest
          : 0;
        ctx.finalResources = {
          coins:
            (ctx.bestHarvestResults?.coins ?? ctx.supplyResultResources.coins) +
            bestMoneyHarvest,
          supplies: (ctx.bestHarvestResults?.supplies ?? ctx.supplyResultResources.supplies) + 50000,
          chronos: (ctx.bestHarvestResults?.chronos ?? ctx.supplyResultResources.chronos) + ctx.bestChronosHarvest + 15,
        };
      }
      return;
    }

    const currentHousingCount = numb_MH + numb_EH;
    const threshold = ctx.maxHousingSlots[c] ?? 0;
    if (currentHousingCount === threshold) {
      spendCost(workingResources, churchCostAll);
      addInstance(ctx, workingLayout, DEF_IDS.CHURCH);
      numb_churches += 1;
      c += 1;
      continue;
    }

    const happiness_boost = happinessTier(
      stats.happinessProvided,
      stats.happinessRequired,
    ).ratio;

    if (numb_MH > 0) {
      const ehBonus = numb_EH * 0.2;
      const mhProduction = BASE_MH * (ehBonus + happiness_boost);

      workingResources.coins += mhProduction;
      refundCost(workingResources, mhSellAll);
      workingChronos += Math.round(mhChronosPer * happiness_boost);
      removeOneByDefId(workingLayout, DEF_IDS.MH);
      numb_MH -= 1;
      continue;
    }

    if (numb_EH > 0) {
      const ehBonus = numb_EH * 0.2;
      const ehProduction = BASE_EH * (ehBonus + happiness_boost);

      workingResources.coins += ehProduction;
      refundCost(workingResources, ehSellAll);
      workingChronos += Math.round(ehChronosPer * happiness_boost);
      removeOneByDefId(workingLayout, DEF_IDS.EH);
      numb_EH -= 1;
      continue;
    }

    spendCost(workingResources, churchCostAll);
    addInstance(ctx, workingLayout, DEF_IDS.CHURCH);
    numb_churches += 1;
    c += 1;
  }
};

export const useMoneyOptimizer = ({
  supplyResultLayout,
  supplyResultResources,
  preExistingLayout,
  libraryMap,
  isCellUnlockedFn,
  nextIdRef,
}) => {
  const [optimizerState, setOptimizerState] = useState(initialOptimizerState);

  const inputRef = useRef({
    supplyResultLayout,
    supplyResultResources,
    preExistingLayout,
    originalStartLayout: preExistingLayout,
    libraryMap,
    isCellUnlockedFn,
    nextIdRef,
    bestSupplyHarvest: null,
    bestHarvestResults: null,
  });
  const contextRef = useRef(null);
  const runningRef = useRef(false);
  const countersRef = useRef({
    geomEvalCount: 0,
    harvestEvalCount: 0,
  });
  const liveCounterTimerRef = useRef(null);

  useEffect(() => {
    inputRef.current = {
      supplyResultLayout,
      supplyResultResources,
      preExistingLayout,
      originalStartLayout: inputRef.current.originalStartLayout,
      libraryMap,
      isCellUnlockedFn,
      nextIdRef,
      bestSupplyHarvest: inputRef.current.bestSupplyHarvest,
      bestHarvestResults: inputRef.current.bestHarvestResults,
    };
  }, [
    supplyResultLayout,
    supplyResultResources,
    preExistingLayout,
    libraryMap,
    isCellUnlockedFn,
    nextIdRef,
  ]);

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

  const applyPausedOrDoneState = useCallback((phase) => {
    const context = contextRef.current;
    setOptimizerState((prev) => ({
      ...prev,
      running: false,
      phase,
      subPhase: context?.subPhase ?? prev.subPhase,
      geomEvalCount: countersRef.current.geomEvalCount,
      harvestEvalCount: countersRef.current.harvestEvalCount,
      currentSetup: cloneMoneySetup(context?.currentSetup) || prev.currentSetup,
      bestSetup: cloneMoneySetup(context?.bestSetup) || prev.bestSetup,
      finalResources: context?.finalResources
        ? { ...context.finalResources }
        : prev.finalResources,
      debugEvents: context?.debugEvents ? [...context.debugEvents] : [],
    }));
  }, []);

  const runMode = useCallback(
    async (mode) => {
      if (runningRef.current) return;

      const { context, createdNew } = ensureContext();
      if (!context || !context.supplyResultResources) return;

      countersRef.current = { geomEvalCount: 0, harvestEvalCount: 0 };
      runningRef.current = true;

      setOptimizerState((prev) => ({
        ...prev,
        running: true,
        phase: "running",
        subPhase: context.subPhase,
        geomEvalCount: 0,
        harvestEvalCount: 0,
        currentSetup: createdNew ? null : prev.currentSetup,
        bestSetup: createdNew ? null : prev.bestSetup,
        finalResources: createdNew ? null : prev.finalResources,
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
                subPhase: contextRef.current?.subPhase ?? prev.subPhase,
                geomEvalCount: countersRef.current.geomEvalCount,
                harvestEvalCount: countersRef.current.harvestEvalCount,
              },
        );
      }, 200);

      try {
        let shouldPause = false;

        while (!context.done) {
          if (context.subPhase === "geometry") {
            runGeometryStep(context, countersRef);
            if (mode === "once") {
              shouldPause = true;
            } else if (mode === "few" && context.subPhase === "harvest") {
              shouldPause = true;
            }
          } else {
            runHarvestIteration(context, countersRef);
            if (mode === "once" && !context.done) {
              shouldPause = true;
            }
          }

          if (context.done || shouldPause) break;
          await waitNextTick();
        }

        if (context.done) {
          applyPausedOrDoneState("done");
        } else {
          applyPausedOrDoneState("paused");
        }
      } finally {
        runningRef.current = false;
        if (liveCounterTimerRef.current) {
          clearInterval(liveCounterTimerRef.current);
          liveCounterTimerRef.current = null;
        }
      }
    },
    [applyPausedOrDoneState, ensureContext],
  );

  const startFromSupplyResult = useCallback(
    (payload, triggerMode = "finish") => {
      inputRef.current = {
        ...inputRef.current,
        supplyResultLayout: payload?.supplyResultLayout || [],
        supplyResultResources: payload?.supplyResultResources || null,
        preExistingLayout:
          payload?.preExistingLayout || inputRef.current.preExistingLayout || [],
        originalStartLayout:
          payload?.originalStartLayout || inputRef.current.originalStartLayout || [],
        bestSupplyHarvest: payload?.bestSupplyHarvest ?? null,
        bestHarvestResults: payload?.bestHarvestResults ?? null,
      };
      contextRef.current = null;
      setOptimizerState(initialOptimizerState);

      const mappedMode =
        triggerMode === "once" || triggerMode === "few" || triggerMode === "finish"
          ? triggerMode
          : "finish";
      queueMicrotask(() => {
        runMode(mappedMode);
      });
    },
    [runMode],
  );

  const stepOnce = useCallback(() => runMode("once"), [runMode]);
  const stepFew = useCallback(() => runMode("few"), [runMode]);
  const finish = useCallback(() => runMode("finish"), [runMode]);
  const reset = useCallback(() => {
    contextRef.current = null;
    countersRef.current = { geomEvalCount: 0, harvestEvalCount: 0 };
    runningRef.current = false;
    if (liveCounterTimerRef.current) {
      clearInterval(liveCounterTimerRef.current);
      liveCounterTimerRef.current = null;
    }
    setOptimizerState(initialOptimizerState);
  }, []);

  return {
    optimizerState,
    startFromSupplyResult,
    stepOnce,
    stepFew,
    finish,
    reset,
  };
};
