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

const IconTerm = ({ icon, text }) => (
  <span className="tutorial-icon-term">
    <img src={icon} alt={text} />
    <span>{text}</span>
  </span>
);

export const TUTORIAL_DE = (
  <>
    <div className="starting-page-tutorial-intro">
      <h2>Tutorial und komplette Oberflächen-Erklärung</h2>
      <p>
        Wenn du neu im Optimizer bist, findest du hier einen vollständigen
        Rundgang durch alle wichtigen Bereiche. Jede Sektion zeigt dir ein
        passendes Beispielbild und erklärt die relevanten Buttons, Anzeigen und
        den typischen Ablauf in der Praxis.
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
          verschiebst und optimierst du Gebäude. Direkt daneben findest du die
          Mini-Toolbar für schnelle Bau- und Produktionsaktionen.
        </p>
        <ul>
          <li>
            <strong>Move:</strong> Verschiebt Gebäude oder tauscht Positionen,
            ohne Werte zu verlieren.
          </li>
          <li>
            <strong>Verkaufen:</strong> Entfernt Gebäude und gibt die reguläre
            Erstattung zurück.
          </li>
          <li>
            <strong>Boost einzeln:</strong> Nutze den Zeit-Boost gezielt auf
            einzelne Gebäude.
          </li>
          <li>
            <strong>Shop:</strong> Öffnet die Bauauswahl. Wenn bereits ein
            Bauobjekt aktiv ist, beendet der Button den Platziermodus.
          </li>
          <li>
            <strong>Boost alle:</strong> Beendet alle laufenden Produktionen
            gleichzeitig.
          </li>
          <li>
            <strong>Rest einsammeln:</strong> Sammelt nur fertige Produktionen
            ein.
          </li>
        </ul>
        <p>
          Im Shop wechselst du über die Tabs zwischen Favoriten, Housing,
          Production, Goods, Culture, Decoration und Military. Jede Karte zeigt
          dir Kosten, Voraussetzungen und den direkten Effekt für deinen Aufbau.
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
            <IconTerm icon={suppliesIcon} text="Vorräte" /> sind die zweite
            Hauptwährung für Ausbau und Produktion.
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
            <IconTerm icon={troopIcon} text="Truppen" /> zeigt jede Einheit mit
            eigenem Zähler.
          </li>
          <li>
            <IconTerm icon={redAttackIcon} text="Angriff" /> und
            <IconTerm icon={redDefenseIcon} text="Verteidigung" /> zeigen den
            aktuellen Kampf-Boost der aktiven Farbe. Bei Blau werden
            automatisch die blauen Werte angezeigt (
            <IconTerm icon={blueAttackIcon} text="Blau Angriff" /> /
            <IconTerm icon={blueDefenseIcon} text="Blau Verteidigung" />).
          </li>
          <li>
            <IconTerm icon={happinessIcon} text="Zufriedenheit" /> zeigt den
            Gesamtbonus in Prozent. Darunter siehst du die Multiplikatoren für
            <IconTerm icon={moneyIcon} text="Geld" />, <IconTerm
              icon={suppliesIcon}
              text="Vorräte"
            /> und <IconTerm icon={chronosIcon} text="Chronos" />.
          </li>
          <li>
            <IconTerm icon={populationIcon} text="Bevölkerung" /> zeigt
            <strong>tot</strong> (gesamt) und <strong>free</strong> (frei
            verfügbar).
          </li>
        </ul>
        <p>
          Rechts in der Zufriedenheits-Spalte siehst du außerdem, wie viele
          Punkte bis zu einer höheren oder niedrigeren Tier-Stufe fehlen.
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
          Der Step-Tracker steuert, wo du dich in deiner Simulations-Historie
          befindest. Angezeigt werden Schritt-Nummer, Tagesphase und aktueller
          Save-Name.
        </p>
        <ul>
          <li>
            <strong>Zum ersten Schritt springen:</strong> springt direkt zum
            Anfang des aktiven Checkpoint-Abschnitts.
          </li>
          <li>
            <strong>Einen Schritt zurück:</strong> geht eine Aktion rückwärts.
          </li>
          <li>
            <strong>Einen Schritt vorwärts:</strong> geht eine Aktion vorwärts.
          </li>
          <li>
            <strong>Zum letzten Schritt springen:</strong> springt zum Ende des
            aktuellen Abschnitts.
          </li>
        </ul>
        <p>
          So kannst du Entscheidungen vergleichen, Fehler schnell finden und die
          beste Reihenfolge für Produktion und Ausbau ermitteln.
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
          Rechts oben liegen die Verwaltungs- und Account-Funktionen. Diese
          Buttons brauchst du für Dateiverwaltung, Hilfe und Einstellungen.
        </p>
        <ul>
          <li>
            <strong>Speichern:</strong> legt einen neuen oder aktualisierten
            Save an.
          </li>
          <li>
            <strong>Laden:</strong> öffnet die Save-Verwaltung mit Laden,
            Umbenennen, Export und Löschen.
          </li>
          <li>
            <strong>Sync Config:</strong> synchronisiert Save-Config mit deiner
            Account-Config (wenn Unterschiede erkannt werden).
          </li>
          <li>
            <strong>Admin:</strong> schaltet erweiterte Bearbeitung für Test-
            und Analyse-Szenarien.
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
            Jeder Knoten entspricht einer Aktion (Build, Sell, Boost, Harvest,
            Region, Admin usw.).
          </li>
          <li>
            Farben und Symbole helfen dir, Aktionstypen auf einen Blick zu
            unterscheiden.
          </li>
          <li>
            Beim Anklicken eines Knotens springt die gesamte Simulation auf
            genau diesen Zustand.
          </li>
          <li>
            Über Branches vergleichst du verschiedene Build-Orders, ohne den
            Hauptpfad zu verlieren.
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
          Rund um den Baum und das Log findest du weitere Analyse-Buttons, die
          für Optimierung und Dokumentation wichtig sind.
        </p>
        <ul>
          <li>
            <strong>Branches ein/ausklappen:</strong> reduziert visuelle
            Komplexität.
          </li>
          <li>
            <strong>Aktionen zusammenfassen:</strong> komprimiert horizontale
            Ausdehnung im Tree.
          </li>
          <li>
            <strong>Zum Hauptbranch machen:</strong> setzt einen alternativen
            Pfad als neue Hauptlinie.
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
            Highlight, Screenshot, File -&gt; PDF und Finde schlechtestes.
          </li>
        </ul>
        <p>
          Typischer Workflow: im Tree die Variante wählen, im Log prüfen, dann
          mit Screenshot oder PDF dokumentieren.
        </p>
      </div>
    </article>
  </>
);

export const TUTORIAL_EN = (
  <>
    <div className="starting-page-tutorial-intro">
      <h2>Tutorial and Complete UI Explanation</h2>
      <p>
        If you are new to the optimizer, this is a complete walkthrough of all
        important areas. Each section includes an example image and explains the
        relevant buttons, displays, and common workflow.
      </p>
    </div>

    <article className="tutorial-block">
      <div className="tutorial-block-visual">
        <img
          src="/examples/city_example.png"
          alt="City view with mini toolbar and shop"
          loading="lazy"
        />
      </div>
      <div className="tutorial-block-copy">
        <h3>1) City Area, Shop, and Quick Actions</h3>
        <p>
          The city grid is the center of your work. This is where you place,
          move, and optimize buildings. Right next to it, the mini toolbar gives
          you quick construction and production actions.
        </p>
        <ul>
          <li>
            <strong>Move:</strong> Moves buildings or swaps positions without
            losing values.
          </li>
          <li>
            <strong>Sell:</strong> Removes buildings and returns the standard
            refund.
          </li>
          <li>
            <strong>Single Boost:</strong> Use time boost on individual
            buildings.
          </li>
          <li>
            <strong>Shop:</strong> Opens the build selection. If a building is
            already selected, this exits placement mode.
          </li>
          <li>
            <strong>Boost All:</strong> Finishes all running productions at
            once.
          </li>
          <li>
            <strong>Collect Rest:</strong> Collects only finished productions.
          </li>
        </ul>
        <p>
          In the shop, switch between tabs for Favorites, Housing, Production,
          Goods, Culture, Decoration, and Military. Each card shows costs,
          requirements, and direct effects for your setup.
        </p>
      </div>
    </article>

    <article className="tutorial-block tutorial-block-reverse">
      <div className="tutorial-block-visual">
        <img
          src="/examples/stats_example.png"
          alt="Stats overview with resources and multipliers"
          loading="lazy"
        />
      </div>
      <div className="tutorial-block-copy">
        <h3>2) Detailed Stats Overview (Every Metric)</h3>
        <p>
          Stats are your central control panel. Check these values regularly
          before building, boosting, or exporting.
        </p>
        <ul>
          <li>
            <IconTerm icon={moneyIcon} text="Coins" /> shows your current
            capital for buildings and actions.
          </li>
          <li>
            <IconTerm icon={suppliesIcon} text="Supplies" /> are your second
            main currency for expansion and production.
          </li>
          <li>
            <IconTerm icon={chronosIcon} text="Chronos" /> is relevant for
            time-based actions and building effects.
          </li>
          <li>
            <IconTerm icon={shardsIcon} text="Shards" /> are mostly needed for
            regions and special progress.
          </li>
          <li>
            <IconTerm icon={qaIcon} text="QA" /> is shown including QA/h so you
            can track long-term throughput.
          </li>
          <li>
            <IconTerm icon={goodsIcon} text="Goods" /> display each item
            individually (e.g. copper, honey, rope, gunpowder, stone).
          </li>
          <li>
            <IconTerm icon={troopIcon} text="Troops" /> displays each unit with
            its own counter.
          </li>
          <li>
            <IconTerm icon={redAttackIcon} text="Attack" /> and
            <IconTerm icon={redDefenseIcon} text="Defense" /> show the current
            combat boost for your active color. If blue is selected, blue values
            are shown automatically (
            <IconTerm icon={blueAttackIcon} text="Blue Attack" /> /
            <IconTerm icon={blueDefenseIcon} text="Blue Defense" />).
          </li>
          <li>
            <IconTerm icon={happinessIcon} text="Happiness" /> shows total
            bonus percentage. Below it, you can see multipliers for
            <IconTerm icon={moneyIcon} text="Coins" />, <IconTerm
              icon={suppliesIcon}
              text="Supplies"
            /> and <IconTerm icon={chronosIcon} text="Chronos" />.
          </li>
          <li>
            <IconTerm icon={populationIcon} text="Population" /> shows
            <strong>tot</strong> (total) and <strong>free</strong> (available).
          </li>
        </ul>
        <p>
          In the happiness column, you also see how many points are missing to
          reach a higher or lower tier.
        </p>
      </div>
    </article>

    <article className="tutorial-block">
      <div className="tutorial-block-visual">
        <img
          src="/examples/step_example.png"
          alt="Step tracker with navigation"
          loading="lazy"
        />
      </div>
      <div className="tutorial-block-copy">
        <h3>3) Step Navigation (Timeline)</h3>
        <p>
          The step tracker controls where you are in simulation history. It
          shows step number, day phase, and active save name.
        </p>
        <ul>
          <li>
            <strong>Jump to first step:</strong> jumps to the start of the
            active checkpoint section.
          </li>
          <li>
            <strong>One step back:</strong> moves one action backward.
          </li>
          <li>
            <strong>One step forward:</strong> moves one action forward.
          </li>
          <li>
            <strong>Jump to last step:</strong> jumps to the end of the current
            section.
          </li>
        </ul>
        <p>
          This lets you compare decisions, find mistakes quickly, and optimize
          production and expansion order.
        </p>
      </div>
    </article>

    <article className="tutorial-block tutorial-block-reverse">
      <div className="tutorial-block-visual">
        <img
          src="/examples/menutools_example.png"
          alt="Menu tools with save and profile"
          loading="lazy"
        />
      </div>
      <div className="tutorial-block-copy">
        <h3>4) Menu Tools and Account Area</h3>
        <p>
          Administrative and account functions are in the top-right area. You
          use these buttons for file management, help, and settings.
        </p>
        <ul>
          <li>
            <strong>Save:</strong> creates or updates a save file.
          </li>
          <li>
            <strong>Load:</strong> opens save management with load, rename,
            export, and delete actions.
          </li>
          <li>
            <strong>Sync Config:</strong> syncs save config with your account
            config when differences are detected.
          </li>
          <li>
            <strong>Admin:</strong> enables extended editing for testing and
            analysis scenarios.
          </li>
          <li>
            <strong>Help:</strong> opens the help window.
          </li>
          <li>
            <strong>Profile:</strong> opens account, config, preferences,
            premium, and legal pages.
          </li>
        </ul>
        <p>
          On smaller displays, arrows appear so you can switch between stats,
          steps, and menu panels.
        </p>
      </div>
    </article>

    <article className="tutorial-block">
      <div className="tutorial-block-visual">
        <img
          src="/examples/tree_example.png"
          alt="History tree with action nodes"
          loading="lazy"
        />
      </div>
      <div className="tutorial-block-copy">
        <h3>5) Reading and Evaluating the History Tree</h3>
        <p>
          The tree shows your complete action history, including alternative
          branches. This lets you test multiple decision paths in parallel.
        </p>
        <ul>
          <li>
            Each node is an action (Build, Sell, Boost, Harvest, Region, Admin,
            etc.).
          </li>
          <li>
            Colors and icons help you distinguish action types at a glance.
          </li>
          <li>
            Clicking a node jumps the whole simulation to that exact state.
          </li>
          <li>
            Branches let you compare build orders without losing the main path.
          </li>
        </ul>
        <p>
          This is especially strong when testing different investment sequences
          from the same starting state.
        </p>
      </div>
    </article>

    <article className="tutorial-block tutorial-block-reverse">
      <div className="tutorial-block-visual">
        <img
          src="/examples/treetools_example.png"
          alt="Tree tools and extra tools"
          loading="lazy"
        />
      </div>
      <div className="tutorial-block-copy">
        <h3>6) Tree Tools, Log, and Extra Tools</h3>
        <p>
          Around the tree and the log, you will find additional analysis buttons
          that are useful for optimization and documentation.
        </p>
        <ul>
          <li>
            <strong>Collapse/expand branches:</strong> reduces visual
            complexity.
          </li>
          <li>
            <strong>Group actions:</strong> compresses horizontal spread in the
            tree.
          </li>
          <li>
            <strong>Make main branch:</strong> promotes an alternative path to
            the main line.
          </li>
          <li>
            <strong>Delete node:</strong> removes the current node, optionally
            with following nodes.
          </li>
          <li>
            <strong>Log:</strong> shows relevant actions between checkpoints.
          </li>
          <li>
            <strong>Extra tools:</strong> includes full refund, highlight,
            screenshot, File -&gt; PDF, and Find worst.
          </li>
        </ul>
        <p>
          Typical workflow: choose a variant in the tree, verify in log, then
          document with screenshot or PDF.
        </p>
      </div>
    </article>
  </>
);
