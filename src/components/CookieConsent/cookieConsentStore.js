import { createContext, useContext } from "react";

export const CookieConsentContext = createContext({
  /** "pending" | "granted" | "denied" */
  consent: "pending",
  grantConsent: () => {},
  denyConsent: () => {},
  resetConsent: () => {},
});

export function useCookieConsent() {
  return useContext(CookieConsentContext);
}
