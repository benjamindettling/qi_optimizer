import { useState, useMemo } from "react";
import { DEFAULT_CONFIG } from "../../config/gameDefaults";
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import chronosIcon from "/chronos.webp";
import goodsIcon from "/goods/Kupfer.webp";
import troopIcon from "/troop.webp";
import populationIcon from "/population.webp";
import shardsIcon from "/shards.webp";
import redAttackIcon from "/fight/red_attack.webp";
import redDefenseIcon from "/fight/red_defense.webp";
import blueAttackIcon from "/fight/blue_attack.webp";
import blueDefenseIcon from "/fight/blue_defense.webp";
import qaIcon from "/quantum_actions.webp";
import happinessIcon from "/happiness/Neutral.webp";
import "./StartingPage.css";

// Shared label helper – declared at module scope to avoid re-creation on render
const Label = ({ icon, text }) => (
  <span className="config-label">
    {icon ? <img src={icon} alt={text} className="inline-icon" /> : null}
    <span>{text}</span>
  </span>
);

const IconTerm = ({ icon, text }) => (
  <span className="tutorial-icon-term">
    <img src={icon} alt={text} />
    <span>{text}</span>
  </span>
);

const NUMBER_PROPS = {
  type: "number",
  inputMode: "numeric",
  className: "config-input",
  onFocus: (e) => e.target.select(),
};

// ---------- Config setup modal (config tab without side-tabs) ----------

function ConfigSetupModal({ config, onSave, onCancel }) {
  const initialDraft = useMemo(() => ({ ...config }), [config]);
  const [draft, setDraft] = useState(initialDraft);

  // Detect if the user changed anything from the initial snapshot
  const hasChanges = useMemo(() => {
    const fields = [
      "extraCoins",
      "extraSupplies",
      "goodsStartBonus",
      "troopsStartBonus",
      "shardsStart",
      "coinBoost",
      "supplyBoost",
      "redAttackBoost",
      "redDefenseBoost",
      "blueAttackBoost",
      "blueDefenseBoost",
      "fightColor",
      "qaBaseBonus",
    ];
    return fields.some((f) => {
      const a = draft[f] ?? DEFAULT_CONFIG[f];
      const b = initialDraft[f] ?? DEFAULT_CONFIG[f];
      return a !== b;
    });
  }, [draft, initialDraft]);

  // Check if any config field has a non-default value (already configured)
  const hasExistingConfig = useMemo(() => {
    const fields = [
      "extraCoins",
      "extraSupplies",
      "goodsStartBonus",
      "troopsStartBonus",
      "coinBoost",
      "supplyBoost",
      "redAttackBoost",
      "redDefenseBoost",
      "blueAttackBoost",
      "blueDefenseBoost",
      "qaBaseBonus",
    ];
    // shardsStart defaults to 500, fightColor to "rot" – ignore those for "already entered" check
    return fields.some((f) => (config[f] ?? 0) !== 0);
  }, [config]);

  const updateField = (key, val) =>
    setDraft((prev) => ({ ...prev, [key]: val }));

  const handleConfirm = () => onSave(draft);

  // Determine button label
  let confirmLabel;
  if (hasChanges) {
    confirmLabel = "Speichern und Weiter";
  } else if (hasExistingConfig) {
    confirmLabel = "Weiter";
  } else {
    confirmLabel = "Überspringen";
  }

  return (
    <div className="modal">
      <div className="modal-card config-setup-modal">
        <div className="config-setup-content">
          <h3>Spieler-Konfiguration</h3>
          <p className="config-setup-subtitle">
            Trage deine aktuellen Boni und Boosts ein, damit der Simulator
            korrekte Werte berechnet. Du kannst diese später jederzeit in den
            Einstellungen anpassen.
          </p>

          <div className="config-setup-body">
            <div className="config-grid">
              {/* Extra flat bonuses */}
              <label className="config-row">
                <Label icon={moneyIcon} text="Münzen Extra" />
                <input
                  {...NUMBER_PROPS}
                  value={draft.extraCoins ?? 0}
                  onChange={(e) =>
                    updateField("extraCoins", Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="config-row">
                <Label icon={suppliesIcon} text="Vorräte Extra" />
                <input
                  {...NUMBER_PROPS}
                  value={draft.extraSupplies ?? 0}
                  onChange={(e) =>
                    updateField("extraSupplies", Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="config-row">
                <Label icon={goodsIcon} text="Güter Extra" />
                <input
                  {...NUMBER_PROPS}
                  value={draft.goodsStartBonus ?? 0}
                  onChange={(e) =>
                    updateField("goodsStartBonus", Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="config-row">
                <Label icon={troopIcon} text="Truppen Extra" />
                <input
                  {...NUMBER_PROPS}
                  value={draft.troopsStartBonus ?? 0}
                  onChange={(e) =>
                    updateField("troopsStartBonus", Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="config-row">
                <Label icon={shardsIcon} text="Scherben Start" />
                <input
                  {...NUMBER_PROPS}
                  value={draft.shardsStart ?? 500}
                  onChange={(e) =>
                    updateField("shardsStart", Number(e.target.value) || 0)
                  }
                />
              </label>

              {/* Percentage boosts */}
              <label className="config-row">
                <Label icon={moneyIcon} text="Münzen % Boost" />
                <input
                  {...NUMBER_PROPS}
                  value={draft.coinBoost ?? 0}
                  onChange={(e) =>
                    updateField("coinBoost", Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="config-row">
                <Label icon={suppliesIcon} text="Vorräte % Boost" />
                <input
                  {...NUMBER_PROPS}
                  value={draft.supplyBoost ?? 0}
                  onChange={(e) =>
                    updateField("supplyBoost", Number(e.target.value) || 0)
                  }
                />
              </label>

              {/* Army boosts – Red */}
              <div className="config-row army-row">
                <Label icon={redAttackIcon} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.redAttackBoost ?? 0}
                  onChange={(e) =>
                    updateField("redAttackBoost", Number(e.target.value) || 0)
                  }
                  title="Roter Angriff % Bonus"
                />
                <span className="army-unit">%</span>
                <Label icon={redDefenseIcon} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.redDefenseBoost ?? 0}
                  onChange={(e) =>
                    updateField("redDefenseBoost", Number(e.target.value) || 0)
                  }
                  title="Rote Verteidigung % Bonus"
                />
                <span className="army-unit">%</span>
              </div>

              {/* Army boosts – Blue */}
              <div className="config-row army-row">
                <Label icon={blueAttackIcon} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.blueAttackBoost ?? 0}
                  onChange={(e) =>
                    updateField("blueAttackBoost", Number(e.target.value) || 0)
                  }
                  title="Blauer Angriff % Bonus"
                />
                <span className="army-unit">%</span>
                <Label icon={blueDefenseIcon} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.blueDefenseBoost ?? 0}
                  onChange={(e) =>
                    updateField("blueDefenseBoost", Number(e.target.value) || 0)
                  }
                  title="Blaue Verteidigung % Bonus"
                />
                <span className="army-unit">%</span>
              </div>

              {/* Fight colour */}
              <div className="config-row">
                <Label text="Farbe zum Kämpfen" />
                <div className="preference-buttons">
                  <button
                    className={draft.fightColor !== "blau" ? "active" : ""}
                    onClick={() => updateField("fightColor", "rot")}
                  >
                    Rot
                  </button>
                  <button
                    className={draft.fightColor === "blau" ? "active" : ""}
                    onClick={() => updateField("fightColor", "blau")}
                  >
                    Blau
                  </button>
                </div>
              </div>

              {/* QA bonus */}
              <label className="config-row">
                <Label icon={qaIcon} text="QA pro Stunde Extra" />
                <input
                  {...NUMBER_PROPS}
                  value={draft.qaBaseBonus ?? 0}
                  onChange={(e) =>
                    updateField("qaBaseBonus", Number(e.target.value) || 0)
                  }
                />
              </label>
            </div>
          </div>

          <div className="config-setup-footer">
            <button onClick={handleConfirm}>{confirmLabel}</button>
            <button onClick={onCancel}>Abbrechen</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Starting Page ----------

export function StartingPage({
  config,
  updateConfig,
  onStartSimulator,
  onOpenSaves,
  onOpenAccount,
}) {
  const [showConfigSetup, setShowConfigSetup] = useState(false);

  // Check if the user already has non-default config values
  const hasConfig = (() => {
    const fields = [
      "extraCoins",
      "extraSupplies",
      "goodsStartBonus",
      "troopsStartBonus",
      "coinBoost",
      "supplyBoost",
      "redAttackBoost",
      "redDefenseBoost",
      "blueAttackBoost",
      "blueDefenseBoost",
      "qaBaseBonus",
    ];
    return fields.some((f) => (config[f] ?? 0) !== 0);
  })();

  const handleStartClick = () => {
    if (hasConfig) {
      // Config already filled in – go straight to the simulator
      onStartSimulator();
    } else {
      // No config yet – show the setup dialog
      setShowConfigSetup(true);
    }
  };

  const handleConfigSave = (draft) => {
    updateConfig(draft);
    setShowConfigSetup(false);
    onStartSimulator();
  };

  const openAccountTab = (tabKey = "account") => {
    onOpenAccount?.(tabKey);
  };

  return (
    <>
      <div className="starting-page">
        <div className="starting-page-main">
          <div className="starting-page-hero">
            <h1>Quantum Incursion Optimizer</h1>
            <p>
              Plane und optimiere dein Quantum Incursion Stadtlayout. Platziere
              Gebäude, berechne Produktionsketten und verwalte mehrere
              Spielstände - alles direkt im Browser.
            </p>
          </div>

          <div className="starting-page-actions">
            <button className="btn-start" onClick={handleStartClick}>
              Starte Simulator
            </button>
            <button className="btn-secondary" onClick={onOpenSaves}>
              Verwalte Spielstände
            </button>
            <button
              className="btn-secondary"
              onClick={() => openAccountTab("account")}
            >
              Einstellungen
            </button>
          </div>
        </div>

        <footer className="starting-page-footer" aria-label="Rechtliche Links">
          <button
            type="button"
            className="starting-page-footer-link"
            onClick={() => openAccountTab("contact")}
          >
            Kontakt
          </button>
          <span className="starting-page-footer-separator" aria-hidden="true">
            |
          </span>
          <button
            type="button"
            className="starting-page-footer-link"
            onClick={() => openAccountTab("imprint")}
          >
            Impressum
          </button>
          <span className="starting-page-footer-separator" aria-hidden="true">
            |
          </span>
          <button
            type="button"
            className="starting-page-footer-link"
            onClick={() => openAccountTab("privacy")}
          >
            Datenschutz
          </button>
        </footer>

        <section className="starting-page-tutorial" aria-label="Tutorial">
          <div className="starting-page-tutorial-intro">
            <h2>Tutorial und komplette Oberflächen-Erklärung</h2>
            <p>
              Wenn du neu im Optimizer bist, findest du hier einen vollständigen
              Rundgang durch alle wichtigen Bereiche. Jede Sektion zeigt dir ein
              passendes Beispielbild und erklärt die relevanten Buttons,
              Anzeigen und den typischen Ablauf in der Praxis.
            </p>
          </div>

          <article className="tutorial-block">
            <div className="tutorial-block-visual">
              <img
                src="/examples/city_example.png"
                alt="Stadtansicht mit Mini-Toolbar und Shop"
                loading="lazy"
              />
            </div>
            <div className="tutorial-block-copy">
              <h3>1) Stadtbereich, Shop und Schnellaktionen</h3>
              <p>
                Das Zentrum deiner Arbeit ist die Stadtfläche. Hier platzierst,
                verschiebst und optimierst du Gebäude. Direkt daneben findest du
                die Mini-Toolbar für schnelle Bau- und Produktionsaktionen.
              </p>
              <ul>
                <li>
                  <strong>Move:</strong> Verschiebt Gebäude oder tauscht
                  Positionen, ohne Werte zu verlieren.
                </li>
                <li>
                  <strong>Verkaufen:</strong> Entfernt Gebäude und gibt die
                  reguläre Erstattung zurück.
                </li>
                <li>
                  <strong>Boost einzeln:</strong> Nutze den Zeit-Boost gezielt
                  auf einzelne Gebäude.
                </li>
                <li>
                  <strong>Shop:</strong> Öffnet die Bauauswahl. Wenn bereits ein
                  Bauobjekt aktiv ist, beendet der Button den Platziermodus.
                </li>
                <li>
                  <strong>Boost alle:</strong> Beendet alle laufenden
                  Produktionen gleichzeitig.
                </li>
                <li>
                  <strong>Rest einsammeln:</strong> Sammelt nur fertige
                  Produktionen ein.
                </li>
              </ul>
              <p>
                Im Shop wechselst du über die Tabs zwischen Favoriten, Housing,
                Production, Goods, Culture, Decoration und Military. Jede Karte
                zeigt dir Kosten, Voraussetzungen und den direkten Effekt für
                deinen Aufbau.
              </p>
            </div>
          </article>

          <article className="tutorial-block tutorial-block-reverse">
            <div className="tutorial-block-visual">
              <img
                src="/examples/stats_example.png"
                alt="Stats Übersicht mit Ressourcen und Multiplikatoren"
                loading="lazy"
              />
            </div>
            <div className="tutorial-block-copy">
              <h3>2) Stats Übersicht im Detail (jede Kennzahl)</h3>
              <p>
                Die Stats sind dein zentrales Kontrollzentrum. Lies diese Werte
                regelmäßig, bevor du baust, boostest oder exportierst.
              </p>
              <ul>
                <li>
                  <IconTerm icon={moneyIcon} text="Geld" /> zeigt dein aktuelles
                  Kapital für Bauten und Aktionen.
                </li>
                <li>
                  <IconTerm icon={suppliesIcon} text="Vorräte" /> sind die
                  zweite Hauptwährung für Ausbau und Produktion.
                </li>
                <li>
                  <IconTerm icon={chronosIcon} text="Chronos" /> sind für
                  zeitbezogene Aktionen und Gebäudeeffekte relevant.
                </li>
                <li>
                  <IconTerm icon={shardsIcon} text="Scherben" /> brauchst du vor
                  allem für Regionen und spezielle Fortschritte.
                </li>
                <li>
                  <IconTerm icon={qaIcon} text="QA" /> wird inklusive QA/h
                  dargestellt, damit du deinen langfristigen Durchsatz siehst.
                </li>
                <li>
                  <IconTerm icon={goodsIcon} text="Güter" /> zeigen jede Ware
                  einzeln (z. B. Kupfer, Honig, Seil, Schießpulver, Stein).
                </li>
                <li>
                  <IconTerm icon={troopIcon} text="Truppen" /> zeigt jede
                  Einheit mit eigenem Zähler.
                </li>
                <li>
                  <IconTerm icon={redAttackIcon} text="Angriff" /> und{" "}
                  <IconTerm icon={redDefenseIcon} text="Verteidigung" /> zeigen
                  den aktuellen Kampf-Boost der aktiven Farbe. Bei Blau werden
                  automatisch die blauen Werte angezeigt (
                  <IconTerm icon={blueAttackIcon} text="Blau Angriff" /> /{" "}
                  <IconTerm icon={blueDefenseIcon} text="Blau Verteidigung" />
                  ).
                </li>
                <li>
                  <IconTerm icon={happinessIcon} text="Zufriedenheit" /> zeigt
                  den Gesamtbonus in Prozent. Darunter siehst du die
                  Multiplikatoren für <IconTerm icon={moneyIcon} text="Geld" />,{" "}
                  <IconTerm icon={suppliesIcon} text="Vorräte" /> und{" "}
                  <IconTerm icon={chronosIcon} text="Chronos" />.
                </li>
                <li>
                  <IconTerm icon={populationIcon} text="Bevölkerung" /> zeigt
                  <strong>tot</strong> (gesamt) und <strong>free</strong>
                  (frei verfügbar).
                </li>
              </ul>
              <p>
                Rechts in der Zufriedenheits-Spalte siehst du außerdem, wie
                viele Punkte bis zu einer höheren oder niedrigeren Tier-Stufe
                fehlen.
              </p>
            </div>
          </article>

          <article className="tutorial-block">
            <div className="tutorial-block-visual">
              <img
                src="/examples/step_example.png"
                alt="Step Tracker mit Navigation"
                loading="lazy"
              />
            </div>
            <div className="tutorial-block-copy">
              <h3>3) Schritt-Navigation (Timeline)</h3>
              <p>
                Der Step-Tracker steuert, wo du dich in deiner
                Simulations-Historie befindest. Angezeigt werden Schritt-Nummer,
                Tagesphase und aktueller Save-Name.
              </p>
              <ul>
                <li>
                  <strong>Zum ersten Schritt springen:</strong> springt direkt
                  zum Anfang des aktiven Checkpoint-Abschnitts.
                </li>
                <li>
                  <strong>Einen Schritt zurück:</strong> geht eine Aktion
                  rückwärts.
                </li>
                <li>
                  <strong>Einen Schritt vorwärts:</strong> geht eine Aktion
                  vorwärts.
                </li>
                <li>
                  <strong>Zum letzten Schritt springen:</strong> springt zum
                  Ende des aktuellen Abschnitts.
                </li>
              </ul>
              <p>
                So kannst du Entscheidungen vergleichen, Fehler schnell finden
                und die beste Reihenfolge für Produktion und Ausbau ermitteln.
              </p>
            </div>
          </article>

          <article className="tutorial-block tutorial-block-reverse">
            <div className="tutorial-block-visual">
              <img
                src="/examples/menutools_example.png"
                alt="Menu-Tools mit Save und Profil"
                loading="lazy"
              />
            </div>
            <div className="tutorial-block-copy">
              <h3>4) Menu-Tools und Account-Bereich</h3>
              <p>
                Rechts oben liegen die Verwaltungs- und Account-Funktionen.
                Diese Buttons brauchst du für Dateiverwaltung, Hilfe und
                Einstellungen.
              </p>
              <ul>
                <li>
                  <strong>Speichern:</strong> legt einen neuen oder
                  aktualisierten Save an.
                </li>
                <li>
                  <strong>Laden:</strong> öffnet die Save-Verwaltung mit Laden,
                  Umbenennen, Export und Löschen.
                </li>
                <li>
                  <strong>Sync Config:</strong> synchronisiert Save-Config mit
                  deiner Account-Config (wenn Unterschiede erkannt werden).
                </li>
                <li>
                  <strong>Admin:</strong> schaltet erweiterte Bearbeitung für
                  Test- und Analyse-Szenarien.
                </li>
                <li>
                  <strong>Hilfe:</strong> öffnet das Hilfefenster.
                </li>
                <li>
                  <strong>Profil:</strong> öffnet Account, Config, Präferenzen,
                  Premium sowie Kontakt/Impressum/Datenschutz.
                </li>
              </ul>
              <p>
                Auf kleineren Displays erscheinen zusätzlich Pfeile, um zwischen
                Stats-, Step- und Menu-Panel zu wechseln.
              </p>
            </div>
          </article>

          <article className="tutorial-block">
            <div className="tutorial-block-visual">
              <img
                src="/examples/tree_example.png"
                alt="History-Tree mit Aktionsknoten"
                loading="lazy"
              />
            </div>
            <div className="tutorial-block-copy">
              <h3>5) History-Tree lesen und auswerten</h3>
              <p>
                Der Baum zeigt dir die komplette Aktionshistorie inklusive
                alternativer Branches. Damit kannst du mehrere Entscheidungswege
                parallel testen.
              </p>
              <ul>
                <li>
                  Jeder Knoten entspricht einer Aktion (Build, Sell, Boost,
                  Harvest, Region, Admin usw.).
                </li>
                <li>
                  Farben und Symbole helfen dir, Aktionstypen auf einen Blick zu
                  unterscheiden.
                </li>
                <li>
                  Beim Anklicken eines Knotens springt die gesamte Simulation
                  auf genau diesen Zustand.
                </li>
                <li>
                  Über Branches vergleichst du verschiedene Build-Orders, ohne
                  den Hauptpfad zu verlieren.
                </li>
              </ul>
              <p>
                Das ist besonders stark, wenn du dieselbe Ausgangslage mit
                verschiedenen Investitionsfolgen testen möchtest.
              </p>
            </div>
          </article>

          <article className="tutorial-block tutorial-block-reverse">
            <div className="tutorial-block-visual">
              <img
                src="/examples/treetools_example.png"
                alt="Tree-Tools und Extra-Tools"
                loading="lazy"
              />
            </div>
            <div className="tutorial-block-copy">
              <h3>6) Tree-Tools, Log und Extra-Tools</h3>
              <p>
                Rund um den Baum und das Log findest du weitere Analyse-Buttons,
                die für Optimierung und Dokumentation wichtig sind.
              </p>
              <ul>
                <li>
                  <strong>Branches ein/ausklappen:</strong> reduziert visuelle
                  Komplexität.
                </li>
                <li>
                  <strong>Aktionen zusammenfassen:</strong> komprimiert
                  horizontale Ausdehnung im Tree.
                </li>
                <li>
                  <strong>Zum Hauptbranch machen:</strong> setzt einen
                  alternativen Pfad als neue Hauptlinie.
                </li>
                <li>
                  <strong>Node löschen:</strong> entfernt den aktuellen Knoten
                  optional inklusive nachfolgender Nodes.
                </li>
                <li>
                  <strong>Log:</strong> zeigt die relevanten Aktionen zwischen
                  Checkpoints.
                </li>
                <li>
                  <strong>Weitere Tools:</strong> enthält Volle Erstattung,
                  Highlight, Screenshot, File -&gt; PDF
                  und Finde schlechtestes.
                </li>
              </ul>
              <p>
                Typischer Workflow: im Tree die Variante wählen, im Log prüfen,
                dann mit Screenshot oder PDF dokumentieren.
              </p>
            </div>
          </article>
        </section>
      </div>

      {showConfigSetup && (
        <ConfigSetupModal
          config={config}
          onSave={handleConfigSave}
          onCancel={() => setShowConfigSetup(false)}
        />
      )}
    </>
  );
}

