import { useState } from "react";

const tabs = [
  { key: "kopfleiste", label: "Kopfleiste" },
  { key: "shop", label: "Shop" },
  { key: "aktionsleiste", label: "Aktionsleiste" },
  { key: "stadt", label: "Stadt" },
  { key: "regionen", label: "Regionen" },
];

const content = {
  kopfleiste: [
    "Ressourcen können via Doppelklick beliebig angepasst werden.",
    "Zufriedenheit und Boosts errechnen sich aus der Stadt.",
    "Stadt kann nach Bedarf gedreht und skaliert werden",
    "Unendlich Knopf ermöglicht unendlich Ressourcen, für schnelleres Testen",
  ],
  shop: [
    "Gebäude sind wie im Spiel nach Kategorien sortiert",
    "Rote Spalte zeigt Kosten, grüne Spalte zeigt Nutzen",
    "Güter-/ und Truppenpakete werden als Tabelle mit Preisen angezeigt.",
    "Wenn Ressourcen nicht reichen, wird Gebäude ausgeblasst",
  ],
  aktionsleiste: [
    "Modi wie Bewegen/Verkaufen/... können per klick aktiviert werden. Ein Zweiter Klick kehrt zum 'Default Modus zurück'",
    "'Verkaufen' gibt 1/4 des Kaufwerts zurück (wie im Spiel). 'Full Refund' gibt den vollen Wert zurück, und ist zum testen gedacht",
    "Finish Productions beendet alle Produktionen. Im 'Default' Modus können Gebäude dann geerntet werden",
    "Save speichert Stadt, samt Ressourcen,Notizen etc lokal im Browser",
    "Load lädt einen beliebigen Spielstand wieder",
  ],
  stadt: [
    "Ernte-bereite Gebäude leuchten gelb und können im 'Default' Modus eingesammelt werden.",
    "Andere Modi sind zB 'Gebäude vom Shop platzieren', 'Bewegen', oder 'Verkaufen'",
    "Im Default Modus können auch Gütergebäude angeklickt werden, um Güter zu produzieren",
  ],
  regionen: [
    "Regionen kaufbar unten im Shop",
    "Kosten pro Freischaltung skalieren wie im Spiel. Mit 'debug' können frei Gebiete und Preise angepasst werden",
    "Falls Gütergebäude in der Stadt steht, kann man ne Art 'Schnellkauf' tätigen. Dabei kann man wählen, ob man den 'günstigsten' Weg will, oder nur die grossen 20er Packete kaufen will",
  ],
};

export function HelpModal({ open, onClose }) {
  const [active, setActive] = useState("kopfleiste");
  if (!open) return null;

  return (
    <div className="modal">
      <div className="modal-card help-modal">
        <div className="help-header">
          <h3>Hilfe &amp; Funktionen</h3>
          <button onClick={onClose}>Schliessen</button>
        </div>
        <div className="help-tabs">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={active === t.key ? "active" : ""}
              onClick={() => setActive(t.key)}
              type="button"
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="help-content">
          <ul>
            {content[active].map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
