import { useEffect, useRef } from "react";
import { useTutorial } from "../context/TutorialContext";

export function useTutorialActionWatcher({ historyIndex, historyNodes }) {
  const { isTutorialActive, fireEvent } = useTutorial();
  const prevHistoryIndexRef = useRef(historyIndex);

  useEffect(() => {
    if (!isTutorialActive) return;
    if (historyIndex === prevHistoryIndexRef.current) return;
    prevHistoryIndexRef.current = historyIndex;

    const nodes =
      typeof historyNodes === "function" ? historyNodes() : (historyNodes ?? []);
    const currentNode = nodes.find((node) => node.id === historyIndex);
    if (!currentNode?.action?.type) return;

    fireEvent(currentNode.action.type, currentNode.action);
  }, [historyIndex, isTutorialActive, fireEvent, historyNodes]);
}
