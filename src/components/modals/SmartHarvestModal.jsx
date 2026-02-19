import { formatNumber } from "../../utils/formatNumber";

export function SmartHarvestModal({ smartHarvestModal, onConfirm }) {
  if (!smartHarvestModal) return null;

  const { log = [], resources = {}, success = true } = smartHarvestModal;
  const title = success ? "Schlaue Ernte" : "Schlaue Ernte abgebrochen";

  return (
    <div className="modal">
      <div className="modal-card smart-harvest-modal">
        <h3>{title}</h3>
        <div className="smart-harvest-body">
          <div className="smart-harvest-log">
            {log.length === 0 ? (
              <div className="smart-harvest-empty">Keine Aktionen</div>
            ) : (
              log.map((line, idx) => (
                <div key={`${idx}-${line}`} className="smart-harvest-line">
                  {line}
                </div>
              ))
            )}
          </div>
          <div className="smart-harvest-summary">
            Neuer Stand: {formatNumber(resources.coins ?? 0)} Münzen,{" "}
            {formatNumber(resources.supplies ?? 0)} Vorräte,{" "}
            {formatNumber(resources.chronos ?? 0)} Chronos
          </div>
        </div>
        <div className="modal-actions">
          <button onClick={onConfirm}>OK</button>
        </div>
      </div>
    </div>
  );
}
