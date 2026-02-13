// Shared stack for resources, goods, or unit counts in the top bar.
import { formatNumber } from "../../utils/formatNumber";

export function ResourceStack({
  items,
  adminEnabled,
  className = "",
  children,
}) {
  const stackClass = ["topbar-stack", className].filter(Boolean).join(" ");

  return (
    <div className={stackClass}>
      {items.map((item) =>
        adminEnabled && item.onEdit ? (
          <button
            key={item.key}
            className="resource-button"
            title={item.title || item.label}
            onClick={item.onEdit}
          >
            <img src={item.icon} alt={item.label} />
            <span className={item.valueClass}>
              {formatNumber(item.value ?? 0)}
            </span>
          </button>
        ) : (
          <div
            key={item.key}
            className="resource-line"
            title={item.title || item.label}
          >
            <img src={item.icon} alt={item.label} />
            <span className={item.valueClass}>
              {formatNumber(item.value ?? 0)}
            </span>
          </div>
        ),
      )}
      {children}
    </div>
  );
}
