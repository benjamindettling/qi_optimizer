import { useCallback, useEffect, useRef, useState } from "react";

// Centralized checkpoint/time-travel management.
export const useCheckpoints = ({
  buildSnapshot,
  applySnapshot,
  timeStep,
  setTimeStep,
}) => {
  const [checkpoints, setCheckpoints] = useState([]);
  const [checkpointIndex, setCheckpointIndex] = useState(null);
  const [editUnlocked, setEditUnlocked] = useState(false);
  const skipCheckpointUpdateRef = useRef(0);
  const trackingPausedRef = useRef(false);

  const stableStringify = useCallback((val) => {
    if (val === null || typeof val !== "object") {
      return JSON.stringify(val);
    }
    if (Array.isArray(val)) {
      return `[${val.map((v) => stableStringify(v)).join(",")}]`;
    }
    const keys = Object.keys(val).sort();
    const entries = keys.map((k) => `"${k}":${stableStringify(val[k])}`);
    return `{${entries.join(",")}}`;
  }, []);

  const makeSignature = useCallback(
    (snapshot) => stableStringify(snapshot),
    [stableStringify]
  );

  const makeUid = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const normalizeCheckpoints = useCallback(
    (list) =>
      (list || []).map((cp) => ({
        ...cp,
        timeStep: cp.timeStep ?? 1,
        allowDuplicate: !!cp.allowDuplicate,
        uid: cp.uid || makeUid(),
        signature: cp.signature || makeSignature(cp.snapshot),
      })),
    [makeSignature]
  );

  const makeCheckpoint = useCallback(
    (snapshot, tStep, allowDuplicate = false) => ({
      snapshot,
      timeStep: tStep,
      allowDuplicate,
      uid: makeUid(),
      signature: makeSignature(snapshot),
    }),
    [makeSignature]
  );

  const totalSteps = checkpoints.length;
  const latestIndex = totalSteps > 0 ? totalSteps - 1 : 0;
  const effectiveIndex =
    checkpointIndex !== null
      ? Math.min(checkpointIndex, latestIndex)
      : latestIndex;
  const currentIndex = totalSteps === 0 ? 0 : effectiveIndex;
  const isPast =
    checkpointIndex !== null && totalSteps > 0 && effectiveIndex < latestIndex;
  const editingLocked = isPast && !editUnlocked;

  useEffect(() => {
    if (checkpointIndex !== null && checkpointIndex >= checkpoints.length) {
      setCheckpointIndex(checkpoints.length ? checkpoints.length - 1 : null);
      setEditUnlocked(false);
    }
  }, [checkpointIndex, checkpoints.length]);

  // Ensure all checkpoints carry a signature for dedupe.
  useEffect(() => {
    setCheckpoints((prev) => normalizeCheckpoints(prev));
  }, [normalizeCheckpoints]);

  // Auto-track current state as latest checkpoint (deduped).
  useEffect(() => {
    if (skipCheckpointUpdateRef.current > 0) {
      skipCheckpointUpdateRef.current -= 1;
      return;
    }
    if (trackingPausedRef.current) return;
    if (isPast) return;
    const snapshot = buildSnapshot();
    const entry = makeCheckpoint(snapshot, timeStep ?? 1, false);
    setCheckpoints((prev) => {
      const base =
        checkpointIndex !== null ? prev.slice(0, currentIndex + 1) : prev;
      const last = base[base.length - 1];
      const lastSig =
        last?.signature || (last?.snapshot ? makeSignature(last.snapshot) : "");
      const sameStep = last && last.timeStep === entry.timeStep;
      const sameSig = lastSig && lastSig === entry.signature;
      if (sameStep && sameSig) {
        return base === prev ? prev : base;
      }
      if (sameStep && last?.allowDuplicate) {
        const trimmed = base.slice(0, -1);
        return [
          ...trimmed,
          {
            ...entry,
            allowDuplicate: true,
          },
        ];
      }
      if (sameStep && !last?.allowDuplicate) {
        const trimmed = base.slice(0, -1);
        return [...trimmed, entry];
      }
      return [...base, entry];
    });
  }, [
    buildSnapshot,
    makeCheckpoint,
    timeStep,
    isPast,
    checkpointIndex,
    currentIndex,
    makeSignature,
  ]);

  const trimFutureCheckpoints = useCallback(() => {
    setCheckpoints((prev) =>
      checkpointIndex !== null ? prev.slice(0, currentIndex + 1) : prev
    );
  }, [checkpointIndex, currentIndex]);

  const enableEditFromPast = useCallback(() => {
    if (!isPast) return;
    setCheckpoints((prev) => prev.slice(0, currentIndex + 1));
    setCheckpointIndex(null);
    setEditUnlocked(true);
  }, [currentIndex, isPast]);

  const branchFromPast = useCallback(() => {
    if (!isPast) return;
    setCheckpoints((prev) => prev.slice(0, currentIndex + 1));
    setCheckpointIndex(null);
    setEditUnlocked(true);
  }, [isPast, currentIndex]);

  const suppressNextCheckpoint = useCallback((count = 1) => {
    skipCheckpointUpdateRef.current = Math.max(
      skipCheckpointUpdateRef.current,
      count
    );
  }, []);

  const pauseCheckpointTracking = useCallback(() => {
    trackingPausedRef.current = true;
  }, []);

  const resumeCheckpointTracking = useCallback(() => {
    trackingPausedRef.current = false;
  }, []);

  const canTimeBack = totalSteps > 0 && currentIndex > 0;
  const canTimeForward = totalSteps > 0 && currentIndex < totalSteps - 1;

  const getPartInfo = useCallback(
    (targetIdx) => {
      const target =
        checkpoints[targetIdx] || checkpoints[checkpoints.length - 1];
      if (!target) return { part: null, total: 0 };
      let total = 0;
      let part = 0;
      checkpoints.forEach((cp, idx) => {
        if (cp.timeStep === target.timeStep) {
          total += 1;
          if (idx <= targetIdx) part += 1;
        }
      });
      return { part, total };
    },
    [checkpoints]
  );

  const jumpBackTime = useCallback(() => {
    if (!canTimeBack) return;
    const target = checkpoints[currentIndex - 1];
    if (!target) return;
    applySnapshot(target.snapshot);
    setCheckpointIndex(currentIndex - 1);
    setEditUnlocked(false);
    if (target.timeStep !== undefined) setTimeStep(target.timeStep);
  }, [canTimeBack, checkpoints, currentIndex, applySnapshot, setTimeStep]);

  const jumpForwardTime = useCallback(() => {
    if (!canTimeForward) return;
    const targetIdx = currentIndex + 1;
    if (targetIdx >= checkpoints.length) return;
    if (targetIdx === checkpoints.length - 1) {
      const latest = checkpoints[checkpoints.length - 1];
      if (latest?.snapshot) {
        applySnapshot(latest.snapshot);
        if (latest.timeStep !== undefined) setTimeStep(latest.timeStep);
      }
      setCheckpointIndex(null);
      setEditUnlocked(false);
      return;
    }
    const target = checkpoints[targetIdx];
    if (!target) return;
    applySnapshot(target.snapshot);
    setCheckpointIndex(targetIdx);
    setEditUnlocked(false);
    if (target.timeStep !== undefined) setTimeStep(target.timeStep);
  }, [canTimeForward, currentIndex, checkpoints, applySnapshot, setTimeStep]);

  const addCheckpointPart = useCallback(() => {
    const snapshot = buildSnapshot();
    const entry = makeCheckpoint(snapshot, timeStep ?? 1, true);
    skipCheckpointUpdateRef.current = 1;
    setCheckpoints((prev) => {
      const base =
        checkpointIndex !== null ? prev.slice(0, currentIndex + 1) : prev;
      return [...base, entry];
    });
    setCheckpointIndex(null);
    setEditUnlocked(false);
  }, [
    buildSnapshot,
    timeStep,
    makeCheckpoint,
    checkpointIndex,
    currentIndex,
  ]);

  const applyLoadedCheckpoints = useCallback(
    (list, fallbackStep = 1, fallbackSnapshotStep) => {
      const normalized = normalizeCheckpoints(list);
      skipCheckpointUpdateRef.current = 1;
      setCheckpoints(normalized);
      setCheckpointIndex(null);
      setEditUnlocked(false);
      const lastStep =
        normalized[normalized.length - 1]?.timeStep ??
        fallbackSnapshotStep ??
        fallbackStep ??
        1;
      setTimeStep(lastStep);
    },
    [normalizeCheckpoints, setTimeStep]
  );

  const makeCheckpointsForSave = useCallback(
    (snapshot, tStep) => {
      const stepVal = tStep ?? timeStep ?? 1;
      const base = checkpoints.length
        ? normalizeCheckpoints(checkpoints)
        : [];
      const finalCp = makeCheckpoint(snapshot, stepVal, true);
      const last = base[base.length - 1];
      const lastSig =
        last?.signature ||
        (last?.snapshot ? makeSignature(last.snapshot) : "");
      const sameStep = last && last.timeStep === finalCp.timeStep;
      const sameSig = lastSig && lastSig === finalCp.signature;
      if (sameStep && sameSig) return base;
      return [...base, finalCp];
    },
    [
      checkpoints,
      makeCheckpoint,
      normalizeCheckpoints,
      timeStep,
      makeSignature,
    ]
  );

  const overwriteCheckpointAtIndex = useCallback(
    (snapshot, targetIdx = currentIndex) => {
      setCheckpoints((prev) => {
        if (!prev.length) return prev;
        const idx = Math.min(Math.max(targetIdx, 0), prev.length - 1);
        const existing = prev[idx];
        const next = {
          ...existing,
          snapshot,
          timeStep: existing?.timeStep ?? timeStep ?? 1,
          signature: makeSignature(snapshot),
        };
        const clone = [...prev];
        clone[idx] = next;
        return clone;
      });
    },
    [currentIndex, makeSignature, timeStep]
  );

  return {
    checkpoints,
    checkpointIndex,
    setCheckpointIndex,
    currentIndex,
    editUnlocked,
    setEditUnlocked,
    isPast,
    editingLocked,
    canTimeBack,
    canTimeForward,
    jumpBackTime,
    jumpForwardTime,
    enableEditFromPast,
    branchFromPast,
    trimFutureCheckpoints,
    applyLoadedCheckpoints,
    makeCheckpointsForSave,
    overwriteCheckpointAtIndex,
    addCheckpointPart,
    currentPart: getPartInfo(currentIndex).part,
    currentPartTotal: getPartInfo(currentIndex).total,
    suppressNextCheckpoint,
    pauseCheckpointTracking,
    resumeCheckpointTracking,
  };
};
