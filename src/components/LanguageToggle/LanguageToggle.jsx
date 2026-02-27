import { useLang } from "../../context/LanguageContext";
import "./LanguageToggle.css";

export function LanguageToggle({ className = "" }) {
  const { lang, setLang } = useLang();
  const isDE = lang === "DE";
  const title = isDE ? "Switch to English" : "Auf Deutsch wechseln";

  return (
    <button
      className={`lang-toggle-btn ${className}`.trim()}
      onClick={() => setLang(isDE ? "EN" : "DE")}
      title={title}
      aria-label={title}
      type="button"
    >
      {isDE ? "🇩🇪" : "🇬🇧"}
    </button>
  );
}
