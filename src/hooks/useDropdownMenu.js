import { useEffect, useRef, useState } from "react";

/**
 * Manages open/close state for a dropdown and closes it on:
 * - click outside
 * - Escape key
 */
export function useDropdownMenu(initialOpen = false) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const ref = useRef(null);

  useEffect(() => {
    function onPointerDown(e) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target)) {
        setIsOpen(false);
      }
    }

    function onKeyDown(e) {
      if (e.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return { ref, isOpen, setIsOpen };
}
