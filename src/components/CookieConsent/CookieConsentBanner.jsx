import { useCookieConsent } from "./cookieConsentStore";
import "./CookieConsentBanner.css";

/**
 * GDPR-style cookie consent banner.
 * Shown at the bottom of the screen when consent is still "pending".
 */
export function CookieConsentBanner() {
  const { consent, grantConsent, denyConsent } = useCookieConsent();

  if (consent !== "pending") return null;

  return (
    <div className="cookie-banner-backdrop">
      <div className="cookie-banner">
        <div className="cookie-banner-text">
          <strong>Cookies &amp; Werbung</strong>
          <p>
            Diese Seite verwendet Cookies von Google AdSense, um personalisierte
            Werbung anzuzeigen. Dabei werden Daten an Google übermittelt. Du
            kannst der Nutzung zustimmen oder sie ablehnen.
          </p>
          <p className="cookie-banner-detail">
            Weitere Informationen findest du in der{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
            >
              Datenschutzerklärung von Google
            </a>
            .
          </p>
        </div>
        <div className="cookie-banner-actions">
          <button
            className="cookie-btn cookie-btn-accept"
            onClick={grantConsent}
          >
            Akzeptieren
          </button>
          <button className="cookie-btn cookie-btn-deny" onClick={denyConsent}>
            Ablehnen
          </button>
        </div>
      </div>
    </div>
  );
}
