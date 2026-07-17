import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ArrowLeft, Loader2, BadgeCheck, MapPin, Search } from "lucide-react";
import { friendlyError } from "@/lib/friendly-error";
import {
  formatCnpj,
  isValidCnpj,
  lookupCnpj,
  isActive,
  suggestedName,
  cnpjAddress,
  onlyDigits,
  type CnpjInfo,
} from "@/lib/cnpj";
import { placesAutocomplete, placeDetails, type PlaceSuggestion, type Coords } from "@/lib/google-places-client";

export const Route = createFileRoute("/_app/venues/new")({
  ssr: false,
  head: () => ({ meta: [{ title: "Cadastrar espaço — Esportes Unidos" }] }),
  component: NewVenue,
});

function NewVenue() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [cnpj, setCnpj] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [info, setInfo] = useState<CnpjInfo | null>(null);
  const [legalName, setLegalName] = useState("");
  const [name, setName] = useState("");

  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [coords, setCoords] = useState<Coords | null>(null);
  const [confirmedAddress, setConfirmedAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const justPicked = useRef(false);

  async function verifyCnpj() {
    if (!isValidCnpj(cnpj)) {
      toast.error("CNPJ inválido. Confira os números.");
      return;
    }
    setVerifying(true);
    setInfo(null);
    const data = await lookupCnpj(cnpj);
    setVerifying(false);
    if (!data) {
      toast.error("Não encontramos esse CNPJ. Verifique e tente de novo.");
      return;
    }
    if (!isActive(data)) {
      toast.error("Este CNPJ não está ativo na Receita.");
      return;
    }
    setInfo(data);
    setLegalName(data.razao_social ?? "");
    setName(suggestedName(data));
    const addr = cnpjAddress(data);
    setAddressQuery(addr);
    setConfirmedAddress("");
    setCoords(null);
    justPicked.current = true; // evita autocomplete disparar imediatamente
    toast.success("CNPJ verificado! Confirme a localização abaixo.");
  }

  // Autocomplete de endereço (debounce) para obter coordenadas.
  useEffect(() => {
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    const q = addressQuery.trim();
    if (q.length < 4) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      const res = await placesAutocomplete(q, 5);
      if (!cancelled) setSuggestions(res);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [addressQuery]);

  async function pickSuggestion(s: PlaceSuggestion) {
    justPicked.current = true;
    setAddressQuery(s.display_name);
    setSuggestions([]);
    const d = await placeDetails(s.place_id);
    if (!d) {
      toast.error("Não consegui obter a localização desse endereço.");
      return;
    }
    setCoords({ lat: d.lat, lng: d.lng });
    setConfirmedAddress(d.address ?? s.display_name);
  }

  const canSubmit = !!info && !!name.trim() && !!coords && !submitting;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!coords) {
      toast.error("Confirme a localização escolhendo um endereço na lista.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("venues").insert({
      name: name.trim(),
      address: confirmedAddress || addressQuery,
      latitude: coords.lat,
      longitude: coords.lng,
      cnpj: onlyDigits(cnpj),
      legal_name: legalName || null,
      registration_status: "pending",
      created_by: user.id,
    } as any);
    setSubmitting(false);
    if (error) return toast.error(friendlyError(error));
    toast.success("Espaço enviado para aprovação! Avisaremos quando for aprovado.");
    navigate({ to: "/discover", search: { tab: "estabelecimentos" as const, venueId: undefined } });
  }

  if (!user) return null;

  return (
    <main className="px-5 pt-8 pb-24 max-w-md mx-auto bg-background min-h-screen">
      <Link to="/discover" search={{ tab: "estabelecimentos" as const, venueId: undefined }} className="inline-flex items-center gap-1 text-sm text-muted-foreground">
        <ArrowLeft className="size-4" /> Voltar
      </Link>
      <h1 className="mt-3 text-3xl font-extrabold uppercase leading-none text-white">
        Cadastrar espaço<span className="text-pop">.</span>
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Espaços são verificados por CNPJ. Após o envio, aprovamos e seu espaço ganha selo verificado.
      </p>

      <form onSubmit={submit} className="mt-6 grid gap-5">
        {/* CNPJ */}
        <div>
          <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">CNPJ</label>
          <div className="mt-1 flex gap-2">
            <input
              value={cnpj}
              onChange={(e) => setCnpj(formatCnpj(e.target.value))}
              inputMode="numeric"
              placeholder="00.000.000/0000-00"
              className="input-brutal flex-1"
            />
            <button
              type="button"
              onClick={verifyCnpj}
              disabled={verifying || onlyDigits(cnpj).length !== 14}
              className="px-4 rounded-full bg-pop text-primary-foreground font-bold text-sm uppercase disabled:opacity-50 flex items-center gap-2"
            >
              {verifying ? <Loader2 className="size-4 animate-spin" /> : "Verificar"}
            </button>
          </div>
        </div>

        {info && (
          <>
            <div className="brutal-card p-3 flex items-start gap-2">
              <BadgeCheck className="size-5 text-pop shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-bold text-ink">{info.razao_social}</p>
                <p className="text-muted-foreground">CNPJ ativo na Receita Federal</p>
              </div>
            </div>

            {/* Nome do espaço */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Nome do espaço</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Playball Pompéia"
                className="input-brutal mt-1"
              />
            </div>

            {/* Endereço / localização */}
            <div className="relative">
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Localização</label>
              <div className="mt-1 flex items-center gap-2 input-brutal">
                <Search className="size-4 text-muted-foreground shrink-0" />
                <input
                  value={addressQuery}
                  onChange={(e) => {
                    setAddressQuery(e.target.value);
                    setCoords(null);
                  }}
                  placeholder="Busque o endereço do espaço"
                  className="flex-1 bg-transparent outline-none text-sm"
                />
              </div>
              {suggestions.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 brutal-card-lg bg-surface p-1 grid gap-0.5 max-h-60 overflow-y-auto">
                  {suggestions.map((s) => (
                    <li key={s.place_id}>
                      <button
                        type="button"
                        onClick={() => pickSuggestion(s)}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-border text-ink"
                      >
                        {s.display_name}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {coords && (
                <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-pop font-bold">
                  <MapPin className="size-3.5" /> Localização confirmada
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full py-4 rounded-full bg-pop text-primary-foreground font-extrabold uppercase disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="size-4 animate-spin" />}
              Enviar para aprovação
            </button>
          </>
        )}
      </form>
    </main>
  );
}
