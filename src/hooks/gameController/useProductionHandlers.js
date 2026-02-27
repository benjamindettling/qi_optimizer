import { useCallback } from "react";
import { GOODS_TYPES } from "../../config/boardConfig";
import { computeStats } from "../../utils/stateUtils";
import {
  aggregateHarvest,
  buildHarvestResult,
  finishProductionsReadyMap,
} from "../../domain/production/productionController";

// Harvesting and production flows.
export const useProductionHandlers = ({
  layout,
  libraryMap,
  stats,
  resources,
  buildLocks,
  readyMap,
  setResources,
  setReadyMap,
  setBuildLocks,
  setHarvestModal,
  setNotes,
  setBoostMode,
  setTimeStep,
  setSelectedIds,
  setSelectedBuildingId,
  infiniteResources,
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

      const extraQa = options.extraQa ?? 0;
      total.qa += extraQa;

      if (!infiniteResources) {
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
      }
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
      infiniteResources,
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
    setNotes("");
    setReadyMap((prev) =>
      finishProductionsReadyMap(layout, libraryMap, prev, buildLocks),
    );
    if (!infiniteResources) {
      const baseQa = qaBasePerHour * qaHoursPerHarvest;
      if (baseQa > 0) {
        setResources((prev) => ({
          ...prev,
          quantumActions: (prev.quantumActions ?? 0) + baseQa,
        }));
      }
    }
    setTimeStep((prev) => Math.min(23, prev + 1));
    setBoostMode(false);
    updateStatus(label);
    setSelectedIds(new Set());
    setSelectedBuildingId(null);
    recordHistoryAction?.({
      type: infiniteResources ? "finishProductionsAdmin" : "finishProductions",
      title: label,
    });
    requestAutoSnapshot();
  }, [
    layout,
    libraryMap,
    buildLocks,
    infiniteResources,
    qaBasePerHour,
    qaHoursPerHarvest,
    setResources,
    setReadyMap,
    setTimeStep,
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
    const baseQa = qaBasePerHour * qaHoursPerHarvest;
    const extraQa = isFullHarvest ? baseQa : 0;
    const targets = isFullHarvest ? layout : readyOnes;
    harvestBuildings(targets, label, true, true, {
      statsOverride: effectiveStats,
      buildLocksOverride: locksBefore,
      extraQa,
      logStatus: false,
    });
    if (isFullHarvest) {
      setTimeStep((prev) => Math.min(23, prev + 1));
    }
    updateStatus(label);
    if (isFullHarvest) {
      setSelectedIds(new Set());
      setSelectedBuildingId(null);
    }
    recordHistoryAction?.({
      type: infiniteResources ? "harvestAllAdmin" : "harvestAll",
      title: label,
    });
    requestAutoSnapshot();
  }, [
    layout,
    readyMap,
    harvestBuildings,
    buildLocks,
    setBuildLocks,
    applyConfigBoosts,
    libraryMap,
    qaBasePerHour,
    qaHoursPerHarvest,
    infiniteResources,
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
      extraQa: 0,
      logStatus: false,
    });
    
    updateStatus(label);
    recordHistoryAction?.({
      type: infiniteResources ? "harvestAllAdmin" : "harvestAll",
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
    infiniteResources,
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
      const baseQa = qaBasePerHour * qaHoursPerHarvest;

      harvestBuildings(effectiveLayout, "Volle Ernte", true, true, {
        statsOverride: effectiveStats,
        buildLocksOverride: locksBefore,
        extraQa: baseQa,
        logStatus: false,
      });
    },
    [
      buildLocks,
      applyConfigBoosts,
      libraryMap,
      harvestBuildings,
      layout,
      qaBasePerHour,
      qaHoursPerHarvest,
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
