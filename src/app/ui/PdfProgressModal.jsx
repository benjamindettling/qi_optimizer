// Progress modal shown while building a PDF export.
import "./PdfProgressModal.css";
export function PdfProgressModal({ progress }) {
  if (!progress) return null;
  return (
    <div className="modal pdf-progress-modal">
      <div className="modal-card">
        <h3 className="modal-title">PDF wird erstellt...</h3>
        <div className="pdf-progress-bar">
          {Array.from({ length: progress.total }).map((_, idx) => {
            const filled = idx < progress.current;
            return (
              <span
                key={idx}
                className={`pdf-progress-block ${filled ? "filled" : ""}`}
              />
            );
          })}
        </div>
        <div className="pdf-progress-text">
          {progress.current} / {progress.total}
        </div>
      </div>
    </div>
  );
}
