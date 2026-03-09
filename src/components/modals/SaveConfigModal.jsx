import { useMemo, useState } from "react";
import moneyIcon from "/money.webp";
import suppliesIcon from "/supplies.webp";
import goodsIcon from "/goods/Kupfer.webp";
import troopIcon from "/troop.webp";
import shardsIcon from "/shards.webp";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { QiInput } from "../common/QiInput";
import {
  analyzeSmallestSaveConfig,
  extractSaveConfig,
} from "../../utils/saveConfig";
import "./SaveConfigModal.css";

const SAVE_CONFIG_LABEL_KEYS = {
  extraCoins: "saveConfigExtraCoins",
  extraSupplies: "saveConfigExtraSupplies",
  goodsStartBonus: "saveConfigExtraGoods",
  troopsStartBonus: "saveConfigExtraTroops",
  shardsLimit: "saveConfigStartShards",
  coinBoost: "saveConfigCoinBoost",
  supplyBoost: "saveConfigSupplyBoost",
};

const SAFE_COMPARE_FIELDS = [
  "extraCoins",
  "extraSupplies",
  "goodsStartBonus",
  "shardsLimit",
];

const Label = ({ icon, text }) => (
  <span className="config-label">
    {icon && <img src={icon} alt="" className="config-icon" />}
    <span>{text}</span>
  </span>
);

export function SaveConfigModal({
  open,
  saveName,
  saveEntry,
  saveConfig,
  userConfig,
  onClose,
  onSave,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const initialDraft = useMemo(
    () => extractSaveConfig(saveConfig),
    [saveConfig],
  );
  const resetKey = useMemo(
    () =>
      `${saveName || ""}|${JSON.stringify(saveConfig || {})}|${
        saveEntry?.syncUser === true ? "1" : "0"
      }`,
    [saveConfig, saveEntry?.syncUser, saveName],
  );
  const [draft, setDraft] = useState(initialDraft);
  const [lastResetKey, setLastResetKey] = useState(resetKey);
  const [warningItems, setWarningItems] = useState([]);
  const [pendingUserDraft, setPendingUserDraft] = useState(null);
  const [draftSyncUser, setDraftSyncUser] = useState(
    saveEntry?.syncUser === true,
  );

  if (resetKey !== lastResetKey) {
    setLastResetKey(resetKey);
    setDraft(extractSaveConfig(saveConfig));
    setWarningItems([]);
    setPendingUserDraft(null);
    setDraftSyncUser(saveEntry?.syncUser === true);
  }

  const updateField = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setDraftSyncUser(false);
  };

  const handleSave = () => {
    onSave?.(draft, { syncUser: draftSyncUser });
    onClose?.();
  };

  const runSmallestConfig = () =>
    analyzeSmallestSaveConfig({
      treeData: saveEntry?.tree,
      draftConfig: draft,
      fallbackConfig: userConfig,
    });

  const handleFindSmallestConfig = () => {
    const result = runSmallestConfig();
    if (!result) {
      alert(t("saveConfigMinUnsupported"));
      return;
    }
    setPendingUserDraft(null);
    setWarningItems([]);
    setDraft(result.adjustedConfig);
    setDraftSyncUser(false);
  };

  const handleApplyUserConfig = () => {
    const result = runSmallestConfig();
    if (!result) {
      alert(t("saveConfigMinUnsupported"));
      return;
    }

    const minimizedDraft = result.adjustedConfig;
    const nextUserDraft = extractSaveConfig(userConfig);
    const criticalItems = SAFE_COMPARE_FIELDS.filter(
      (field) => (nextUserDraft[field] ?? 0) < (minimizedDraft[field] ?? 0),
    ).map((field) => ({
      field,
      label: t(SAVE_CONFIG_LABEL_KEYS[field]),
      safeValue: minimizedDraft[field] ?? 0,
      userValue: nextUserDraft[field] ?? 0,
    }));

    setDraft(minimizedDraft);

    if (criticalItems.length > 0) {
      setWarningItems(criticalItems);
      setPendingUserDraft(nextUserDraft);
      return;
    }

    setPendingUserDraft(null);
    setWarningItems([]);
    setDraft(nextUserDraft);
    setDraftSyncUser(true);
  };

  const handleConfirmApplyUserConfig = () => {
    if (pendingUserDraft) {
      setDraft(pendingUserDraft);
    }
    setDraftSyncUser(true);
    setPendingUserDraft(null);
    setWarningItems([]);
  };

  const handleCancelWarning = () => {
    setPendingUserDraft(null);
    setWarningItems([]);
  };

  if (!open) return null;

  return (
    <div className="modal">
      <div className="modal-card save-config-modal">
        <div className="help-header">
          <h3>
            {t("saveConfigModalTitle")}: {saveName}
          </h3>
          <button onClick={onClose}>{t("saveConfigClose")}</button>
        </div>

        <div className="save-config-content">
          <div className="config-grid">
            <label className="config-row">
              <Label icon={moneyIcon} text={t("saveConfigExtraCoins")} />
              <QiInput
                mode="number"
                className="config-input"
                value={draft.extraCoins ?? 0}
                min={0}
                onChange={(nextValue) => updateField("extraCoins", nextValue)}
              />
            </label>
            <label className="config-row">
              <Label icon={suppliesIcon} text={t("saveConfigExtraSupplies")} />
              <QiInput
                mode="number"
                className="config-input"
                value={draft.extraSupplies ?? 0}
                min={0}
                onChange={(nextValue) => updateField("extraSupplies", nextValue)}
              />
            </label>
            <label className="config-row">
              <Label icon={goodsIcon} text={t("saveConfigExtraGoods")} />
              <QiInput
                mode="number"
                className="config-input"
                value={draft.goodsStartBonus ?? 0}
                min={0}
                onChange={(nextValue) => updateField("goodsStartBonus", nextValue)}
              />
            </label>
            <label className="config-row">
              <Label icon={troopIcon} text={t("saveConfigExtraTroops")} />
              <QiInput
                mode="number"
                className="config-input"
                value={draft.troopsStartBonus ?? 0}
                min={0}
                onChange={(nextValue) => updateField("troopsStartBonus", nextValue)}
              />
            </label>
            <label className="config-row">
              <Label icon={shardsIcon} text={t("saveConfigStartShards")} />
              <QiInput
                mode="number"
                className="config-input"
                value={draft.shardsLimit ?? 500}
                min={0}
                onChange={(nextValue) => updateField("shardsLimit", nextValue)}
              />
            </label>
            <label className="config-row">
              <Label icon={moneyIcon} text={t("saveConfigCoinBoost")} />
              <QiInput
                mode="number"
                className="config-input"
                value={draft.coinBoost ?? 0}
                min={0}
                onChange={(nextValue) => updateField("coinBoost", nextValue)}
              />
            </label>
            <label className="config-row">
              <Label icon={suppliesIcon} text={t("saveConfigSupplyBoost")} />
              <QiInput
                mode="number"
                className="config-input"
                value={draft.supplyBoost ?? 0}
                min={0}
                onChange={(nextValue) => updateField("supplyBoost", nextValue)}
              />
            </label>
          </div>

          <div className="save-config-secondary-actions">
            <button
              className="save-config-secondary-btn"
              onClick={handleFindSmallestConfig}
            >
              {t("saveConfigFindSmallest")}
            </button>
          </div>
        </div>

        <div className="save-config-actions">
          <button
            className="save-config-user-btn"
            onClick={handleApplyUserConfig}
          >
            {t("saveConfigApplyUser")}
          </button>
          <button className="save-config-save-btn" onClick={handleSave}>
            {t("startConfigSave")}
          </button>
          <button className="save-config-cancel-btn" onClick={onClose}>
            {t("startConfigCancel")}
          </button>
        </div>
      </div>

      {warningItems.length > 0 && (
        <div className="modal modal-overlay">
          <div className="modal-card save-config-warning-modal">
            <div className="help-header">
              <h3>{t("saveConfigConflictTitle")}</h3>
            </div>

            <div className="save-config-warning-body">
              <p>{t("saveConfigConflictIntro")}</p>
              <div className="save-config-warning-list">
                {warningItems.map((item) => (
                  <div key={item.field} className="save-config-warning-item">
                    <strong>{item.label}</strong>
                    <span>
                      {t("saveConfigConflictSaveValue")}: {item.safeValue}
                    </span>
                    <span>
                      {t("saveConfigConflictUserValue")}: {item.userValue}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="save-config-actions">
              <button
                className="save-config-danger-btn"
                onClick={handleConfirmApplyUserConfig}
              >
                {t("saveConfigConflictProceed")}
              </button>
              <button
                className="save-config-cancel-btn"
                onClick={handleCancelWarning}
              >
                {t("startConfigCancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
