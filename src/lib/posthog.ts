let posthogInstance: ReturnType<typeof import("posthog-js").default["init"]> | null = null;
let initPromise: Promise<ReturnType<typeof import("posthog-js").default["init"]> | null> | null = null;

export async function getPosthog(): Promise<ReturnType<typeof import("posthog-js").default["init"]> | null> {
  if (typeof window === "undefined") return null;
  if (posthogInstance) return posthogInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const phModule = await import("posthog-js");
    const posthog = phModule.default;
    const key = import.meta.env.VITE_POSTHOG_KEY;
    if (key) {
      posthogInstance = posthog.init(key, {
        api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com",
        capture_pageview: false,
        capture_pageleave: false,
      });
    }
    return posthogInstance;
  })();

  return initPromise;
}

export async function trackEvent(
  event: string,
  properties?: Record<string, unknown>
) {
  const ph = await getPosthog();
  if (ph) ph.capture(event, properties);
}
