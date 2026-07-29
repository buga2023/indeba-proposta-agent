// CNPJ: máscara e validação de dígitos verificadores.
//
// O campo aceitava qualquer coisa ("abc123xyz!@#" entrava inteiro e ia parar na capa do
// PDF do cliente). CNPJ é opcional no contrato (ClienteSnapshot.cnpj é nullable), então
// a regra é: se estiver vazio, tudo bem; se estiver preenchido, tem que ser um CNPJ real.

/** Só os dígitos, no máximo 14. */
export const soDigitos = (valor: string) => valor.replace(/\D/g, "").slice(0, 14);

/**
 * Formata progressivamente enquanto se digita: 12 → "12", 123456 → "12.345.6",
 * completo → "12.345.678/0001-95". Não força tamanho — quem valida é `cnpjValido`.
 */
export function mascaraCnpj(valor: string): string {
  const d = soDigitos(valor);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

// Dígito verificador: soma ponderada dos dígitos, módulo 11; resto < 2 vira 0.
function dv(base: string, pesoInicial: number): number {
  let peso = pesoInicial;
  let soma = 0;
  for (const c of base) {
    soma += Number(c) * peso;
    peso = peso === 2 ? 9 : peso - 1;
  }
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** true só para CNPJ com 14 dígitos e os dois DVs corretos. */
export function cnpjValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 14) return false;
  // 00000000000000, 11111111111111… passam no módulo 11 mas não existem.
  if (/^(\d)\1{13}$/.test(d)) return false;
  return dv(d.slice(0, 12), 5) === Number(d[12]) && dv(d.slice(0, 13), 6) === Number(d[13]);
}

/** Mensagem de erro pro campo, ou null quando está vazio (opcional) ou válido. */
export function erroCnpj(valor: string): string | null {
  const d = soDigitos(valor);
  if (!d.length) return null; // campo opcional
  if (d.length < 14) return `CNPJ incompleto — ${d.length} de 14 dígitos.`;
  return cnpjValido(d) ? null : "CNPJ inválido — confira os dígitos.";
}
