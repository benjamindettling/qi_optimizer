import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import chronosIcon from "/chronos.webp";
import qaIcon from "/quantum_actions.webp";
import { formatNumber } from "../../utils/formatNumber";

export function HarvestModal({ harvestModal, onConfirm, onCancel }) {
  if (!harvestModal) return null;

  const { title, delta, result } = harvestModal;
  const fmt = (val, withSign = true) =>
    withSign && val >= 0
      ? `+${formatNumber(val)}`
      : withSign
      ? formatNumber(val)
      : formatNumber(val);

  const Row = ({ icon, value, withSign = true }) => (
    <div className="cost-row">
      <img src={icon} alt="" />
      <span>{fmt(value, withSign)}</span>
    </div>
  );

  return (
    <div className="modal">
      <div className="modal-card">
        <h3>{title || "Harvest Result"}</h3>
        <div className="modal-body harvest-body">
          <div className="harvest-col">
            <div className="harvest-heading">Erhalten</div>
            <Row icon={moneyIcon} value={delta.coins ?? 0} />
            <Row icon={suppliesIcon} value={delta.supplies ?? 0} />
            <Row icon={chronosIcon} value={delta.chronos ?? 0} />
            <Row icon={qaIcon} value={delta.qa ?? 0} />
          </div>
          <div className="harvest-col">
            <div className="harvest-heading">Neuer Stand</div>
            <Row icon={moneyIcon} value={result.coins ?? 0} withSign={false} />
            <Row
              icon={suppliesIcon}
              value={result.supplies ?? 0}
              withSign={false}
            />
            <Row
              icon={chronosIcon}
              value={result.chronos ?? 0}
              withSign={false}
            />
            <Row
              icon={qaIcon}
              value={result.quantumActions ?? 0}
              withSign={false}
            />
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={onConfirm}>Okay</button>
          <button onClick={onCancel}>Abbrechen</button>
        </div>
      </div>
    </div>
  );
}
