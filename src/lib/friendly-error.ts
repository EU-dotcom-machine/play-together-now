// Traduz erros técnicos (Supabase / Postgres / rede / auth) em mensagens
// amigáveis em português. Objetivo: nunca mostrar mensagem técnica em inglês
// direto ao usuário (ex.: "new row violates row-level security policy").
//
// Uso:
//   import { friendlyError } from "@/lib/friendly-error";
//   if (error) return toast.error(friendlyError(error));

type MaybeError = {
  message?: string;
  code?: string;
} | null;

const GENERIC = "Algo deu errado. Tente novamente.";

export function friendlyError(error: unknown, fallback: string = GENERIC): string {
  if (!error) return fallback;

  const err: MaybeError =
    typeof error === "object" ? (error as MaybeError) : { message: String(error) };
  const code = err?.code ?? "";
  const message = (err?.message ?? "").toLowerCase();

  // Rede / conexão
  if (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed")
  ) {
    return "Sem conexão com o servidor. Verifique sua internet e tente novamente.";
  }

  // Códigos Postgres comuns
  switch (code) {
    case "23505": // unique_violation
      return "Isso já existe — ação duplicada não é permitida.";
    case "23503": // foreign_key_violation
      return "Registro relacionado não encontrado.";
    case "23514": // check_violation
      return "Dados inválidos para esta operação.";
    case "42501": // insufficient_privilege / RLS
      return "Você não tem permissão para fazer isso.";
  }

  // RLS por mensagem (quando o código não vem)
  if (message.includes("row-level security")) {
    return "Você não tem permissão para fazer isso.";
  }

  // Autenticação (Supabase Auth)
  if (message.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
  if (message.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
  if (message.includes("user already registered")) return "Este e-mail já está cadastrado.";
  if (message.includes("password should be at least")) return "A senha é muito curta.";
  if (message.includes("rate limit")) return "Muitas tentativas. Aguarde um momento e tente de novo.";

  return fallback;
}
