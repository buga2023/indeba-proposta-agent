import { z } from "zod";
import { prisma } from "@/lib/db";

// Catálogo compartilhado do Gerador POP (public/gerador-pop/index.html). O HTML veio pronto
// com o armazenamento no navegador de cada usuário; aqui ele passa a ser um só para o time
// (decisão do Gustavo, 27/10/2026). O contrato espelha o `strip()` do HTML: um documento por
// produto com ordem `o`, os campos de texto, a cor e 6 ícones {k = nome no catálogo, t = rótulo}.

// id gerado no navegador (uid() ou os ids fixos dos produtos de exemplo, como "sol-plus").
export const POP_ID = z.string().regex(/^[A-Za-z0-9-]{1,64}$/);

const texto = (max: number) => z.string().max(max).default("");
const HEX = /^#[0-9a-fA-F]{6}$/;

const Icone = z.object({ k: z.string().max(40), t: z.string().max(60) });

export const PopProduto = z.object({
  o: z.number().finite(),
  nome: texto(120),
  cod: texto(40),
  seg: texto(80),
  sub: texto(160),
  serve: texto(1000),
  onde: texto(1000),
  dil: texto(200),
  modo: texto(1000),
  epi: texto(200),
  obs: texto(1000),
  cor: z.string().regex(HEX),
  i: z
    .array(Icone)
    .max(6)
    .transform((a) => [...a, ...Array.from({ length: 6 - a.length }, () => ({ k: "", t: "" }))]),
});
export type PopProduto = z.infer<typeof PopProduto>;

export const PopPaleta = z.object({
  cores: z.array(z.string().regex(HEX).transform((c) => c.toUpperCase())).max(40),
});

const CHAVE_PALETA = "popPaleta";

export async function listarPop(): Promise<{ produtos: (PopProduto & { id: string })[]; paleta: string[] }> {
  const [linhas, cfg] = await Promise.all([
    prisma.popProduto.findMany({ orderBy: { ordem: "asc" } }),
    prisma.config.findUnique({ where: { chave: CHAVE_PALETA } }),
  ]);
  // Linha que não passa no contrato (editada à mão no banco) é pulada, não derruba a tela.
  const produtos = linhas.flatMap((l) => {
    const p = PopProduto.safeParse(JSON.parse(l.dados));
    return p.success ? [{ id: l.id, ...p.data }] : [];
  });
  const paleta = cfg ? (PopPaleta.safeParse({ cores: JSON.parse(cfg.valor) }).data?.cores ?? []) : [];
  return { produtos, paleta };
}

export async function salvarPopProduto(id: string, p: PopProduto, autor: string): Promise<void> {
  const dados = JSON.stringify(p);
  await prisma.popProduto.upsert({
    where: { id },
    update: { ordem: p.o, dados, autor },
    create: { id, ordem: p.o, dados, autor },
  });
}

// deleteMany: excluir o que já não existe (dois usuários apagando o mesmo) não é erro.
export async function excluirPopProduto(id: string): Promise<void> {
  await prisma.popProduto.deleteMany({ where: { id } });
}

export async function salvarPopPaleta(cores: string[]): Promise<void> {
  const valor = JSON.stringify(cores);
  await prisma.config.upsert({ where: { chave: CHAVE_PALETA }, update: { valor }, create: { chave: CHAVE_PALETA, valor } });
}
