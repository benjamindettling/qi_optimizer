import { useCallback } from "react";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../../config/boardConfig";
import { solveTilingMask } from "../../utils/tilingSolver";
import { applyTilingSolution, buildTilingGroups, buildTilingMask } from "../../utils/tilingTranslator";
import { isTierLocked } from "../../config/buildingTiers";
import {
  sumCost,
  addCost,
  subtractResources,
  maxCountForCost,
  canAffordTotal as canAffordTotalBase,
  buildCandidateLayoutFactory,
  countDefsFactory,
  insertTopResult,
} from "./smartInvestUtils";

// Smart invest search and apply flow.
export const useSmartInvest = ({
  layout,
  resources,
  readyMap,
  buildLocks,
  libraryMap,
  isCellUnlocked,
  timeStep,
  nextIdRef,
  cloneResources,
  infiniteResources,
  runSmartHarvestSimulation,
  smartInvestRunningRef,
  smartInvestStepResolveRef,
  smartInvestResults,
  setSmartInvestRunning,
  setSmartInvestResults,
  setSmartInvestModal,
  setLayout,
  setResources,
  setReadyMap,
  setBuildLocks,
  setTimeStep,
  setSelectedIds,
  setSelectedBuildingId,
  updateStatus,
  editingLocked,
  carried,
  trimFutureCheckpoints,
  setCheckpointIndex,
  setEditUnlocked,
  branchFromPast,
  requestAutoSnapshot,
}) => {
  const handleSmartInvest = useCallback(async () => {
    if (editingLocked) {
      updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
      return;
    }
    if (carried) {
      updateStatus("Bitte zuerst das getragene Gebaeude ablegen.");
      return;
    }
    if (smartInvestRunningRef.current) {
      updateStatus("Schlauer Invest laeuft bereits.");
      return;
    }

    smartInvestRunningRef.current = true;
    setSmartInvestRunning(true);
    setSmartInvestModal({ phase: "running", churchCount: 0 });

    const churchDef = libraryMap["culture:kirche"];
    const gutDef = libraryMap["housing:gutshaus"];
    const mehrDef = libraryMap["housing:mehrgeschossiges_haus"];
    if (!churchDef || !gutDef || !mehrDef) {
      const missing = [];
      if (!churchDef) missing.push("Kirche");
      if (!gutDef) missing.push("Gutshaus");
      if (!mehrDef) missing.push("Mehrgeschossiges Haus");
      const error = `Abbruch: ${missing.join(", ")} nicht gefunden.`;
      setSmartInvestResults([]);
      setSmartInvestModal({ phase: "results", results: [], error });
      setSmartInvestRunning(false);
      smartInvestRunningRef.current = false;
      updateStatus("Schlauer Invest abgebrochen.");
      return;
    }

    const baseLayout = layout.map((b) => ({ ...b }));
    const baseResources = cloneResources(resources);
    const baseReadyMap = { ...readyMap };
    const baseBuildLocks = { ...buildLocks };

    const mask = buildTilingMask(BOARD_WIDTH, BOARD_HEIGHT, isCellUnlocked);
    const availableCells = mask.reduce(
      (acc, row) => acc + row.filter(Boolean).length,
      0,
    );
    const existingArea = baseLayout.reduce(
      (acc, b) => acc + (b.width ?? 0) * (b.height ?? 0),
      0,
    );
    const extraCells = availableCells - existingArea;
    if (extraCells < 0) {
      const error = "Abbruch: Layout passt nicht in die freigegebene Flaeche.";
      setSmartInvestResults([]);
      setSmartInvestModal({ phase: "results", results: [], error });
      setSmartInvestRunning(false);
      smartInvestRunningRef.current = false;
      updateStatus("Schlauer Invest abgebrochen.");
      return;
    }

    const sleep = () => new Promise((resolve) => setTimeout(resolve, 0));
    const waitForContinue = () =>
      new Promise((resolve) => {
        smartInvestStepResolveRef.current = resolve;
      });

    const canAffordTotal = (res, cost) =>
      canAffordTotalBase(infiniteResources, res, cost);

    const churchArea = (churchDef.width ?? 0) * (churchDef.height ?? 0);
    const gutArea = (gutDef.width ?? 0) * (gutDef.height ?? 0);
    const mehrArea = (mehrDef.width ?? 0) * (mehrDef.height ?? 0);

    const maxChurchByArea = churchArea
      ? Math.floor(extraCells / churchArea)
      : 0;
    const maxChurchByBudget = infiniteResources
      ? maxChurchByArea
      : maxCountForCost(baseResources, churchDef.cost);
    const maxChurch = Math.max(0, Math.min(maxChurchByArea, maxChurchByBudget));

    const buildCandidateLayout = buildCandidateLayoutFactory({
      churchDef,
      gutDef,
      mehrDef,
      baseLayout,
      mask,
      nextIdRef,
      buildTilingGroups,
      solveTilingMask,
      applyTilingSolution,
    });

    const countDefs = countDefsFactory({ churchDef, gutDef, mehrDef });

    const results = [];
    let bestOverall = -Infinity;
    let outerMisses = 0;
    let resultId = 1;

    for (let churchCount = 0; churchCount <= maxChurch; churchCount += 1) {
      setSmartInvestModal({ phase: "running", churchCount, gutCount: 0 });
      await sleep();

      const costChurches = sumCost(churchDef.cost, churchCount);
      if (!canAffordTotal(baseResources, costChurches)) break;
      const areaChurches = churchCount * churchArea;
      if (areaChurches > extraCells) break;

      const remainingAfterChurch = subtractResources(
        cloneResources,
        baseResources,
        costChurches,
      );
      const maxGutshausByArea = gutArea
        ? Math.floor((extraCells - areaChurches) / gutArea)
        : 0;
      const maxGutshausByBudget = infiniteResources
        ? maxGutshausByArea
        : maxCountForCost(remainingAfterChurch, gutDef.cost);
      const maxGutshaus = Math.max(
        0,
        Math.min(maxGutshausByArea, maxGutshausByBudget),
      );

      let bestInner = -Infinity;
      let improvedOverall = false;
      let foundAny = false;

      for (let gutCount = 0; gutCount <= maxGutshaus; gutCount += 1) {
        setSmartInvestModal({ phase: "running", churchCount, gutCount });
        await sleep();
        const costGut = sumCost(gutDef.cost, gutCount);
        const baseCost = addCost(costChurches, costGut);
        if (!canAffordTotal(baseResources, baseCost)) break;
        const areaUsed = areaChurches + gutCount * gutArea;
        if (areaUsed > extraCells) break;

        const remainingAfterBase = subtractResources(
          cloneResources,
          baseResources,
          baseCost,
        );
        const maxMehrByArea = mehrArea
          ? Math.floor((extraCells - areaUsed) / mehrArea)
          : 0;
        const maxMehrByBudget = infiniteResources
          ? maxMehrByArea
          : maxCountForCost(remainingAfterBase, mehrDef.cost);
        let maxMehr = Math.max(0, Math.min(maxMehrByArea, maxMehrByBudget));

        let candidate = null;
        for (let mehrCount = maxMehr; mehrCount >= 0; mehrCount -= 1) {
          const totalCost = addCost(baseCost, sumCost(mehrDef.cost, mehrCount));
          if (!canAffordTotal(baseResources, totalCost)) continue;
          const resourcesAfterPurchase = subtractResources(
            cloneResources,
            baseResources,
            totalCost,
          );

          const applied = buildCandidateLayout(churchCount, gutCount, mehrCount);
          if (!applied) continue;

          const nextReadyMap = { ...baseReadyMap };
          const nextBuildLocks = { ...baseBuildLocks };
          applied.created.forEach((created) => {
            nextReadyMap[created.id] = false;
            nextBuildLocks[created.id] = isTierLocked(
              libraryMap[created.defId]?.tier,
            );
          });

          const simResult = runSmartHarvestSimulation({
            layout: applied.layout,
            readyMap: nextReadyMap,
            buildLocks: nextBuildLocks,
            resources: resourcesAfterPurchase,
            nextId: applied.nextId,
            timeStep: timeStep ?? 1,
            mask,
            logActions: false,
          });

          if (!simResult.ok) continue;

          candidate = {
            id: `invest-${resultId++}`,
            score: simResult.resources.coins ?? 0,
            resources: simResult.resources,
            layout: simResult.layout,
            readyMap: simResult.readyMap,
            buildLocks: simResult.buildLocks,
            timeStep: simResult.timeStep,
            nextId: simResult.nextId,
            counts: countDefs(simResult.layout),
          };
          break;
        }

        if (!candidate) {
          continue;
        }

        foundAny = true;
        if (candidate.score > bestInner) {
          bestInner = candidate.score;
        } else {
          break;
        }

        if (candidate.score > bestOverall) {
          bestOverall = candidate.score;
          improvedOverall = true;
        }

        results.splice(0, results.length, ...insertTopResult(results, candidate));

        setSmartInvestModal({
          phase: "step",
          churchCount,
          gutCount,
          lastResult: candidate,
          bestResult: results[0] ?? null,
        });
        await waitForContinue();
      }

      if (!foundAny) {
        outerMisses += 1;
      } else if (improvedOverall) {
        outerMisses = 0;
      } else {
        outerMisses += 1;
      }

      if (outerMisses >= 4) break;
    }

    const error =
      results.length === 0
        ? "Keine Ergebnisse für das aktuelle Budget gefunden."
        : null;

    setSmartInvestResults(results);
    setSmartInvestModal({ phase: "results", results, error });
    setSmartInvestRunning(false);
    smartInvestRunningRef.current = false;
    updateStatus("Schlauer Invest abgeschlossen.");
  }, [
    editingLocked,
    updateStatus,
    carried,
    libraryMap,
    layout,
    resources,
    cloneResources,
    infiniteResources,
    isCellUnlocked,
    readyMap,
    buildLocks,
    runSmartHarvestSimulation,
    timeStep,
    setSmartInvestRunning,
    setSmartInvestResults,
    setSmartInvestModal,
    smartInvestRunningRef,
    smartInvestStepResolveRef,
    nextIdRef,
  ]);

  const openSmartInvestResults = useCallback(() => {
    if (!smartInvestResults) return;
    setSmartInvestModal({ phase: "results", results: smartInvestResults });
  }, [smartInvestResults, setSmartInvestModal]);

  const continueSmartInvest = useCallback(() => {
    const resolver = smartInvestStepResolveRef.current;
    if (resolver) {
      smartInvestStepResolveRef.current = null;
      resolver();
    }
  }, [smartInvestStepResolveRef]);

  const closeSmartInvestModal = useCallback(() => {
    setSmartInvestModal(null);
  }, [setSmartInvestModal]);

  const applySmartInvestResult = useCallback(
    (result) => {
      if (!result) return;
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (carried) {
        updateStatus("Bitte zuerst das getragene Gebäude ablegen.");
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
      setSelectedIds(new Set());
      setSelectedBuildingId(null);
      setSmartInvestModal(null);
      updateStatus("Schlauer Invest angewendet.");
      requestAutoSnapshot();
    },
    [
      editingLocked,
      updateStatus,
      carried,
      trimFutureCheckpoints,
      setCheckpointIndex,
      setEditUnlocked,
      branchFromPast,
      setLayout,
      setResources,
      setReadyMap,
      setBuildLocks,
      setTimeStep,
      requestAutoSnapshot,
      setSelectedIds,
      setSelectedBuildingId,
      setSmartInvestModal,
      nextIdRef,
    ],
  );

  return {
    handleSmartInvest,
    openSmartInvestResults,
    continueSmartInvest,
    closeSmartInvestModal,
    applySmartInvestResult,
  };
};
