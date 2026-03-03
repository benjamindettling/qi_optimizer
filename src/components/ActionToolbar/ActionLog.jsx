// Auto-generated action log between checkpoints.
import { useMemo } from "react";
import { useLang } from "../../context/LanguageContext";
import { buildActionLogEntries } from "../../utils/actionLogEntries";
import "./ActionLog.css";

export function ActionLog({
  historyTree,
  selectedNodeId,
  libraryMap,
  shortIdMap,
}) {
  const { lang } = useLang();

  const entries = useMemo(
    () =>
      buildActionLogEntries({
        historyTree,
        selectedNodeId,
        libraryMap,
        shortIdMap,
        lang,
      }),
    [historyTree, selectedNodeId, libraryMap, shortIdMap, lang],
  );

  return (
    <div className="action-log-card">
      <label className="action-log-label">Log</label>
      <div className="action-log-list">
        {entries.length === 0 ? (
          <div className="action-log-empty">Keine Aktionen</div>
        ) : (
          entries.map((entry, idx) => (
            <div
              key={`${entry.nodeId}-${idx}`}
              className={`action-log-entry color-${entry.color}${entry.isHighlighted ? " highlighted" : ""}${entry.isSubEntry ? " sub-entry" : ""}`}
            >
              {entry.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
