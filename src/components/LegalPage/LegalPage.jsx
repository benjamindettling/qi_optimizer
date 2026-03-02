import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { LanguageToggle } from "../LanguageToggle/LanguageToggle";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import "./LegalPage.css";

const LEGAL_ROUTE_MAP = {
  contact: "/contact",
  imprint: "/imprint",
  privacy: "/privacy",
};

function resolveBackTarget(stateFrom) {
  if (stateFrom === "/simulator") return "/simulator";
  return "/";
}

export function LegalPage({ type = "contact" }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  const currentPath = LEGAL_ROUTE_MAP[type] || "/contact";
  const rawFrom = location.state?.from;
  const from =
    typeof rawFrom === "string" &&
    rawFrom &&
    rawFrom !== currentPath &&
    !Object.values(LEGAL_ROUTE_MAP).includes(rawFrom)
      ? rawFrom
      : null;
  const backTarget = resolveBackTarget(from);

  return (
    <div className="legal-page">
      <LanguageToggle className="starting-page-lang-btn" />

      <main className="legal-page-content">
        <button
          type="button"
          className="legal-page-back"
          onClick={() => navigate(backTarget)}
          aria-label={t("legalBackAria")}
          title={t("legalBackAria")}
        >
          <ArrowLeft size={18} />
          <span>{t("legalBack")}</span>
        </button>

        {type === "contact" && (
          <section className="legal-card">
            <h1>{t("legalContactTitle")}</h1>
            <p>{t("legalContactIntro")}</p>
            <div className="legal-card-block">
              <p>
                <strong>{t("legalContactNameLabel")}:</strong> Benjamin Dettling
              </p>
              <p>
                <strong>{t("legalContactEmailLabel")}:</strong>{" "}
                benjamin@benjamindettling.ch
              </p>
              <p>
                <strong>{t("legalContactResponseLabel")}:</strong>{" "}
                {t("legalContactResponseValue")}
              </p>
            </div>
            <p className="legal-note">{t("legalContactPrivateNote")}</p>
          </section>
        )}

        {type === "imprint" && (
          <section className="legal-card">
            <h1>{t("legalImprintTitle")}</h1>
            <p>{t("legalImprintIntro")}</p>
            <div className="legal-card-block">
              <p>
                <strong>{t("legalContactNameLabel")}:</strong> Benjamin Dettling
              </p>
              <p>
                <strong>{t("legalImprintAddressLabel")}:</strong>{" "}
                {t("legalImprintAddressValue")}
              </p>
              <p>
                <strong>{t("legalContactEmailLabel")}:</strong>{" "}
                benjamin@benjamindettling.ch
              </p>
            </div>
            <div className="legal-card-block">
              <p>
                <strong>{t("legalImprintContentOwnerLabel")}:</strong>
              </p>
              <p>Benjamin Dettling, {t("legalImprintAddressValue")}</p>
            </div>
            <p className="legal-note">{t("legalImprintNoCompany")}</p>
          </section>
        )}

        {type === "privacy" && (
          <section className="legal-card">
            <h1>{t("legalPrivacyTitle")}</h1>
            <p>{t("legalPrivacyIntro")}</p>

            <h2>{t("accountPrivacyDataTitle")}</h2>
            <ul>
              <li>{t("legalPrivacyDataPoint1")}</li>
              <li>{t("legalPrivacyDataPoint2")}</li>
              <li>{t("legalPrivacyDataPoint3")}</li>
            </ul>

            <h2>{t("accountPrivacyPurposeTitle")}</h2>
            <ul>
              <li>{t("legalPrivacyPurposePoint1")}</li>
              <li>{t("legalPrivacyPurposePoint2")}</li>
              <li>{t("legalPrivacyPurposePoint3")}</li>
            </ul>

            <h2>{t("accountPrivacyContactTitle")}</h2>
            <div className="legal-card-block">
              <p>
                <strong>{t("legalContactNameLabel")}:</strong> Benjamin Dettling
              </p>
              <p>
                <strong>{t("legalContactEmailLabel")}:</strong>{" "}
                [datenschutz@example.com]
              </p>
            </div>
            <p className="legal-note">{t("legalPrivacyPlaceholderNote")}</p>
          </section>
        )}
      </main>
    </div>
  );
}
