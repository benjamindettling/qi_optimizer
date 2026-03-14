import { useState, useEffect, useMemo, useCallback } from "react";
import { SlidersHorizontal, ArrowLeft, Save, User, X } from "lucide-react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { QiInput } from "../common/QiInput";
import { SavefileCard } from "../common/SavefileCard";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { useAuth } from "../../auth/AuthProvider";
import { auth } from "../../firebase";
import {
  claimUsername,
  fetchProfileUsername,
  loginWithUsernameOrEmail,
} from "../../firebase/usernameAuth";
import {
  listNewestSharedSaves,
  downloadSharedSave,
  renameSharedSave,
  deleteSharedSave,
  findOwnSharedSaveByTitle,
} from "../../firebase/sharedSaves";
import {
  getProfileDescription,
  setProfileDescription,
} from "../../firebase/sharedSaves";
import { extractSaveConfig } from "../../utils/saveConfig";
import "./OnlineLibraryModal.css";

import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import goodsIcon from "/goods/Kupfer.webp";
import shardsIcon from "/shards.webp";
import attackIcon from "/fight/red_attack.webp";
import defenseIcon from "/fight/red_defense.webp";
import qaIcon from "/quantum_actions.webp";
import unitIcon from "/troop.webp";

const SORT_MODES = [
  { key: "newest", field: "uploadedAt", dir: "desc" },
  { key: "oldest", field: "uploadedAt", dir: "asc" },
  { key: "az", field: "title", dir: "asc" },
  { key: "za", field: "title", dir: "desc" },
  { key: "highestQa", field: "finalTotalQaSetup", dir: "desc" },
];

const SORT_LABEL_KEYS = {
  newest: "onlineLibrarySortNewest",
  oldest: "onlineLibrarySortOldest",
  az: "onlineLibrarySortAz",
  za: "onlineLibrarySortZa",
  highestQa: "onlineLibrarySortHighestQa",
};

const MIN_FILTER_FIELDS = [
  { key: "minMoney", labelKey: "loadSavesStatsMoney", icon: moneyIcon },
  {
    key: "minSupplies",
    labelKey: "loadSavesStatsSupplies",
    icon: suppliesIcon,
  },
  { key: "minGoods", labelKey: "loadSavesStatsGoods", icon: goodsIcon },
  {
    key: "minShardsUsed",
    labelKey: "loadSavesStatsShardsUsed",
    icon: shardsIcon,
  },
];

const FINAL_FILTER_FIELDS = [
  { key: "finalAttack", labelKey: "loadSavesStatsAttack", icon: attackIcon },
  { key: "finalDefense", labelKey: "loadSavesStatsDefense", icon: defenseIcon },
  { key: "finalTotalQaSetup", labelKey: "loadSavesStatsTotalQa", icon: qaIcon },
  { key: "finalUnitKatapult", labelKey: "loadSavesStatsUnits", icon: unitIcon },
];

/**
 * Determine whether a shared save is "impossible" for the given user config.
 * Returns true when any minimum requirement exceeds the user's setting.
 */
function isSharedSaveImpossible(save, userConfig) {
  if (!userConfig) return false;
  const uc = extractSaveConfig(userConfig);
  return (
    (uc.goodsStartBonus ?? 0) < (save.minGoods ?? 0) ||
    (uc.shardsLimit ?? 0) < (save.minShardsUsed ?? 0)
  );
}

function getSharedSaveMinimumViolations(save, userConfig) {
  const uc = extractSaveConfig(userConfig);
  return {
    money: (uc.extraCoins ?? 0) < (Number(save?.minMoney) || 0),
    supplies: (uc.extraSupplies ?? 0) < (Number(save?.minSupplies) || 0),
    goods: (uc.goodsStartBonus ?? 0) < (Number(save?.minGoods) || 0),
    shardsUsed: (uc.shardsLimit ?? 0) < (Number(save?.minShardsUsed) || 0),
  };
}

function toFinite(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function OnlineLibraryModal({
  open,
  onClose,
  userConfig,
  currentUsername = "",
}) {
  const { lang } = useLang();
  const t = useCallback((key) => T[key]?.[lang] ?? T[key]?.DE ?? key, [lang]);
  const { user, logout } = useAuth();
  const currentUid = user?.uid ?? null;

  // Data state
  const [saves, setSaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Sort & filter state
  const [sortMode, setSortMode] = useState("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filters, setFilters] = useState({});

  // Card interaction state
  const [deletingId, setDeletingId] = useState(null);
  const [busyId, setBusyId] = useState(null);

  // Profile view state
  const [profileView, setProfileView] = useState(null); // { uid, username }
  const [profileSaves, setProfileSaves] = useState([]);
  const [profileDesc, setProfileDesc] = useState("");
  const [profileDescDraft, setProfileDescDraft] = useState("");
  const [profileEditingDesc, setProfileEditingDesc] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Inline auth state for own-profile access in online library
  const [authMode, setAuthMode] = useState("login");
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [registerUsername, setRegisterUsername] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [showAuthPanel, setShowAuthPanel] = useState(false);

  const setFilterValue = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // Fetch saves when modal opens
  const fetchSaves = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listNewestSharedSaves(100);
      setSaves(result);
    } catch (err) {
      console.error("Failed to load shared saves", err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchSaves();
    } else {
      // Reset state on close
      setTimeout(() => {
        setSaves([]);
        setError(null);
        setLoading(false);
        setSortMode("newest");
        setFiltersOpen(false);
        setSearchTerm("");
        setFilters({});
        setDeletingId(null);
        setBusyId(null);
        setProfileView(null);
        setProfileSaves([]);
        setProfileDesc("");
        setProfileDescDraft("");
        setProfileEditingDesc(false);
        setProfileLoading(false);
        setAuthMode("login");
        setEmailOrUsername("");
        setRegisterUsername("");
        setRegisterEmail("");
        setAuthPassword("");
        setAuthError("");
        setShowAuthPanel(false);
      }, 0);
    }
  }, [open, fetchSaves]);

  // Filtered + sorted saves
  const displaySaves = useMemo(() => {
    let list = [...saves];

    // Search by title or username
    const normalizedSearch = searchTerm.trim().toLowerCase();
    if (normalizedSearch) {
      list = list.filter(
        (s) =>
          (s.title ?? "").toLowerCase().includes(normalizedSearch) ||
          (s.ownerUsername ?? "").toLowerCase().includes(normalizedSearch),
      );
    }

    // Apply min-requirement filters (save visible if its value <= user threshold)
    for (const { key } of MIN_FILTER_FIELDS) {
      const threshold = toFinite(filters[key]);
      if (threshold !== null) {
        list = list.filter((s) => {
          const val = toFinite(s[key]);
          return val === null || val <= threshold;
        });
      }
    }

    // Apply final-stat filters (save visible if its value >= user threshold)
    for (const { key } of FINAL_FILTER_FIELDS) {
      const threshold = toFinite(filters[key]);
      if (threshold !== null) {
        list = list.filter((s) => {
          const val = toFinite(s[key]);
          return val !== null && val >= threshold;
        });
      }
    }

    // Sort
    const mode = SORT_MODES.find((m) => m.key === sortMode) ?? SORT_MODES[0];
    list.sort((a, b) => {
      let aVal, bVal;
      if (mode.field === "uploadedAt") {
        aVal = a.uploadedAt?.toMillis?.() ?? a.uploadedAt ?? 0;
        bVal = b.uploadedAt?.toMillis?.() ?? b.uploadedAt ?? 0;
      } else if (mode.field === "title") {
        aVal = (a.title ?? "").toLowerCase();
        bVal = (b.title ?? "").toLowerCase();
        if (aVal < bVal) return mode.dir === "desc" ? 1 : -1;
        if (aVal > bVal) return mode.dir === "desc" ? -1 : 1;
        return 0;
      } else {
        aVal = toFinite(a[mode.field]) ?? 0;
        bVal = toFinite(b[mode.field]) ?? 0;
      }
      return mode.dir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return list;
  }, [saves, searchTerm, filters, sortMode]);

  // ---- Actions ----

  const handleDownload = useCallback(
    async (save) => {
      if (busyId) return;
      setBusyId(save.id);
      try {
        const parsed = await downloadSharedSave(save.id);
        const blob = new Blob([JSON.stringify(parsed, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${save.title || "setup"}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (err) {
        console.error("Download failed", err);
        alert(t("onlineLibraryDownloadError"));
      } finally {
        setBusyId(null);
      }
    },
    [busyId, t],
  );

  const handleConfirmDelete = useCallback(
    async (save) => {
      if (!currentUid) return;
      setBusyId(save.id);
      try {
        await deleteSharedSave({ saveId: save.id, ownerUid: currentUid });
        setSaves((prev) => prev.filter((s) => s.id !== save.id));
        setDeletingId(null);
      } catch (err) {
        console.error("Delete failed", err);
        alert(t("onlineLibraryDeleteError"));
      } finally {
        setBusyId(null);
      }
    },
    [currentUid, t],
  );

  // ---- Helpers ----

  const isOwner = useCallback(
    (save) => currentUid && save.ownerUid === currentUid,
    [currentUid],
  );

  const statsForSave = useCallback((save) => {
    return {
      minimum: {
        money: save.minMoney,
        supplies: save.minSupplies,
        goods: save.minGoods,
        shardsUsed: save.minShardsUsed,
      },
      final: {
        attack: save.finalAttack,
        defense: save.finalDefense,
        totalQaSetup: save.finalTotalQaSetup,
        units: {
          Katapult: save.finalUnitKatapult ?? 0,
          Blide: save.finalUnitBlide ?? 0,
          Kanone: save.finalUnitKanone ?? 0,
        },
      },
    };
  }, []);

  // ---- Profile navigation ----

  const openProfile = useCallback(
    async (uid, username) => {
      setProfileView({ uid, username });
      setProfileLoading(true);
      setProfileEditingDesc(false);

      const userSaves = (saves || []).filter((s) => s.ownerUid === uid);
      let desc = "";

      if (uid === currentUid) {
        try {
          desc = await getProfileDescription(uid);
        } catch (err) {
          console.error("Failed to load profile description", err);
          desc = "";
        }
      }

      setProfileSaves(userSaves);
      setProfileDesc(desc);
      setProfileDescDraft(desc);
      setProfileLoading(false);
    },
    [currentUid, saves],
  );

  const closeProfile = useCallback(() => {
    setProfileView(null);
    setProfileSaves([]);
    setProfileDesc("");
    setProfileDescDraft("");
    setProfileEditingDesc(false);
    setProfileLoading(false);
  }, []);

  const handleSaveDescription = useCallback(async () => {
    if (!profileView || profileView.uid !== currentUid) return;
    setBusyId("profile-desc");
    try {
      await setProfileDescription(currentUid, profileDescDraft.trim());
      setProfileDesc(profileDescDraft.trim());
      setProfileEditingDesc(false);
    } catch (err) {
      console.error("Failed to save description", err);
      alert(t("onlineLibraryProfileDescError"));
    } finally {
      setBusyId(null);
    }
  }, [profileView, currentUid, profileDescDraft, t]);

  /**
   * Rename directly with a given new title (used by SavefileCard's onRename).
   */
  const handleConfirmRenameImmediate = useCallback(
    async (save, newTitle) => {
      const trimmed = newTitle.trim();
      if (!trimmed || trimmed === save.title) return;
      if (!currentUid) return;

      setBusyId(save.id);
      try {
        const existing = await findOwnSharedSaveByTitle({
          ownerUid: currentUid,
          title: trimmed,
        });
        if (existing && existing.id !== save.id) {
          alert(t("onlineLibraryRenameExists"));
          setBusyId(null);
          return;
        }
        await renameSharedSave({
          saveId: save.id,
          ownerUid: currentUid,
          newTitle: trimmed,
        });
        setSaves((prev) =>
          prev.map((s) =>
            s.id === save.id
              ? { ...s, title: trimmed, titleLower: trimmed.toLowerCase() }
              : s,
          ),
        );
      } catch (err) {
        console.error("Rename failed", err);
        alert(t("onlineLibraryRenameError"));
      } finally {
        setBusyId(null);
      }
    },
    [currentUid, t],
  );

  const handleOpenOwnProfile = useCallback(() => {
    if (!currentUid) {
      setShowAuthPanel((prev) => !prev);
      return;
    }
    setShowAuthPanel(false);
    openProfile(currentUid, currentUsername || "?");
  }, [currentUid, currentUsername, openProfile]);

  const claimFallbackUsername = useCallback(async (uid, emailValue) => {
    const base =
      String(emailValue ?? "user")
        .split("@")[0]
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_.-]/g, "") || "user";

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate =
        attempt === 0
          ? base
          : `${base}${Math.floor(Math.random() * 9000) + 1000}`;
      try {
        await claimUsername(uid, candidate, emailValue || "");
        return candidate;
      } catch {
        // try next candidate
      }
    }
    return "";
  }, []);

  const handleAuthSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      setAuthError("");
      try {
        if (authMode === "register") {
          const userCred = await createUserWithEmailAndPassword(
            auth,
            registerEmail.trim(),
            authPassword,
          );
          const desiredUsername = registerUsername.trim();
          if (desiredUsername) {
            await claimUsername(
              userCred.user.uid,
              desiredUsername,
              registerEmail.trim(),
            );
          }
          const actualUsername =
            desiredUsername || (await fetchProfileUsername(userCred.user.uid));
          setShowAuthPanel(false);
          await openProfile(userCred.user.uid, actualUsername || "?");
          setRegisterUsername("");
          setRegisterEmail("");
        } else {
          const result = await loginWithUsernameOrEmail(
            emailOrUsername.trim(),
            authPassword,
          );
          const username = await fetchProfileUsername(result.user.uid);
          setShowAuthPanel(false);
          await openProfile(
            result.user.uid,
            username || result.user.email || "?",
          );
          setEmailOrUsername("");
        }
        setAuthPassword("");
      } catch (err) {
        setAuthError(err?.message || "Authentication failed");
      }
    },
    [
      authMode,
      registerEmail,
      authPassword,
      registerUsername,
      emailOrUsername,
      openProfile,
    ],
  );

  const handleGoogleAuth = useCallback(async () => {
    setAuthError("");
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const uid = result.user.uid;
      const emailValue = result.user.email || "";
      let username = await fetchProfileUsername(uid);
      if (!username) {
        username = await claimFallbackUsername(uid, emailValue);
      }
      setShowAuthPanel(false);
      await openProfile(uid, username || emailValue || "?");
    } catch (err) {
      setAuthError(err?.message || "Google sign-in failed");
    }
  }, [claimFallbackUsername, openProfile]);

  if (!open) return null;

  const deletingSave = deletingId
    ? saves.find((s) => s.id === deletingId)
    : null;

  return (
    <div className="modal">
      <div className="modal-card online-library-modal">
        {/* Header */}
        <div className="help-header">
          <h3>{t("onlineLibraryTitle")}</h3>
          <button onClick={onClose}>{t("onlineLibraryClose")}</button>
        </div>

        {/* Toolbar: search + sort + filter toggle */}
        <div className="online-library-toolbar">
          <QiInput
            mode="text"
            fullWidth
            className="online-library-search"
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder={t("onlineLibrarySearchPlaceholder")}
            aria-label={t("onlineLibrarySearchPlaceholder")}
          />
          <div className="online-library-sort-group">
            <label className="online-library-sort-label" htmlFor="online-sort">
              {t("onlineLibrarySortLabel")}
            </label>
            <select
              id="online-sort"
              className="online-library-sort-select"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
            >
              {SORT_MODES.map((m) => (
                <option key={m.key} value={m.key}>
                  {t(SORT_LABEL_KEYS[m.key])}
                </option>
              ))}
            </select>
          </div>
          <button
            className={`online-library-filter-toggle ${filtersOpen ? "active" : ""}`}
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            <SlidersHorizontal size={14} />
            {t("onlineLibraryFilterTitle")}
          </button>
          <button
            className="online-library-toolbar-btn"
            onClick={handleOpenOwnProfile}
            title={t("onlineLibraryOpenOwnProfile")}
          >
            <User size={16} />
          </button>
        </div>

        {/* Filter section */}
        {filtersOpen && (
          <div className="online-library-filters">
            <div className="online-library-filter-group">
              <div className="online-library-filter-group-title">
                {t("onlineLibraryFilterMinLabel")}
              </div>
              <div className="online-library-filter-grid">
                {MIN_FILTER_FIELDS.map(({ key, labelKey, icon, isBoost }) => (
                  <div key={key} className="online-library-filter-field">
                    <img
                      src={icon}
                      alt={t(labelKey)}
                      title={t(labelKey)}
                      className={`online-library-filter-icon${isBoost ? " boost-icon" : ""}`}
                    />
                    <QiInput
                      mode="number"
                      className="online-library-filter-input"
                      value={filters[key] ?? ""}
                      onChange={(v) =>
                        setFilterValue(key, v === 0 && !filters[key] ? "" : v)
                      }
                      min={0}
                      allowNegative={false}
                      placeholder="-"
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="online-library-filter-group">
              <div className="online-library-filter-group-title">
                {t("onlineLibraryFilterFinalLabel")}
              </div>
              <div className="online-library-filter-grid">
                {FINAL_FILTER_FIELDS.map(({ key, labelKey, icon }) => (
                  <div key={key} className="online-library-filter-field">
                    <img
                      src={icon}
                      alt={t(labelKey)}
                      title={t(labelKey)}
                      className="online-library-filter-icon"
                    />
                    <QiInput
                      mode="number"
                      className="online-library-filter-input"
                      value={filters[key] ?? ""}
                      onChange={(v) =>
                        setFilterValue(key, v === 0 && !filters[key] ? "" : v)
                      }
                      min={0}
                      allowNegative={false}
                      placeholder="-"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Save list */}
        <div className="online-library-list">
          {loading && saves.length === 0 && (
            <div className="online-library-status">
              {t("onlineLibraryLoading")}
            </div>
          )}
          {error && (
            <div className="online-library-status online-library-error">
              <span>{t("onlineLibraryError")}</span>
              <button className="online-library-retry-btn" onClick={fetchSaves}>
                {t("onlineLibraryRetry")}
              </button>
            </div>
          )}
          {!loading && !error && !profileView && displaySaves.length === 0 && (
            <div className="online-library-status">
              {t("onlineLibraryEmpty")}
            </div>
          )}

          {showAuthPanel && (
            <div className="online-library-auth-panel">
              <div className="online-library-auth-toggle">
                <button
                  type="button"
                  className={authMode === "login" ? "active" : ""}
                  onClick={() => setAuthMode("login")}
                >
                  {t("onlineAuthSignIn")}
                </button>
                <button
                  type="button"
                  className={authMode === "register" ? "active" : ""}
                  onClick={() => setAuthMode("register")}
                >
                  {t("onlineAuthSignUp")}
                </button>
              </div>

              <form
                className="online-library-auth-form"
                onSubmit={handleAuthSubmit}
                autoComplete="on"
              >
                <div className="online-library-auth-grid">
                  {authMode === "register" && (
                    <QiInput
                      mode="text"
                      fullWidth
                      value={registerUsername}
                      onChange={setRegisterUsername}
                      placeholder={t("onlineAuthUsername")}
                      name="username"
                      autoComplete="username"
                    />
                  )}

                  <QiInput
                    mode="text"
                    type={authMode === "register" ? "email" : "text"}
                    fullWidth
                    value={
                      authMode === "register" ? registerEmail : emailOrUsername
                    }
                    onChange={
                      authMode === "register"
                        ? setRegisterEmail
                        : setEmailOrUsername
                    }
                    placeholder={
                      authMode === "register"
                        ? t("onlineAuthEmail")
                        : t("onlineAuthIdentifier")
                    }
                    name={authMode === "register" ? "email" : "username"}
                    autoComplete={
                      authMode === "register" ? "email" : "username"
                    }
                  />

                  <QiInput
                    mode="text"
                    type="password"
                    fullWidth
                    value={authPassword}
                    onChange={setAuthPassword}
                    placeholder={t("onlineAuthPassword")}
                    name={
                      authMode === "register"
                        ? "new-password"
                        : "current-password"
                    }
                    autoComplete={
                      authMode === "register"
                        ? "new-password"
                        : "current-password"
                    }
                  />
                </div>

                {authError ? (
                  <div className="online-library-auth-error">{authError}</div>
                ) : null}

                <div className="online-library-auth-actions">
                  <button type="submit" className="online-library-auth-submit">
                    {authMode === "register"
                      ? t("onlineAuthCreate")
                      : t("onlineAuthLogin")}
                  </button>
                  <button
                    type="button"
                    className="online-library-auth-google"
                    onClick={handleGoogleAuth}
                  >
                    <span className="online-library-auth-google-glyph">G</span>
                    <span>{t("onlineAuthGoogle")}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Profile view */}
          {profileView && (
            <>
              <div
                className="online-library-status"
                style={{ gridColumn: "1 / -1", padding: "0 0 6px" }}
              >
                <div className="online-library-profile-header">
                  <button
                    className="online-library-profile-back"
                    onClick={closeProfile}
                  >
                    <ArrowLeft size={14} /> {t("onlineLibraryProfileBack")}
                  </button>
                  <span className="online-library-profile-title">
                    {profileView.username || "?"}
                  </span>
                  {profileView.uid === currentUid && (
                    <button
                      className="online-library-profile-upload"
                      onClick={() => logout?.()}
                      title={t("onlineLibraryProfileLogout")}
                    >
                      {t("onlineLibraryProfileLogout")}
                    </button>
                  )}
                </div>
                {profileLoading ? (
                  <div
                    style={{
                      padding: "12px 0",
                      color: "var(--color-text-muted)",
                      fontSize: "0.9em",
                    }}
                  >
                    {t("onlineLibraryLoading")}
                  </div>
                ) : (
                  <>
                    {profileView.uid === currentUid && profileEditingDesc ? (
                      <div>
                        <textarea
                          className="online-library-profile-edit-desc"
                          value={profileDescDraft}
                          onChange={(e) => setProfileDescDraft(e.target.value)}
                          maxLength={500}
                          placeholder={t("onlineLibraryProfileDescPlaceholder")}
                        />
                        <div className="online-library-profile-actions">
                          <button
                            className="load-saves-action-btn export-btn"
                            onClick={handleSaveDescription}
                            disabled={busyId === "profile-desc"}
                            title={t("onlineLibraryProfileDescSave")}
                          >
                            <Save size={14} />{" "}
                            {t("onlineLibraryProfileDescSave")}
                          </button>
                          <button
                            className="load-saves-action-btn"
                            onClick={() => {
                              setProfileDescDraft(profileDesc);
                              setProfileEditingDesc(false);
                            }}
                            title={t("loadSavesBtnCancel")}
                          >
                            <X size={14} /> {t("loadSavesBtnCancel")}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="online-library-profile-desc"
                        onClick={
                          profileView.uid === currentUid
                            ? () => setProfileEditingDesc(true)
                            : undefined
                        }
                        style={
                          profileView.uid === currentUid
                            ? { cursor: "pointer" }
                            : undefined
                        }
                        title={
                          profileView.uid === currentUid
                            ? t("onlineLibraryProfileDescEdit")
                            : undefined
                        }
                      >
                        {profileDesc ||
                          (profileView.uid === currentUid
                            ? t("onlineLibraryProfileDescPlaceholder")
                            : t("onlineLibraryProfileNoDesc"))}
                      </div>
                    )}
                  </>
                )}
              </div>
              {profileSaves.map((save) => {
                const owner = isOwner(save);
                const busy = busyId === save.id;
                const stats = statsForSave(save);
                const impossible = isSharedSaveImpossible(save, userConfig);
                const minimumViolations = getSharedSaveMinimumViolations(
                  save,
                  userConfig,
                );
                return (
                  <SavefileCard
                    key={save.id}
                    title={save.title}
                    isOwned={owner}
                    impossible={impossible}
                    stats={stats}
                    minimumViolations={minimumViolations}
                    ownerUsername={!owner ? save.ownerUsername : undefined}
                    ownerUid={!owner ? save.ownerUid : undefined}
                    timestamp={save.updatedAt ?? save.uploadedAt}
                    onLoad={() => handleDownload(save)}
                    onRename={
                      owner
                        ? (newName) =>
                            handleConfirmRenameImmediate(save, newName)
                        : undefined
                    }
                    onExport={() => handleDownload(save)}
                    onDelete={owner ? () => setDeletingId(save.id) : undefined}
                    onProfileClick={openProfile}
                    busy={busy}
                  />
                );
              })}
              {!profileLoading && profileSaves.length === 0 && (
                <div className="online-library-status">
                  {t("onlineLibraryProfileNoSaves")}
                </div>
              )}
            </>
          )}

          {/* Main listing */}
          {!profileView &&
            displaySaves.map((save) => {
              const owner = isOwner(save);
              const busy = busyId === save.id;
              const stats = statsForSave(save);
              const impossible = isSharedSaveImpossible(save, userConfig);
              const minimumViolations = getSharedSaveMinimumViolations(
                save,
                userConfig,
              );
              return (
                <SavefileCard
                  key={save.id}
                  title={save.title}
                  isOwned={owner}
                  impossible={impossible}
                  stats={stats}
                  minimumViolations={minimumViolations}
                  ownerUsername={!owner ? save.ownerUsername : undefined}
                  ownerUid={!owner ? save.ownerUid : undefined}
                  timestamp={save.updatedAt ?? save.uploadedAt}
                  onLoad={() => handleDownload(save)}
                  onRename={
                    owner
                      ? (newName) => handleConfirmRenameImmediate(save, newName)
                      : undefined
                  }
                  onExport={() => handleDownload(save)}
                  onDelete={owner ? () => setDeletingId(save.id) : undefined}
                  onProfileClick={openProfile}
                  busy={busy}
                />
              );
            })}
        </div>

        {/* Note about 0% boosts */}
        <div className="online-library-note">
          <span className="online-library-note-icon impossible-square" />
          <span>= {t("onlineLibraryNoteImpossible")}</span>
          <span className="online-library-note-separator">|</span>
          <img src={moneyIcon} alt="" className="online-library-note-icon" />
          <img src={suppliesIcon} alt="" className="online-library-note-icon" />
          <span>{t("onlineLibraryNoteBoosts")}</span>
        </div>
      </div>

      {/* Delete confirmation */}
      {deletingSave && (
        <div className="modal modal-overlay">
          <div className="modal-card modal-confirm-delete">
            <div className="help-header">
              <h3>{t("onlineLibraryBtnDelete")}</h3>
            </div>
            <div className="modal-body">
              <p>
                {t("onlineLibraryDeletePrompt").replace(
                  "{name}",
                  deletingSave.title,
                )}
              </p>
            </div>
            <div className="modal-actions">
              <button
                className="btn-confirm-delete"
                onClick={() => handleConfirmDelete(deletingSave)}
                disabled={busyId === deletingSave.id}
              >
                {t("onlineLibraryBtnDelete")}
              </button>
              <button
                className="btn-cancel-delete"
                onClick={() => setDeletingId(null)}
              >
                {t("loadSavesBtnCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
