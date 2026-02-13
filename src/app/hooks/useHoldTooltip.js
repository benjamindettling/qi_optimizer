// Handles long-press tooltips for button titles.
import { useEffect, useRef, useState } from "react";

export function useHoldTooltip({ delayMs = 700 } = {}) {
  const [tooltip, setTooltip] = useState(null);
  const holdTimerRef = useRef(null);
  const suppressClickRef = useRef(false);
  const holdTriggeredRef = useRef(false);

  useEffect(() => {
    const clearTimer = () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };

    const onPointerDown = (e) => {
      const btn = e.target.closest("button");
      if (!btn) return;
      const title = btn.getAttribute("title");
      if (!title) return;
      clearTimer();
      holdTriggeredRef.current = false;
      const { clientX, clientY } = e;
      holdTimerRef.current = setTimeout(() => {
        holdTriggeredRef.current = true;
        suppressClickRef.current = true;
        setTooltip({ text: title, x: clientX, y: clientY });
      }, delayMs);
    };

    const onPointerUp = () => {
      clearTimer();
    };

    const onClickCapture = (e) => {
      if (suppressClickRef.current) {
        e.preventDefault();
        e.stopPropagation();
        suppressClickRef.current = false;
        return;
      }
      if (holdTriggeredRef.current) {
        holdTriggeredRef.current = false;
      }
      if (tooltip) {
        setTooltip(null);
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);
    document.addEventListener("click", onClickCapture, true);

    return () => {
      clearTimer();
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [tooltip, delayMs]);

  return { tooltip };
}
