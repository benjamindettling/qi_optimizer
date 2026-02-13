import { useEffect } from "react";

// Escape key cancels active move actions.
export const useMoveEscape = ({
  moveSnapshot,
  applySnapshot,
  setCarried,
  setMoveSnapshot,
  setMoveMode,
  clearMoveChain,
}) => {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && moveSnapshot) {
        applySnapshot(moveSnapshot);
        clearMoveChain?.();
        setCarried(null);
        setMoveSnapshot(null);
        setMoveMode(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    moveSnapshot,
    applySnapshot,
    setCarried,
    setMoveSnapshot,
    setMoveMode,
    clearMoveChain,
  ]);
};
