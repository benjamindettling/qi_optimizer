import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { DEFAULT_CONFIG } from "../../config/gameDefaults";
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
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { TUTORIAL_DE, TUTORIAL_EN } from "../../i18n/tutorialContent";
import { LanguageToggle } from "../LanguageToggle/LanguageToggle";
import "./StartingPage.css";

const Label = ({ icon, text }) => (
  <span className="config-label">
    {icon ? <img src={icon} alt={text} className="inline-icon" /> : null}
    <span>{text}</span>
  </span>
);

const NUMBER_PROPS = {
  type: "number",
  inputMode: "numeric",
  className: "config-input",
  onFocus: (e) => e.target.select(),
};

const normalizeTextPair = (textPair) => {
  if (!textPair || typeof textPair !== "object") {
    const fallback = String(textPair ?? "");
    return { DE: fallback, EN: fallback };
  }
  const de = String(textPair.DE ?? "");
  const en = String(textPair.EN ?? de);
  return { DE: de, EN: en };
};

function StableLocalizedText({ textPair, lang, className = "" }) {
  const { DE, EN } = normalizeTextPair(textPair);
  const visibleText = lang === "EN" ? EN : DE;

  return (
    <span className={`i18n-stable ${className}`.trim()}>
      <span className="i18n-stable-measure" aria-hidden="true">
        <span>{DE}</span>
        <span>{EN}</span>
      </span>
      <span className="i18n-stable-visible">{visibleText}</span>
    </span>
  );
}

function ConfigSetupModal({ config, onSave, onCancel, lang }) {
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const initialDraft = useMemo(() => ({ ...config }), [config]);
  const [draft, setDraft] = useState(initialDraft);

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
    return fields.some((f) => (config[f] ?? 0) !== 0);
  }, [config]);

  const updateField = (key, val) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  let confirmLabel = t("startConfigConfirmSkip");
  if (hasChanges) {
    confirmLabel = t("startConfigConfirmSaveAndContinue");
  } else if (hasExistingConfig) {
    confirmLabel = t("startConfigConfirmContinue");
  }

  return (
    <div className="modal">
      <div className="modal-card config-setup-modal">
        <div className="config-setup-content">
          <h3>{t("startConfigTitle")}</h3>
          <p className="config-setup-subtitle">{t("startConfigSubtitle")}</p>

          <div className="config-setup-body">
            <div className="config-grid">
              <label className="config-row">
                <Label icon={moneyIcon} text={t("configLabelExtraCoins")} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.extraCoins ?? 0}
                  onChange={(e) =>
                    updateField("extraCoins", Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="config-row">
                <Label
                  icon={suppliesIcon}
                  text={t("configLabelExtraSupplies")}
                />
                <input
                  {...NUMBER_PROPS}
                  value={draft.extraSupplies ?? 0}
                  onChange={(e) =>
                    updateField("extraSupplies", Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="config-row">
                <Label icon={goodsIcon} text={t("configLabelExtraGoods")} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.goodsStartBonus ?? 0}
                  onChange={(e) =>
                    updateField("goodsStartBonus", Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="config-row">
                <Label icon={troopIcon} text={t("configLabelExtraTroops")} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.troopsStartBonus ?? 0}
                  onChange={(e) =>
                    updateField("troopsStartBonus", Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="config-row">
                <Label icon={shardsIcon} text={t("configLabelShardsStart")} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.shardsStart ?? 500}
                  onChange={(e) =>
                    updateField("shardsStart", Number(e.target.value) || 0)
                  }
                />
              </label>

              <label className="config-row">
                <Label icon={moneyIcon} text={t("configLabelCoinBoost")} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.coinBoost ?? 0}
                  onChange={(e) =>
                    updateField("coinBoost", Number(e.target.value) || 0)
                  }
                />
              </label>
              <label className="config-row">
                <Label icon={suppliesIcon} text={t("configLabelSupplyBoost")} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.supplyBoost ?? 0}
                  onChange={(e) =>
                    updateField("supplyBoost", Number(e.target.value) || 0)
                  }
                />
              </label>

              <div className="config-row army-row">
                <Label icon={redAttackIcon} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.redAttackBoost ?? 0}
                  onChange={(e) =>
                    updateField("redAttackBoost", Number(e.target.value) || 0)
                  }
                  title={t("accountConfigRedAttack")}
                />
                <span className="army-unit">%</span>
                <Label icon={redDefenseIcon} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.redDefenseBoost ?? 0}
                  onChange={(e) =>
                    updateField("redDefenseBoost", Number(e.target.value) || 0)
                  }
                  title={t("accountConfigRedDefense")}
                />
                <span className="army-unit">%</span>
              </div>

              <div className="config-row army-row">
                <Label icon={blueAttackIcon} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.blueAttackBoost ?? 0}
                  onChange={(e) =>
                    updateField("blueAttackBoost", Number(e.target.value) || 0)
                  }
                  title={t("accountConfigBlueAttack")}
                />
                <span className="army-unit">%</span>
                <Label icon={blueDefenseIcon} />
                <input
                  {...NUMBER_PROPS}
                  value={draft.blueDefenseBoost ?? 0}
                  onChange={(e) =>
                    updateField("blueDefenseBoost", Number(e.target.value) || 0)
                  }
                  title={t("accountConfigBlueDefense")}
                />
                <span className="army-unit">%</span>
              </div>

              <div className="config-row">
                <Label text={t("configLabelFightColor")} />
                <div className="preference-buttons">
                  <button
                    className={draft.fightColor !== "blau" ? "active" : ""}
                    onClick={() => updateField("fightColor", "rot")}
                    type="button"
                  >
                    {t("colorRed")}
                  </button>
                  <button
                    className={draft.fightColor === "blau" ? "active" : ""}
                    onClick={() => updateField("fightColor", "blau")}
                    type="button"
                  >
                    {t("colorBlue")}
                  </button>
                </div>
              </div>

              <label className="config-row">
                <Label icon={qaIcon} text={t("configLabelQaPerHour")} />
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
            <button type="button" onClick={() => onSave(draft)}>
              {confirmLabel}
            </button>
            <button type="button" onClick={onCancel}>
              {t("startConfigCancel")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function StartingPage({
  config,
  updateConfig,
  onStartSimulator,
  onOpenSaves,
  onOpenAccount,
  onStartTutorial,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const [showConfigSetup, setShowConfigSetup] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
      onStartSimulator();
    } else {
      setShowConfigSetup(true);
    }
  };

  const openAccountTab = (tabKey = "account") => {
    onOpenAccount?.(tabKey);
  };

  const openLegalPage = (path) => {
    navigate(path, { state: { from: location.pathname || "/" } });
  };

  return (
    <>
      <div className="starting-page">
        <LanguageToggle className="starting-page-lang-btn" />

        <div className="starting-page-main">
          <div className="starting-page-hero">
            <h1>
              <StableLocalizedText textPair={T.startTitle} lang={lang} />
            </h1>
            <p className="starting-page-hero-subtitle">
              <StableLocalizedText textPair={T.startSubtitle} lang={lang} />
            </p>
            <p className="starting-page-hero-text">
              <StableLocalizedText textPair={T.startHeroText} lang={lang} />
            </p>
          </div>

          <div className="starting-page-actions">
            <button className="btn-start" onClick={handleStartClick} type="button">
              <StableLocalizedText
                textPair={T.startOpenSimulator}
                lang={lang}
                className="starting-page-btn-label"
              />
            </button>
            <button className="btn-secondary" onClick={onOpenSaves} type="button">
              <StableLocalizedText
                textPair={T.startSecondarySaves}
                lang={lang}
                className="starting-page-btn-label"
              />
            </button>
            <button
              className="btn-secondary"
              onClick={() => openAccountTab("account")}
              type="button"
            >
              <StableLocalizedText
                textPair={T.startSecondarySettings}
                lang={lang}
                className="starting-page-btn-label"
              />
            </button>
            <button className="btn-secondary" onClick={onStartTutorial} type="button">
              <StableLocalizedText
                textPair={T.tutorialStart}
                lang={lang}
                className="starting-page-btn-label"
              />
            </button>
          </div>
        </div>

        <section className="starting-page-tutorial" aria-label={t("startFooterTutorialAria")}>
          {lang === "EN" ? TUTORIAL_EN : TUTORIAL_DE}
        </section>

        <footer className="starting-page-footer" aria-label={t("startFooterLegalAria")}>
          <button
            type="button"
            className="starting-page-footer-link"
            onClick={() => openLegalPage("/contact")}
          >
            {t("accountTabContact")}
          </button>
          <span className="starting-page-footer-separator" aria-hidden="true">
            |
          </span>
          <button
            type="button"
            className="starting-page-footer-link"
            onClick={() => openLegalPage("/imprint")}
          >
            {t("accountTabImprint")}
          </button>
          <span className="starting-page-footer-separator" aria-hidden="true">
            |
          </span>
          <button
            type="button"
            className="starting-page-footer-link"
            onClick={() => openLegalPage("/privacy")}
          >
            {t("accountTabPrivacy")}
          </button>
        </footer>
      </div>

      {showConfigSetup && (
        <ConfigSetupModal
          config={config}
          onSave={(draft) => {
            updateConfig(draft);
            setShowConfigSetup(false);
            onStartSimulator();
          }}
          onCancel={() => setShowConfigSetup(false)}
          lang={lang}
        />
      )}
    </>
  );
}

