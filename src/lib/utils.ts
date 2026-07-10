import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getUserLocale(): string {
  if (typeof navigator === "undefined") return "pt-BR";
  return navigator.language ?? "pt-BR";
}

export function formatDateDisplay(
  date: Date | string | null | undefined,
  options: Intl.DateTimeFormatOptions = {}
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(getUserLocale(), options).format(d);
}
