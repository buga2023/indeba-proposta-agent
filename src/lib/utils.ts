// Concatena classes condicionais (versão mínima de clsx — sem deps).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
