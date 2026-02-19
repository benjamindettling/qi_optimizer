// Happiness breakdown and boost multipliers for the top bar.
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import chronosIcon from "/chronos.webp";
import populationIcon from "/population.webp";
import { HAPPINESS_TIERS } from "../../config/happinessTiers";
import { formatNumber } from "../../utils/formatNumber";

const percentColor = (pct) => {
  const hue = Math.min(120, Math.max(0, (pct / 200) * 120));
  return `hsl(${hue}, 70%, 60%)`;
};

export function HappinessPanel({ stats, happyInfo }) {
  const percent = (stats.happinessProvided / stats.happinessRequired) * 100;
  const totalPeople = stats.people ?? 0;
  const freePeople = (stats.people ?? 0) - (stats.peopleReq ?? 0);
  const totalClass = totalPeople < 0 ? "text-negative" : "";
  const freeClass = freePeople < 0 ? "text-negative" : "";
  const tiers = HAPPINESS_TIERS.map((t, idx) => ({
    ...t,
    lower: idx === 0 ? 0 : HAPPINESS_TIERS[idx - 1].cap,
    labelPercent: Math.round(t.mult * 100),
  }));
  const currentTierIdx =
    tiers.findIndex((t) => percent < t.cap) !== -1
      ? tiers.findIndex((t) => percent < t.cap)
      : tiers.length - 1;

  const tierRows = tiers
    .map((t, idx) => ({ ...t, idx }))
    .filter((t) => t.idx !== currentTierIdx)
    .map((t) => {
      const isHigher = t.idx > currentTierIdx;
      const targetPercent = isHigher ? t.lower : t.cap;
      const targetProvided = (targetPercent * stats.happinessRequired) / 100;
      const delta = isHigher
        ? Math.ceil(targetProvided - stats.happinessProvided)
        : -Math.ceil(stats.happinessProvided - targetProvided);
      return {
        labelPercent: t.labelPercent,
        delta,
      };
    });

  const coinMult = (
    (stats.coinBoost ?? 0) +
    (happyInfo.ratio ?? 1) -
    1 +
    1
  ).toFixed(2);
  const supplyMult = (
    (stats.supplyBoost ?? 0) +
    (happyInfo.ratio ?? 1) -
    1 +
    1
  ).toFixed(2);
  const chronosMult = (happyInfo.ratio ?? 1).toFixed(2);

  return (
    <>
      <div className="topbar-stack boost-stack">
        <div
          className="resource-line"
          title={`Zufriedenheit: ${happyInfo.label}`}
        >
          <img src={happyInfo.icon} alt="happiness" />
          <span
            className="happy-boost"
            style={{
              color: percentColor((happyInfo.ratio ?? 1) * 100),
            }}
          >
            {Math.round((happyInfo.ratio ?? stats.happyMulti) * 100)}%
          </span>
        </div>
        <div className="resource-line" title="Totaler Muenzboost">
          <img src={moneyIcon} alt="coins" />
          <span className="happy-boost">x{coinMult}</span>
        </div>
        <div className="resource-line" title="Totaler Vorratsboost">
          <img src={suppliesIcon} alt="supplies" />
          <span className="happy-boost">x{supplyMult}</span>
        </div>
        <div className="resource-line" title="Totaler Chronosboost">
          <img src={chronosIcon} alt="chronos" />
          <span className="happy-boost">x{chronosMult}</span>
        </div>
        <div className="resource-line population-line" title="Bevölkerung">
          <img src={populationIcon} alt="population" />
          <div className="population-values">
            <span
              className={`pop-total ${totalClass}`}
              title="Totale Bevölkerung"
            >
              tot: {formatNumber(totalPeople)}
            </span>
            <span className={`pop-free ${freeClass}`} title="Freie Bevölkerung">
              free: {formatNumber(freePeople)}
            </span>
          </div>
        </div>
      </div>
      <div className="happy-tiers-column">
        {tierRows.map((row) => (
          <div className="happy-tier-row" key={row.labelPercent}>
            <span
              className="happy-tier"
              style={{ color: percentColor(row.labelPercent) }}
            >
              {row.labelPercent}%
            </span>
            <span
              className="happy-delta"
              style={{
                color: row.delta <= 0 ? "#6de38f" : "#ff7676",
              }}
            >
              {row.delta > 0 ? "+" : row.delta < 0 ? "-" : ""}
              {formatNumber(Math.abs(row.delta))}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
