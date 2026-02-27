import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthProvider";
import { CookieConsentProvider } from "./components/CookieConsent";
import { LanguageProvider } from "./context/LanguageContext";
import { TutorialProvider } from "./context/TutorialContext";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <CookieConsentProvider>
        <LanguageProvider>
          <AuthProvider>
            <TutorialProvider>
              <App />
            </TutorialProvider>
          </AuthProvider>
        </LanguageProvider>
      </CookieConsentProvider>
    </BrowserRouter>
  </StrictMode>,
);
