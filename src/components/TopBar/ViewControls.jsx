// View mode buttons and admin toggles.
import { Sparkle, CircleQuestionMark, User } from "lucide-react";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";

export function ViewControls({
  adminMode,
  onToggleAdmin,
  editingLocked,
  onOpenHelp,
  onOpenAccount,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const adminActive = adminMode && !editingLocked;

  return (
    <div className="view-controls-column">
      <button
        className={`view-control-btn admin-btn ${adminActive ? "active" : ""}`}
        onClick={() => !editingLocked && onToggleAdmin?.(!adminMode)}
        disabled={editingLocked}
        title={t("btnAdminTitle")}
        aria-label={t("btnAdminLabel")}
      >
        <Sparkle size={18} />
      </button>
      <button
        className="view-control-btn help-btn"
        onClick={onOpenHelp}
        title={t("btnHelpTitle")}
        aria-label={t("btnHelpLabel")}
      >
        <CircleQuestionMark size={18} />
      </button>
      <button
        className="view-control-btn profile-btn"
        onClick={onOpenAccount}
        title={t("btnProfileTitle")}
        aria-label={t("btnProfileLabel")}
      >
        <User size={18} />
      </button>
    </div>
  );
}

