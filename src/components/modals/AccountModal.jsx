import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import qaIcon from "/quantum_actions.webp";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { DEFAULT_CONFIG } from "../../config/gameDefaults";
import { QiInput } from "../common/QiInput";
import "./AccountModal.css";

const TAB_KEYS = [
  "account",
  "config",
  "preferences",
  "premium",
];

const isValidTabKey = (tabKey) => TAB_KEYS.includes(tabKey);
const CONFIG_KEYS = Object.keys(DEFAULT_CONFIG);
const CONFIG_KEY_SET = new Set(CONFIG_KEYS);

const buildConfigPayload = (source = {}) =>
  CONFIG_KEYS.reduce((acc, key) => {
    if (source[key] !== undefined) {
      acc[key] = source[key];
    }
    return acc;
  }, {});

export function AccountModal({
  open,
  onClose,
  config,
  onSave,
  onPreviewConfig,
  onApplyStartBonus,
  viewMode,
  setViewMode,
  toolbarPosition,
  setToolbarPosition,
  boardScale,
  setBoardScale,
  warnDeleteSingleAction,
  setWarnDeleteSingleAction,
  warnDeleteSubtree,
  setWarnDeleteSubtree,
  saveAccountToCloud,
  canCloudSave,
  cloudProfile,
  initialTab = "account",
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  // Legacy preference hooks kept wired for future re-introduction.
  void toolbarPosition;
  void setToolbarPosition;
  void boardScale;
  void setBoardScale;
  void onApplyStartBonus;
  const navigate = useNavigate();
  const location = useLocation();
  const mainTabs = [
    { key: "account", label: t("accountTabAccount") },
    { key: "config", label: t("accountTabConfig") },
    { key: "preferences", label: t("accountTabPreferences") },
    { key: "premium", label: t("accountTabPremium") },
  ];
  const legalTabs = [
    { key: "contact", label: t("accountTabContact") },
    { key: "imprint", label: t("accountTabImprint") },
    { key: "privacy", label: t("accountTabPrivacy") },
  ];
  const allTabs = [...mainTabs, ...legalTabs];
  const mainTabHelpIds = {
    account: "profile-tab-account",
    config: "profile-tab-config",
    preferences: "profile-tab-preferences",
    premium: "profile-tab-premium",
  };

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

  const buildModalDraft = useMemo(
    () => () => ({
      ...config,
      viewMode,
      warnDeleteSingleAction,
      warnDeleteSubtree,
    }),
    [config, viewMode, warnDeleteSingleAction, warnDeleteSubtree],
  );

  const buildPreviewSnapshot = useMemo(
    () => () => ({
      config: buildConfigPayload(config),
      viewMode,
      warnDeleteSingleAction,
      warnDeleteSubtree,
    }),
    [config, viewMode, warnDeleteSingleAction, warnDeleteSubtree],
  );

  const initialDraft = useMemo(() => buildModalDraft(), [buildModalDraft]);
  const [openSnapshot, setOpenSnapshot] = useState(buildPreviewSnapshot());
  const [draft, setDraft] = useState(initialDraft);

  // Reset draft when modal opens
  const [lastOpen, setLastOpen] = useState(open);
  if (open && !lastOpen) {
    setDraft(buildModalDraft());
    setOpenSnapshot(buildPreviewSnapshot());
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

    if (key === "viewMode") {
      setViewMode(val, { persist: false });
      return;
    }
    if (key === "warnDeleteSingleAction") {
      setWarnDeleteSingleAction(val, { persist: false });
      return;
    }
    if (key === "warnDeleteSubtree") {
      setWarnDeleteSubtree(val, { persist: false });
      return;
    }
    if (CONFIG_KEY_SET.has(key)) {
      onPreviewConfig?.({ [key]: val }, { persist: false });
    }
  };

  const restorePreviewSnapshot = () => {
    onPreviewConfig?.(openSnapshot.config, { persist: false });
    setViewMode(openSnapshot.viewMode, { persist: false });
    setWarnDeleteSingleAction(openSnapshot.warnDeleteSingleAction, { persist: false });
    setWarnDeleteSubtree(openSnapshot.warnDeleteSubtree, { persist: false });
  };

  const handleCancel = () => {
    restorePreviewSnapshot();
    onClose?.();
  };

  const openLegalPage = (tabKey) => {
    const route =
      tabKey === "contact"
        ? "/contact"
        : tabKey === "imprint"
          ? "/imprint"
          : "/privacy";
    const from = location.pathname === "/simulator" ? "/simulator" : "/";
    handleCancel();
    navigate(route, { state: { from } });
  };

  const handleSave = async () => {
    setSaveError("");

    const finalConfig = buildConfigPayload(draft);
    const finalViewMode = draft.viewMode ?? viewMode;
    const finalWarnDeleteSingleAction =
      draft.warnDeleteSingleAction ?? warnDeleteSingleAction;
    const finalWarnDeleteSubtree =
      draft.warnDeleteSubtree ?? warnDeleteSubtree;

    // Commit preferences + config to local persistence.
    setViewMode(finalViewMode, { persist: true });
    setWarnDeleteSingleAction(finalWarnDeleteSingleAction, { persist: true });
    setWarnDeleteSubtree(finalWarnDeleteSubtree, { persist: true });

    onSave(finalConfig, { persist: true });
    setOpenSnapshot({
      config: finalConfig,
      viewMode: finalViewMode,
      warnDeleteSingleAction: finalWarnDeleteSingleAction,
      warnDeleteSubtree: finalWarnDeleteSubtree,
    });

    // Save to cloud if user is logged in
    if (canCloudSave && saveAccountToCloud) {
      try {
        await saveAccountToCloud(
          finalConfig,
          {
            viewMode: finalViewMode,
            warnDeleteSingleAction: finalWarnDeleteSingleAction,
            warnDeleteSubtree: finalWarnDeleteSubtree,
          },
          { username: username.trim(), profileText: profileText.trim() },
        );
      } catch (err) {
        console.error("Failed to save account settings to cloud:", err);
        setSaveError(err?.message || t("accountSaveFailed"));
        return; // Don't close modal on error
      }
    }

    onClose();
  };

  const Label = ({ icon, text, helpId = null }) => (
    <span
      className="config-label"
      data-help-id={helpId || undefined}
    >
      {icon ? <img src={icon} alt={text} className="inline-icon" /> : null}
      <span>{text}</span>
    </span>
  );

  const renderConfigTab = () => (
    <div className="config-grid">
      {/* Extra flat bonuses */}
      <label className="config-row">
        <Label icon={moneyIcon} text={t("configLabelExtraCoins")} />
        <QiInput
          mode="number"
          className="config-input"
          value={draft.extraCoins ?? 0}
          onChange={(nextValue) => updateField("extraCoins", nextValue)}
        />
      </label>
      <label className="config-row">
        <Label icon={suppliesIcon} text={t("configLabelExtraSupplies")} />
        <QiInput
          mode="number"
          className="config-input"
          value={draft.extraSupplies ?? 0}
          onChange={(nextValue) => updateField("extraSupplies", nextValue)}
        />
      </label>
      <label className="config-row">
        <Label icon={goodsIcon} text={t("configLabelExtraGoods")} />
        <QiInput
          mode="number"
          className="config-input"
          value={draft.goodsStartBonus ?? 0}
          onChange={(nextValue) => updateField("goodsStartBonus", nextValue)}
        />
      </label>
      <label className="config-row">
        <Label icon={troopIcon} text={t("configLabelExtraTroops")} />
        <QiInput
          mode="number"
          className="config-input"
          value={draft.troopsStartBonus ?? 0}
          onChange={(nextValue) => updateField("troopsStartBonus", nextValue)}
        />
      </label>
      {/* Percentage boosts */}
      <label className="config-row">
        <Label icon={moneyIcon} text={t("configLabelCoinBoost")} />
        <QiInput
          mode="number"
          className="config-input"
          value={draft.coinBoost ?? 0}
          onChange={(nextValue) => updateField("coinBoost", nextValue)}
        />
      </label>
      <label className="config-row">
        <Label icon={suppliesIcon} text={t("configLabelSupplyBoost")} />
        <QiInput
          mode="number"
          className="config-input"
          value={draft.supplyBoost ?? 0}
          onChange={(nextValue) => updateField("supplyBoost", nextValue)}
        />
      </label>

      {/* Army boosts - Red Attack & Defense */}
      <div className="config-row army-row">
        <div className="army-row-fields">
          <label className="army-field">
            <span className="army-field-label">
              {t("accountConfigRedAttack")} (%)
            </span>
            <QiInput
              mode="number"
              className="config-input"
              value={draft.redAttackBoost ?? 0}
              onChange={(nextValue) => updateField("redAttackBoost", nextValue)}
              title={t("accountConfigRedAttack")}
            />
          </label>
          <label className="army-field">
            <span className="army-field-label">
              {t("accountConfigRedDefense")} (%)
            </span>
            <QiInput
              mode="number"
              className="config-input"
              value={draft.redDefenseBoost ?? 0}
              onChange={(nextValue) => updateField("redDefenseBoost", nextValue)}
              title={t("accountConfigRedDefense")}
            />
          </label>
        </div>
      </div>

      {/* Army boosts - Blue Attack & Defense */}
      <div className="config-row army-row">
        <div className="army-row-fields">
          <label className="army-field">
            <span className="army-field-label">
              {t("accountConfigBlueAttack")} (%)
            </span>
            <QiInput
              mode="number"
              className="config-input"
              value={draft.blueAttackBoost ?? 0}
              onChange={(nextValue) => updateField("blueAttackBoost", nextValue)}
              title={t("accountConfigBlueAttack")}
            />
          </label>
          <label className="army-field">
            <span className="army-field-label">
              {t("accountConfigBlueDefense")} (%)
            </span>
            <QiInput
              mode="number"
              className="config-input"
              value={draft.blueDefenseBoost ?? 0}
              onChange={(nextValue) => updateField("blueDefenseBoost", nextValue)}
              title={t("accountConfigBlueDefense")}
            />
          </label>
        </div>
      </div>

      {/* Fight color selector */}
      <div className="config-row">
        <Label text={t("configLabelFightColor")} />
        <div className="preference-buttons">
          <button
            className={draft.fightColor !== "blau" ? "active" : ""}
            onClick={() => updateField("fightColor", "rot")}
          >
            {t("colorRed")}
          </button>
          <button
            className={draft.fightColor === "blau" ? "active" : ""}
            onClick={() => updateField("fightColor", "blau")}
          >
            {t("colorBlue")}
          </button>
        </div>
      </div>

      {/* QA bonus */}
      <label className="config-row">
        <Label icon={qaIcon} text={t("configLabelQaPerHour")} />
        <QiInput
          mode="number"
          className="config-input"
          value={draft.qaBaseBonus ?? 0}
          onChange={(nextValue) => updateField("qaBaseBonus", nextValue)}
        />
      </label>
    </div>
  );

  const renderPreferencesTab = () => (
    <div className="config-grid">
      <label className="config-row" data-help-id="profile-pref-shards-limit">
        <Label icon={shardsIcon} text={t("accountPrefShardsLimit")} />
        <QiInput
          mode="number"
          className="config-input"
          value={draft.shardsLimit ?? 500}
          onChange={(nextValue) => updateField("shardsLimit", nextValue)}
        />
      </label>

      <div className="config-row">
        <Label
          text={t("accountPrefShardCountMode")}
          helpId="profile-pref-shard-count-question"
        />
        <div className="preference-buttons">
          <button
            data-help-id="profile-pref-shard-count-spent"
            className={draft.shardDisplayMode !== "stock" ? "active" : ""}
            onClick={() => updateField("shardDisplayMode", "spent")}
          >
            {t("accountPrefShardCountSpent")}
          </button>
          <button
            data-help-id="profile-pref-shard-count-stock"
            className={draft.shardDisplayMode === "stock" ? "active" : ""}
            onClick={() => updateField("shardDisplayMode", "stock")}
          >
            {t("accountPrefShardCountStock")}
          </button>
        </div>
      </div>

      <div className="config-row">
        <Label
          text={t("accountPrefAllowShardLimitOverflow")}
          helpId="profile-pref-shard-limit-question"
        />
        <div className="preference-buttons wide preference-buttons--right">
          <button
            data-help-id="profile-pref-shard-limit-overflow-yes"
            className={draft.allowShardLimitOverflow !== false ? "active" : ""}
            onClick={() => updateField("allowShardLimitOverflow", true)}
          >
            {t("accountPrefAllowShardLimitOverflowYes")}
          </button>
          <button
            data-help-id="profile-pref-shard-limit-overflow-no"
            className={draft.allowShardLimitOverflow === false ? "active" : ""}
            onClick={() => updateField("allowShardLimitOverflow", false)}
          >
            {t("accountPrefAllowShardLimitOverflowNo")}
          </button>
        </div>
      </div>

      <div className="config-row" data-help-id="profile-pref-tree-delete-single">
        <Label text={t("accountPrefWarnDeleteSingle")} />
        <div className="preference-buttons">
          <button
            className={draft.warnDeleteSingleAction !== false ? "active" : ""}
            onClick={() => updateField("warnDeleteSingleAction", true)}
          >
            {t("accountPrefYes")}
          </button>
          <button
            className={draft.warnDeleteSingleAction === false ? "active" : ""}
            onClick={() => updateField("warnDeleteSingleAction", false)}
          >
            {t("accountPrefNo")}
          </button>
        </div>
      </div>

      <div className="config-row" data-help-id="profile-pref-tree-delete-branch">
        <Label text={t("accountPrefWarnDeleteSubtree")} />
        <div className="preference-buttons">
          <button
            className={draft.warnDeleteSubtree !== false ? "active" : ""}
            onClick={() => updateField("warnDeleteSubtree", true)}
          >
            {t("accountPrefYes")}
          </button>
          <button
            className={draft.warnDeleteSubtree === false ? "active" : ""}
            onClick={() => updateField("warnDeleteSubtree", false)}
          >
            {t("accountPrefNo")}
          </button>
        </div>
      </div>

      <div className="config-row" data-help-id="profile-pref-outer-skip">
        <Label text={t("accountPrefOuterSkipButtons")} />
        <div className="preference-buttons wide preference-buttons--right">
          <button
            className={draft.skipToEnd !== false ? "active" : ""}
            onClick={() => updateField("skipToEnd", true)}
          >
            {t("accountPrefOuterSkipCheckpointEnd")}
          </button>
          <button
            className={draft.skipToEnd === false ? "active" : ""}
            onClick={() => updateField("skipToEnd", false)}
          >
            {t("accountPrefOuterSkipTreeEnd")}
          </button>
        </div>
      </div>

      <div className="config-row" data-help-id="profile-pref-qa-from-setup">
        <Label text={t("accountPrefOnlyCountQaFromSetup")} />
        <div className="preference-buttons">
          <button
            className={draft.onlyCountQaFromSetup !== false ? "active" : ""}
            onClick={() => updateField("onlyCountQaFromSetup", true)}
          >
            {t("accountPrefYes")}
          </button>
          <button
            className={draft.onlyCountQaFromSetup === false ? "active" : ""}
            onClick={() => updateField("onlyCountQaFromSetup", false)}
          >
            {t("accountPrefNo")}
          </button>
        </div>
      </div>

      <div className="config-row" data-help-id="profile-pref-board-orientation">
        <Label text={t("accountConfigBoardOrientation")} />
        <div className="preference-buttons">
          <button
            className={draft.viewMode === "down" ? "active" : ""}
            onClick={() => updateField("viewMode", "down")}
          >
            &darr;
          </button>
          <button
            className={draft.viewMode === "diagonal" ? "active" : ""}
            onClick={() => updateField("viewMode", "diagonal")}
          >
            &#8600;
          </button>
          <button
            className={draft.viewMode === "right" ? "active" : ""}
            onClick={() => updateField("viewMode", "right")}
          >
            &rarr;
          </button>
        </div>
      </div>

      <div className="config-row" data-help-id="profile-pref-color-theme">
        <Label text={t("accountConfigColorTheme")} />
        <div className="preference-buttons">
          <button className="active" disabled>
            {t("accountPrefThemeComingSoon")}
          </button>
        </div>
      </div>
    </div>
  );

  const renderPremiumTab = () => (
    <div className="premium-content">
      <h2 className="premium-title">{t("accountPremiumTitle")}</h2>
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

      <h4>{t("accountPrivacyDataTitle")}</h4>
      <ul>
        <li>{t("legalPrivacyDataPoint1")}</li>
        <li>{t("legalPrivacyDataPoint2")}</li>
        <li>{t("legalPrivacyDataPoint3")}</li>
      </ul>

      <h4>{t("accountPrivacyPurposeTitle")}</h4>
      <ul>
        <li>{t("legalPrivacyPurposePoint1")}</li>
        <li>{t("legalPrivacyPurposePoint2")}</li>
        <li>{t("legalPrivacyPurposePoint3")}</li>
      </ul>


      <h4>{t("accountPrivacyContactTitle")}</h4>
      <div className="legal-block">
        <p>
          <strong>Name:</strong> Benjamin Dettling
        </p>
        <p>
          <strong>E-Mail:</strong> [datenschutz@example.com]
        </p>
      </div>

      <p className="legal-note">{t("legalPrivacyPlaceholderNote")}</p>
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
              <QiInput
                mode="text"
                className="config-input"
                fullWidth
                value={username}
                onChange={(nextValue) => setUsername(nextValue)}
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
                <QiInput
                  type="text"
                  fullWidth
                  placeholder="ProGamer123"
                  value={registerUsername}
                  onChange={(nextValue) => setRegisterUsername(nextValue)}
                  autoComplete="username"
                  maxLength={30}
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">
                  Email<span className="required-star">*</span>
                </label>
                <QiInput
                  type="email"
                  fullWidth
                  placeholder="ProGamer@gmail.com"
                  value={registerEmail}
                  onChange={(nextValue) => setRegisterEmail(nextValue)}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">
                  Passwort<span className="required-star">*</span>
                </label>
                <QiInput
                  type="password"
                  fullWidth
                  placeholder="12345678"
                  value={password}
                  onChange={(nextValue) => setPassword(nextValue)}
                  autoComplete="new-password"
                  required
                />
              </div>
            </>
          ) : (
            <>
              <div className="auth-field">
                <label className="auth-label">Username oder Email</label>
                <QiInput
                  type="text"
                  fullWidth
                  placeholder="ProGamer123 oder ProGamer@gmail.com"
                  value={emailOrUsername}
                  onChange={(nextValue) => setEmailOrUsername(nextValue)}
                  autoComplete="username"
                  required
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Passwort</label>
                <QiInput
                  type="password"
                  fullWidth
                  placeholder="********"
                  value={password}
                  onChange={(nextValue) => setPassword(nextValue)}
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
              {mainTabs.map((tab) => (
                <button
                  type="button"
                  key={tab.key}
                  data-help-id={mainTabHelpIds[tab.key]}
                  className={`account-tab ${activeTab === tab.key ? "active" : ""}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="account-tabs-legal">
              {legalTabs.map((tab) => (
                <button
                  type="button"
                  key={tab.key}
                  className="account-tab"
                  onClick={() => openLegalPage(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="account-content">
            <div className="account-header">
              <h3>{allTabs.find((entry) => entry.key === activeTab)?.label}</h3>
              <button
                type="button"
                onClick={handleCancel}
                aria-label={t("accountHeaderClose")}
              >
                ×
              </button>
            </div>
            <div className="account-body">
              {activeTab === "account" && (
                <div data-help-id="profile-window-account">
                  {renderAccountTab()}
                </div>
              )}
              {activeTab === "config" && (
                <div data-help-id="profile-window-config">
                  {renderConfigTab()}
                </div>
              )}
              {activeTab === "preferences" && renderPreferencesTab()}
              {activeTab === "premium" && (
                <div data-help-id="profile-window-premium">
                  {renderPremiumTab()}
                </div>
              )}
              {activeTab === "contact" && renderContactTab()}
              {activeTab === "imprint" && renderImprintTab()}
              {activeTab === "privacy" && renderPrivacyTab()}
            </div>
            {saveError && <div className="save-error">{saveError}</div>}
            <div className="account-footer">
              <button type="button" onClick={handleSave}>
                {t("accountBtnSave")}
              </button>
              <button type="button" onClick={handleCancel}>
                {t("accountBtnCancel")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
