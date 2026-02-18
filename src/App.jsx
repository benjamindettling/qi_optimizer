import "./index.css";
import { AppRoot } from "./app/AppRoot";
import { CookieConsentBanner } from "./components/CookieConsent";

export default function App() {
  return (
    <>
      <AppRoot />
      <CookieConsentBanner />
    </>
  );
}
