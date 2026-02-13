import { formatNumber } from "../../utils/formatNumber";

export function WorstRemovalModal({ open, data, onClose }) {
  if (!open) return null;
  const housing = data?.housing || [];
  const production = data?.production || [];
  const maxHousing = housing.reduce(
    (m, r) => (r.value > m ? r.value : m),
    -Infinity
  );
  const maxProd = production.reduce(
    (m, r) => (r.value > m ? r.value : m),
    -Infinity
  );

  const Column = ({ title, rows, maxVal }) => (
    <div className="worst-col">
      <div className="worst-heading">{title}</div>
      {rows.length === 0 ? (
        <div className="worst-empty">Keine Daten</div>
      ) : (
        rows.map((row) => (
          <div
            key={row.defId}
            className={`worst-row ${
              row.value === maxVal ? "worst-top" : ""
            }`}
          >
            <span className="worst-name">{row.short}</span>
            <span className="worst-value">{formatNumber(row.value)}</span>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="modal">
      <div className="modal-card worst-modal">
        <div className="help-header">
          <h3>Finde schlechtestes</h3>
          <button onClick={onClose}>Schliessen</button>
        </div>
        <div className="worst-grid">
          <Column title="Wohnungen (Münzen)" rows={housing} maxVal={maxHousing} />
          <Column title="Produktionen (Vorräte)" rows={production} maxVal={maxProd} />
        </div>
      </div>
    </div>
  );
}
