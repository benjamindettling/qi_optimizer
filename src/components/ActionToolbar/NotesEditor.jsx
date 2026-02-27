// Notes editor with auto-resize and inline formatting mirror.
import { useEffect, useMemo, useRef } from "react";
import { formatNotesHtml } from "./notesFormatting";
import { useLang } from "../../context/LanguageContext";
import { T } from "../../i18n/translations";
import { useTutorialGate } from "../../hooks/useTutorialGate";

export function NotesEditor({ notes, onChangeNotes }) {
  const { lang } = useLang();
  const t = (key) => T[key]?.[lang] ?? T[key]?.DE ?? key;
  const notesLocked = useTutorialGate("notes");

  const placeholder = t("notesPlaceholder");
  const formattedNotes = useMemo(
    () => formatNotesHtml(notes, placeholder),
    [notes, placeholder],
  );
  const notesRef = useRef(null);

  const resizeNotes = () => {
    const el = notesRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };

  useEffect(() => {
    resizeNotes();
  }, [notes]);

  return (
    <div className={`notes-card${notesLocked ? " tutorial-zone-locked" : ""}`}>
      <label className="notes-label" htmlFor="city-notes">
        {t("notesLabel")}
      </label>
      <div className="notes-autosize">
        <div
          className="notes-mirror"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: `${formattedNotes}\n` }}
        />
        <textarea
          id="city-notes"
          className="notes-input"
          placeholder={placeholder}
          value={notes}
          onChange={(e) => {
            onChangeNotes?.(e.target.value);
            resizeNotes();
          }}
          ref={notesRef}
          rows={3}
        />
      </div>
    </div>
  );
}

