import { useCallback } from "react";
import { GOODS_TYPES } from "../../config/boardConfig";
import { formatNumber } from "../../utils/formatNumber";

const RESOURCE_LABELS = {
  coins: "Muenzen",
  supplies: "Vorraete",
  chronos: "Chronos",
  shards: "Scherben",
  quantumActions: "QA",
};

const GOODS_LABELS = {
  Kupfer: "Kupfer",
  Honig: "Honig",
  Stein: "Stein",
  Seil: "Seil",
  Schiesspulver: "Schiesspulver",
};

// Admin-only edit flows for resources, goods, and units.
export const useAdminEditors = ({
  resources,
  setResources,
  editResourceModal,
  setEditResourceModal,
  editGoodModal,
  setEditGoodModal,
  editUnitModal,
  setEditUnitModal,
  infiniteResources,
  editingLocked,
  updateStatus,
  requestAutoSnapshot,
  branchFromPast,
  recordHistoryAction,
}) => {
  const handleEditResource = useCallback(
    (descriptor) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!infiniteResources) {
        updateStatus("Admin-Modus aktivieren, um Werte zu bearbeiten.");
        return;
      }
      if (!descriptor?.key) return;
      const current = resources?.[descriptor.key] ?? 0;
      setEditResourceModal({
        ...descriptor,
        value: current,
      });
    },
    [resources, editingLocked, infiniteResources, updateStatus, setEditResourceModal],
  );

  const handleEditGood = useCallback(
    (goodKey) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!infiniteResources) {
        updateStatus("Admin-Modus aktivieren, um Werte zu bearbeiten.");
        return;
      }
      if (!goodKey) return;
      const current = resources?.goods?.[goodKey] ?? 0;
      setEditGoodModal({ goodKey, value: current });
    },
    [resources, editingLocked, updateStatus, infiniteResources, setEditGoodModal],
  );

  const handleEditUnit = useCallback(
    (unitKey) => {
      if (editingLocked) {
        updateStatus("Bearbeitung gesperrt. Bearbeitung aktivieren.");
        return;
      }
      if (!infiniteResources) {
        updateStatus("Admin-Modus aktivieren, um Werte zu bearbeiten.");
        return;
      }
      if (!unitKey) return;
      const current = resources?.units?.[unitKey] ?? 0;
      setEditUnitModal({ unitKey, value: current });
    },
    [resources, editingLocked, infiniteResources, updateStatus, setEditUnitModal],
  );

  const applyGoodEdit = useCallback(
    (amount, applyAll = false) => {
      if (!editGoodModal?.goodKey && !applyAll) return;
      const nextVal = Math.floor(Number(amount) || 0);
      const prevVal = editGoodModal?.value ?? 0;
      const label = applyAll
        ? `Alle Gueter: ${formatNumber(nextVal)}`
        : `${
            GOODS_LABELS[editGoodModal?.goodKey] ?? editGoodModal?.goodKey
          }: ${formatNumber(prevVal)} -> ${formatNumber(nextVal)}`;
      setResources((prev) => {
        const goods = { ...(prev.goods ?? {}) };
        if (applyAll) {
          GOODS_TYPES.forEach((g) => {
            goods[g] = nextVal;
          });
        } else if (editGoodModal?.goodKey) {
          goods[editGoodModal.goodKey] = nextVal;
        }
        return { ...prev, goods };
      });
      if (recordHistoryAction) {
        if (applyAll) {
          const deltaByKey = GOODS_TYPES.reduce((acc, good) => {
            const prevGood = resources?.goods?.[good] ?? 0;
            const delta = nextVal - prevGood;
            if (delta) acc[good] = delta;
            return acc;
          }, {});
          if (Object.keys(deltaByKey).length) {
            recordHistoryAction({
              type: "adminAdjust",
              group: "goods",
              deltaByKey,
            });
          }
        } else if (editGoodModal?.goodKey) {
          const delta = nextVal - prevVal;
          if (delta) {
            recordHistoryAction({
              type: "adminAdjust",
              group: "goods",
              key: editGoodModal.goodKey,
              delta,
            });
          }
        }
      }
      updateStatus(label);
      setEditGoodModal(null);
      requestAutoSnapshot();
    },
    [
      editGoodModal,
      recordHistoryAction,
      resources,
      setResources,
      updateStatus,
      setEditGoodModal,
      requestAutoSnapshot,
    ],
  );

  const cancelEditGood = useCallback(() => {
    setEditGoodModal(null);
  }, [setEditGoodModal]);

  const applyResourceEdit = useCallback(
    (amount) => {
      if (!editResourceModal?.key) return;
      const nextVal = Math.floor(Number(amount) || 0);
      const prevVal = resources?.[editResourceModal.key] ?? 0;
      branchFromPast();
      const resLabel =
        RESOURCE_LABELS[editResourceModal.key] || editResourceModal.key;
      const label = `${resLabel}: ${formatNumber(prevVal)} -> ${formatNumber(
        nextVal,
      )}`;
      setResources((prev) => ({ ...prev, [editResourceModal.key]: nextVal }));
      if (recordHistoryAction) {
        const delta = nextVal - prevVal;
        if (delta) {
          recordHistoryAction({
            type: "adminAdjust",
            group: "resources",
            key: editResourceModal.key,
            delta,
          });
        }
      }
      updateStatus(label);
      setEditResourceModal(null);
      requestAutoSnapshot();
    },
    [
      branchFromPast,
      editResourceModal,
      recordHistoryAction,
      resources,
      setResources,
      updateStatus,
      requestAutoSnapshot,
      setEditResourceModal,
    ],
  );

  const cancelEditResource = useCallback(() => {
    setEditResourceModal(null);
  }, [setEditResourceModal]);

  const applyUnitEdit = useCallback(
    (amount) => {
      if (!editUnitModal?.unitKey) return;
      const nextVal = Math.floor(Number(amount) || 0);
      const prevVal = resources?.units?.[editUnitModal.unitKey] ?? 0;

      const label = `${editUnitModal.unitKey}: ${formatNumber(
        prevVal,
      )} -> ${formatNumber(nextVal)}`;

      setResources((prev) => ({
        ...prev,
        units: {
          ...(prev.units ?? {}),
          [editUnitModal.unitKey]: nextVal,
        },
      }));
      if (recordHistoryAction) {
        const delta = nextVal - prevVal;
        if (delta) {
          recordHistoryAction({
            type: "adminAdjust",
            group: "units",
            key: editUnitModal.unitKey,
            delta,
          });
        }
      }
      updateStatus(label);
      setEditUnitModal(null);
      requestAutoSnapshot();
    },
    [
      editUnitModal,
      recordHistoryAction,
      resources,
      setResources,
      updateStatus,
      requestAutoSnapshot,
      setEditUnitModal,
    ],
  );

  const cancelEditUnit = useCallback(() => {
    setEditUnitModal(null);
  }, [setEditUnitModal]);

  return {
    handleEditResource,
    handleEditGood,
    handleEditUnit,
    applyGoodEdit,
    cancelEditGood,
    applyResourceEdit,
    cancelEditResource,
    applyUnitEdit,
    cancelEditUnit,
  };
};
