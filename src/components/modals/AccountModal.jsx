import { useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../../firebase";
import {
  loginWithUsernameOrEmail,
  claimUsername,
} from "../../firebase/usernameAuth";
import { useAuth } from "../../auth/AuthProvider";
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import goodsIcon from "/goods/Kupfer.webp";
import troopIcon from "/troop.webp";
import shardsIcon from "/shards.webp";
import redAttackIcon from "/fight/red_attack.webp";
import redDefenseIcon from "/fight/red_defense.webp";
import blueAttackIcon from "/fight/blue_attack.webp";
import blueDefenseIcon from "/fight/blue_defense.webp";
import qaIcon from "/quantum_actions.webp";
import "./AccountModal.css";

const TABS = [
  { key: "account", label: "Account" },
  { key: "config", label: "Config" },
  { key: "preferences", label: "Präferenzen" },
  { key: "premium", label: "Premium" },
];

const LEGAL_TABS = [
  { key: "contact", label: "Kontakt" },
  { key: "imprint", label: "Impressum" },
  { key: "privacy", label: "Datenschutz" },
];

const ALL_TABS = [...TABS, ...LEGAL_TABS];

const isValidTabKey = (tabKey) => ALL_TABS.some((tab) => tab.key === tabKey);

export function AccountModal({
  open,
  onClose,
  config,
  onSave,
  onApplyStartBonus,
  viewMode,
  setViewMode,
  useShortNames,
  setUseShortNames,
  toolbarPosition,
  setToolbarPosition,
  boardScale,
  setBoardScale,
  saveAccountToCloud,
  canCloudSave,
  cloudProfile,
  initialTab = "account",
}) {
  const { user, authLoading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState("account");

  // Auth form state
  const [authMode, setAuthMode] = useState("login"); // "login" | "register"
  const [emailOrUsername, setEmailOrUsername] = useState(""); // for login
  const [registerUsername, setRegisterUsername] = useState(""); // for register
  const [registerEmail, setRegisterEmail] = useState(""); // for register
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [saveError, setSaveError] = useState("");

  // Profile state - initialize from cloudProfile when it changes
  const [username, setUsername] = useState(cloudProfile?.username || "");
  const [profileText, setProfileText] = useState(
    cloudProfile?.profileText || "",
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Sync profile state when cloudProfile changes (e.g., after login)
  const [lastCloudProfile, setLastCloudProfile] = useState(cloudProfile);
  if (cloudProfile !== lastCloudProfile) {
    setLastCloudProfile(cloudProfile);
    if (cloudProfile) {
      setUsername(cloudProfile.username || "");
      setProfileText(cloudProfile.profileText || "");
    }
  }

  // Initialize draft with config merged with current view preferences
  const initialDraft = useMemo(
    () => ({
      ...config,
      viewMode: viewMode,
      useShortNames: useShortNames,
      toolbarPosition: toolbarPosition,
      boardScale: Math.round((boardScale ?? 1) * 100),
    }),
    [config, viewMode, useShortNames, toolbarPosition, boardScale],
  );

  const [draft, setDraft] = useState(initialDraft);

  // Reset draft when modal opens
  const [lastOpen, setLastOpen] = useState(open);
  if (open && !lastOpen) {
    setDraft({
      ...config,
      viewMode: viewMode,
      useShortNames: useShortNames,
      toolbarPosition: toolbarPosition,
      boardScale: Math.round((boardScale ?? 1) * 100),
    });
  }
  if (open !== lastOpen) {
    setLastOpen(open);
  }

  useEffect(() => {
    if (!open) return;
    if (!isValidTabKey(initialTab)) return;
    setActiveTab(initialTab);
  }, [open, initialTab]);

  if (!open) return null;

  const updateField = (key, val) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  const handleSave = async () => {
    setSaveError("");

    // Compute final preference values
    const finalViewMode = draft.viewMode ?? viewMode;
    const finalUseShortNames = draft.useShortNames ?? useShortNames;
    const finalToolbarPosition = draft.toolbarPosition ?? toolbarPosition;
    const finalBoardScale =
      Math.max(1, Math.min(500, draft.boardScale ?? 100)) / 100;

    // Apply preference settings locally
    if (viewMode !== finalViewMode) {
      setViewMode(finalViewMode);
    }
    if (useShortNames !== finalUseShortNames) {
      setUseShortNames(finalUseShortNames);
    }
    if (toolbarPosition !== finalToolbarPosition) {
      setToolbarPosition(finalToolbarPosition);
    }
    if (boardScale !== finalBoardScale) {
      setBoardScale(finalBoardScale);
    }

    // Save config locally
    onSave(draft);

    // Save to cloud if user is logged in
    if (canCloudSave && saveAccountToCloud) {
      try {
        await saveAccountToCloud(
          draft,
          {
            viewMode: finalViewMode,
            useShortNames: finalUseShortNames,
            toolbarPosition: finalToolbarPosition,
            boardScale: finalBoardScale,
          },
          { username: username.trim(), profileText: profileText.trim() },
        );
      } catch (err) {
        console.error("Failed to save account settings to cloud:", err);
        setSaveError(err?.message || "Speichern fehlgeschlagen");
        return; // Don't close modal on error
      }
    }

    onClose();
  };

  const handleApplyStartBonus = () => {
    const coins = Number(draft.extraCoins ?? 0) || 0;
    const supplies = Number(draft.extraSupplies ?? 0) || 0;
    onApplyStartBonus?.(coins, supplies);
  };

  const numberProps = {
    type: "number",
    inputMode: "numeric",
    className: "config-input",
    onFocus: (e) => e.target.select(),
  };

  const Label = ({ icon, text }) => (
    <span className="config-label">
      {icon ? <img src={icon} alt={text} className="inline-icon" /> : null}
      <span>{text}</span>
    </span>
  );

  const renderConfigTab = () => (
    <div className="config-grid">
      {/* Extra flat bonuses */}
      <label className="config-row">
        <Label icon={moneyIcon} text="Münzen Extra" />
        <input
          {...numberProps}
          value={draft.extraCoins ?? 0}
          onChange={(e) =>
            updateField("extraCoins", Number(e.target.value) || 0)
          }
        />
      </label>
      <label className="config-row">
        <Label icon={suppliesIcon} text="Vorräte Extra" />
        <input
          {...numberProps}
          value={draft.extraSupplies ?? 0}
          onChange={(e) =>
            updateField("extraSupplies", Number(e.target.value) || 0)
          }
        />
      </label>
      <label className="config-row">
        <Label icon={goodsIcon} text="Güter Extra" />
        <input
          {...numberProps}
          value={draft.goodsStartBonus ?? 0}
          onChange={(e) =>
            updateField("goodsStartBonus", Number(e.target.value) || 0)
          }
        />
      </label>
      <label className="config-row">
        <Label icon={troopIcon} text="Truppen Extra" />
        <input
          {...numberProps}
          value={draft.troopsStartBonus ?? 0}
          onChange={(e) =>
            updateField("troopsStartBonus", Number(e.target.value) || 0)
          }
        />
      </label>
      <label className="config-row">
        <Label icon={shardsIcon} text="Scherben Start" />
        <input
          {...numberProps}
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
          {...numberProps}
          value={draft.coinBoost ?? 0}
          onChange={(e) =>
            updateField("coinBoost", Number(e.target.value) || 0)
          }
        />
      </label>
      <label className="config-row">
        <Label icon={suppliesIcon} text="Vorräte % Boost" />
        <input
          {...numberProps}
          value={draft.supplyBoost ?? 0}
          onChange={(e) =>
            updateField("supplyBoost", Number(e.target.value) || 0)
          }
        />
      </label>

      {/* Army boosts - Red Attack & Defense */}
      <div className="config-row army-row">
        <Label icon={redAttackIcon} />
        <input
          {...numberProps}
          value={draft.redAttackBoost ?? 0}
          onChange={(e) =>
            updateField("redAttackBoost", Number(e.target.value) || 0)
          }
          title="Roter Angriff % Bonus"
        />
        <span className="army-unit">%</span>
        <Label icon={redDefenseIcon} />
        <input
          {...numberProps}
          value={draft.redDefenseBoost ?? 0}
          onChange={(e) =>
            updateField("redDefenseBoost", Number(e.target.value) || 0)
          }
          title="Rote Verteidigung % Bonus"
        />
        <span className="army-unit">%</span>
      </div>

      {/* Army boosts - Blue Attack & Defense */}
      <div className="config-row army-row">
        <Label icon={blueAttackIcon} />
        <input
          {...numberProps}
          value={draft.blueAttackBoost ?? 0}
          onChange={(e) =>
            updateField("blueAttackBoost", Number(e.target.value) || 0)
          }
          title="Blauer Angriff % Bonus"
        />
        <span className="army-unit">%</span>
        <Label icon={blueDefenseIcon} />
        <input
          {...numberProps}
          value={draft.blueDefenseBoost ?? 0}
          onChange={(e) =>
            updateField("blueDefenseBoost", Number(e.target.value) || 0)
          }
          title="Blaue Verteidigung % Bonus"
        />
        <span className="army-unit">%</span>
      </div>

      {/* Fight color selector */}
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
          {...numberProps}
          value={draft.qaBaseBonus ?? 0}
          onChange={(e) =>
            updateField("qaBaseBonus", Number(e.target.value) || 0)
          }
        />
      </label>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="config-grid">
      {/* Board Size */}
      <label className="config-row">
        <Label text="Board Größe (%)" />
        <input
          {...numberProps}
          value={draft.boardScale ?? 100}
          min={1}
          max={500}
          onChange={(e) =>
            updateField("boardScale", Number(e.target.value) || 100)
          }
        />
      </label>

      {/* Board Orientation */}
      <div className="config-row">
        <Label text="Board Orientation" />
        <div className="preference-buttons">
          <button
            className={draft.viewMode === "down" ? "active" : ""}
            onClick={() => updateField("viewMode", "down")}
            title="Down view"
          >
            ↓
          </button>
          <button
            className={draft.viewMode === "diagonal" ? "active" : ""}
            onClick={() => updateField("viewMode", "diagonal")}
            title="Diagonal view"
          >
            ↘
          </button>
          <button
            className={draft.viewMode === "right" ? "active" : ""}
            onClick={() => updateField("viewMode", "right")}
            title="Right view"
          >
            →
          </button>
        </div>
      </div>

      {/* Toolbar Position */}
      <div className="config-row">
        <Label text="Board Toolbar Position" />
        <div className="preference-buttons">
          <button
            className={draft.toolbarPosition !== "top" ? "active" : ""}
            onClick={() => updateField("toolbarPosition", "left")}
          >
            Links
          </button>
          <button
            className={draft.toolbarPosition === "top" ? "active" : ""}
            onClick={() => updateField("toolbarPosition", "top")}
          >
            Oben
          </button>
        </div>
      </div>

      {/* Skip button behavior */}
      <div className="config-row">
        <Label text="Skip Buttons springen bis" />
        <div className="preference-buttons wide">
          <button
            className={draft.skipToEnd !== false ? "active" : ""}
            onClick={() => updateField("skipToEnd", true)}
          >
            Ende des Checkpoints
          </button>
          <button
            className={draft.skipToEnd === false ? "active" : ""}
            onClick={() => updateField("skipToEnd", false)}
          >
            Anfang des Checkpoints
          </button>
        </div>
      </div>

      {/* Color theme */}
      <div className="config-row">
        <Label text="Farbtheme" />
        <div className="preference-buttons">
          <button
            className={draft.colorTheme === "light" ? "active" : ""}
            onClick={() => updateField("colorTheme", "light")}
          >
            Hell
          </button>
          <button
            className={draft.colorTheme !== "light" ? "active" : ""}
            onClick={() => updateField("colorTheme", "dark")}
          >
            Dunkel
          </button>
        </div>
      </div>

      {/* Building placement behavior */}
      <div className="config-row">
        <Label text="Gebäude setzen" />
        <div className="preference-buttons wide">
          <button
            className={draft.placementMode === "multi" ? "active" : ""}
            onClick={() => updateField("placementMode", "multi")}
          >
            Mehrere hintereinander
          </button>
          <button
            className={draft.placementMode === "reopen" ? "active" : ""}
            onClick={() => updateField("placementMode", "reopen")}
          >
            Shop neu öffnen
          </button>
          <button
            className={
              !draft.placementMode || draft.placementMode === "single"
                ? "active"
                : ""
            }
            onClick={() => updateField("placementMode", "single")}
          >
            Modus beenden
          </button>
        </div>
      </div>
    </div>
  );

  const renderPremiumTab = () => (
    <div className="premium-content">
      <h2 className="premium-title">Premium demnächst erhältlich</h2>
    </div>
  );

  const renderContactTab = () => (
    <div className="legal-content">
      <p>
        Wenn du Fragen hast oder Inhalte melden möchtest, kannst du mich direkt
        kontaktieren.
      </p>
      <div className="legal-block">
        <p>
          <strong>Name:</strong> Benjamin Dettling
        </p>
        <p>
          <strong>E-Mail:</strong> benjamin@benjamindettling.ch
        </p>
        <p>
          <strong>Antwortzeit:</strong> 2-3 Werktage
        </p>
      </div>
      <p className="legal-note">
        Hinweis: Dieses Projekt wird privat und nicht im Namen einer Firma
        betrieben.
      </p>
    </div>
  );

  const renderImprintTab = () => (
    <div className="legal-content">
      <p>
        Angaben gemäß Paragraph 5 TMG für ein privat betriebenes Online-Angebot.
      </p>
      <div className="legal-block">
        <p>
          <strong>Name:</strong> Benjamin Dettling
        </p>
        <p>
          <strong>Adresse:</strong> Winterthur, Schweiz
        </p>
        <p>
          <strong>E-Mail:</strong> benjamin@benjamindettling.ch
        </p>
      </div>
      <div className="legal-block">
        <p>
          <strong>Verantwortlich für Inhalte:</strong>
        </p>
        <p>Benjamin Dettling, Winterthur, Schweiz</p>
      </div>
      <p className="legal-note">
        Keine Firma, kein Verein und keine gewerbliche Redaktion.
      </p>
    </div>
  );

  const renderPrivacyTab = () => (
    <div className="legal-content">
      <p>
        Diese Seite ist ein privat betriebenes Projekt. Personenbezogene Daten
        werden nur verarbeitet, wenn es technisch notwendig ist oder du sie
        aktiv eingibst.
      </p>

      <h4>Verarbeitete Daten</h4>
      <ul>
        <li>Technische Zugriffsdaten (z. B. IP, Browser, Zeitstempel)</li>
        <li>Optional: Login-Daten bei Nutzung der Account-Funktionen</li>
        <li>Optional: Cookie-Einwilligungen und Komfort-Einstellungen</li>
      </ul>

      <h4>Zwecke</h4>
      <ul>
        <li>Bereitstellung und Sicherheit der Webseite</li>
        <li>Speichern von Einstellungen und Spielständen</li>
        <li>Betrieb von Login- und Cloud-Funktionen</li>
      </ul>

      <h4>Google AdSense (geplant)</h4>
      <p>
        Bei aktivierter Einbindung kann Google AdSense Cookies und
        nutzungsbezogene Daten für personalisierte oder nicht-personalisierte
        Werbung verarbeiten. Die Auslieferung erfolgt nur gemaess deiner
        Consent-Auswahl.
      </p>

      <h4>Kontakt für Datenschutzanfragen</h4>
      <div className="legal-block">
        <p>
          <strong>Name:</strong> Benjamin Dettling
        </p>
        <p>
          <strong>E-Mail:</strong> [datenschutz@example.com]
        </p>
      </div>

      <p className="legal-note">
        Bitte ersetze alle Platzhalter vor dem Live-Betrieb mit deinen echten
        Angaben.
      </p>
    </div>
  );

  // Auth handlers
  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    try {
      if (authMode === "register") {
        const userCred = await createUserWithEmailAndPassword(
          auth,
          registerEmail.trim(),
          password,
        );
        // Claim username in the usernames collection for lookup
        if (registerUsername.trim()) {
          try {
            await claimUsername(
              userCred.user.uid,
              registerUsername.trim(),
              registerEmail.trim(),
            );
          } catch (err) {
            console.error("Failed to claim username:", err);
            // Don't block registration if username claim fails
          }
        }
        // Save username to user's profile in Firestore
        if (registerUsername.trim() && saveAccountToCloud) {
          try {
            await saveAccountToCloud(null, null, {
              username: registerUsername.trim(),
            });
          } catch (err) {
            console.error("Failed to save username on register:", err);
          }
        }
        setRegisterUsername("");
        setRegisterEmail("");
      } else {
        // Login with username or email
        await loginWithUsernameOrEmail(emailOrUsername.trim(), password);
        setEmailOrUsername("");
      }
      setPassword("");
    } catch (err) {
      setAuthError(err?.message ?? "Authentifizierungsfehler");
    }
  };

  const handleGoogleAuth = async () => {
    setAuthError("");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setAuthError(err?.message ?? "Google Anmeldungsfehler");
    }
  };

  const handleLogout = () => {
    logout();
    setShowLogoutConfirm(false);
  };

  const renderAccountTab = () => {
    if (authLoading) {
      return <div className="auth-loading">Lade...</div>;
    }

    // Logged in view
    if (user) {
      return (
        <div className="account-logged-in">
          <div className="account-user-info">
            <div className="account-email">{user.email}</div>
          </div>

          <div className="account-profile-section">
            <label className="config-row">
              <span className="config-label">Benutzername</span>
              <input
                type="text"
                className="config-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Dein Benutzername"
                maxLength={30}
              />
            </label>

            <label className="config-row profile-text-row">
              <span className="config-label">Profiltext</span>
              <textarea
                className="config-textarea"
                style={{ color: "#000" }}
                value={profileText}
                onChange={(e) => setProfileText(e.target.value.slice(0, 200))}
                placeholder="Erzähle etwas über dich..."
                maxLength={200}
                rows={3}
              />
              <span className="char-count">{profileText.length}/200</span>
            </label>
          </div>

          <div className="account-logout-section">
            {!showLogoutConfirm ? (
              <button
                className="logout-btn"
                onClick={() => setShowLogoutConfirm(true)}
              >
                Abmelden
              </button>
            ) : (
              <div className="logout-confirm">
                <span>Wirklich abmelden?</span>
                <button className="logout-btn confirm" onClick={handleLogout}>
                  Ja, abmelden
                </button>
                <button
                  className="logout-cancel-btn"
                  onClick={() => setShowLogoutConfirm(false)}
                >
                  Abbrechen
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Not logged in - show auth form
    return (
      <div className="account-auth">
        <div className="auth-mode-toggle">
          <button
            className={authMode === "login" ? "active" : ""}
            onClick={() => setAuthMode("login")}
          >
            Anmelden
          </button>
          <button
            className={authMode === "register" ? "active" : ""}
            onClick={() => setAuthMode("register")}
          >
            Registrieren
          </button>
        </div>

        <form onSubmit={handleEmailAuth} className="auth-form">
          {authMode === "register" ? (
            <>
              <div className="auth-field">
                <label className="auth-label">Username</label>
                <input
                  type="text"
                  placeholder="ProGamer123"
                  value={registerUsername}
                  onChange={(e) => setRegisterUsername(e.target.value)}
                  autoComplete="username"
                  maxLength={30}
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">
                  Email<span className="required-star">*</span>
                </label>
                <input
                  type="email"
                  placeholder="ProGamer@gmail.com"
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">
                  Passwort<span className="required-star">*</span>
                </label>
                <input
                  type="password"
                  placeholder="12345678"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="auth-field">
                <label className="auth-label">Username oder Email</label>
                <input
                  type="text"
                  placeholder="ProGamer123 oder ProGamer@gmail.com"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Passwort</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            </>
          )}
          <button type="submit" className="auth-submit-btn">
            {authMode === "register" ? "Konto erstellen" : "Anmelden"}
          </button>
        </form>

        <div className="auth-divider">
          <span>oder</span>
        </div>

        <button onClick={handleGoogleAuth} className="google-auth-btn">
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Mit Google fortfahren
        </button>

        {authError && <div className="auth-error">{authError}</div>}
      </div>
    );
  };

  return (
    <div className="modal">
      <div className="modal-card account-modal">
        <div className="account-layout">
          <div className="account-tabs">
            <div className="account-tabs-main">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`account-tab ${activeTab === tab.key ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="account-tabs-legal">
              {LEGAL_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={`account-tab ${activeTab === tab.key ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="account-content">
            <div className="account-header">
              <h3>{ALL_TABS.find((t) => t.key === activeTab)?.label}</h3>
              <button onClick={onClose}>×</button>
            </div>
            <div className="account-body">
              {activeTab === "account" && renderAccountTab()}
              {activeTab === "config" && renderConfigTab()}
              {activeTab === "preferences" && renderPreferencesTab()}
              {activeTab === "premium" && renderPremiumTab()}
              {activeTab === "contact" && renderContactTab()}
              {activeTab === "imprint" && renderImprintTab()}
              {activeTab === "privacy" && renderPrivacyTab()}
            </div>
            {saveError && <div className="save-error">{saveError}</div>}
            <div className="account-footer">
              <button onClick={handleSave}>Speichern</button>
              <button onClick={onClose}>Abbrechen</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
