import { createContext, useContext, useState } from "react";

const LanguageContext = createContext({ lang: "DE", setLang: () => {} });

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    try {
      return localStorage.getItem("qi_lang") || "DE";
    } catch {
      return "DE";
    }
  });

  const setLang = (nextLang) => {
    setLangState(nextLang);
    try {
      localStorage.setItem("qi_lang", nextLang);
    } catch {
      // no-op
    }
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}

/** Returns t[lang] or t["DE"] as fallback */
export function useT(t) {
  const { lang } = useLang();
  return t?.[lang] ?? t?.DE;
}
