import { useEffect } from "react";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { formatNumber } from "../../utils/formatNumber";

const formatTemplate = (template, values = {}) =>
  Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );

const SetupCard = ({ title, setup, t }) => {
  const buildings = setup?.buildings || [];
  return (
    <div className="supply-optimizer-card">
      <div className="supply-optimizer-card-title">{title}</div>
      {setup ? (
        <div className="supply-optimizer-score">
          {t("supplyOptimizerScoreLabel")}: {formatNumber(setup.supplyHarvest ?? 0)}
        </div>
      ) : (
        <div className="supply-optimizer-empty">{t("supplyOptimizerNoResult")}</div>
      )}
      {buildings.length > 0 ? (
        <ul className="supply-optimizer-list">
          {buildings.map((entry) => (
            <li key={entry.defId} className="supply-optimizer-item">
              {entry.name} x{entry.count}
            </li>
          ))}
        </ul>
      ) : (
        <div className="supply-optimizer-empty">{t("supplyOptimizerNoBuildings")}</div>
      )}
    </div>
  );
};

export function SupplyOptimizerModal({
  open,
  onClose,
  optimizerState,
  onStepOnce,
  onStepFew,
  onFinish,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose?.();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [open, onClose]);

  if (!open) return null;

  const phase = optimizerState?.phase ?? "idle";
  const isRunning = phase === "running";
  const isDone = phase === "done";
  const evalCount = optimizerState?.evalCount ?? 0;
  const currentSetup = optimizerState?.currentSetup;
  const bestSetup = optimizerState?.bestSetup;

  return (
    <div className="modal">
      <div className="modal-card supply-optimizer-modal">
        <div className="help-header">
          <h3>{t("supplyOptimizerModalTitle")}</h3>
          <button onClick={onClose}>{t("supplyOptimizerClose")}</button>
        </div>

        {isRunning ? (
          <div className="supply-optimizer-running">
            <div>{t("supplyOptimizerRunning")}</div>
            <div className="supply-optimizer-live">
              {formatTemplate(t("supplyOptimizerEvalCount"), { count: evalCount })}
            </div>
          </div>
        ) : (
          <>
            {!isDone && (
              <div className="modal-actions supply-optimizer-actions">
                <button onClick={onStepOnce}>{t("supplyOptimizerOneStep")}</button>
                <button onClick={onStepFew}>{t("supplyOptimizerFewSteps")}</button>
                <button onClick={onFinish}>{t("supplyOptimizerFinish")}</button>
              </div>
            )}
            {evalCount > 0 && (
              <div className="supply-optimizer-live">
                {formatTemplate(t("supplyOptimizerEvalCount"), { count: evalCount })}
              </div>
            )}
            {isDone && (
              <div className="supply-optimizer-done">
                {t("supplyOptimizerSearchComplete")}
              </div>
            )}
          </>
        )}

        <div className="supply-optimizer-grid">
          <SetupCard
            title={t("supplyOptimizerCurrentSetup")}
            setup={currentSetup}
            t={t}
          />
          <SetupCard title={t("supplyOptimizerBestSetup")} setup={bestSetup} t={t} />
        </div>

        {isDone && (
          <div className="modal-actions">
            <button onClick={onClose}>{t("supplyOptimizerClose")}</button>
          </div>
        )}
      </div>
    </div>
  );
}
