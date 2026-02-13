import { useCallback, useMemo } from "react";
import { QA_BASE_PER_HOUR } from "../../config/gameDefaults";
import { happinessTier } from "../../utils/gameMath";
import { computeStats } from "../../utils/stateUtils";

// Derives stats, boosts, and helper computations from the current layout.
export const useGameStats = ({ layout, buildLocks, libraryMap, config, setWorstModal }) => {
  const computeLockedPeopleReq = useCallback(
    (layoutList, locks) =>
      (layoutList || []).reduce((acc, inst) => {
        if (!locks?.[inst.id]) return acc;
        const def = libraryMap[inst.defId];
        if (!def || def.category === "housing") return acc;
        const req = def.requiresPeople ?? 0;
        return req > 0 ? acc + req : acc;
      }, 0),
    [libraryMap],
  );

  const computeStatsWithLockedPeopleReq = useCallback(
    (layoutList, locks) => {
      const unlocked = (layoutList || []).filter((b) => !locks?.[b.id]);
      const base = computeStats(unlocked, libraryMap);
      const lockedReq = computeLockedPeopleReq(layoutList, locks);
      if (!lockedReq) return base;
      return { ...base, peopleReq: (base.peopleReq ?? 0) + lockedReq };
    },
    [computeLockedPeopleReq, libraryMap],
  );

  const baseStats = useMemo(
    () => computeStatsWithLockedPeopleReq(layout, buildLocks),
    [layout, buildLocks, computeStatsWithLockedPeopleReq],
  );

  const coinBoostCfg = Number(config?.coinBoost ?? 0) / 100;
  const supplyBoostCfg = Number(config?.supplyBoost ?? 0) / 100;
  // Note: armyBoostRed/Blue now only come from decorations in baseStats
  // Config attack/defense boosts are applied separately in StatsPanel
  const applyConfigBoosts = useCallback(
    (base) => ({
      ...base,
      coinBoost: (base.coinBoost ?? 0) + coinBoostCfg,
      supplyBoost: (base.supplyBoost ?? 0) + supplyBoostCfg,
      // armyBoostRed/Blue are kept as-is from decorations
      armyBoostRed: base.armyBoostRed ?? 0,
      armyBoostBlue: base.armyBoostBlue ?? 0,
    }),
    [coinBoostCfg, supplyBoostCfg],
  );

  const qaBasePerHour = QA_BASE_PER_HOUR + Number(config?.qaBaseBonus ?? 0);
  const qaHoursPerHarvest = Number(config?.qaHarvestHours ?? 12);
  const qaRateFromBuildings = useMemo(
    () =>
      layout.reduce(
        (acc, b) => acc + (libraryMap[b.defId]?.quantumActions ?? 0),
        0,
      ),
    [layout, libraryMap],
  );
  const qaPerHour = qaBasePerHour + qaRateFromBuildings;
  const statsWithConfig = applyConfigBoosts(baseStats);
  const stats = { ...statsWithConfig, qaPerHour, qaHoursPerHarvest };
  const happyInfo = happinessTier(
    stats.happinessProvided,
    stats.happinessRequired,
  );

  const harvestWithConfig = useCallback(
    (layoutSubset) => {
      const base = computeStats(layoutSubset, libraryMap);
      const happy = happinessTier(
        base.happinessProvided,
        base.happinessRequired,
      ).ratio;
      const coinBoost = (base.coinBoost ?? 0) + coinBoostCfg;
      const supplyBoost = (base.supplyBoost ?? 0) + supplyBoostCfg;
      const coins =
        Math.round(base.baseCoins * (1 + coinBoost + (happy - 1))) +
        base.flatCoins;
      const supplies =
        Math.round(base.baseSupplies * (1 + supplyBoost + (happy - 1))) +
        base.flatSupplies;
      return { coins, supplies };
    },
    [libraryMap, coinBoostCfg, supplyBoostCfg],
  );

  const openWorstModal = useCallback(() => {
    const activeLayout = layout.filter((b) => !buildLocks[b.id]);
    const housingDefs = Array.from(
      new Set(
        activeLayout
          .filter((b) => libraryMap[b.defId]?.category === "housing")
          .map((b) => b.defId),
      ),
    );
    const productionDefs = Array.from(
      new Set(
        activeLayout
          .filter((b) => libraryMap[b.defId]?.category === "production")
          .map((b) => b.defId),
      ),
    );

    const computeList = (defIds, harvestKey) =>
      defIds
        .map((defId) => {
          const idx = activeLayout.findIndex((b) => b.defId === defId);
          if (idx === -1) return null;
          const removed = activeLayout.filter((_, i) => i !== idx);
          const h = harvestWithConfig(removed);
          const value = h[harvestKey] ?? 0;
          const def = libraryMap[defId];
          return {
            defId,
            short: def?.short || def?.name || defId,
            name: def?.name || defId,
            value,
          };
        })
        .filter(Boolean);

    const housingList = computeList(housingDefs, "coins");
    const productionList = computeList(productionDefs, "supplies");

    setWorstModal({
      housing: housingList,
      production: productionList,
    });
  }, [layout, buildLocks, libraryMap, harvestWithConfig, setWorstModal]);

  return {
    stats,
    happyInfo,
    applyConfigBoosts,
    computeStatsWithLockedPeopleReq,
    qaBasePerHour,
    qaHoursPerHarvest,
    qaPerHour,
    openWorstModal,
  };
};
