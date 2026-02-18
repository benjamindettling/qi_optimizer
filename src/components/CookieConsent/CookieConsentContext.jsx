import { useState, useCallback, useEffect } from "react";
import { CookieConsentContext } from "./cookieConsentStore";

const STORAGE_KEY = "qi_cookie_consent"; // "granted" | "denied"

/**
 * Dynamically injects the Google AdSense <script> tag once,
 * only after the user has granted cookie consent.
 */
function loadAdSenseScript() {
  const CLIENT_ID =
    import.meta.env.VITE_ADSENSE_CLIENT || "ca-pub-XXXXXXXXXXXXXXXX";

  if (document.querySelector('script[src*="adsbygoogle"]')) return; // already loaded

  const script = document.createElement("script");
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${CLIENT_ID}`;
  script.async = true;
  script.crossOrigin = "anonymous";
  document.head.appendChild(script);
}

export function CookieConsentProvider({ children }) {
  const [consent, setConsent] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "granted" || stored === "denied") return stored;
    } catch {
      /* ignore */
    }
    return "pending";
  });

  // Whenever consent becomes "granted", load the AdSense script
  useEffect(() => {
    if (consent === "granted") {
      loadAdSenseScript();
    }
  }, [consent]);

  const grantConsent = useCallback(() => {
    setConsent("granted");
    try {
      localStorage.setItem(STORAGE_KEY, "granted");
    } catch {
      /* ignore */
    }
  }, []);

  const denyConsent = useCallback(() => {
    setConsent("denied");
    try {
      localStorage.setItem(STORAGE_KEY, "denied");
    } catch {
      /* ignore */
    }
  }, []);

  const resetConsent = useCallback(() => {
    setConsent("pending");
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <CookieConsentContext.Provider
      value={{ consent, grantConsent, denyConsent, resetConsent }}
    >
      {children}
    </CookieConsentContext.Provider>
  );
}
