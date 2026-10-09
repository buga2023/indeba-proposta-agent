// Identidade da EMPRESA que opera o sistema — hoje a Indeba Express. Primeiro passo para o
// produto Noxis (revisão de 08/10/2026, item #2): os dados abaixo estavam chumbados em
// cinco templates de PDF e nos textos padrão da proposta. Concentrados aqui, trocar de
// distribuidora passa a ser trocar UM objeto (e, no próximo passo, lê-lo do banco por
// empresa). Nenhum valor mudou em relação ao que saía no papel.
export type Empresa = {
  nomeFantasia: string;
  razaoSocial: string;
  cnpj: string;
  inscricaoEstadual: string;
  /** Logradouro completo, uma linha, sem cidade. */
  endereco: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  telefone: string;
  emailGerencia: string;
  /** Área de entrega citada nas condições comerciais padrão. */
  regiaoEntrega: string;
  consultorPadrao: { nome: string; telefone: string };
};

export const EMPRESA: Empresa = {
  nomeFantasia: "Indeba Express",
  razaoSocial: "IES Equipamentos, Soluções e Produtos de Limpeza Ltda",
  cnpj: "13.313.568/0001-04",
  inscricaoEstadual: "150336336",
  endereco: "Rua Cosme de Farias, 05 — Galpão 01",
  bairro: "Boca do Rio",
  cidade: "Salvador",
  uf: "BA",
  cep: "41710-010",
  telefone: "(71) 3369-2306",
  emailGerencia: "gerencia@indebaexpress.com.br",
  regiaoEntrega: "na cidade de Salvador e região metropolitana",
  consultorPadrao: { nome: "Matheus Resende", telefone: "(71) 99196-2650" },
};

/** "Rua …, Bairro, Cidade — UF · CEP 00000-000" — rodapé/assinatura dos PDFs. */
export function enderecoCompleto(e: Empresa = EMPRESA): string {
  return `${e.endereco}, ${e.bairro}, ${e.cidade} — ${e.uf} · CEP ${e.cep}`;
}
