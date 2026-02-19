import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./auth/AuthProvider";
import { CookieConsentProvider } from "./components/CookieConsent";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <CookieConsentProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </CookieConsentProvider>
    </BrowserRouter>
  </StrictMode>,
);
