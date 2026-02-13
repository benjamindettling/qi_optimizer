// Tooltip shown after a long press on toolbar buttons.
import "./HoldTooltip.css";
export function HoldTooltip({ tooltip }) {
  if (!tooltip) return null;
  return (
    <div
      className="hold-tooltip"
      style={{
        left: tooltip.x + 12,
        top: tooltip.y + 12,
      }}
    >
      {tooltip.text}
    </div>
  );
}
