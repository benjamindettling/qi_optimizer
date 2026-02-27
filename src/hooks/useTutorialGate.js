// Zone-specific disabling has been retired in favor of overlay-only guidance.
// Keep this hook for backwards compatibility with existing component wiring.
export function useTutorialGate() {
  return false;
}
