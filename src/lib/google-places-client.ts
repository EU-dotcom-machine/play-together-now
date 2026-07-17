// Cliente de Google Places reutilizável (extraído do fluxo de criação de jogo,
// comportamento idêntico). Usado no cadastro de espaços e onde precisar de
// autocomplete de endereço + coordenadas.
import { getGooglePlacesKey } from "@/lib/google-places.functions";

export type Coords = { lat: number; lng: number };
export type PlaceSuggestion = { display_name: string; place_id: string };

let cachedKey: string | null = null;
async function fetchKey(): Promise<string | null> {
  if (cachedKey) return cachedKey;
  try {
    const { key } = await getGooglePlacesKey();
    cachedKey = key;
    return key;
  } catch (err) {
    console.error("[places] failed to fetch key:", err);
    return null;
  }
}

let googleMapsPromise: Promise<any> | null = null;
function waitForPlaces(timeoutMs = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const iv = setInterval(() => {
      const g = (window as any).google;
      if (g?.maps?.places?.AutocompleteService && g?.maps?.places?.PlacesService) {
        clearInterval(iv);
        resolve(g);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        clearInterval(iv);
        reject(new Error("google.maps.places unavailable (timeout)"));
      }
    }, 100);
  });
}

function loadGoogleMaps(): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  const w = window as any;
  if (w.google?.maps?.places?.AutocompleteService) return Promise.resolve(w.google);
  if (googleMapsPromise) return googleMapsPromise;
  googleMapsPromise = (async () => {
    const key = await fetchKey();
    if (!key) throw new Error("missing key");
    return new Promise<any>((resolve, reject) => {
      const existing = document.querySelector<HTMLScriptElement>("script[data-google-maps-loader]");
      if (!existing) {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&language=pt-BR`;
        script.async = true;
        script.defer = true;
        script.dataset.googleMapsLoader = "true";
        script.addEventListener("error", () => {
          googleMapsPromise = null;
          reject(new Error("script load error"));
        });
        document.head.appendChild(script);
      }
      waitForPlaces().then(resolve).catch((err) => {
        googleMapsPromise = null;
        reject(err);
      });
    });
  })();
  return googleMapsPromise;
}

let services: { autocomplete: any; details: any; sessionToken: any } | null = null;
async function ensureServices(): Promise<typeof services> {
  if (services) return services;
  try {
    await loadGoogleMaps();
    const g = (window as any).google;
    const dummy = document.createElement("div");
    services = {
      autocomplete: new g.maps.places.AutocompleteService(),
      details: new g.maps.places.PlacesService(dummy),
      sessionToken: new g.maps.places.AutocompleteSessionToken(),
    };
    return services;
  } catch (err) {
    console.error("[places] ensureServices failed:", err);
    return null;
  }
}

export async function hasGooglePlaces(): Promise<boolean> {
  return !!(await fetchKey());
}

export async function placesAutocomplete(q: string, limit = 5): Promise<PlaceSuggestion[]> {
  if (!(await fetchKey())) return [];
  const svc = await ensureServices();
  if (!svc) return [];
  const request: any = {
    input: q,
    componentRestrictions: { country: "br" },
    language: "pt-BR",
    sessionToken: svc.sessionToken,
  };
  return new Promise<PlaceSuggestion[]>((resolve) => {
    try {
      svc.autocomplete.getPlacePredictions(request, (predictions: any[] | null) => {
        if (!predictions || predictions.length === 0) return resolve([]);
        resolve(
          predictions.slice(0, limit).map((p) => ({
            display_name: p.description as string,
            place_id: p.place_id as string,
          })),
        );
      });
    } catch (err) {
      console.error("[placesAutocomplete] exception:", err);
      resolve([]);
    }
  });
}

// Retorna coordenadas + endereço formatado de um place_id.
export async function placeDetails(
  placeId: string,
): Promise<(Coords & { address: string | null }) | null> {
  if (!(await fetchKey())) return null;
  const svc = await ensureServices();
  if (!svc || !placeId) return null;
  return new Promise((resolve) => {
    try {
      svc.details.getDetails(
        { placeId, fields: ["geometry", "formatted_address"] },
        (place: any, status: string) => {
          if (status !== "OK" || !place?.geometry?.location) return resolve(null);
          const loc = place.geometry.location;
          const lat = typeof loc.lat === "function" ? loc.lat() : loc.lat;
          const lng = typeof loc.lng === "function" ? loc.lng() : loc.lng;
          if (typeof lat === "number" && typeof lng === "number" && isFinite(lat) && isFinite(lng)) {
            const g = (window as any).google;
            if (g?.maps?.places?.AutocompleteSessionToken) {
              svc.sessionToken = new g.maps.places.AutocompleteSessionToken();
            }
            return resolve({ lat, lng, address: place.formatted_address ?? null });
          }
          resolve(null);
        },
      );
    } catch (err) {
      console.error("[placeDetails] exception:", err);
      resolve(null);
    }
  });
}
