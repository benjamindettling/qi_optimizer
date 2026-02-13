import { useCallback } from "react";
import { BOARD_HEIGHT, BOARD_WIDTH, GOODS_TYPES } from "../../config/boardConfig";
import { happinessTier } from "../../utils/gameMath";
import { canAffordResources, computeStats } from "../../utils/stateUtils";
import { solveTilingMask } from "../../utils/tilingSolver";
import { applyTilingSolution, buildTilingGroups, buildTilingMask } from "../../utils/tilingTranslator";
import { isTierLocked } from "../../config/buildingTiers";
import { computeSaleOrRefund } from "../../domain/economy/resourceTransactions";
import { aggregateHarvest, finishProductionsReadyMap } from "../../domain/production/productionController";
import { formatNumber } from "../../utils/formatNumber";

// Smart harvest simulation and apply flow.
export const useSmartHarvest = ({
  layout,
  readyMap,
  buildLocks,
  resources,
  timeStep,
  libraryMap,
  cloneResources,
  qaBasePerHour,
  qaHoursPerHarvest,
  infiniteResources,
  isCellUnlocked,
  applyConfigBoosts,
  computeStatsWithLockedPeopleReq,
  setLayout,
  setResources,
  setReadyMap,
  setBuildLocks,
  setTimeStep,
  setSmartHarvestModal,
  setCheckpointIndex,
  setEditUnlocked,
  branchFromPast,
  trimFutureCheckpoints,
  requestAutoSnapshot,
  updateStatus,
  editingLocked,
  carried,
  nextIdRef,
}) => {
  const runSmartHarvestSimulation = useCallback(
    (input = {}) => {
      const {
        layout: startLayout = layout,
        readyMap: startReadyMap = readyMap,
        buildLocks: startBuildLocks = buildLocks,
        resources: startResources = resources,
        nextId: startNextId = nextIdRef.current,
        timeStep: startTimeStep = timeStep ?? 1,
        mask: maskOverride = null,
        logActions = false,
      } = input;

      const log = [];
      const addLog = logActions ? (msg) => log.push(msg) : () => {};

      const churchDef = libraryMap["culture:kirche"];
      if (!churchDef) {
        addLog("Abbruch: Kirche nicht gefunden.");
        return { ok: false, log, reason: "church_missing" };
      }

      let simLayout = startLayout.map((b) => ({ ...b }));
      let simReadyMap = { ...startReadyMap };
      let simBuildLocks = { ...startBuildLocks };
      let simResources = cloneResources(startResources);
      let simNextId = startNextId;
      let simTimeStep = startTimeStep;

      const baseQa = qaBasePerHour * qaHoursPerHarvest;
      simReadyMap = finishProductionsReadyMap(
        simLayout,
        libraryMap,
        simReadyMap,
        simBuildLocks,
      );
      if (!infiniteResources && baseQa > 0) {
        simResources.quantumActions =
          (simResources.quantumActions ?? 0) + baseQa;
      }
      simTimeStep = Math.min(23, simTimeStep + 1);

      const mask =
        maskOverride ??
        buildTilingMask(BOARD_WIDTH, BOARD_HEIGHT, isCellUnlocked);

      const computeUnlockedStats = () =>
        computeStatsWithLockedPeopleReq(simLayout, simBuildLocks);

      const computeHappyInfo = () => {
        const base = computeUnlockedStats();
        const happy = happinessTier(
          base.happinessProvided,
          base.happinessRequired,
        );
        const freePop = (base.people ?? 0) - (base.peopleReq ?? 0);
        return { base, happy, freePop };
      };

      const buildHarvestStats = (useLockedLayout = false) => {
        const base = useLockedLayout
          ? computeStats(simLayout, libraryMap)
          : computeUnlockedStats();
        return applyConfigBoosts(base);
      };

      const applyResourceDelta = (delta, sign = 1) => {
        if (infiniteResources) return;
        simResources.coins =
          (simResources.coins ?? 0) + sign * (delta.coins ?? 0);
        simResources.supplies =
          (simResources.supplies ?? 0) + sign * (delta.supplies ?? 0);
        simResources.chronos =
          (simResources.chronos ?? 0) + sign * (delta.chronos ?? 0);
      };

      const simulateHarvest = (
        instances,
        stats,
        options = { extraQa: 0, buildLocksOverride: null },
      ) => {
        if (!instances.length) return;
        const locks = options.buildLocksOverride ?? simBuildLocks;
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
            ? aggregateHarvest(harvestable, libraryMap, stats, {
                qaHoursPerHarvest,
              })
            : { coins: 0, supplies: 0, chronos: 0, goods: {}, qa: 0 };

        const qaFromLockedCulture = lockedCulture.reduce(
          (acc, inst) =>
            acc +
            (libraryMap[inst.defId]?.quantumActions ?? 0) * qaHoursPerHarvest,
          0,
        );
        total.qa =
          (total.qa ?? 0) + qaFromLockedCulture + (options.extraQa ?? 0);

        if (!infiniteResources) {
          simResources.coins = (simResources.coins ?? 0) + (total.coins ?? 0);
          simResources.supplies =
            (simResources.supplies ?? 0) + (total.supplies ?? 0);
          simResources.chronos =
            (simResources.chronos ?? 0) + (total.chronos ?? 0);
          simResources.quantumActions =
            (simResources.quantumActions ?? 0) + (total.qa ?? 0);
          simResources.goods = simResources.goods ?? {};
          GOODS_TYPES.forEach((g) => {
            simResources.goods[g] =
              (simResources.goods[g] ?? 0) + (total.goods?.[g] ?? 0);
          });
        }

        instances.forEach((inst) => {
          simReadyMap[inst.id] = false;
        });
        const unlockIds = [
          ...lockedIds,
          ...lockedCulture.map((inst) => inst.id),
        ];
        unlockIds.forEach((id) => {
          simBuildLocks[id] = false;
        });
      };

      const ensureFreePopulation = () => {
        const { freePop } = computeHappyInfo();
        return freePop >= 0;
      };

      if (!ensureFreePopulation()) {
        addLog("Abbruch: Freie Bevoelkerung unter 0.");
        return { ok: false, log, reason: "population" };
      }

      const multiHouseDefId = "housing:mehrgeschossiges_haus";
      const estateDefId = "housing:gutshaus";
      const targetRatio = 1.5;
      const maxSteps = 200;
      let ok = false;
      let failureReason = "";

      for (let step = 0; step < maxSteps; step += 1) {
        const { happy } = computeHappyInfo();
        if ((happy.ratio ?? 0) >= targetRatio) {
          ok = true;
          break;
        }

        let placedChurch = false;
        const canAffordChurch =
          infiniteResources || canAffordResources(simResources, churchDef.cost);
        if (canAffordChurch) {
          const { groups, blocks } = buildTilingGroups(simLayout, [
            { ...churchDef, count: 1 },
          ]);
          const placements = solveTilingMask(mask, blocks, { allowGaps: true });
          if (placements) {
            const applied = applyTilingSolution(placements, groups, simNextId);
            if (!applied) {
              failureReason = "Tiling konnte nicht uebertragen werden.";
              break;
            }
            simLayout = applied.layout;
            simNextId = applied.nextId;
            applied.created.forEach((created) => {
              simReadyMap[created.id] = false;
            simBuildLocks[created.id] = isTierLocked(churchDef.tier);
            });
            applyResourceDelta(churchDef.cost, -1);
            addLog("Setze Kirche");
            placedChurch = true;
            if (!ensureFreePopulation()) {
              failureReason = "Freie Bevoelkerung unter 0.";
              break;
            }
          }
        }

        if (placedChurch) continue;

        const target =
          simLayout.find((b) => b.defId === multiHouseDefId) ||
          simLayout.find((b) => b.defId === estateDefId);
        if (!target) {
          failureReason = "Keine passenden Wohngebaeude mehr.";
          break;
        }

        if (simReadyMap[target.id] === true) {
          const statsForHarvest = buildHarvestStats(false);
          simulateHarvest([target], statsForHarvest);
        }

        const refundDelta = computeSaleOrRefund(target, libraryMap, false);
        applyResourceDelta(refundDelta, 1);

        simLayout = simLayout.filter((b) => b.id !== target.id);
        delete simReadyMap[target.id];
        delete simBuildLocks[target.id];

        addLog(`Zerstoere ${libraryMap[target.defId]?.name ?? "Wohngebaeude"}`);

        if (!ensureFreePopulation()) {
          failureReason = "Freie Bevoelkerung unter 0.";
          break;
        }
      }

      if (!ok) {
        addLog(`Abbruch: ${failureReason || "Keine Loesung gefunden."}`);
        return { ok: false, log, reason: failureReason || "no_solution" };
      }

      addLog("150% erreicht -> Ernte Rest");
      const harvestTargets = simLayout.filter((b) => simReadyMap[b.id] === true);
      const finalHarvestStats = buildHarvestStats(true);
      simulateHarvest(harvestTargets, finalHarvestStats, { extraQa: baseQa });

      addLog(
        `Neuer Stand: ${formatNumber(simResources.coins ?? 0)} Muenzen, ${formatNumber(
          simResources.supplies ?? 0,
        )} Vorraete, ${formatNumber(simResources.chronos ?? 0)} Chronos`,
      );

      return {
        ok: true,
        log,
        layout: simLayout,
        readyMap: simReadyMap,
        buildLocks: simBuildLocks,
        resources: simResources,
        nextId: simNextId,
        timeStep: simTimeStep,
      };
    },
    [
      layout,
      readyMap,
      buildLocks,
      resources,
      timeStep,
      libraryMap,
      cloneResources,
      qaBasePerHour,
      qaHoursPerHarvest,
      infiniteResources,
      isCellUnlocked,
      applyConfigBoosts,
      computeStatsWithLockedPeopleReq,
      nextIdRef,
    ],
  );

  const handleSmartHarvest = useCallback(() => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    if (carried) {
      updateStatus("Bitte zuerst das getragene Gebaeude ablegen.");
      return;
    }

    const result = runSmartHarvestSimulation({ logActions: true });
    if (!result.ok) {
      setSmartHarvestModal({
        success: false,
        log: result.log,
        resources: {
          coins: resources.coins ?? 0,
          supplies: resources.supplies ?? 0,
          chronos: resources.chronos ?? 0,
          quantumActions: resources.quantumActions ?? 0,
        },
      });
      updateStatus("Schlaue Ernte abgebrochen.");
      return;
    }

    trimFutureCheckpoints();
    setCheckpointIndex(null);
    setEditUnlocked(false);
    branchFromPast();
    setLayout(result.layout);
    setResources(result.resources);
    setReadyMap(result.readyMap);
    setBuildLocks(result.buildLocks);
    setTimeStep(result.timeStep);
    nextIdRef.current = result.nextId;
    setSmartHarvestModal({
      success: true,
      log: result.log,
      resources: {
        coins: result.resources.coins ?? 0,
        supplies: result.resources.supplies ?? 0,
        chronos: result.resources.chronos ?? 0,
        quantumActions: result.resources.quantumActions ?? 0,
      },
    });
    updateStatus("Schlaue Ernte");
    requestAutoSnapshot();
  }, [
    editingLocked,
    updateStatus,
    carried,
    resources,
    setCheckpointIndex,
    setEditUnlocked,
    trimFutureCheckpoints,
    branchFromPast,
    setSmartHarvestModal,
    runSmartHarvestSimulation,
    setResources,
    setLayout,
    setReadyMap,
    setBuildLocks,
    setTimeStep,
    requestAutoSnapshot,
    nextIdRef,
  ]);

  const confirmSmartHarvest = useCallback(() => {
    setSmartHarvestModal(null);
  }, [setSmartHarvestModal]);

  return { runSmartHarvestSimulation, handleSmartHarvest, confirmSmartHarvest };
};
