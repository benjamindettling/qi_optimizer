import { useCallback, useMemo } from "react";
import { BOARD_HEIGHT, BOARD_WIDTH } from "../../config/boardConfig";
import { canAffordResources, hasPopulationForDef } from "../../utils/stateUtils";
import { isAreaFree } from "../../utils/layoutUtils";
import { computeSaleOrRefund } from "../../domain/economy/resourceTransactions";
import {
  isTierLocked,
} from "../../config/buildingTiers";
import { dropCarried, findTargetInstance } from "../../domain/placement/placementController";
import { getBuildingName, getCurrentLang } from "../../utils/buildingName";
import { getBoostInteractionState } from "../../utils/shards";

// Board click handling for placement, move, sell, and boost.
export const usePlacementHandlers = ({
  layout,
  carried,
  libraryMap,
  isCellUnlocked,
  moveMode,
  sellMode,
  refundMode,
  boostMode,
  buildLocks,
  readyMap,
  resources,
  stats,
  selectedBuildingId,
  autoSelectNew,
  infiniteResources,
  config,
  effectiveResources,
  applySpend,
  applyRefund,
  setResources,
  setLayout,
  setCarried,
  setMoveMode,
  moveSnapshot,
  setReadyMap,
  setBuildLocks,
  setMoveSnapshot,
  setSelectedIds,
  setSelectedBuildingId,
  setGoodsModal,
  setUnitModal,
  updateStatus,
  harvestBuildings,
  buildSnapshot,
  overwriteCheckpointAtIndex,
  suppressNextCheckpoint,
  branchFromPast,
  requestAutoSnapshot,
  isPast,
  nextIdRef,
  recordHistoryAction,
  moveChainRef,
  applySnapshot,
  clearMoveChain,
}) => {
  const selectedDef = useMemo(
    () => (selectedBuildingId ? libraryMap[selectedBuildingId] : null),
    [selectedBuildingId, libraryMap],
  );

  // Track positions for the current move/swap-chain
  const recordMovePosition = useCallback((fromX, fromY, toX, toY) => {
    if (fromX === toX && fromY === toY) return;
    const chain = moveChainRef?.current;
    if (!chain) return;
    chain.push([fromX, fromY, toX, toY]);
  }, [moveChainRef]);

  // Flush and record the move action when move/swap-chain completes
  const finishMove = useCallback(() => {
    const positions = moveChainRef?.current ?? [];
    if (moveChainRef) {
      moveChainRef.current = [];
    }
    // Filter out any no-op moves
    const filtered = positions.filter(([x, y, xn, yn]) => x !== xn || y !== yn);
    if (!filtered.length) return;
    recordHistoryAction?.({
      type: "move",
      positions: filtered,
    });
  }, [recordHistoryAction, moveChainRef]);

  const cancelMove = useCallback(() => {
    if (moveSnapshot) {
      applySnapshot(moveSnapshot);
    }
    clearMoveChain?.();
    setCarried(null);
    setMoveSnapshot(null);
  }, [applySnapshot, clearMoveChain, moveSnapshot, setCarried, setMoveSnapshot]);

  const onCancelAction = useCallback(() => {
    if (carried) {
      cancelMove();
    }
    if (selectedBuildingId) {
      setSelectedBuildingId(null);
    }
  }, [cancelMove, carried, selectedBuildingId, setSelectedBuildingId]);

  const handleCellClick = useCallback(
    (x, y) => {
      const target = findTargetInstance(layout, x, y);
      if (carried) {
        const placeX = Math.min(x, BOARD_WIDTH - carried.def.width);
        const placeY = Math.min(y, BOARD_HEIGHT - carried.def.height);
        const fromX = carried.instance.x;
        const fromY = carried.instance.y;
        const dropResult = dropCarried({
          carried,
          x,
          y,
          layout,
          libraryMap,
          isCellUnlocked,
          setLayout,
          setCarried,
          setReadyMap,
          setBuildLocks,
          readyMap,
          buildLocks,
          setMoveMode,
          updateStatus,
        });
        if (dropResult?.ok) {
          // Record this position change in the chain
          recordMovePosition(fromX, fromY, placeX, placeY);
          if (dropResult?.done) {
            // Chain complete - record the move action
            finishMove();
            requestAutoSnapshot();
          }
          return {
            ok: true,
            done: !!dropResult?.done,
            kind: "move",
            swapped: !!dropResult?.swapped,
          };
        }
        return {
          ok: false,
          done: false,
          kind: "move",
        };
      }

      if ((sellMode || refundMode) && target) {
        if (libraryMap[target.defId]?.category === "townhall") {
          updateStatus("Rathaus kann nicht verkauft werden.");
          return { ok: false, done: false, kind: "sell" };
        }
        const def = libraryMap[target.defId];
        const lang = getCurrentLang();
        const isHarvestable = readyMap[target.id] === true;
        const isLocked = buildLocks[target.id] === true;
        const sellHistory = {
          type: refundMode
            ? "sellFull"
            : infiniteResources
              ? "sellAdmin"
              : "sell",
          shortId: def?.shortId ?? target.defId,
          x: target.x,
          y: target.y,
          harvestable: isHarvestable,
          locked: isLocked,
        };
        branchFromPast();
        const delta = computeSaleOrRefund(target, libraryMap, refundMode);
        if (readyMap[target.id] === true) {
          // Delete flow invariant: if target is ready, collect yield before removal.
          const lockOverride = { ...buildLocks, [target.id]: false };
          harvestBuildings([target], "Harvest", true, true, {
            buildLocksOverride: lockOverride,
          });
        }
        const label = `${refundMode ? "Rueckerstattung:" : "Verkauft:"} ${
          getBuildingName(libraryMap[target.defId], lang, "name")
        }`;
        applyRefund(delta);
        setLayout((prev) => prev.filter((p) => p.id !== target.id));
        setReadyMap((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });
        setBuildLocks((prev) => {
          const next = { ...prev };
          delete next[target.id];
          return next;
        });
        updateStatus(label);
        if (isPast) {
          setTimeout(() => {
            overwriteCheckpointAtIndex(buildSnapshot());
          }, 0);
        }
        recordHistoryAction?.(sellHistory);
        requestAutoSnapshot();
        return { ok: true, done: true, kind: "sell" };
      }

      if (boostMode && target) {
        const def = libraryMap[target.defId];
        const lang = getCurrentLang();
        const spendShards = (cost) => {
          if (infiniteResources || cost <= 0) return;
          setResources((prev) => ({
            ...prev,
            shards: (prev.shards ?? 0) - cost,
          }));
        };
        const boostState = getBoostInteractionState({
          def,
          locked: !!buildLocks[target.id],
          ready: !!readyMap[target.id],
          shards: resources.shards ?? 0,
          config,
          infiniteResources,
        });
        if (boostState.action === "unlock") {
          if (!boostState.allowed) {
            updateStatus("Need more shards.");
            return { ok: false, done: false, kind: "boost" };
          }
          spendShards(boostState.cost);
          if (def?.category === "culture") {
            harvestBuildings([target], "Harvest", true);
            updateStatus(`Unlocked ${getBuildingName(def, lang, "name")}`);
          } else {
            setBuildLocks((prev) => ({ ...prev, [target.id]: false }));
            updateStatus(`Unlocked ${getBuildingName(def, lang, "name")}`);
          }
          recordHistoryAction?.({
            type: infiniteResources ? "boostUnlockAdmin" : "boostUnlock",
            shortId: def?.shortId ?? target.defId,
            x: target.x,
            y: target.y,
          });
        } else if (boostState.action === "harvest") {
          recordHistoryAction?.({
            type: "harvest",
            shortId: def?.shortId ?? target.defId,
            x: target.x,
            y: target.y,
          });
          harvestBuildings([target], "Harvest", true);
        } else if (boostState.action === "boost") {
          if (!boostState.allowed) {
            updateStatus("Need more shards.");
            return { ok: false, done: false, kind: "boost" };
          }
          spendShards(boostState.cost);
          setReadyMap((prev) => ({ ...prev, [target.id]: true }));
          recordHistoryAction?.({
            type: infiniteResources ? "boostReadyAdmin" : "boostReady",
            shortId: def?.shortId ?? target.defId,
            x: target.x,
            y: target.y,
          });
          updateStatus(`Boosted ${getBuildingName(def, lang, "name")}`);
        } else {
          updateStatus("This building cannot be boosted.");
          return { ok: false, done: false, kind: "boost" };
        }
        requestAutoSnapshot();
        return { ok: true, done: true, kind: "boost" };
      }

      if (selectedDef) {
        // Admin/infinite mode bypasses population check
        if (!infiniteResources && !hasPopulationForDef(stats, selectedDef)) {
          updateStatus("Not enough free population.");
          return { ok: false, done: false, kind: "build" };
        }
        const adjustedX = Math.min(x, BOARD_WIDTH - selectedDef.width);
        const adjustedY = Math.min(y, BOARD_HEIGHT - selectedDef.height);
        if (
          !isAreaFree(
            layout,
            adjustedX,
            adjustedY,
            selectedDef.width,
            selectedDef.height,
            undefined,
            isCellUnlocked,
          )
        ) {
          updateStatus("Blocked or locked area.");
          return { ok: false, done: false, kind: "build" };
        }
        if (
          !infiniteResources &&
          !canAffordResources(effectiveResources, selectedDef.cost)
        ) {
          updateStatus("Not enough resources.");
          return { ok: false, done: false, kind: "build" };
        }
        branchFromPast();
        applySpend(selectedDef.cost);
        const instance = {
          id: nextIdRef.current++,
          defId: selectedDef.defId,
          x: adjustedX,
          y: adjustedY,
          width: selectedDef.width,
          height: selectedDef.height,
        };
        setLayout((prev) => [...prev, instance]);
        setReadyMap((prev) => ({ ...prev, [instance.id]: false }));
        setBuildLocks((prev) => ({
          ...prev,
          [instance.id]: isTierLocked(selectedDef.tier),
        }));
        if (autoSelectNew) {
          setSelectedIds((prev) => new Set([...(prev ?? []), instance.id]));
        }
        recordHistoryAction?.({
          type: infiniteResources ? "buildAdmin" : "build",
          shortId: selectedDef.shortId ?? selectedDef.defId,
          x: instance.x,
          y: instance.y,
        });
        const label = `Gekauft: ${getBuildingName(selectedDef, getCurrentLang(), "name")}`;
        updateStatus(label);
        if (isPast) {
          setTimeout(() => {
            overwriteCheckpointAtIndex(buildSnapshot());
          }, 0);
        }
        requestAutoSnapshot();
        return { ok: true, done: true, kind: "build" };
      }

      if (moveMode && target) {
        suppressNextCheckpoint();
        const snap = buildSnapshot();
        setMoveSnapshot(snap);
        setLayout((prev) => prev.filter((p) => p.id !== target.id));
        setCarried({
          instance: {
            ...target,
            ready: readyMap[target.id],
            locked: buildLocks[target.id],
          },
          def: libraryMap[target.defId],
        });
        if (isPast) {
          setTimeout(() => {
            overwriteCheckpointAtIndex(buildSnapshot());
          }, 0);
        }
        return { ok: true, done: false, kind: "pickup" };
      }

      if (
        !moveMode &&
        !sellMode &&
        !refundMode &&
        !selectedDef &&
        target &&
        readyMap[target.id] === true
      ) {
        recordHistoryAction?.({
          type: "harvest",
          defId: target.defId,
          x: target.x,
          y: target.y,
        });
        harvestBuildings([target], "Geerntet", true);
        requestAutoSnapshot();
        return { ok: true, done: true, kind: "harvest" };
      }

      if (!moveMode && target && libraryMap[target.defId]?.category === "military") {
        const def = libraryMap[target.defId];
        setUnitModal({ def });
        return { ok: true, done: true, kind: "inspect" };
      }

      if (!moveMode && target && libraryMap[target.defId]?.category === "goods") {
        const def = libraryMap[target.defId];
        setGoodsModal({ def });
        return { ok: true, done: true, kind: "inspect" };
      }

      return { ok: false, done: false, kind: "noop" };
    },
    [
      layout,
      carried,
      libraryMap,
      isCellUnlocked,
      setLayout,
      setCarried,
      setReadyMap,
      setBuildLocks,
      buildLocks,
      setMoveMode,
      updateStatus,
      requestAutoSnapshot,
      sellMode,
      refundMode,
      branchFromPast,
      readyMap,
      harvestBuildings,
      applyRefund,
      setMoveSnapshot,
      resources,
      config,
      setResources,
      boostMode,
      infiniteResources,
      selectedDef,
      stats,
      effectiveResources,
      applySpend,
      autoSelectNew,
      setSelectedIds,
      isPast,
      overwriteCheckpointAtIndex,
      buildSnapshot,
      moveMode,
      suppressNextCheckpoint,
      setGoodsModal,
      setUnitModal,
      nextIdRef,
      recordHistoryAction,
      recordMovePosition,
      finishMove,
    ],
  );

  return { handleCellClick, cancelMove, onCancelAction };
};
