import { useEffect, useState } from "react";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { formatNumber } from "../../utils/formatNumber";

const formatTemplate = (template, values = {}) =>
  Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );

const fmtRes = (r) =>
  `${formatNumber(r?.coins ?? 0)}c ${formatNumber(r?.supplies ?? 0)}s ${formatNumber(r?.chronos ?? 0)}ch`;

const DebugEventLine = ({ event }) => {
  if (event.type === "evaluation") {
    const line = `[Eval] Alch:${event.alchemists} Brew:${event.breweries}  |  Res: ${fmtRes(event.resources)}  |  Supply_Harvest: ${formatNumber(event.supplyHarvest)}`;
    return (
      <div className={`optimizer-debug-event${event.isBest ? " is-best" : ""}`}>
        {line}
        {event.isBest ? "  ★" : ""}
      </div>
    );
  }
  if (event.type === "supply_building") {
    const parts = [];
    if (event.coinBase > 0)
      parts.push(
        `coins: ${formatNumber(event.coinBase)} × ${Number(event.coinMult ?? 0).toFixed(2)} = ${formatNumber(event.coinResult)}`,
      );
    if (event.supplyBase > 0)
      parts.push(
        `supplies: ${formatNumber(event.supplyBase)} × ${Number(event.supplyMult ?? 0).toFixed(2)} = ${formatNumber(event.supplyResult)}`,
      );
    if (event.chronosBase > 0)
      parts.push(
        `chronos: ${event.chronosBase} × ${Number(event.chronosMult ?? 0).toFixed(2)} = ${event.chronosResult}`,
      );
    const line = `  [${event.name}] ${parts.join("  |  ")}`;
    return <div className="optimizer-debug-event">{line}</div>;
  }
  if (event.type === "supply_harvest_totals") {
    const hasCoinInfo =
      Number(event.totalCoins ?? 0) !== 0 || event.coinMult !== undefined;
    const hasChronosInfo =
      Number(event.totalChronos ?? 0) !== 0 || event.chronosMult !== undefined;
    const line =
      `  [Totals] coins: ${formatNumber(event.totalCoins ?? 0)}${
        hasCoinInfo
          ? ` (×${Number(event.coinMult ?? 0).toFixed(2)}, coinBoost=${Number(event.globalCoinBoost ?? 0).toFixed(2)})`
          : ""
      }` +
      `  |  chronos: ${event.totalChronos ?? 0}${
        hasChronosInfo ? ` (×${Number(event.chronosMult ?? 0).toFixed(2)})` : ""
      }` +
      `  |  supplies: ${formatNumber(event.supplyHarvest)} (×${event.supplyMult.toFixed(2)})`;
    return <div className="optimizer-debug-event is-best">{line}</div>;
  }
  if (event.type === "geometry_result") {
    const line = `[Geom] ${event.churchCount} churches  →  max ${event.maxMH} MH`;
    return <div className="optimizer-debug-event">{line}</div>;
  }
  if (event.type === "harvest_eval") {
    const line =
      `[Harvest] MH=${event.start_MH} EH=${event.start_EH} C=${event.numb_churches}` +
      `  |  Loop: ${formatNumber(event.loopCoins)}c` +
      `  Working: ${formatNumber(event.workingCoins)}c` +
      `  Prod: ${formatNumber(event.moneyFromProduction)}c` +
      `  Adj: ${formatNumber(event.buildingDiff)}c` +
      `  →  Total: ${formatNumber(event.totalCoins)}c` +
      `  |  Money: ${formatNumber(event.moneyHarvest)}` +
      `  Chronos: ${formatNumber(event.chronosHarvest ?? 0)}`;
    return (
      <div className={`optimizer-debug-event${event.isBest ? " is-best" : ""}`}>
        {line}
        {event.isBest ? "  ★" : ""}
      </div>
    );
  }
  if (event.type === "harvest_step") {
    if (event.action === "initial_purchase") {
      const line =
        `  [Buy] MH diff=${event.mhDiff} (prior=${event.priorMH}) EH diff=${event.ehDiff} (prior=${event.priorEH})` +
        `  |  mhCost=${formatNumber(event.mhCost)} ehCost=${formatNumber(event.ehCost)}` +
        `  |  ${formatNumber(event.coinsBefore)}c → ${formatNumber(event.coinsAfter)}c`;
      return <div className="optimizer-debug-event type-add">{line}</div>;
    }
    if (event.action === "buy_church" || event.action === "safety_church") {
      const tag = event.action === "safety_church" ? "Safety Church" : "Church";
      const line =
        `  [+${tag}] -${formatNumber(event.cost)}c` +
        `  |  ${formatNumber(event.coinsBefore)}c → ${formatNumber(event.coinsAfter)}c` +
        `  |  MH=${event.numb_MH} EH=${event.numb_EH} C=${event.numb_churches}` +
        `  |  Hap: ${event.happinessPercent}% (×${event.happinessMult})`;
      return <div className="optimizer-debug-event">{line}</div>;
    }
    if (event.action === "harvest_MH" || event.action === "harvest_EH") {
      const label = event.action === "harvest_MH" ? "MH" : "EH";
      const line =
        `  [-${label}] prod=${formatNumber(event.production)}c sell=${formatNumber(event.sellRefund)}c` +
        `  |  ${formatNumber(event.coinsBefore)}c → ${formatNumber(event.coinsAfter)}c` +
        `  |  MH=${event.numb_MH} EH=${event.numb_EH} C=${event.numb_churches}` +
        `  |  Hap: ${event.happinessPercent}% (×${event.happinessMult}) ehBonus=${event.ehBonus}`;
      return <div className="optimizer-debug-event type-remove">{line}</div>;
    }
  }
  return null;
};

const DebugSection = ({ title, events, t }) => {
  const list = events || [];
  return (
    <div className="optimizer-debug-section">
      <h4>
        {title} ({list.length})
      </h4>
      {list.length === 0 ? (
        <div className="optimizer-debug-event">{t("debugNoEvents")}</div>
      ) : (
        list.map((ev, i) => <DebugEventLine key={i} event={ev} />)
      )}
    </div>
  );
};

const MoneySetupCard = ({ setup, t }) => (
  <div className="optimizer-card">
    <div className="optimizer-card-title">{t("moneyOptimizerTitle")}</div>
    {setup ? (
      <div className="optimizer-card-lines">
        <div>
          {t("moneyOptimizerScoreLabel")}:{" "}
          {formatNumber(setup.moneyHarvest ?? 0)}
        </div>
        <div>
          {t("moneyChronosHarvestLabel")}:{" "}
          {formatNumber(setup.chronosHarvest ?? 0)}
        </div>
        <div>
          {t("moneyOptimizerStartMH")}: {setup.start_MH ?? 0}
        </div>
        <div>
          {t("moneyOptimizerStartEH")}: {setup.start_EH ?? 0}
        </div>
        <div>
          {t("moneyOptimizerChurches")}: {setup.numb_churches ?? 0}
        </div>
      </div>
    ) : (
      <div className="optimizer-empty">{t("supplyOptimizerNoResult")}</div>
    )}
  </div>
);

const SupplySetupCard = ({ setup, t }) => {
  const buildings = setup?.buildings || [];
  return (
    <div className="optimizer-card">
      <div className="optimizer-card-title">
        {t("supplyOptimizerModalTitle")}
      </div>
      {setup ? (
        <div className="optimizer-card-lines">
          <div>
            {t("supplyOptimizerScoreLabel")}:{" "}
            {formatNumber(setup.supplyHarvest ?? 0)}
          </div>
          <div>
            {t("supplyChronosHarvestLabel")}:{" "}
            {formatNumber(setup.chronosHarvest ?? 0)}
          </div>
        </div>
      ) : (
        <div className="optimizer-empty">{t("supplyOptimizerNoResult")}</div>
      )}
      {buildings.length > 0 ? (
        <ul className="optimizer-list">
          {buildings.map((entry) => (
            <li key={entry.defId} className="optimizer-item">
              {entry.name} x{entry.count}
            </li>
          ))}
        </ul>
      ) : (
        <div className="optimizer-empty">{t("supplyOptimizerNoBuildings")}</div>
      )}
    </div>
  );
};

export function OptimizerModal({
  open,
  onClose,
  supplyOptimizerState,
  frozenSupplyBestSetup,
  moneyOptimizerState,
  onStepOnce,
  onStepFew,
  onFinish,
  finishLabelKey,
  onNew,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const [debugMode, setDebugMode] = useState(false);

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

  const supplyPhase = supplyOptimizerState?.phase ?? "idle";
  const moneyPhase = moneyOptimizerState?.phase ?? "idle";
  const supplyDone = supplyPhase === "done";
  const activeRunning = supplyDone
    ? moneyPhase === "running"
    : supplyPhase === "running";
  const isDone = supplyDone && moneyPhase === "done";
  const finishKey = finishLabelKey || "supplyOptimizerFinish";
  const geomEvalCount = moneyOptimizerState?.geomEvalCount ?? 0;
  const harvestEvalCount = moneyOptimizerState?.harvestEvalCount ?? 0;

  let statusLine = "";
  if (activeRunning) {
    if (!supplyDone) {
      const evalCount = supplyOptimizerState?.evalCount ?? 0;
      const evalText =
        evalCount > 0
          ? ` | ${formatTemplate(t("supplyOptimizerEvalCount"), { count: evalCount })}`
          : "";
      statusLine = `${t("supplyOptimizerRunning")}${evalText}`;
    } else {
      statusLine = `${t("supplyOptimizerRunning")} ${formatTemplate(
        t("moneyOptimizerGeomCount"),
        { count: geomEvalCount },
      )} | ${formatTemplate(t("moneyOptimizerHarvestCount"), {
        count: harvestEvalCount,
      })}`;
    }
  } else if (!supplyDone) {
    const evalCount = supplyOptimizerState?.evalCount ?? 0;
    if (evalCount > 0) {
      statusLine = formatTemplate(t("supplyOptimizerEvalCount"), {
        count: evalCount,
      });
    }
  } else if (moneyPhase === "idle") {
    statusLine = t("supplyOptimizerSearchComplete");
  } else if (moneyOptimizerState?.subPhase === "geometry") {
    statusLine = formatTemplate(t("moneyOptimizerGeomCount"), {
      count: geomEvalCount,
    });
  } else {
    statusLine = `${formatTemplate(t("moneyOptimizerGeomCount"), {
      count: geomEvalCount,
    })} | ${formatTemplate(t("moneyOptimizerHarvestCount"), {
      count: harvestEvalCount,
    })}`;
  }

  return (
    <div className="modal">
      <div className="modal-card optimizer-modal">
        <div className="help-header">
          <h3>{t("optimizerModalTitle")}</h3>
          <label className="optimizer-debug-toggle">
            <input
              type="checkbox"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
            />
            {t("debugMode")}
          </label>
          <button onClick={onClose}>{t("supplyOptimizerClose")}</button>
        </div>

        {!activeRunning && (
          <div className="modal-actions optimizer-actions">
            <button onClick={onStepOnce} disabled={isDone}>
              {t("supplyOptimizerOneStep")}
            </button>
            <button onClick={onStepFew} disabled={isDone}>
              {t("supplyOptimizerFewSteps")}
            </button>
            <button onClick={onFinish} disabled={isDone}>
              {t(finishKey)}
            </button>
            <button onClick={onNew}>{t("optimizerNew")}</button>
          </div>
        )}

        {statusLine && <div className="optimizer-status">{statusLine}</div>}
        {isDone && (
          <div className="optimizer-status optimizer-status-done">
            {t("supplyOptimizerSearchComplete")}
          </div>
        )}

        <div className="optimizer-grid">
          <MoneySetupCard setup={moneyOptimizerState?.bestSetup} t={t} />
          <SupplySetupCard setup={frozenSupplyBestSetup} t={t} />
        </div>

        {debugMode && (
          <div className="optimizer-debug">
            <DebugSection
              title={t("debugSectionSupply")}
              events={supplyOptimizerState?.debugEvents}
              t={t}
            />
            <DebugSection
              title={t("debugSectionMoney")}
              events={moneyOptimizerState?.debugEvents}
              t={t}
            />
          </div>
        )}

        {moneyOptimizerState?.finalResources && (
          <div className="optimizer-final">
            <div className="optimizer-final-title">
              {t("optimizerFinalResources")}
            </div>
            <div className="optimizer-final-line">
              {t("optimizerFinalCoins")}:{" "}
              {formatNumber(moneyOptimizerState.finalResources.coins ?? 0)} |{" "}
              {t("optimizerFinalSupplies")}:{" "}
              {formatNumber(moneyOptimizerState.finalResources.supplies ?? 0)} |{" "}
              {t("optimizerFinalChronos")}:{" "}
              {formatNumber(moneyOptimizerState.finalResources.chronos ?? 0)}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose}>{t("supplyOptimizerClose")}</button>
        </div>
      </div>
    </div>
  );
}
