// Standalone history panel that lists delta steps and exports history.
import "./HistoryPanel.css";

const buildTooltip = (entry, step) => {
  if (!entry) return "Startposition";
  const body = JSON.stringify(entry, null, 2) || "";
  return `Schritt ${step}\n${body}`;
};

export function HistoryPanel({
  historyIndex = 0,
  historyEntries = [],
  historyInvalidSteps = [],
  historyChecking = false,
  onJumpHistory,
}) {
  const invalidSet = new Set(historyInvalidSteps);
  const steps = Array.from(
    { length: historyEntries.length + 1 },
    (_, idx) => idx,
  );

  const handleDownload = () => {
    const payload = {
      version: 1,
      cursor: historyIndex,
      actions: historyEntries,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "qi_history.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="history-panel">
      <div className={`history-title ${historyChecking ? "checking" : ""}`}>
        Historie
      </div>
      <div className="history-steps">
        {steps.map((step) => {
          const entry = step === 0 ? null : historyEntries[step - 1];
          const isInvalid = invalidSet.has(step);
          return (
            <button
              key={step}
              className={`history-step ${step === historyIndex ? "active" : ""} ${
                isInvalid ? "invalid" : ""
              }`}
              onClick={() => onJumpHistory?.(step)}
              disabled={step === historyIndex}
              title={buildTooltip(entry, step)}
            >
              {step}
            </button>
          );
        })}
      </div>
      <button className="history-download" onClick={handleDownload}>
        Download Historie
      </button>
    </aside>
  );
}
