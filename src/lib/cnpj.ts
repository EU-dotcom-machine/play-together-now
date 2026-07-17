// Validação e consulta de CNPJ. Consulta a BrasilAPI (gratuita, pública, com
// CORS) para confirmar que o CNPJ está ATIVO e auto-preencher dados do espaço.

export function onlyDigits(s: string): string {
  return (s || "").replace(/\D/g, "");
}

export function formatCnpj(s: string): string {
  const c = onlyDigits(s).slice(0, 14);
  return c
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

// Validação dos dígitos verificadores.
export function isValidCnpj(raw: string): boolean {
  const c = onlyDigits(raw);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const calc = (base: string): number => {
    let sum = 0;
    let pos = base.length - 7;
    for (let i = 0; i < base.length; i++) {
      sum += Number(base[i]) * pos--;
      if (pos < 2) pos = 9;
    }
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const d1 = calc(c.slice(0, 12));
  const d2 = calc(c.slice(0, 12) + d1);
  return c.slice(12) === `${d1}${d2}`;
}

export type CnpjInfo = {
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_situacao_cadastral?: string; // ex.: "ATIVA"
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  ddd_telefone_1?: string;
};

export function isActive(info: CnpjInfo): boolean {
  return (info.descricao_situacao_cadastral ?? "").toUpperCase().includes("ATIVA");
}

// Nome sugerido para o espaço (nome fantasia > razão social).
export function suggestedName(info: CnpjInfo): string {
  return (info.nome_fantasia || info.razao_social || "").trim();
}

// Endereço oficial do CNPJ, montado a partir dos campos.
export function cnpjAddress(info: CnpjInfo): string {
  const rua = [info.logradouro, info.numero].filter(Boolean).join(", ");
  return [rua, info.bairro, info.municipio, info.uf].filter(Boolean).join(" - ");
}

// Consulta BrasilAPI. Retorna null em erro/404 (CNPJ inexistente).
export async function lookupCnpj(raw: string): Promise<CnpjInfo | null> {
  const c = onlyDigits(raw);
  if (c.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${c}`);
    if (!r.ok) return null;
    return (await r.json()) as CnpjInfo;
  } catch (err) {
    console.error("[cnpj] lookup failed:", err);
    return null;
  }
}
