import { useState } from "react";
import { Edit2, Share2, Trash2, Check, X } from "lucide-react";
import { QiInput } from "./QiInput";
import { SaveStatsDisplay } from "./SaveStatsDisplay";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import "./SavefileCard.css";

function formatDate(ts) {
  if (!ts) return "-";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatTime(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Unified savefile card used in Load menu, Online Library, and Profile views.
 *
 * @param {object}  props
 * @param {string}  props.title               — Save name
 * @param {boolean} props.isOwned             — true = show rename/export/delete; false = show author + date
 * @param {boolean} [props.impossible]        — red "impossible" styling
 * @param {object}  [props.stats]             — { minimum, final } for SaveStatsDisplay
 * @param {string}  [props.ownerUsername]      — Author name (foreign cards)
 * @param {object}  [props.timestamp]          — Firestore timestamp or Date (foreign cards)
 * @param {function} [props.onLoad]            — Called when the card body is clicked
 * @param {function} [props.onRename]          — (newName) => void
 * @param {function} [props.onExport]          — () => void
 * @param {function} [props.onDelete]          — () => void
 * @param {function} [props.onProfileClick]    — (uid, username) => void (foreign cards)
 * @param {string}  [props.ownerUid]           — Author uid (foreign cards)
 * @param {boolean} [props.busy]               — Card currently processing an action
 * @param {number}  [props.outsideQaTotal]     — Outside QA to add to totalQaSetup for display
 */
export function SavefileCard({
  title,
  isOwned = false,
  impossible = false,
  stats,
  ownerUsername,
  timestamp,
  onLoad,
  onRename,
  onExport,
  onDelete,
  onProfileClick,
  ownerUid,
  busy = false,
}) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;

  const [editing, setEditing] = useState(false);
  const [editingName, setEditingName] = useState("");

  const handleStartEdit = (e) => {
    e.stopPropagation();
    setEditing(true);
    setEditingName(title);
  };

  const handleConfirmRename = (e) => {
    e?.stopPropagation();
    const newName = editingName.trim();
    if (newName && newName !== title) {
      onRename?.(newName);
    }
    setEditing(false);
    setEditingName("");
  };

  const handleCancelEdit = (e) => {
    e?.stopPropagation();
    setEditing(false);
    setEditingName("");
  };

  const handleCardClick = (e) => {
    const target = e.target;
    if (!(target instanceof Element)) return;
    if (target.closest("button, input, textarea, select, a, label")) return;
    onLoad?.();
  };

  const minimum = stats?.minimum ?? {};
  const finalStats = stats?.final ?? {};

  return (
    <div
      className={`savefile-card${impossible ? " impossible" : ""}`}
      onClick={handleCardClick}
    >
      <div className="savefile-card-top">
        {editing ? (
          <div
            className="savefile-card-edit-container"
            onClick={(e) => e.stopPropagation()}
          >
            <QiInput
              mode="text"
              fullWidth
              className="savefile-card-edit-input"
              value={editingName}
              onChange={(v) => setEditingName(v)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmRename();
                else if (e.key === "Escape") handleCancelEdit();
              }}
              autoFocus
            />
            <button
              className="savefile-card-edit-confirm"
              onClick={handleConfirmRename}
              title={t("loadSavesBtnConfirm")}
            >
              <Check size={16} />
            </button>
            <button
              className="savefile-card-edit-cancel"
              onClick={handleCancelEdit}
              title={t("loadSavesBtnCancel")}
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <span
              className={`savefile-card-title${impossible ? " impossible" : ""}`}
            >
              {title}
            </span>
            <div className="savefile-card-right">
              {isOwned ? (
                <div className="savefile-card-actions">
                  <button
                    className="load-saves-action-btn edit-btn"
                    onClick={handleStartEdit}
                    disabled={busy}
                    title={t("loadSavesBtnRename")}
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="load-saves-action-btn export-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onExport?.();
                    }}
                    disabled={busy}
                    title={t("loadSavesBtnExport")}
                  >
                    <Share2 size={16} />
                  </button>
                  <button
                    className="load-saves-action-btn delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete?.();
                    }}
                    disabled={busy}
                    title={t("loadSavesBtnDelete")}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ) : (
                <div className="savefile-card-author">
                  {ownerUsername && (
                    <strong
                      className="savefile-card-username-link"
                      onClick={(e) => {
                        e.stopPropagation();
                        onProfileClick?.(ownerUid, ownerUsername);
                      }}
                    >
                      {ownerUsername}
                    </strong>
                  )}
                  {timestamp && (
                    <span className="savefile-card-date">
                      {formatTime(timestamp)} {formatDate(timestamp)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
      <SaveStatsDisplay minimum={minimum} final={finalStats} />
    </div>
  );
}
