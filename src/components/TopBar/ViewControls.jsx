// View mode buttons and admin toggles.
import { Sparkle, CircleQuestionMark, User } from "lucide-react";

export function ViewControls({
  adminMode,
  onToggleAdmin,
  editingLocked,
  onOpenHelp,
  onOpenAccount,
}) {
  const adminActive = adminMode && !editingLocked;

  return (
    <div className="view-controls-column">
      <button
        className={`view-control-btn admin-btn ${adminActive ? "active" : ""}`}
        onClick={() => !editingLocked && onToggleAdmin?.(!adminMode)}
        disabled={editingLocked}
        title="Admin-Modus: freies Bauen, Region-Tools, Ressourcenbearbeitung"
        aria-label="Admin"
      >
        <Sparkle size={18} />
      </button>
      <button
        className="view-control-btn help-btn"
        onClick={onOpenHelp}
        title="Hilfe"
        aria-label="Hilfe"
      >
        <CircleQuestionMark size={18} />
      </button>
      <button
        className="view-control-btn profile-btn"
        onClick={onOpenAccount}
        title="Profil"
        aria-label="Profil"
      >
        <User size={18} />
      </button>
    </div>
  );
}
