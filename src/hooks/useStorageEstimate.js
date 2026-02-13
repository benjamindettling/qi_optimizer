import { useEffect, useState } from "react";

function formatBytes(bytes) {
  if (bytes == null) return "n/a";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;

  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }

  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function useStorageEstimate({ intervalMs = 50 } = {}) {
  const [estimate, setEstimate] = useState({
    supported: false,
    usage: null,
    quota: null,
    indexedDB: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        if (!navigator.storage?.estimate) {
          if (!cancelled) {
            setEstimate((prev) => ({ ...prev, supported: false }));
          }
          return;
        }

        const res = await navigator.storage.estimate();
        const indexedDB = res?.usageDetails?.indexedDB ?? null;

        if (!cancelled) {
          setEstimate({
            supported: true,
            usage: res?.usage ?? null,
            quota: res?.quota ?? null,
            indexedDB,
          });
        }
      } catch {
        if (!cancelled) {
          setEstimate((prev) => ({ ...prev, supported: false }));
        }
      }
    }

    refresh();
    const t = setInterval(refresh, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [intervalMs]);

  const percent =
    estimate.usage != null && estimate.quota != null && estimate.quota > 0
      ? (estimate.usage / estimate.quota) * 100
      : null;

  return {
    supported: estimate.supported,
    usage: estimate.usage,
    quota: estimate.quota,
    indexedDB: estimate.indexedDB,
    percent,
    formatBytes,
  };
}
