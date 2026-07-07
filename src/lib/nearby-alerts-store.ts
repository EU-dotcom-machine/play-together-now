// Tiny external store for the "unseen nearby games" counter shown as a badge
// on the notifications bell. Persisted in localStorage so the badge survives
// reloads until the user opens the bell.

const KEY = "nearby-alerts:unseen";
type Listener = () => void;
const listeners = new Set<Listener>();

function readCount(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(KEY);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function writeCount(n: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, String(Math.max(0, n)));
  listeners.forEach((l) => l());
}

export const nearbyAlertsStore = {
  subscribe(l: Listener) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot: readCount,
  getServerSnapshot: () => 0,
  increment() {
    writeCount(readCount() + 1);
  },
  reset() {
    writeCount(0);
  },
};
