import { formatNumber } from "../../utils/formatNumber";

export function SmartInvestModal({
  smartInvestModal,
  onClose,
  onApplyResult,
  onContinue,
}) {
  if (!smartInvestModal) return null;

  if (smartInvestModal.phase === "running") {
    return (
      <div className="modal">
        <div className="modal-card smart-invest-modal">
          <h3>Schlauer Invest</h3>
          <div className="smart-invest-progress">
            Teste Kirchen: {smartInvestModal.churchCount ?? 0}
            <span className="smart-invest-inline">
              Gutshaus: {smartInvestModal.gutCount ?? 0}
            </span>
          </div>
        </div>
      </div>
    );
  }

  if (smartInvestModal.phase === "step") {
    const last = smartInvestModal.lastResult;
    const best = smartInvestModal.bestResult;
    return (
      <div className="modal">
        <div className="modal-card smart-invest-modal">
          <h3>Schlauer Invest</h3>
          <div className="smart-invest-progress">
            Teste Kirchen: {smartInvestModal.churchCount ?? 0}
            <span className="smart-invest-inline">
              Gutshaus: {smartInvestModal.gutCount ?? 0}
            </span>
          </div>
          <div className="smart-invest-section">
            <div className="smart-invest-section-title">Letztes Ergebnis</div>
            {last ? (
              <>
                <div className="smart-invest-line">
                  {formatNumber(last.resources?.coins ?? 0)} Münzen,{" "}
                  {formatNumber(last.resources?.supplies ?? 0)} Vorräte,{" "}
                  {formatNumber(last.resources?.chronos ?? 0)} Chronos
                </div>
                <div className="smart-invest-line">
                  Kirche: {last.counts?.church ?? 0} | Gutshaus:{" "}
                  {last.counts?.gut ?? 0} | Mehrgeschossiges Haus:{" "}
                  {last.counts?.mehr ?? 0}
                </div>
              </>
            ) : (
              <div className="smart-invest-empty">Kein Ergebnis</div>
            )}
          </div>
          <div className="smart-invest-section">
            <div className="smart-invest-section-title">Highscore</div>
            {best ? (
              <>
                <div className="smart-invest-line">
                  {formatNumber(best.resources?.coins ?? 0)} Münzen,{" "}
                  {formatNumber(best.resources?.supplies ?? 0)} Vorräte,{" "}
                  {formatNumber(best.resources?.chronos ?? 0)} Chronos
                </div>
                <div className="smart-invest-line">
                  Kirche: {best.counts?.church ?? 0} | Gutshaus:{" "}
                  {best.counts?.gut ?? 0} | Mehrgeschossiges Haus:{" "}
                  {best.counts?.mehr ?? 0}
                </div>
              </>
            ) : (
              <div className="smart-invest-empty">Kein Highscore</div>
            )}
          </div>
          <div className="modal-actions">
            <button onClick={onContinue}>Weiter</button>
          </div>
        </div>
      </div>
    );
  }

  const results = smartInvestModal.results || [];
  const error = smartInvestModal.error || null;

  return (
    <div className="modal">
      <div className="modal-card smart-invest-modal">
        <div className="help-header">
          <h3>Schlauer Invest</h3>
          <button onClick={onClose}>Schliessen</button>
        </div>
        {error && <div className="smart-invest-error">{error}</div>}
        {results.length === 0 ? (
          <div className="smart-invest-empty">Keine Ergebnisse</div>
        ) : (
          <div className="smart-invest-results">
            {results.map((result, idx) => (
              <button
                key={result.id ?? idx}
                type="button"
                className="smart-invest-result"
                onClick={() => onApplyResult?.(result)}
              >
                <div className="smart-invest-rank">#{idx + 1}</div>
                <div className="smart-invest-line">
                  {formatNumber(result.resources?.coins ?? 0)} Münzen,{" "}
                  {formatNumber(result.resources?.supplies ?? 0)} Vorräte,{" "}
                  {formatNumber(result.resources?.chronos ?? 0)} Chronos
                </div>
                <div className="smart-invest-line">
                  Kirche: {result.counts?.church ?? 0} | Gutshaus:{" "}
                  {result.counts?.gut ?? 0} | Mehrgeschossiges Haus:{" "}
                  {result.counts?.mehr ?? 0}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
