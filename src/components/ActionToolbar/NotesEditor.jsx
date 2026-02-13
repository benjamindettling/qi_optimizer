// Notes editor with auto-resize and inline formatting mirror.
import { useEffect, useMemo, useRef } from "react";
import { formatNotesHtml } from "./notesFormatting";

export function NotesEditor({ notes, onChangeNotes }) {
  const formattedNotes = useMemo(() => formatNotesHtml(notes), [notes]);
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
    <div className="notes-card">
      <label className="notes-label" htmlFor="city-notes">
        Notizen
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
          placeholder="Fuege Notizen hinzu"
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
