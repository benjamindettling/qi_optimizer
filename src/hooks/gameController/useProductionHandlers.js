import { useCallback } from "react";
import { GOODS_TYPES } from "../../config/boardConfig";
import { computeStats } from "../../utils/stateUtils";
import {
  aggregateHarvest,
  buildHarvestResult,
  finishProductionsReadyMap,
  getCultureAutoHarvest,
} from "../../domain/production/productionController";
import { getOutsideQaDeltaForStepChange } from "../../utils/qaAccounting";

// Harvesting and production flows.
export const useProductionHandlers = ({
  layout,
  libraryMap,
  stats,
  resources,
  buildLocks,
  readyMap,
  timeStep,
  setResources,
  setReadyMap,
  setBuildLocks,
  setHarvestModal,
  setNotes,
  setBoostMode,
  setTimeStep,
  setSelectedIds,
  setSelectedBuildingId,
  applyConfigBoosts,
  qaBasePerHour,
  qaHoursPerHarvest,
  updateStatus,
  editingLocked,
  branchFromPast,
  trimFutureCheckpoints,
  setCheckpointIndex,
  setEditUnlocked,
  requestAutoSnapshot,
  recordHistoryAction,
}) => {
  const harvestBuildings = useCallback(
    (instances, label = "Harvest", skipPopup = false, skipHistory = false, options = {}) => {
      if (!instances.length) return;
      const logStatus = options.logStatus ?? !skipHistory;

      const locks = options.buildLocksOverride ?? buildLocks;
      const useStats = options.statsOverride ?? stats;
      const lockedIds = [];
      const harvestable = [];
      const lockedCulture = [];
      instances.forEach((inst) => {
        if (locks[inst.id]) {
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
          ? aggregateHarvest(harvestable, libraryMap, useStats, {
              qaHoursPerHarvest,
            })
          : { coins: 0, supplies: 0, chronos: 0, goods: {}, qa: 0 };

      const qaFromLockedCulture = lockedCulture.reduce(
        (acc, inst) =>
          acc +
          (libraryMap[inst.defId]?.quantumActions ?? 0) * qaHoursPerHarvest,
        0,
      );
      total.qa = (total.qa ?? 0) + qaFromLockedCulture;

      setResources((prev) => ({
        ...prev,
        coins: prev.coins + (total.coins ?? 0),
        supplies: prev.supplies + (total.supplies ?? 0),
        chronos: prev.chronos + (total.chronos ?? 0),
        quantumActions: (prev.quantumActions ?? 0) + (total.qa ?? 0),
        goods: GOODS_TYPES.reduce(
          (acc, g) => ({
            ...acc,
            [g]: (prev.goods?.[g] ?? 0) + (total.goods?.[g] ?? 0),
          }),
          {},
        ),
        units: { ...(prev.units ?? {}) },
      }));
      const harvestedIds = instances.map((i) => i.id);
      setReadyMap((prev) => {
        const next = { ...prev };
        harvestedIds.forEach((id) => {
          next[id] = false;
        });
        return next;
      });
      const unlockIds = [...lockedIds, ...lockedCulture.map((inst) => inst.id)];
      if (unlockIds.length) {
        setBuildLocks((prev) => {
          const next = { ...prev };
          unlockIds.forEach((id) => {
            next[id] = false;
          });
          return next;
        });
      }
      if (!skipPopup) {
        setHarvestModal({
          delta: total,
          result: buildHarvestResult({ total, resources }),
          title: label,
        });
      }
      if (logStatus) {
        updateStatus(label);
      }
    },
    [
      buildLocks,
      stats,
      libraryMap,
      qaHoursPerHarvest,
      setResources,
      setReadyMap,
      setBuildLocks,
      setHarvestModal,
      resources,
      updateStatus,
    ],
  );

  const finishProductions = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    trimFutureCheckpoints();
    setCheckpointIndex(null);
    setEditUnlocked(false);
    const label = "Beende alle Prod.";
    const finishStats = applyConfigBoosts(computeStats(layout, libraryMap));
    const { cultureIds, total: cultureTotal } =
      getCultureAutoHarvest(layout, libraryMap, buildLocks, finishStats, {
        qaHoursPerHarvest,
      });
    const currentStep = Number.isFinite(Number(timeStep))
      ? Number(timeStep)
      : 1;
    const nextStep = Math.min(23, currentStep + 1);
    const outsideQaDelta = getOutsideQaDeltaForStepChange({
      fromStep: currentStep,
      toStep: nextStep,
      qaOutsidePerHour: qaBasePerHour,
      qaHoursPerStep: qaHoursPerHarvest,
    });
    setNotes("");
    setReadyMap((prev) => {
      const next = finishProductionsReadyMap(layout, libraryMap, prev, buildLocks);
      cultureIds.forEach((id) => {
        next[id] = false;
      });
      return next;
    });
    setBuildLocks((prev) => {
      let changed = false;
      const next = { ...prev };
      Object.keys(next).forEach((id) => {
        if (next[id]) {
          next[id] = false;
          changed = true;
        }
      });
      return changed ? next : prev;
    });
    const totalQa = (cultureTotal.qa ?? 0) + outsideQaDelta;
    const hasCultureDelta =
      (cultureTotal.coins ?? 0) !== 0 ||
      (cultureTotal.supplies ?? 0) !== 0 ||
      (cultureTotal.chronos ?? 0) !== 0 ||
      Object.values(cultureTotal.goods ?? {}).some((v) => (v ?? 0) !== 0);
    if (totalQa !== 0 || hasCultureDelta) {
      setResources((prev) => ({
        ...prev,
        coins: (prev.coins ?? 0) + (cultureTotal.coins ?? 0),
        supplies: (prev.supplies ?? 0) + (cultureTotal.supplies ?? 0),
        chronos: (prev.chronos ?? 0) + (cultureTotal.chronos ?? 0),
        quantumActions: (prev.quantumActions ?? 0) + totalQa,
        goods: GOODS_TYPES.reduce(
          (acc, g) => ({
            ...acc,
            [g]: (prev.goods?.[g] ?? 0) + (cultureTotal.goods?.[g] ?? 0),
          }),
          {},
        ),
      }));
    }
    setTimeStep(() => nextStep);
    setBoostMode(false);
    updateStatus(label);
    setSelectedIds(new Set());
    setSelectedBuildingId(null);
    recordHistoryAction?.({
      type: "finishProductions",
      title: label,
    });
    requestAutoSnapshot();
  }, [
    layout,
    libraryMap,
    buildLocks,
    timeStep,
    qaBasePerHour,
    qaHoursPerHarvest,
    setResources,
    setReadyMap,
    setTimeStep,
    setBuildLocks,
    applyConfigBoosts,
    updateStatus,
    editingLocked,
    trimFutureCheckpoints,
    setCheckpointIndex,
    setEditUnlocked,
    setNotes,
    setBoostMode,
    setSelectedIds,
    setSelectedBuildingId,
    requestAutoSnapshot,
    recordHistoryAction,
  ]);

  const harvestAll = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    trimFutureCheckpoints();
    setCheckpointIndex(null);
    setEditUnlocked(false);
    branchFromPast();
    const readyOnes = layout.filter((b) => readyMap[b.id] === true);
    const isFullHarvest = readyOnes.length === 0;
    const label = isFullHarvest ? "Volle Ernte" : "Rest einsammeln";
    setNotes("");
    setBoostMode(false);

    const locksBefore = { ...buildLocks };
    const buildLocksAfter = { ...buildLocks };
    let unlockedAny = false;
    Object.keys(buildLocksAfter).forEach((key) => {
      if (buildLocksAfter[key]) {
        buildLocksAfter[key] = false;
        unlockedAny = true;
      }
    });
    if (unlockedAny) setBuildLocks(buildLocksAfter);

    const effectiveStats = applyConfigBoosts(computeStats(layout, libraryMap));
    const targets = isFullHarvest ? layout : readyOnes;
    harvestBuildings(targets, label, true, true, {
      statsOverride: effectiveStats,
      buildLocksOverride: locksBefore,
      logStatus: false,
    });
    if (isFullHarvest) {
      const currentStep = Number.isFinite(Number(timeStep))
        ? Number(timeStep)
        : 1;
      const nextStep = Math.min(23, currentStep + 1);
      const outsideQaDelta = getOutsideQaDeltaForStepChange({
        fromStep: currentStep,
        toStep: nextStep,
        qaOutsidePerHour: qaBasePerHour,
        qaHoursPerStep: qaHoursPerHarvest,
      });
      if (outsideQaDelta !== 0) {
        setResources((prev) => ({
          ...prev,
          quantumActions: (prev.quantumActions ?? 0) + outsideQaDelta,
        }));
      }
      setTimeStep(() => nextStep);
    }
    updateStatus(label);
    if (isFullHarvest) {
      setSelectedIds(new Set());
      setSelectedBuildingId(null);
    }
    recordHistoryAction?.({
      type: "harvestAll",
      title: label,
    });
    requestAutoSnapshot();
  }, [
    layout,
    readyMap,
    timeStep,
    harvestBuildings,
    buildLocks,
    setBuildLocks,
    applyConfigBoosts,
    libraryMap,
    setResources,
    qaBasePerHour,
    qaHoursPerHarvest,
    setTimeStep,
    setCheckpointIndex,
    setEditUnlocked,
    updateStatus,
    editingLocked,
    trimFutureCheckpoints,
    branchFromPast,
    setSelectedIds,
    setSelectedBuildingId,
    setNotes,
    setBoostMode,
    requestAutoSnapshot,
    recordHistoryAction,
  ]);

  // Partial harvest only - collects only ready buildings without creating a checkpoint
  const harvestPartialOnly = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    const readyOnes = layout.filter((b) => readyMap[b.id] === true);
    if (readyOnes.length === 0) {
      updateStatus("Keine fertigen Produktionen zum Einsammeln.");
      return;
    }
    
    trimFutureCheckpoints();
    setCheckpointIndex(null);
    setEditUnlocked(false);
    branchFromPast();
    
    const label = "Rest einsammeln";
    setBoostMode(false);

    const locksBefore = { ...buildLocks };
    const effectiveStats = applyConfigBoosts(computeStats(layout, libraryMap));
    
    harvestBuildings(readyOnes, label, true, true, {
      statsOverride: effectiveStats,
      buildLocksOverride: locksBefore,
      logStatus: false,
    });
    
    updateStatus(label);
    recordHistoryAction?.({
      type: "harvestAll",
      title: label,
    });
    requestAutoSnapshot();
  }, [
    layout,
    readyMap,
    harvestBuildings,
    buildLocks,
    applyConfigBoosts,
    libraryMap,
    setCheckpointIndex,
    setEditUnlocked,
    updateStatus,
    editingLocked,
    trimFutureCheckpoints,
    branchFromPast,
    setBoostMode,
    requestAutoSnapshot,
    recordHistoryAction,
  ]);

  const harvestFullForPdf = useCallback(
    (layoutOverride = null, buildLocksOverride = null) => {
      const effectiveLayout = Array.isArray(layoutOverride)
        ? layoutOverride
        : layout;
      const locksBefore = {
        ...(buildLocksOverride && typeof buildLocksOverride === "object"
          ? buildLocksOverride
          : buildLocks),
      };

      const effectiveStats = applyConfigBoosts(
        computeStats(effectiveLayout, libraryMap),
      );

      harvestBuildings(effectiveLayout, "Volle Ernte", true, true, {
        statsOverride: effectiveStats,
        buildLocksOverride: locksBefore,
        logStatus: false,
      });
    },
    [
      buildLocks,
      applyConfigBoosts,
      libraryMap,
      harvestBuildings,
      layout,
    ],
  );

  const confirmHarvest = useCallback(() => {
    setHarvestModal(null);
  }, [setHarvestModal]);

  const cancelHarvest = useCallback(() => {
    setHarvestModal(null);
  }, [setHarvestModal]);

  return {
    harvestBuildings,
    finishProductions,
    harvestAll,
    harvestPartialOnly,
    harvestFullForPdf,
    confirmHarvest,
    cancelHarvest,
  };
};
