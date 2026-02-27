/**
 * Returns the display name of a building definition.
 * @param {object} def - building definition from libraryMap
 * @param {"DE"|"EN"} lang
 * @param {"name"|"short"} type
 */
export function getBuildingName(def, lang = "DE", type = "name") {
  if (!def) return "?";
  const langKey = lang === "EN" ? "EN" : "DE";
  if (type === "short") {
    return (
      def[`shortname_${langKey}`] ||
      def[`name_${langKey}`] ||
      def.shortname_DE ||
      def.name_DE ||
      "?"
    );
  }
  return def[`name_${langKey}`] || def.name_DE || "?";
}

export function getCurrentLang() {
  if (typeof window === "undefined") return "DE";
  try {
    return localStorage.getItem("qi_lang") === "EN" ? "EN" : "DE";
  } catch {
    return "DE";
  }
}
